import {rayKingLoop} from './ray-king-loop';
import {createFlight} from './operations';
import {sortie,distance,type Airport,type PowerLine} from './model';
/** Local staging endpoints are fictional; the inspection centerline is OSM. */
export function rayKingFlight(line:PowerLine,index:number){
 const coords=line.coords;
 function base(end:number,neighbor:number,id:string):Airport{
  const a=coords[end],b=coords[neighbor],scale=.4/distance(a,b);
  return {id,name:'Simulated Ray–King staging strip',city:'Ray–King corridor',county:'',coord:[a[0]+(a[0]-b[0])*scale,a[1]+(a[1]-b[1])*scale],rural:false,runways:[{id:'SIM',lengthFt:2500,surface:'Hypothetical'}],certificated:false};
 }
 const flight=createFlight(sortie(base(0,1,'SIM-RK-N'),base(coords.length-1,coords.length-2,'SIM-RK-S'),line,30),index);
 flight.events.push('Ray–King 345 kV · OSM corridor with recorded OGRIP LiDAR (2006 / 2021).','Local launch and landing strips are hypothetical; trajectory is not terrain-validated.');
 const loop=rayKingLoop(coords);
 flight.route=loop.points;flight.length=loop.length;flight.loop=true;flight.laps=0;
 flight.sortie={...flight.sortie,points:loop.points,length:loop.length,inspectionStartKm:0,inspectionEndKm:loop.length,inspectionKm:loop.length};
 flight.events.push('Continuous simulated passes · 700 ft-radius endpoint turns · recorded LiDAR revealed as flown.');
 return flight;
}
