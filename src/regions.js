import jscad from '@jscad/modeling';
import {classifyLoops} from './contours.js';
const {polygon}=jscad.primitives;
const {subtract,union}=jscad.booleans;
export function regionFromLoops(loops) {
  const nodes=classifyLoops(loops), solids=[];
  nodes.forEach((n,i)=>{if(n.depth%2===0) {
    const children=nodes.filter(c=>c.parent===i).map(c=>polygon({points:c.points}));
    const shape=polygon({points:n.points}); solids.push(children.length?subtract(shape,...children):shape);
  }});
  if(!solids.length) throw new Error('No hay áreas cerradas válidas.');
  return solids.length===1?solids[0]:union(...solids);
}
