import opentype from 'opentype.js';
import {serializeBinarySTL} from './mesh.js';
// Install the handler before awaiting the local WASM module, so the first job is never lost.
const engine=import('./geometry.js');
self.onmessage=async ({data})=>{
  try {
    const start=performance.now();
    const {buildDesign,triangulatePart}=await engine;
    const font=data.fontBuffer?opentype.parse(data.fontBuffer):null;
    const result=buildDesign({...data,font});
    const parts=[];
    for(const p of result.parts) {
      const ready=triangulatePart(p);
      const stl=serializeBinarySTL(ready.geometry);
      parts.push({name:ready.name,color:ready.color,positions:ready.positions,volume:ready.volume,bbox:ready.bbox,triangles:ready.triangles,stl});
    }
    self.postMessage({id:data.id,parts,warnings:result.warnings,elapsed:performance.now()-start},parts.flatMap(p=>[p.positions.buffer,p.stl]));
  } catch(error) { self.postMessage({id:data.id,error:error.message||'No se pudo generar el modelo.'}); }
};
