import jscad from '@jscad/modeling';
import {offsetRegion} from './offsets.js';
const {geom2}=jscad.geometries,{extrudeFromSlices,slice}=jscad.extrusions,{mat4}=jscad.maths;
/** Rounded exterior edges with a flat bed contact and an open cutter interior. */
export function createRoundedBrim(exterior,p){
  const h=p.brimHeight,w=p.brimWidth,r=Math.min(h*.45,w*.45,1.5),steps=6,profile=[];
  for(let i=0;i<=steps;i++){const a=i/steps*Math.PI/2;profile.push({z:r-r*Math.cos(a),delta:w-r+r*Math.sin(a)});}
  for(let i=0;i<=steps;i++){const a=i/steps*Math.PI/2;profile.push({z:h-r+r*Math.sin(a),delta:w-r+r*Math.cos(a)});}
  const innerSides=geom2.toSides(offsetRegion(exterior,-p.wallThickness)).map(([a,b])=>[b,a]);
  const sections=profile.map(({z,delta})=>{
    const outer=offsetRegion(exterior,delta);geom2.validate(outer);
    return slice.transform(mat4.fromTranslation(mat4.create(),[0,0,z]),slice.fromSides([...geom2.toSides(outer),...innerSides]));
  });
  if(!sections.every(s=>slice.toEdges(s).length===slice.toEdges(sections[0]).length))throw new Error('El redondeo cierra una zona estrecha de la empuñadura. Reduce su ancho, aumenta el tamaño o elige la empuñadura plana.');
  return extrudeFromSlices({numberOfSlices:sections.length,repair:false,callback:(_,i)=>sections[i]},sections[0]);
}
