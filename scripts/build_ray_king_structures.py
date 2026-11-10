"""Build reproducible, explicitly estimated tower frames from OSM + original LAS."""
import json,pathlib,sys,numpy as np
import tower_lidar_service as lidar
root=pathlib.Path(__file__).resolve().parents[1];folder=pathlib.Path(sys.argv[1]).resolve();out=[];features=[]
for i,s in enumerate(lidar.supports):
 lidar.jobs[s['id']]={'status':'processing'};lidar.process(i,folder);job=lidar.jobs[s['id']]
 p=np.array(s['position']);before=np.array(lidar.supports[max(0,i-1)]['position']);after=np.array(lidar.supports[min(len(lidar.supports)-1,i+1)]['position']);axis=after-p if i==0 else after-before;axis[1]=0;axis/=np.linalg.norm(axis);cross=np.array([-axis[2],0,axis[0]])
 h=s['top']-p[1];width=18.;depth=7.;method='OSM alignment + sampled LiDAR location/height; assumed tower proportions'
 if job['status']=='complete':
  pts=np.array(job['triangles']);high=pts[pts[:,1]>p[1]+h*.7]
  if len(high)>12:
   offsets=(high-p)@cross;width=float(np.clip(np.quantile(offsets,.95)-np.quantile(offsets,.05),12,36));method='OSM alignment + LiDAR location/height and upper envelope width; inferred lattice members'
 def point(x,y,z):return np.round(p+cross*x+axis*z+np.array([0,y,0]),3).tolist()
 edges=[]
 levels=[0,h*.25,h*.5,h*.72,h*.9]
 for k in range(len(levels)-1):
  y,y2=levels[k:k+2];w=depth/2*(1-.75*y/h);w2=depth/2*(1-.75*y2/h)
  for sign in [-1,1]:
   for side in [-1,1]:edges.append([point(sign*w,y,side*w),point(sign*w2,y2,side*w2)])
   edges.extend([[point(-w,y,sign*w),point(w2,y2,sign*w2)],[point(w,y,sign*w),point(-w2,y2,sign*w2)],[point(sign*w,y,-w),point(sign*w2,y2,w2)],[point(sign*w,y,w),point(sign*w2,y2,-w2)]])
 arm=h*.82
 edges.extend([[point(-width/2,arm,0),point(width/2,arm,0)],[point(-width/2,arm,0),point(0,h*.65,0)],[point(width/2,arm,0),point(0,h*.65,0)],[point(0,h*.9,0),point(0,h,0)]])
 props={'id':s['id'],'assetGroup':'Transmission support','status':'Estimated; unverified','method':method,'sourceFiles':job.get('sourceFiles',[]),'fullResolutionReturns':job.get('returns',0),'heightMeters':h,'crossarmWidthMeters':width,'membersInferred':True,'envelopeAvailable':job['status']=='complete'}
 out.append({**props,'position':s['position'],'edges':edges,'envelope':job.get('triangles',[])})
 o=lidar.meta['origin'];cos=np.cos(np.radians(o[1]));geo=lambda p:[o[0]+p[0]/(111320*cos),o[1]-p[2]/111320,p[1]+lidar.meta['verticalOffsetMeters']]
 features.append({'type':'Feature','id':s['id'],'properties':{**props,'verticalDatum':'NAVD88 metres'},'geometry':{'type':'MultiLineString','coordinates':[[geo(a),geo(b)] for a,b in edges]}})
 print(s['id'],job['status'],job.get('returns',0))
(root/'src/fleet/ray-king-structures.json').write_text(json.dumps({'structures':out,'geojson':{'type':'FeatureCollection','features':features}},separators=(',',':')))
