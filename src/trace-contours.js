import {cleanLoop} from './contours.js';
export const tracerOptions={ltres:1,qtres:1,pathomit:12,rightangleenhance:false,colorsampling:0,numberofcolors:2,layering:0,pal:[{r:0,g:0,b:0,a:255},{r:255,g:255,b:255,a:255}]};
export function tracedDataToLoops(traced){
  const blackLayer=traced.palette.findIndex(c=>c.r<128);
  return traced.layers[blackLayer].map(path=>{
    const points=[];
    for(const s of path.segments){
      points.push([s.x1,-s.y1]);
      if(s.type==='Q'){
        // Bound the quadratic-to-chord deviation to 0.10 source pixels.
        const bend=Math.hypot(s.x1-2*s.x2+s.x3,s.y1-2*s.y2+s.y3);
        const steps=Math.max(2,Math.ceil(Math.sqrt(bend/.4)));
        for(let k=1;k<=steps;k++){const t=k/steps,u=1-t;points.push([u*u*s.x1+2*u*t*s.x2+t*t*s.x3,-(u*u*s.y1+2*u*t*s.y2+t*t*s.y3)]);}
      }else points.push([s.x2,-s.y2]);
    }
    return cleanLoop(points);
  }).filter(p=>p.length>2);
}
