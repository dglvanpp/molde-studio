import j from '@jscad/modeling';
import {normalizeLoops} from './contours.js';
import {extrudePlanar} from './extrude-planar.js';
const {polygon,circle}=j.primitives,{geom2}=j.geometries,{slice,extrudeFromSlices}=j.extrusions,{mat4}=j.maths;
export function shapedGripBody(p){
 const r=p.handleDiameter/2,core=p.stampHandle==='integrated'?r*.55:p.threadDiameter/2+p.tolerance+.3+1.2;
 let shape;
 if(p.gripShape==='hex')shape=polygon({points:Array.from({length:6},(_,i)=>{const a=i*Math.PI/3;return [r*Math.cos(a),r*Math.sin(a)];})});
 else if(p.gripShape==='heart')shape=j.booleans.union(polygon({points:normalizeLoops([Array.from({length:48},(_,i)=>{const t=i*Math.PI/24;return [16*Math.sin(t)**3,13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t)];})],p.handleDiameter)[0].reverse()}),circle({radius:core,segments:64}));
 else shape=polygon({points:Array.from({length:48},(_,i)=>{const a=i*Math.PI/24,R=p.gripShape==='flower'?Math.max(core,r*(.9+.1*Math.cos(6*a))):r;return [R*Math.cos(a),R*Math.sin(a)];})});
 // Preserve a safe circular socket wall inside aesthetic outlines.
 if(p.gripShape==='hex')shape=j.booleans.union(shape,circle({radius:core,segments:64}));
 const R=Math.min(p.handleBottomRound,p.handleHeight/2,r-.8),profile=[];
 if(R>0)for(let i=0;i<=6;i++){const a=i*Math.PI/12;profile.push([R-R*Math.cos(a),(r-R+R*Math.sin(a))/r]);}
 else profile.push([0,1]);profile.push([p.handleHeight,1]);
 const sections=profile.map(([z,s])=>slice.transform(mat4.fromTranslation(mat4.create(),[0,0,z]),slice.fromSides(geom2.toSides(j.transforms.scale([s,s],shape)))));
 const loft=extrudeFromSlices({numberOfSlices:sections.length,capStart:false,capEnd:false,repair:false,callback:(_,i)=>sections[i]},sections[0]);
 const bottom=extrudePlanar(j.transforms.scale([profile[0][1],profile[0][1]],shape),1),top=extrudePlanar(shape,1,p.handleHeight-1);
 return j.geometries.geom3.create([...loft.polygons,...bottom.polygons.filter(p=>p.vertices.every(v=>Math.abs(v[2])<1e-7)),...top.polygons.filter(q=>q.vertices.every(v=>Math.abs(v[2]-p.handleHeight)<1e-7))]);
}

