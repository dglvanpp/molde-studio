import {createPotrace} from './vendor/potrace.js';
import {area,cleanLoop,classifyLoops,bounds} from './contours.js';

const point=p=>[p.x,-p.y];
function cubic(a,b,c,d,t){const u=1-t;return [0,1].map(k=>u*u*u*a[k]+3*u*u*t*b[k]+3*u*t*t*c[k]+t*t*t*d[k]);}
function extrema(a,b,c,d){
  const A=-a+3*b-3*c+d,B=2*(a-2*b+c),C=b-a;
  if(Math.abs(A)<1e-12)return Math.abs(B)<1e-12?[]:[-C/B].filter(t=>t>0&&t<1);
  const disc=B*B-4*A*C;if(disc<0)return [];
  return [(-B+Math.sqrt(disc))/(2*A),(-B-Math.sqrt(disc))/(2*A)].filter(t=>t>0&&t<1);
}
/** Include analytic curve extrema so the sampled SVG bounds match its curves. */
export function curvesToLoops(curves){
  return curves.map(curve=>{
    const out=[];let a=point(curve.c[(curve.n-1)*3+2]);out.push(a);
    for(let i=0;i<curve.n;i++){
      const c=point(curve.c[i*3+1]),d=point(curve.c[i*3+2]);
      if(curve.tag[i]==='CURVE'){
        const b=point(curve.c[i*3]);
        const length=Math.hypot(...b.map((v,k)=>v-a[k]))+Math.hypot(...c.map((v,k)=>v-b[k]))+Math.hypot(...d.map((v,k)=>v-c[k]));
        const steps=Math.max(4,Math.ceil(length/2));
        const ts=[...Array.from({length:steps},(_,j)=>(j+1)/steps),...extrema(a[0],b[0],c[0],d[0]),...extrema(a[1],b[1],c[1],d[1])].sort((x,y)=>x-y);
        for(const t of ts)out.push(cubic(a,b,c,d,t));
      }else out.push(c,d);
      a=d;
    }
    return cleanLoop(out);
  }).filter(p=>p.length>=3&&Math.abs(area(p))>.01);
}
export function traceMask({mask,width,height}){
  if(!mask.some(v=>v===1))throw new Error('La corrección dejó la imagen vacía. Baja el umbral o reduce el adelgazado.');
  const tracer=createPotrace();tracer.loadBitmap(width,height,mask);tracer.process(()=>{});
  const loops=curvesToLoops(tracer.getCurves()),nodes=classifyLoops(loops);
  if(!nodes.length)throw new Error('No hay contornos cerrados aprovechables. Ajusta umbral, dilatación y blur.');
  if(nodes.length>90||loops.reduce((n,l)=>n+l.length,0)>12000)throw new Error('Hay demasiado ruido o detalle. Limpia el fondo o reduce la ampliación.');
  const svg=tracer.getSVG(1);
  const moves=(svg.match(/M/g)||[]).length,closes=(svg.match(/Z/g)||[]).length;
  if(!moves||moves!==closes)throw new Error('Potrace no cerró todos los subtrazados.');
  return {svg,loops:nodes.map(n=>n.points),bounds:bounds(loops),contourCount:nodes.length,outerCount:nodes.filter(n=>n.depth===0).length};
}
export function scaleToLongestSide(loops,size){
  if(!Number.isFinite(size)||size<50||size>150)throw new Error('El lado más largo debe medir entre 50 y 150 mm.');
  const b=bounds(loops),longest=Math.max(b[0][1]-b[0][0],b[1][1]-b[1][0]);
  if(!Number.isFinite(longest)||longest<=0)throw new Error('El dibujo no tiene un tamaño válido.');
  return loops.map(l=>l.map(([x,y])=>[(x-(b[0][0]+b[0][1])/2)*size/longest,(y-(b[1][0]+b[1][1])/2)*size/longest]));
}

