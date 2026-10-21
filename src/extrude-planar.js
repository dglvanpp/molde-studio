import jscad from '@jscad/modeling';
import {ShapeUtils,Vector2} from 'three';
import {classifyLoops,area} from './contours.js';
const {geom2,geom3,poly3}=jscad.geometries;
/** Keep JSCAD extrusion walls, triangulate planar caps with hole-aware Earcut. */
export function extrudePlanar(shape,height,z=0){
  geom2.validate(shape);
  const source=jscad.transforms.translate([0,0,z],jscad.extrusions.extrudeLinear({height},shape));
  const at=(p,h)=>p.vertices.every(v=>Math.abs(v[2]-h)<1e-8);
  const faces=geom3.toPolygons(source).filter(p=>!at(p,z)&&!at(p,z+height));
  const nodes=classifyLoops(geom2.toOutlines(shape));
  nodes.forEach((node,index)=>{if(node.depth%2)return;
    const outer=node.points.map(p=>new Vector2(...p)),holes=nodes.filter(n=>n.parent===index).map(n=>n.points.map(p=>new Vector2(...p)));
    const triangles=ShapeUtils.triangulateShape(outer,holes),points=outer.concat(...holes);
    for(const tri of triangles){let p=tri.map(i=>[points[i].x,points[i].y]);if(area(p)<0)p.reverse();faces.push(poly3.create(p.map(v=>[...v,z+height])),poly3.create([...p].reverse().map(v=>[...v,z])));}
  });
  return geom3.create(faces);
}
