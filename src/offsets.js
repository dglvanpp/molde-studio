import jscad from '@jscad/modeling';
const {geom2}=jscad.geometries,{circle}=jscad.primitives,{union,subtract}=jscad.booleans,{hull}=jscad.hulls;
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function hasCrossings(shape){
  const loops=geom2.toOutlines(shape),edges=[];
  loops.forEach((loop,l)=>loop.forEach((a,i)=>edges.push({a,b:loop[(i+1)%loop.length],l,i,n:loop.length})));
  for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
    const u=edges[i],v=edges[j];if(u.l===v.l&&(v.i===u.i+1||u.i===0&&v.i===u.n-1))continue;
    const {a,b}=u,{a:c,b:d}=v;
    if([0,1].some(k=>Math.max(a[k],b[k])<Math.min(c[k],d[k])-1e-8||Math.max(c[k],d[k])<Math.min(a[k],b[k])-1e-8))continue;
    const p=cross(a,b,c),q=cross(a,b,d),r=cross(c,d,a),s=cross(c,d,b);
    if(((p<=1e-8&&q>=-1e-8)||(q<=1e-8&&p>=-1e-8))&&((r<=1e-8&&s>=-1e-8)||(s<=1e-8&&r>=-1e-8)))return true;
  }
  return false;
}
/** Boolean union of swept disks resolves offsets across narrow concave channels. */
export function capsuleOffset(shape,delta){
  if(!delta)return shape;
  const radius=Math.abs(delta),capsules=[];
  for(const loop of geom2.toOutlines(shape))for(let i=0;i<loop.length;i++){
    const a=loop[i],b=loop[(i+1)%loop.length];if(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-7)continue;
    capsules.push(hull(circle({radius,center:a,segments:24}),circle({radius,center:b,segments:24})));
  }
  if(!capsules.length)return geom2.create();
  const band=union(...capsules);return delta>0?union(shape,band):subtract(shape,band);
}
export function offsetRegion(shape,delta){
  if(!delta)return shape;
  try{const result=jscad.expansions.offset({delta,corners:'edge'},shape);geom2.validate(result);if(!hasCrossings(result))return result;}catch{}
  const result=capsuleOffset(shape,delta);geom2.validate(result);return result;
}
