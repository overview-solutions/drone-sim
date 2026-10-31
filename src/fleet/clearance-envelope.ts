/** Deliberately illustrative visualization rule, not MAD, MVCD or arc-flash distance. */
export function demoClearanceMeters(kv:number){return .75+Math.max(0,Math.min(765,Number.isFinite(kv)?kv:0))*.008;}
