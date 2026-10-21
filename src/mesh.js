import jscad from '@jscad/modeling';
const {geom3,poly3}=jscad.geometries;
const subtract=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

/** Weld numerical duplicates, split T-junctions and close only tiny planar CSG cracks. */
export function repairMesh(input,tolerance=.005,dropNumericalSlivers=false,projectJunctions=false,allowDisconnected=false) {
  const vertices=[],originals=[],cells=new Map(),cellKey=p=>p.map(x=>Math.floor(x/tolerance));
  const vertexId=(point)=>{
    const c=cellKey(point);
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const i of cells.get([c[0]+x,c[1]+y,c[2]+z].join(','))||[])if(Math.hypot(...subtract(vertices[i],point))<tolerance)return i;
    const i=vertices.length;vertices.push([...point]);originals.push([...point]);const key=c.join(',');if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);return i;
  };
  const projectVertex=(i,point)=>{
    // Bound cumulative motion, not just each successive edge projection.
    if(Math.hypot(...subtract(point,originals[i]))>tolerance)return;
    const from=cellKey(vertices[i]).join(','),to=cellKey(point).join(',');
    if(from!==to){cells.set(from,cells.get(from).filter(index=>index!==i));if(!cells.has(to))cells.set(to,[]);cells.get(to).push(i);}
    vertices[i]=point;
  };
  let triangles=[];
  for(const p of geom3.toPolygons(input)){
    if(p.vertices.length===3)triangles.push(p.vertices.map(vertexId));
    else {const center=vertexId([0,1,2].map(axis=>p.vertices.reduce((s,v)=>s+v[axis],0)/p.vertices.length)),ids=p.vertices.map(vertexId);for(let i=0;i<ids.length;i++)triangles.push([center,ids[i],ids[(i+1)%ids.length]]);}
  }
  const clean=()=>{
    const found=new Map();
    triangles=triangles.filter(t=>{
      if(new Set(t).size<3)return false;
      const n=cross(subtract(vertices[t[1]],vertices[t[0]]),subtract(vertices[t[2]],vertices[t[0]]));
      const longest=Math.max(...[0,1,2].map(i=>Math.hypot(...subtract(vertices[t[i]],vertices[t[(i+1)%3]]))));
      // Skinny BSP facets still close the surface. Welding tolerance is not an
      // area cutoff: discard only effectively collinear faces, never valid slivers.
      if(Math.hypot(...n)<(dropNumericalSlivers?tolerance*.5:1e-12)*longest)return false;
      const key=[...t].sort((a,b)=>a-b).join(',');if(found.has(key))return false;found.set(key,true);return true;
    });
  };
  const edgeMap=()=>{
    const edges=new Map();
    triangles.forEach((t,face)=>{for(let i=0;i<3;i++){const a=t[i],b=t[(i+1)%3],key=a<b?`${a},${b}`:`${b},${a}`;if(!edges.has(key))edges.set(key,[]);edges.get(key).push({a,b,face});}});return edges;
  };
  clean();
  for(let pass=0;pass<3;pass++) {
    const edges=edgeMap(),open=[...edges.values()].filter(e=>e.length!==2||e[0].a!==e[1].b).flat();if(!open.length)break;
    const candidates=[...new Set(open.flatMap(e=>[e.a,e.b]))],splits=new Map();
    for(const edge of open){
      const a=vertices[edge.a],ab=subtract(vertices[edge.b],a),len2=dot(ab,ab),extra=[];
      for(const i of candidates){if(i===edge.a||i===edge.b)continue;const ap=subtract(vertices[i],a),t=dot(ap,ab)/len2;if(t<1e-6||t>1-1e-6)continue;const dist=Math.hypot(...ap.map((n,k)=>n-t*ab[k]));if(dist<tolerance){if(projectJunctions)projectVertex(i,a.map((v,k)=>v+t*ab[k]));extra.push({i,t});}}
      if(extra.length)splits.set(`${edge.a},${edge.b}`,extra.sort((a,b)=>a.t-b.t).map(s=>s.i));
    }
    if(!splits.size)break;
    const next=[];
    for(const t of triangles){const loop=[];for(let i=0;i<3;i++){const a=t[i],b=t[(i+1)%3];loop.push(a,...(splits.get(`${a},${b}`)||[]));}
      if(loop.length===3)next.push(t);
      else{const center=vertexId([0,1,2].map(axis=>t.reduce((s,id)=>s+vertices[id][axis],0)/3));for(let i=0;i<loop.length;i++)next.push([center,loop[i],loop[(i+1)%loop.length]]);}
    }
    triangles=next;clean();
  }
  // BSP may omit a tiny triangular face at coplanar layer boundaries. Patch only
  // simple planar loops <= 0.1 mm² and <= 1 mm across; larger gaps are rejected.
  const boundary=[...edgeMap().values()].filter(es=>es.length===1).flat(),outgoing=new Map(),visited=new Set();
  for(const e of boundary){if(!outgoing.has(e.a))outgoing.set(e.a,[]);outgoing.get(e.a).push(e.b);}
  for(const edge of boundary){
    if(visited.has(edge.a))continue;const loop=[];let at=edge.a,closed=false;
    for(let i=0;i<=boundary.length;i++){if(at===edge.a&&loop.length){closed=true;break;}if(visited.has(at)||outgoing.get(at)?.length!==1)break;visited.add(at);loop.push(at);at=outgoing.get(at)[0];}
    if(!closed||loop.length<3)continue;
    const points=loop.map(i=>vertices[i]),origin=points[0];let normal=[0,0,0];
    for(let i=1;i<points.length-1;i++){const n=cross(subtract(points[i],origin),subtract(points[i+1],origin));normal=normal.map((v,k)=>v+n[k]);}
    const twiceArea=Math.hypot(...normal),diameter=Math.max(...points.flatMap(a=>points.map(b=>Math.hypot(...subtract(a,b)))));
    if(twiceArea<1e-10||twiceArea>.2||diameter>1)continue;
    normal=normal.map(v=>v/twiceArea);if(points.some(pt=>Math.abs(dot(subtract(pt,origin),normal))>tolerance))continue;
    const reversed=[...loop].reverse();for(let i=1;i<reversed.length-1;i++)triangles.push([reversed[0],reversed[i],reversed[i+1]]);
  }
  // A BSP split can leave an almost zero-length edge shared by four faces.
  // Collapse only such nonmanifold edges under 0.001 mm, then require the same
  // strict oriented-edge and connected-component checks as every other mesh.
  for(let pass=0;pass<3;pass++){
    const tiny=[...edgeMap().values()].filter(es=>es.length>2&&Math.hypot(...subtract(vertices[es[0].a],vertices[es[0].b]))<.001);
    if(!tiny.length)break;
    for(const es of tiny){const {a,b}=es[0];triangles=triangles.map(t=>t.map(i=>i===b?a:i));}
    clean();
  }
  const edges=edgeMap();
  const invalid=[...edges.values()].filter(e=>e.length!==2||e[0].a!==e[1].b||e[0].b!==e[1].a);
  if(invalid.length){const error=new Error(`La malla contiene ${invalid.length} uniones abiertas o solapadas. Simplifica el contorno o aumenta el tamaño.`);error.edges=invalid.map(es=>es.map(e=>({a:vertices[e.a],b:vertices[e.b]})));throw error;}
  // Edge adjacency detects disconnected print islands after all numeric repair.
  const adjacency=Array.from({length:triangles.length},()=>[]);
  for(const e of edges.values()){adjacency[e[0].face].push(e[1].face);adjacency[e[1].face].push(e[0].face);}
  const seen=new Set([0]),stack=[0];while(stack.length){for(const face of adjacency[stack.pop()]||[])if(!seen.has(face)){seen.add(face);stack.push(face);}}
  if(!allowDisconnected&&seen.size!==triangles.length)throw new Error('La pieza tiene fragmentos separados. Aumenta el tamaño, reduce los offsets o simplifica la imagen.');
  return geom3.create(triangles.map(t=>poly3.create(t.map(i=>vertices[i]))));
}

/** Binary STL: 80-byte header, uint32 triangle count, then 50 bytes per triangle. */
export function serializeBinarySTL(geometry) {
  const triangles=geom3.toPolygons(geometry);
  const buffer=new ArrayBuffer(84+50*triangles.length),view=new DataView(buffer),header=new TextEncoder().encode('Molde Studio | binary STL | coordinates in millimeters');
  new Uint8Array(buffer,0,header.length).set(header);view.setUint32(80,triangles.length,true);
  triangles.forEach((poly,i)=>{
    if(poly.vertices.length!==3)throw new Error('El STL requiere una malla triangulada.');
    const [a,b,c]=poly.vertices.map(v=>v.map(Math.fround)),n=cross(subtract(b,a),subtract(c,a)),length=Math.hypot(...n),values=[...n.map(v=>v/length),...a,...b,...c];
    if(!length||values.some(v=>!Number.isFinite(v)))throw new Error('El STL contiene un triángulo degenerado.');
    values.forEach((v,j)=>view.setFloat32(84+i*50+j*4,v,true));view.setUint16(84+i*50+48,0,true);
  });return buffer;
}
