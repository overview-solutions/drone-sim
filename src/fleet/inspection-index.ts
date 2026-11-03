/** A demonstration coverage score, not a defect-confidence or safety rating. */
export function inspectionIndex(requiredCaptured:boolean,extras:number){return Math.min(100,(requiredCaptured?80:0)+Math.min(2,extras)*10);}
export function extraCapturePriority(c:{requiredCaptured:boolean;extras:number;flagged:boolean;forward:number;angle:number;range:number;slack:number}){
 if(c.forward<=20||c.angle>35||c.range>1800||c.extras>=2)return -Infinity;
 const roundTripSeconds=c.angle/15*2+4+1.5+4+4;
 if(c.slack<roundTripSeconds)return -Infinity;
 return (100-inspectionIndex(c.requiredCaptured,c.extras))+(c.flagged?80:0)-c.angle*3-c.range/100;
}
