// Public browser API for integrating the cutter generator with other local tools.
import { svgToLoops } from './vectorize.js';
import { buildDesign, defaults, triangulatePart } from './geometry.js';
import {serializeBinarySTL} from './mesh.js';
export function createCutterFromSvg(svg,params={},font=null) {
  return buildDesign({loops:svgToLoops(svg),params:{...defaults,...params,mode:'cutter'},font}).parts[0].geometry;
}
export function downloadSTL(geometry,name='cortador.stl') {
  const ready=triangulatePart({name,geometry});
  const blob=new Blob([serializeBinarySTL(ready.geometry)],{type:'application/sla'});
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
