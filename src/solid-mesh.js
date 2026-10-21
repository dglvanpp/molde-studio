import jscad from '@jscad/modeling';
import {repairMesh} from './mesh.js';
const {geom3}=jscad.geometries;
const {generalize}=jscad.modifiers;
const {measureVolume,measureBoundingBox}=jscad.measurements;
export function triangulatePart(part) {
  let geometry,lastError;
  // BSP rounding varies with model scale. Use the smallest successful weld,
  // capped at 0.01 mm; never export a mesh that fails the topology check.
  const attempts=[[.00001,false],[.00001,false,true],[.002,true],[.00005,false],[.0001,false],[.0005,false],[.001,false],[.005,true],[.01,true]];
  for(const [tolerance,dropSlivers,projectJunctions] of attempts)try{geometry=repairMesh(part.geometry,tolerance,dropSlivers,projectJunctions);break;}catch(error){lastError=error;}
  if(!geometry){const snapped=generalize({snap:true,triangulate:true},part.geometry);for(const [tolerance,dropSlivers,projectJunctions] of attempts)try{geometry=repairMesh(snapped,tolerance,dropSlivers,projectJunctions);break;}catch(error){lastError=error;}}
  if(!geometry)throw lastError;
  // STL stores float32 coordinates. Validate that actual precision too: a
  // nearly collinear loft triangle can collapse only when written to STL.
  const quantized=geom3.create(geom3.toPolygons(geometry).map(p=>jscad.geometries.poly3.create(p.vertices.map(v=>v.map(Math.fround)))));
  const collapsed=geom3.toPolygons(quantized).some(p=>jscad.geometries.poly3.measureArea(p)===0);
  if(collapsed)geometry=repairMesh(quantized,.00001,false,true);
  const polygons=geom3.toPolygons(geometry),positions=[];
  for(const poly of polygons)for(let i=1;i<poly.vertices.length-1;i++)positions.push(...poly.vertices[0],...poly.vertices[i],...poly.vertices[i+1]);
  const volume=measureVolume(geometry),bbox=measureBoundingBox(geometry);
  if(!positions.length||!Number.isFinite(volume)||volume<=0||positions.some(v=>!Number.isFinite(v)))throw new Error(`La geometría de ${part.name} no es válida. Simplifica la imagen o ajusta las medidas.`);
  return {...part,geometry,positions:new Float32Array(positions),volume,bbox,triangles:positions.length/9};
}
