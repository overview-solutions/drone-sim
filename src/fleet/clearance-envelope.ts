/** Deliberately illustrative visualization rule, not MAD, MVCD or arc-flash distance. */
export function demoClearanceMeters(kv:number){return .75+Math.max(0,Math.min(765,Number.isFinite(kv)?kv:0))*.008;}

/** Discrete scenario choices; not approved electrical clearance criteria. */
export const scenarioVoltages=[23,34.5,40,46,69,88,115,138,161,230,345,500,765] as const;
export function nearestVoltageIndex(kv:number){return scenarioVoltages.reduce((best,v,i)=>Math.abs(v-kv)<Math.abs(scenarioVoltages[best]-kv)?i:best,0);}
