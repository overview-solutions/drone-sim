/** Along-span coverage cells. Samples never interpolate across skipped flight time. */
export class SpanCoverage {
 private cells=new Map<number,Set<number>>();
 private ends=new Map<number,number>();
 private finished=new Map<number,number>();
 clear(){this.cells.clear();this.finished.clear();this.ends.clear();}
 observe(index:number,along:number,length:number,lateral:number,seconds:number){
  if(length<=0||Math.abs(lateral)>60||along<0||along>length)return;
  const count=Math.max(1,Math.ceil(length/10));const cells=this.cells.get(index)??new Set<number>();
  for(let j=0;j<count;j++)if(Math.abs((j+.5)*length/count-along)<=10)cells.add(j);
  this.cells.set(index,cells);const ends=(this.ends.get(index)??0)|(along<=10?1:0)|(along>=length-10?2:0);this.ends.set(index,ends);if(ends===3&&cells.size===count&&!this.finished.has(index))this.finished.set(index,seconds);
 }
 complete(index:number,seconds:number){const at=this.finished.get(index);return at!==undefined&&seconds>=at+2;}
}
