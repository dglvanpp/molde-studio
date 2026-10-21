// Geometry-neutral contour helpers shared by vectorization, OpenType and CSG.
export const area = (p) => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
export function cleanLoop(points, epsilon = 1e-5) {
  const out = [];
  for (const p of points) if (p.every(Number.isFinite) && (!out.length || Math.hypot(p[0] - out.at(-1)[0], p[1] - out.at(-1)[1]) > epsilon)) out.push(p);
  if (out.length > 2 && Math.hypot(out[0][0] - out.at(-1)[0], out[0][1] - out.at(-1)[1]) < epsilon) out.pop();
  return out;
}
export function contains(point, loop) {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i], b = loop[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function classifyLoops(loops) {
  const nodes = loops.map(p => cleanLoop(p)).filter(p => p.length >= 3 && Math.abs(area(p)) > 1e-5).map(points => ({ points, area: Math.abs(area(points)), parent: -1, depth: 0 })).sort((a,b) => b.area-a.area);
  nodes.forEach((n, i) => {
    for (let j = i - 1; j >= 0; j--) if (contains(n.points[0], nodes[j].points)) { n.parent = j; n.depth = nodes[j].depth + 1; break; }
    if (area(n.points) < 0) n.points.reverse();
  });
  return nodes;
}
export function bounds(loops) {
  const points = loops.flat();
  if (!points.length) throw new Error('No hay contornos. Ajusta el umbral o usa una imagen con contraste.');
  return [0,1].map(axis => [Math.min(...points.map(p=>p[axis])), Math.max(...points.map(p=>p[axis]))]);
}
export function normalizeLoops(loops, size, mirror = false) {
  const b = bounds(loops), scale = size / Math.max(b[0][1]-b[0][0], b[1][1]-b[1][0]);
  return loops.map(loop => loop.map(([x,y]) => [(x-(b[0][0]+b[0][1])/2)*scale*(mirror?-1:1), (y-(b[1][0]+b[1][1])/2)*scale]));
}
// Remove raster-scale collinear segments before polygon offsets. Tolerance in mm.
export function simplifyLoop(input,tolerance=.3) {
  const points=cleanLoop(input);if(points.length<5)return points;
  const simplify=(p)=>{if(p.length<3)return p;const a=p[0],b=p.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],len2=dx*dx+dy*dy;let far=0,index=0;
    for(let i=1;i<p.length-1;i++){const t=Math.max(0,Math.min(1,len2?((p[i][0]-a[0])*dx+(p[i][1]-a[1])*dy)/len2:0)),dist=Math.hypot(p[i][0]-a[0]-t*dx,p[i][1]-a[1]-t*dy);if(dist>far){far=dist;index=i;}}
    return far>tolerance?[...simplify(p.slice(0,index+1)).slice(0,-1),...simplify(p.slice(index))]:[a,b];
  };
  let split=1;for(let i=2;i<points.length;i++)if(Math.hypot(points[i][0]-points[0][0],points[i][1]-points[0][1])>Math.hypot(points[split][0]-points[0][0],points[split][1]-points[0][1]))split=i;
  const reduced=[...simplify(points.slice(0,split+1)).slice(0,-1),...simplify([...points.slice(split),points[0]]).slice(0,-1)];
  return reduced.length>=3?reduced:points;
}
export function flattenCommands(commands, subdivisions = 7) {
  const loops = []; let points = [], at = [0,0];
  const flush = () => { if (points.length > 2) loops.push(cleanLoop(points)); points = []; };
  for (const c of commands) {
    if (c.type === 'M') { flush(); at = [c.x,-c.y]; points.push(at); }
    if (c.type === 'L') { at = [c.x,-c.y]; points.push(at); }
    if (c.type === 'Q' || c.type === 'C') {
      const p0 = at, p1 = [c.x1,-c.y1], end = [c.x,-c.y], p2 = c.type === 'C' ? [c.x2,-c.y2] : end;
      for (let k=1;k<=subdivisions;k++) { const t=k/subdivisions, u=1-t; points.push([0,1].map(a => c.type==='Q' ? u*u*p0[a]+2*u*t*p1[a]+t*t*end[a] : u*u*u*p0[a]+3*u*u*t*p1[a]+3*u*t*t*p2[a]+t*t*t*end[a])); }
      at = end;
    }
    if (c.type === 'Z') flush();
  }
  flush(); return loops;
}
