import ClipperLib from 'clipper-lib';
import jscad from '@jscad/modeling';
const {geom2}=jscad.geometries,SCALE=100000;
const paths=shape=>geom2.toOutlines(shape).map(loop=>loop.map(([x,y])=>({X:Math.round(x*SCALE),Y:Math.round(y*SCALE)})));
export function planarBoolean(type,a,b){
  const c=new ClipperLib.Clipper();c.StrictlySimple=true;
  c.AddPaths(paths(a),ClipperLib.PolyType.ptSubject,true);c.AddPaths(paths(b),ClipperLib.PolyType.ptClip,true);
  const result=[];c.Execute(ClipperLib.ClipType[type],result,ClipperLib.PolyFillType.pftNonZero,ClipperLib.PolyFillType.pftNonZero);
  const sides=result.flatMap(loop=>loop.map((p,i)=>{const q=loop[(i+1)%loop.length];return [[p.X/SCALE,p.Y/SCALE],[q.X/SCALE,q.Y/SCALE]];}));
  return geom2.create(sides);
}
export const planarIntersect=(a,b)=>planarBoolean('ctIntersection',a,b);
export const planarSubtract=(a,b)=>planarBoolean('ctDifference',a,b);

