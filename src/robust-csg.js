import Module from 'manifold-3d';
import j from '@jscad/modeling';
import {repairMesh} from './mesh.js';

// JSCAD owns the parametric model; local Manifold WASM handles difficult 3D booleans.
const options=typeof process!=='undefined'&&process.versions?.node?{}:{
  locateFile:()=>new URL(`${import.meta.env.BASE_URL}manifold.wasm`, self.location.href).href
};
const runtime=await Module(options);
runtime.setup();
const {Manifold,Mesh}=runtime;

function fromSolid(solid){
  let geometry,lastError;
  // Text contains separate closed letters before fusion. Open surfaces still fail.
  for(const tolerance of [.00001,.00005,.0001,.0005,.001]){
    try{geometry=repairMesh(solid,tolerance,false,true,true);break;}
    catch(error){lastError=error;}
  }
  if(!geometry)throw lastError;
  const vertices=[],indices=[],ids=new Map();
  for(const polygon of j.geometries.geom3.toPolygons(geometry)){
    for(const vertex of polygon.vertices){
      const point=vertex.map(Math.fround),key=point.join(',');
      let id=ids.get(key);
      if(id===undefined){id=vertices.length/3;ids.set(key,id);vertices.push(...point);}
      indices.push(id);
    }
  }
  const mesh=new Mesh({numProp:3,vertProperties:new Float32Array(vertices),triVerts:new Uint32Array(indices)});
  mesh.merge();
  const result=new Manifold(mesh);
  if(result.status()!=='NoError'){
    const status=result.status();result.delete();
    throw new Error(`No se puede unir una superficie abierta (${status}).`);
  }
  return result;
}

export function robustBoolean(operation,a,b){
  let left,right,result;
  try{
    left=fromSolid(a);right=fromSolid(b);
    result=operation==='subtract'?left.subtract(right):left.add(right);
    if(result.status()!=='NoError')throw new Error('La operación geométrica no produjo un sólido cerrado.');
    // Remove numerical slivers before float32 STL conversion; maximum motion 0.0001 mm.
    const simplified=result.simplify(.0001);result.delete();result=simplified;
    const mesh=result.getMesh(),polygons=[];
    for(let i=0;i<mesh.triVerts.length;i+=3){
      const points=[0,1,2].map(k=>{
        const v=mesh.triVerts[i+k]*mesh.numProp;
        return Array.from(mesh.vertProperties.slice(v,v+3));
      });
      polygons.push(j.geometries.poly3.create(points));
    }
    return j.geometries.geom3.create(polygons);
  }finally{result?.delete();right?.delete();left?.delete();}
}
