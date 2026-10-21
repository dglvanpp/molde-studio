import jscad from '@jscad/modeling';
const {geom2}=jscad.geometries,{slice,extrudeFromSlices}=jscad.extrusions,{mat4}=jscad.maths;
/** Match perimeter stations while retaining every original corner in every section. */
function match(loops){
  const tables=loops.map(loop=>{
    const minY=Math.min(...loop.map(p=>p[1]));
    // Numerical ties at two bottom lobes must not rotate one section by a petal.
    let start=loop.findIndex(p=>p[1]<=minY+.0001);
    for(let i=0;i<loop.length;i++)if(loop[i][1]<=minY+.0001&&loop[i][0]<loop[start][0])start=i;
    const p=loop.slice(start).concat(loop.slice(0,start)),s=[0];
    p.forEach((a,i)=>s.push(s.at(-1)+Math.hypot(a[0]-p[(i+1)%p.length][0],a[1]-p[(i+1)%p.length][1])));
    return {p,s:s.map(v=>v/s.at(-1))};
  });
  const knots=[...new Set(tables.flatMap(t=>t.s.slice(0,-1)).map(v=>Math.round(v*1e8)/1e8))].sort((a,b)=>a-b);
  return tables.map(({p,s})=>{let e=0;return knots.map(t=>{while(e<p.length-1&&s[e+1]<t)e++;const a=p[e],b=p[(e+1)%p.length],u=(t-s[e])/(s[e+1]-s[e]);return a.map((v,k)=>v+(b[k]-v)*u);});});
}
export function loftRings(sections){
  const outer=sections.map(s=>geom2.toOutlines(s.outer)),inner=sections.map(s=>geom2.toOutlines(s.inner));
  if(outer.some(l=>l.length!==1)||inner.some(l=>l.length!==1))throw new Error('La pared divide un detalle demasiado estrecho. Aumenta tamaño o reduce el grosor.');
  const outs=match(outer.map(l=>l[0])),ins=match(inner.map(l=>l[0]));
  const slices=sections.map(({z},i)=>{const sides=outs[i].map((a,k)=>[a,outs[i][(k+1)%outs[i].length]]).concat(ins[i].map((a,k)=>[ins[i][(k+1)%ins[i].length],a]));return slice.transform(mat4.fromTranslation(mat4.create(),[0,0,z]),slice.fromSides(sides));});
  return extrudeFromSlices({numberOfSlices:slices.length,repair:false,callback:(_,i)=>slices[i]},slices[0]);
}
