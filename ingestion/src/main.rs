use axum::{http::HeaderValue, routing::get, Json, Router};
use serde_json::{json, Value};
use std::{
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tokio::sync::RwLock;
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}
fn normalize(v: &Value) -> Vec<Value> {
    v["states"].as_array().into_iter().flatten().filter_map(|s|{
 let lon=s[5].as_f64()?;let lat=s[6].as_f64()?;let time=s[3].as_u64()?;
 if !(-180.0..=180.0).contains(&lon)||!(-90.0..=90.0).contains(&lat)||s[8]==true{return None}
 Some(json!({"id":s[0],"label":s[1].as_str().unwrap_or("Unknown").trim(),"kind":if s[17]==8 {"helicopter"} else {"aircraft"},"source":"OpenSky","observedAt":time,"longitude":lon,"latitude":lat,"altitudeM":s[7],"altitudeDatum":"barometric","heading":s[10],"speedMps":s[9]}))
 }).collect()
}
async fn file_feed(env: &str) -> Result<Value, String> {
    let path = std::env::var(env).map_err(|_| "Not configured".to_string())?;
    let bytes = tokio::fs::read(path)
        .await
        .map_err(|_| "File unavailable".to_string())?;
    if bytes.len() > 5_000_000 {
        return Err("File too large".into());
    }
    serde_json::from_slice(&bytes).map_err(|_| "Invalid JSON".into())
}
#[tokio::main]
async fn main() {
    let state = Arc::new(RwLock::new(
        json!({"tracks":[],"notices":[],"sources":[],"generatedAt":now()}),
    ));
    let writer = state.clone();
    tokio::spawn(async move {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .unwrap();
        let mut last_tracks = vec![];
        let mut next_poll = 0;
        let mut token = String::new();
        let mut token_expiry = 0;
        let mut status = "Not configured".to_string();
        loop {
            let t = now();
            if std::env::var("OPENSKY_ENABLED").as_deref() == Ok("1") && t >= next_poll {
                next_poll = t + 300;
                let credentials = std::env::var("OPENSKY_CLIENT_ID")
                    .ok()
                    .zip(std::env::var("OPENSKY_CLIENT_SECRET").ok());
                if let Some((id, secret)) = credentials {
                    if t >= token_expiry {
                        token.clear();
                        if let Ok(r)=client.post("https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token").form(&[("grant_type","client_credentials"),("client_id",&id),("client_secret",&secret)]).send().await {if r.status().is_success(){if let Ok(v)=r.json::<Value>().await {token=v["access_token"].as_str().unwrap_or("").into();token_expiry=t+v["expires_in"].as_u64().unwrap_or(1800).saturating_sub(30);}}}
                    }
                }
                let mut req=client.get("https://opensky-network.org/api/states/all?lamin=38.3&lomin=-84.9&lamax=42.0&lomax=-80.4&extended=1");
                if !token.is_empty() {
                    req = req.bearer_auth(&token);
                }
                match req.send().await {
                    Ok(r) if r.status().is_success() => match r.json::<Value>().await {
                        Ok(v) if v.get("states").is_some() => {
                            last_tracks = normalize(&v);
                            status = "Connected".into()
                        }
                        _ => status = "Invalid response; previous observations retained".into(),
                    },
                    Ok(r) => {
                        if r.status().as_u16() == 429 {
                            next_poll = t + r
                                .headers()
                                .get("X-Rate-Limit-Retry-After-Seconds")
                                .and_then(|h| h.to_str().ok())
                                .and_then(|s| s.parse::<u64>().ok())
                                .unwrap_or(3600)
                                .max(300);
                        }
                        if r.status().as_u16() == 401 {
                            token_expiry = 0;
                        }
                        status = format!(
                            "HTTP {}; previous observations retained",
                            r.status().as_u16()
                        );
                    }
                    Err(_) => status = "Unavailable; previous observations retained".into(),
                }
            }
            let mut tracks: Vec<Value> = last_tracks
                .iter()
                .filter(|v| t.saturating_sub(v["observedAt"].as_u64().unwrap_or(0)) < 600)
                .cloned()
                .collect();
            let mut sources = vec![json!({"name":"OpenSky","status":status})];
            for (env, name) in [("REMOTE_ID_FILE", "Remote ID receiver")] {
                match file_feed(env).await {
                    Ok(v) => {
                        let mut count = 0;
                        for item in v.as_array().into_iter().flatten() {
                            let lon = item["longitude"].as_f64();
                            let lat = item["latitude"].as_f64();
                            let age = item["observedAt"].as_u64();
                            if lon.is_some_and(|x| (-180.0..=180.0).contains(&x))
                                && lat.is_some_and(|x| (-90.0..=90.0).contains(&x))
                                && age.is_some_and(|x| x <= t + 5 && t.saturating_sub(x) < 120)
                            {
                                let mut item = item.clone();
                                item["kind"] = json!("remote-id");
                                item["source"] = json!(name);
                                tracks.push(item);
                                count += 1;
                            }
                        }
                        sources.push(json!({"name":name,"status":format!("Local receiver file · {count} recent observations")}));
                    }
                    Err(e) => sources.push(json!({"name":name,"status":e})),
                }
            }
            let notices = match file_feed("NOTICES_FILE").await {
                Ok(v) if v.is_array() => {
                    sources.push(json!({"name":"NOTAM / TFR import","status":"Local file; verify publication currency"}));
                    v
                }
                _ => {
                    sources.push(json!({"name":"NOTAM / TFR import","status":"Not configured or invalid file"}));
                    json!([])
                }
            };
            *writer.write().await = json!({"schemaVersion":1,"generatedAt":t,"tracks":tracks,"notices":notices,"sources":sources});
            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    });
    let app = Router::new().route(
        "/v1/airspace",
        get(move |request_headers: axum::http::HeaderMap| {
            let s = state.clone();
            async move {
                let origin = request_headers
                    .get("origin")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("");
                let allowed = origin.is_empty()
                    || origin == "null"
                    || origin
                        .strip_prefix("http://127.0.0.1:")
                        .is_some_and(|port| port.parse::<u16>().is_ok())
                    || origin
                        .strip_prefix("http://localhost:")
                        .is_some_and(|port| port.parse::<u16>().is_ok());
                if !allowed {
                    return (
                        axum::http::StatusCode::FORBIDDEN,
                        axum::http::HeaderMap::new(),
                        Json(json!({"error":"Origin not allowed"})),
                    );
                }
                let mut headers = axum::http::HeaderMap::new();
                headers.insert(
                    "access-control-allow-origin",
                    HeaderValue::from_str(if origin.is_empty() { "null" } else { origin }).unwrap(),
                );
                headers.insert("cache-control", HeaderValue::from_static("no-store"));
                (
                    axum::http::StatusCode::OK,
                    headers,
                    Json(s.read().await.clone()),
                )
            }
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8788")
        .await
        .unwrap();
    println!("Flightline airspace: http://127.0.0.1:8788/v1/airspace (read only)");
    axum::serve(listener, app).await.unwrap();
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preserves_position_time_and_rotorcraft() {
        let v = json!({"states":[["abc"," HELI ","US",100,200,-83,40,900,false,40,90,0,null,950,"1200",false,0,8]]});
        let a = normalize(&v);
        assert_eq!(a[0]["observedAt"], 100);
        assert_eq!(a[0]["kind"], "helicopter");
        assert_eq!(a[0]["label"], "HELI");
    }
    #[test]
    fn missing_positions_are_not_zero() {
        assert!(normalize(&json!({"states":[["a"]]})).is_empty());
    }
}
