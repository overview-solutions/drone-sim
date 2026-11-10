"""OSM-seeded candidate support extraction from the actual, thinned OGRIP returns.
No classification identifies wires/towers in these tiles; results require review.
"""
import json,pathlib,numpy as np
root=pathlib.Path(__file__).resolve().parents[1];data=json.loads((root/'src/fleet/ray-king-data.json').read_text());a=np.array(data['points']);o=data['origin'];cos=np.cos(np.radians(o[1]));supports=[]
for i,q in enumerate(data['line']['coords']):
 x=(q[0]-o[0])*111320*cos;z=-(q[1]-o[1])*111320;r=np.hypot(a[:,0]-x,a[:,2]-z)
 ground=a[(r<60)&(a[:,3]==2),1]
 if len(ground)<5:continue
 base=float(np.median(ground));returns=a[(r<22)&(a[:,1]>base+25)&(a[:,1]<base+80)&(a[:,3]!=7)]
 if len(returns)<5:continue
 # Robust median of elevated returns near each OSM vertex, not uniform spacing.
 cx,cz=np.median(returns[:,[0,2]],axis=0);top=float(np.quantile(returns[:,1],.95))
 supports.append({'id':f'RK-T{i+1:02}','seedIndex':i,'position':[round(cx,2),round(base,2),round(cz,2)],'top':round(top,2),'evidenceReturns':len(returns),'groundReturns':len(ground),'status':'candidate','method':'OSM vertex seeded, 22 m elevated-return cluster; median XY, 95th percentile top; ground median within 60 m'})
spans=[]
for i,(s,t) in enumerate(zip(supports,supports[1:])):
 if t['seedIndex']!=s['seedIndex']+1:continue
 p=np.array(s['position']);q=np.array(t['position']);d=q[[0,2]]-p[[0,2]];length=np.linalg.norm(d);v=((a[:,0]-p[0])*d[0]+(a[:,2]-p[2])*d[1])/length**2
 lateral=np.abs((a[:,0]-p[0])*d[1]-(a[:,2]-p[2])*d[0])/length
 ground=p[1]+(q[1]-p[1])*v
 selected=(v>.08)&(v<.92)&(lateral<18)&(a[:,1]>ground+25)&(a[:,3]!=7)
 bins=[]
 for j in range(8):
  mask=selected&(v>=.08+j*.105)&(v<.08+(j+1)*.105)
  if np.count_nonzero(mask)>=3:bins.append([float(np.median(v[mask])),float(np.quantile(a[mask,1],.75)),int(np.count_nonzero(mask))])
 # Evidence envelope, not phase-resolved conductor or a mechanical sag solution.
 fit=np.polyfit([b[0] for b in bins],[b[1] for b in bins],2) if len(bins)>=5 else None
 points=[]
 if fit is not None:
  for u in np.linspace(.08,.92,25):points.append([round(p[0]+d[0]*u,2),round(float(np.polyval(fit,u)),2),round(p[2]+d[1]*u,2)])
 spans.append({'id':f'RK-SPAN-{i+1:02}','from':s['id'],'to':t['id'],'lengthMeters':round(length,2),'evidenceReturns':int(np.count_nonzero(selected)),'supportedBins':len(bins),'envelope':points,'status':'unverified candidate','phaseResolved':False})
out={'source':'OGRIP sampled historical returns + OSM vertex seeds','verticalOffsetMeters':data['verticalOffsetMeters'],'supports':supports,'spans':spans,'limitations':'Mixed 2006/2021 surveys; no tower/wire classes; candidates may include vegetation. Phase identity, attachment positions and conductor sag unverified.'}
(root/'src/fleet/ray-king-spans.json').write_text(json.dumps(out,indent=2));print(len(supports),'supports',len(spans),'spans',sum(bool(s['envelope']) for s in spans),'supported envelope fits')
