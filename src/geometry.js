import {buildAdvancedDesign} from './advanced-geometry.js';
import {regionFromLoops} from './regions.js';
export {regionFromLoops} from './regions.js';
import {threadedVolume} from './threads.js';
export {threadedVolume} from './threads.js';
import {threadDefaults,validateThreadParams,createThreadedStamp,createThreadedHandle} from './stamp-system.js';
import jscad from '@jscad/modeling';
import unionGeom3Sub from '@jscad/modeling/src/operations/booleans/unionGeom3Sub.js';
import { area, bounds, classifyLoops, normalizeLoops, flattenCommands, contains, simplifyLoop } from './contours.js';
import {triangulatePart} from './solid-mesh.js';
export {triangulatePart} from './solid-mesh.js';
import {offsetRegion} from './offsets.js';
import {createRoundedBrim} from './rounded-brim.js';
const { polygon, circle, rectangle, roundedRectangle, cylinder, cylinderElliptic } = jscad.primitives;
const { union, subtract, intersect } = jscad.booleans;
const { extrudeLinear } = jscad.extrusions;
const { translate, rotateX, rotateZ, scale, mirrorY } = jscad.transforms;
const { measureArea, measureBoundingBox, measureVolume } = jscad.measurements;
const { geom2, geom3, poly3 } = jscad.geometries;
const TAU = Math.PI*2;

export const defaults = { mode:'cutter',size:80,smoothing:.1,bladeThickness:.8,bladeHeight:15,wallThickness:1.2,wallHeight:12,brimWidth:3,brimHeight:2,interiorThickness:1,mirror:false,bars:false,details:false,nameplate:false,text:'',textSecondLine:'',textStyle:'vertical',textHeight:3,textDepth:.7,stampHandle:'threaded',stampBase:'circle',handleDiameter:16,handleHeight:12,threadDiameter:10.5,threadPitch:2,threadLength:8,tolerance:.2,nutShape:'flower',reliefHeight:2,rollerDiameter:32,topperStake:55,roundedBrim:true,...threadDefaults };
export function validateParams(input) {
  const p={...defaults,...input};
  const ranges={size:[25,180],bladeThickness:[.4,2],bladeHeight:[5,30],wallThickness:[.8,3],wallHeight:[3,25],brimWidth:[2,8],brimHeight:[1,4],interiorThickness:[.5,3],textHeight:[1.5,6],textDepth:[.4,1.2],handleDiameter:[12,40],handleHeight:[5,30],threadDiameter:[8,24],threadCupDepth:[1,12],handleBottomRound:[0,8],tolerance:[.1,.5],reliefHeight:[1,4],rollerDiameter:[24,60],topperStake:[25,90]};
  for(const [key,[lo,hi]] of Object.entries(ranges)) if(!Number.isFinite(p[key])||p[key]<lo||p[key]>hi) throw new Error(`Parámetro fuera de rango: ${key}.`);
  if(!Number.isFinite(p.smoothing)||p.smoothing<.05||p.smoothing>.5)throw new Error('El suavizado debe estar entre 0.05 y 0.50 mm.');
  if(p.wallThickness<p.bladeThickness) throw new Error('La pared debe ser al menos tan gruesa como la cuchilla.');
  if(p.wallHeight>p.bladeHeight) throw new Error('La pared de soporte no puede superar la altura de la cuchilla.');
  if(!['cutter','cutterStamp','kpop','roller','topper','stencil','stamp','set'].includes(p.mode)) throw new Error('Modo desconocido.');
  if(!['flower','heart','hex'].includes(p.nutShape)) throw new Error('Forma de mango desconocida.');
  if(!['vertical','flat'].includes(p.textStyle)||!['integrated','threaded'].includes(p.stampHandle)||!['circle','silhouette'].includes(p.stampBase))throw new Error('Estilo de texto o sello desconocido.');
  if(['stamp','cutterStamp'].includes(p.mode)&&p.stampHandle==='threaded')validateThreadParams(p);
  p.text=String(p.text).trim().slice(0,32);
  p.textSecondLine=String(p.textSecondLine).trim().slice(0,32);
  if(p.textStyle==='flat' && p.text && ['cutter','cutterStamp','set'].includes(p.mode) && p.brimHeight>=2.5) throw new Error('Para ver el texto plano de 2.5 mm, la empuñadura debe tener menos de 2.5 mm de grosor.');
  return p;
}
// Prefer the native offset; use capsule unions when concavities cross or open it.
const grow=offsetRegion;
const up=(shape,h,z=0)=>{try{geom2.validate(shape);}catch{throw new Error('El offset no forma un área cerrada válida. Reduce el grosor o ancho de empuñadura, o ajusta el suavizado. Si el dibujo tiene líneas rotas, usa «Cerrar pequeñas roturas».');}return translate([0,0,z],extrudeLinear({height:h},shape));};
const ccw=(points)=>area(points)<0?[...points].reverse():points;
const ring=(shape,t)=>{
  const inner=grow(shape,-t);
  if(Math.abs(measureArea(inner))<.01) throw new Error('El contorno es demasiado estrecho para ese grosor. Aumenta el tamaño.');
  return subtract(shape,inner);
};

/** Equivalent to the union of full-height blade/wall/brim extrusions.
 * Use consecutive Z intervals to avoid coincident faces in JSCAD's BSP. */
export function createCutter(exterior,p,detailRegion=null,font=null) {
  exterior=polygon({points:ccw(simplifyLoop(geom2.toOutlines(exterior).sort((a,b)=>Math.abs(area(b))-Math.abs(area(a)))[0],p.smoothing))});
  const brimRegion=subtract(grow(exterior,p.brimWidth),grow(exterior,-p.wallThickness));
  const pieces=[p.roundedBrim?createRoundedBrim(exterior,p):up(brimRegion,p.brimHeight)];
  if(p.wallHeight>p.brimHeight)pieces.push(up(ring(exterior,p.wallThickness),p.wallHeight-p.brimHeight,p.brimHeight));
  if(p.bladeHeight>Math.max(p.wallHeight,p.brimHeight))pieces.push(up(ring(exterior,p.bladeThickness),p.bladeHeight-Math.max(p.wallHeight,p.brimHeight),Math.max(p.wallHeight,p.brimHeight)));
  const bb=measureBoundingBox(exterior), width=bb[1][0]-bb[0][0],height=bb[1][1]-bb[0][1],cx=(bb[1][0]+bb[0][0])/2,cy=(bb[1][1]+bb[0][1])/2;
  if(p.bars) {
    const cross=union(rectangle({size:[width+2,p.wallThickness],center:[cx,cy]}),rectangle({size:[p.wallThickness,height+2],center:[cx,cy]}));
    pieces.push(up(intersect(cross,exterior),p.brimHeight));
  }
  if(p.details&&detailRegion) {
    const detail=intersect(grow(detailRegion,p.interiorThickness/2),grow(exterior,-p.wallThickness/2));
    // A shallow backing joins isolated image details to the cutter base.
    pieces.push(up(exterior,1),up(detail,Math.max(2,p.bladeHeight-3)));
  }
  if(p.nameplate) {
    const low=geom2.toOutlines(exterior).flat().filter(pt=>pt[1]<bb[0][1]+.05).sort((a,b)=>Math.abs(a[0]-cx)-Math.abs(b[0]-cx)),anchorX=low[0][0];
    pieces.push(up(roundedRectangle({size:[Math.min(width*.65,40),9],roundRadius:1.5,center:[anchorX,bb[0][1]-2]}),p.brimHeight));
  }
  if((p.text||(p.textStyle==='vertical'&&p.textSecondLine))&&font) pieces.push(p.textStyle==='vertical'?verticalBrimText(exterior,p,font):curvedBrimText(exterior,p,font));
  // JSCAD's final retessellation can overlap tiny letter facets on a flat wall.
  // Keep its BSP union faces here; our checked triangulation handles T-junctions.
  if(p.textStyle==='vertical'&&(p.text||p.textSecondLine)&&font){
    const base=triangulatePart({name:'Base del cortador',geometry:union(...pieces.slice(0,-1))}).geometry;
    return unionGeom3Sub(base,pieces.at(-1));
  }
  return union(...pieces);
}

/** Upright glyphs: local X follows the CCW wall, local Y becomes global Z.
 * The bottom line starts on the brim; every glyph overlaps the supporting wall. */
export function verticalBrimText(exterior,p,font) {
  const outline=ccw(geom2.toOutlines(exterior).sort((a,b)=>Math.abs(area(b))-Math.abs(area(a)))[0]);
  const lengths=[0];outline.forEach((a,i)=>{const b=outline[(i+1)%outline.length];lengths.push(lengths.at(-1)+Math.hypot(b[0]-a[0],b[1]-a[1]));});
  const perimeter=lengths.at(-1),minY=Math.min(...outline.map(pt=>pt[1]));
  let bottom=lengths[outline.findIndex(pt=>pt[1]===minY)];
  const flat=outline.map((pt,i)=>({i,length:lengths[i+1]-lengths[i]})).filter(({i})=>Math.abs(outline[i][1]-minY)<.02&&Math.abs(outline[(i+1)%outline.length][1]-minY)<.02).sort((a,b)=>b.length-a.length);
  if(flat.length)bottom=lengths[flat[0].i]+flat[0].length/2;
  const sample=s=>{s=(s%perimeter+perimeter)%perimeter;let i=0;while(lengths[i+1]<s)i++;const a=outline[i],b=outline[(i+1)%outline.length],f=(s-lengths[i])/(lengths[i+1]-lengths[i]);return {point:[a[0]+f*(b[0]-a[0]),a[1]+f*(b[1]-a[1])],angle:Math.atan2(b[1]-a[1],b[0]-a[0])};};
  const lines=[p.text,p.textSecondLine].filter(Boolean).map(text=>{
    const glyphs=font.stringToGlyphs(text);
    if(glyphs.some(g=>g.index===0))throw new Error('La fuente no contiene uno de los caracteres del texto. Carga otra TTF.');
    const widths=glyphs.map((g,i)=>(g.advanceWidth||font.unitsPerEm*.4)+(i<glyphs.length-1?font.getKerningValue(g,glyphs[i+1]):0));
    const paths=glyphs.map(g=>flattenCommands(g.getPath(0,0,font.unitsPerEm).commands));
    const bb=bounds(paths.flat());return {widths,paths,minY:bb[1][0],height:bb[1][1]-bb[1][0],width:widths.reduce((s,w)=>s+w,0)};
  });
  const gap=.6,available=p.wallHeight-p.brimHeight-.4;
  const ratio=Math.min(p.textHeight/Math.max(...lines.map(l=>l.height)),(available-gap*(lines.length-1))/lines.reduce((s,l)=>s+l.height,0),perimeter*.36/Math.max(...lines.map(l=>l.width)));
  if(!Number.isFinite(ratio)||Math.min(...lines.map(l=>l.height))*ratio<1.5)throw new Error('El texto vertical no cabe. Acórtalo, aumenta el tamaño o sube la altura de la pared de soporte.');
  const pieces=[];let z=p.brimHeight-.06;
  // Draw the second input on the bottom row, preserving a shared baseline per row.
  for(const line of [...lines].reverse()) {
    let cursor=-line.width*ratio/2;
    line.paths.forEach((loops,i)=>{
      const advance=line.widths[i]*ratio,distance=bottom+cursor+advance/2,at=sample(distance);cursor+=advance;
      if(!loops.length)return;
      const normal=[Math.sin(at.angle),-Math.cos(at.angle)];
      const scaled=loops.map(loop=>simplifyLoop(loop.map(pt=>[pt[0]*ratio-advance/2,(pt[1]-line.minY)*ratio]),.02));
      const box=bounds(scaled);let inset=.24;
      for(let j=0;j<=12;j++){const pt=sample(distance+box[0][0]+(box[0][1]-box[0][0])*j/12).point;inset=Math.max(inset,-((pt[0]-at.point[0])*normal[0]+(pt[1]-at.point[1])*normal[1])+.2);}
      // An inward overlap compensates chord sag on curved walls; trim at inner face.
      const glyph=up(regionFromLoops(scaled),inset+p.textDepth);
      pieces.push(translate([at.point[0]-normal[0]*inset,at.point[1]-normal[1]*inset,z],rotateZ(at.angle,rotateX(Math.PI/2,glyph))));
    });
    z+=line.height*ratio+gap;
  }
  if(!pieces.length)throw new Error('Introduce texto visible.');
  return subtract(union(...pieces),up(grow(exterior,-p.wallThickness+.08),p.bladeHeight+1));
}

/** OpenType glyphs follow the actual lower brim contour, extruded Z=0..2.5. */
export function curvedBrimText(exterior,p,font) {
  const usable=subtract(grow(exterior,p.brimWidth),exterior);
  const outline=ccw(geom2.toOutlines(grow(exterior,p.brimWidth-.45)).sort((a,b)=>Math.abs(area(b))-Math.abs(area(a)))[0]);
  const lengths=[0]; outline.forEach((pt,i)=>{const next=outline[(i+1)%outline.length];lengths.push(lengths.at(-1)+Math.hypot(next[0]-pt[0],next[1]-pt[1]));});
  const perimeter=lengths.at(-1); let bottom=0;
  outline.forEach((pt,i)=>{if(pt[1]<outline[bottom][1])bottom=i;});
  let bottomDistance=lengths[bottom];
  const flatSegments=outline.map((pt,i)=>({i,length:lengths[i+1]-lengths[i]})).filter(({i})=>Math.abs(outline[i][1]-outline[bottom][1])<.02&&Math.abs(outline[(i+1)%outline.length][1]-outline[bottom][1])<.02).sort((a,b)=>b.length-a.length);
  if(flatSegments.length)bottomDistance=lengths[flatSegments[0].i]+flatSegments[0].length/2;
  const sample=(s)=>{s=((s%perimeter)+perimeter)%perimeter;let i=0;while(lengths[i+1]<s)i++;const a=outline[i],b=outline[(i+1)%outline.length],f=(s-lengths[i])/(lengths[i+1]-lengths[i]);return {point:[a[0]+f*(b[0]-a[0]),a[1]+f*(b[1]-a[1])],angle:Math.atan2(b[1]-a[1],b[0]-a[0])};};
  const glyphs=font.stringToGlyphs(p.text);
  if(glyphs.some(g=>g.index===0))throw new Error('La fuente no contiene uno de los caracteres del texto. Carga otra TTF.');
  const rawWidths=glyphs.map((g,i)=>(g.advanceWidth||font.unitsPerEm*.4)+(i<glyphs.length-1?font.getKerningValue(g,glyphs[i+1]):0));
  const rawTotal=rawWidths.reduce((a,b)=>a+b,0);
  let fontSize=Math.min(p.textSize?p.textSize*25.4/72:Infinity,(p.brimWidth-1)*1.15,perimeter*.36*font.unitsPerEm/rawTotal);
  for(let attempt=0;attempt<8;attempt++,fontSize*=.84) {
    const ratio=fontSize/font.unitsPerEm,total=rawTotal*ratio; let cursor=-total/2; const shapes=[];
    glyphs.forEach((g,i)=>{
      const advance=rawWidths[i]*ratio,at=sample(bottomDistance+cursor+advance/2);cursor+=advance;
      const loops=flattenCommands(g.getPath(0,0,fontSize).commands);
      if(!loops.length)return;
      const b=bounds(loops),glyph=translate([-advance/2,.15-b[1][0]],regionFromLoops(loops));
      shapes.push(translate(at.point,rotateZ(at.angle,glyph)));
    });
    if(!shapes.length)throw new Error('Introduce texto visible.');
    const text=union(...shapes),outside=Math.abs(measureArea(subtract(text,usable)));
    if(outside<.001 && fontSize>=1.5)return up(text,2.5);
  }
  throw new Error('El texto no cabe en la curva inferior. Acórtalo o aumenta el ancho de empuñadura.');
}

function threadOptions(p,clearance=0,length=p.threadLength) {return {diameter:p.threadDiameter,pitch:p.threadPitch,length,clearance};}

export function createStamp(exterior,details,p,logoLoops=null) {
  if(p.stampHandle==='threaded')return createThreadedStamp(exterior,intersect(grow(details,Math.max(0,(p.interiorThickness-1)/2)),exterior),p);
  const plate=exterior, top=p.reliefHeight+p.brimHeight+1;
  const outlines=geom2.toOutlines(exterior),bb=measureBoundingBox(exterior),radius=p.stampHandle==='integrated'?p.handleDiameter/2+2.1:p.threadDiameter/2+.6;
  const candidates=[[0,0]];
  for(let y=1;y<12;y++)for(let x=1;x<12;x++)candidates.push([bb[0][0]+(bb[1][0]-bb[0][0])*x/12,bb[0][1]+(bb[1][1]-bb[0][1])*y/12]);
  candidates.sort((a,b)=>Math.hypot(...a)-Math.hypot(...b));
  const anchor=candidates.find(c=>Array.from({length:32},(_,i)=>[c[0]+radius*Math.cos(i*TAU/32),c[1]+radius*Math.sin(i*TAU/32)]).every(pt=>outlines.reduce((inside,loop)=>contains(pt,loop)?!inside:inside,false)));
  if(!anchor)throw new Error('El mango no cabe dentro de la placa. Aumenta el tamaño o reduce su diámetro.');
  const relief=intersect(grow(details,Math.max(0,(p.interiorThickness-1)/2)),plate);
  const handle=p.stampHandle==='integrated'?createIntegratedHandle(p,logoLoops):threadedVolume(threadOptions(p));
  // Flip the integrated assembly: its exposed handle face is on the bed,
  // while the relief points along +Z. Preserve XY artwork orientation.
  const solid=union(up(relief,p.reliefHeight),up(plate,p.brimHeight+1,p.reliefHeight),translate([anchor[0],anchor[1],top],handle));
  const flipped=mirrorY(rotateX(Math.PI,solid));
  return translate([0,0,-measureBoundingBox(flipped)[0][2]],flipped);
}

/** Short solid knob with a broad tapered foot and a chamfered, flat logo face. */
export function createIntegratedHandle(p,logoLoops=null) {
  const r=p.handleDiameter/2,h=p.handleHeight,segments=64;
  const taper=(r1,r2,height,z)=>cylinderElliptic({startRadius:[r1,r1],endRadius:[r2,r2],height,center:[0,0,z+height/2],segments});
  let handle=union(taper(r+2,r-.8,2.5,-.1),cylinder({radius:r-.8,height:h-2.7,center:[0,0,2+(h-2.7)/2],segments}),taper(r-.8,r,1,h-3),cylinder({radius:r,height:1.4,center:[0,0,h-1.4],segments}),taper(r,r-.6,.7,h-.7));
  if(logoLoops?.length){const normalized=normalizeLoops(logoLoops,p.handleDiameter),maxRadius=Math.max(...normalized.flat().map(pt=>Math.hypot(...pt))),logo=regionFromLoops(normalized.map(loop=>loop.map(pt=>pt.map(v=>v*(r-1.5)/maxRadius))));handle=subtract(handle,up(logo,1.05,h-1));}
  return handle;
}
export function createNut(p,logoLoops=null) {
  const minRadius=p.threadDiameter/2+p.tolerance+3,radius=Math.max(14,minRadius+4),height=p.threadLength+3.5;
  let shape;
  if(p.nutShape==='hex')shape=circle({radius:radius,segments:6});
  else if(p.nutShape==='heart') {
    const points=Array.from({length:80},(_,i)=>{const t=i*TAU/80;return [16*Math.sin(t)**3,13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t)];});
    shape=union(regionFromLoops(normalizeLoops([points],radius*2)),circle({radius:minRadius,segments:40}));
  } else shape=polygon({points:Array.from({length:96},(_,i)=>{const a=i*TAU/96,r=radius+1.8*Math.cos(6*a);return [r*Math.cos(a),r*Math.sin(a)];})});
  let nut=up(shape,height);
  const cavity=translate([0,0,-.05],threadedVolume(threadOptions(p,p.tolerance,p.threadLength+.4)));
  const entry=cylinderElliptic({startRadius:[p.threadDiameter/2+p.tolerance+.4,p.threadDiameter/2+p.tolerance+.4],endRadius:[p.threadDiameter/2-p.threadPitch*.375+p.tolerance,p.threadDiameter/2-p.threadPitch*.375+p.tolerance],height:.8,center:[0,0,.35],segments:40});
  nut=subtract(nut,cavity,entry);
  if(logoLoops?.length) {
    const logo=regionFromLoops(normalizeLoops(logoLoops,minRadius*1.45));
    nut=subtract(nut,up(logo,1.05,height-1));
  }
  return nut;
}

export function createRoller(details,p) {
  const radius=p.rollerDiameter/2,length=p.size,angular=128,axial=96;
  const outlines=geom2.toOutlines(details),bb=measureBoundingBox(details),sx=bb[1][0]-bb[0][0],sy=bb[1][1]-bb[0][1];
  const inside=(pt)=>outlines.reduce((found,loop)=>contains(pt,loop)?!found:found,false);
  // A periodic radial heightfield avoids folding long triangles through the axis.
  // Every shared grid vertex is reused; seam, end annuli and axial bore are closed.
  const grid=Array.from({length:axial+1},(_,j)=>Array.from({length:angular},(_,i)=>{
    const u=i/angular,v=j/axial,angle=u*TAU;
    const black=u>.06&&u<.94&&v>4/length&&v<1-4/length&&inside([bb[0][0]+(u-.06)/.88*sx,bb[0][1]+(v*length-4)/(length-8)*sy]);
    const r=radius+(black?p.reliefHeight:0);return [r*Math.cos(angle),r*Math.sin(angle),v*length];
  }));
  const faces=[],triangle=(a,b,c)=>faces.push(poly3.create([a,b,c]));
  for(let j=0;j<axial;j++)for(let i=0;i<angular;i++){const n=(i+1)%angular,a=grid[j][i],b=grid[j][n],c=grid[j+1][n],d=grid[j+1][i];triangle(a,b,c);triangle(a,c,d);}
  for(let i=0;i<angular;i++){
    const n=(i+1)%angular,a=i*TAU/angular,b=n*TAU/angular;
    const bi=[4*Math.cos(a),4*Math.sin(a),0],bn=[4*Math.cos(b),4*Math.sin(b),0],ti=[bi[0],bi[1],length],tn=[bn[0],bn[1],length];
    triangle(grid[0][n],grid[0][i],bi);triangle(grid[0][n],bi,bn);
    triangle(grid[axial][i],grid[axial][n],tn);triangle(grid[axial][i],tn,ti);
    triangle(bn,bi,ti);triangle(bn,ti,tn);
  }
  return geom3.create(faces);
}

export function buildLegacyDesign({loops,params,font=null,logoLoops=null}) {
  const p=validateParams(params),normalized=normalizeLoops(loops,p.size,p.mirror),nodes=classifyLoops(normalized);
  const root=nodes.find(n=>n.depth===0);if(!root)throw new Error('No hay contorno exterior.');
  const exterior=polygon({points:root.points}),details=regionFromLoops(nodes.map(n=>n.points));
  let parts=[],warnings=[];
  if(nodes.filter(n=>n.depth===0).length>1)warnings.push('Hay varias siluetas: se usa la de mayor área como contorno exterior.');
  const part=(name,geometry,color)=>({name,geometry,color});
  if(p.mode==='cutter')parts=[part('Cortador',createCutter(exterior,p,details,font),'#588bff')];
  if(p.mode==='cutterStamp')parts=[part('Cortador',createCutter(exterior,{...p,details:false},details,font),'#588bff'),part('Sello',createStamp(grow(exterior,-p.wallThickness-.4),details,p,logoLoops),'#9984e8')];
  if(p.mode==='stamp') {
    let plate=exterior,art=details;
    if(p.stampBase==='circle'){
      const radius=p.size/2,maxRadius=Math.max(...normalized.flat().map(pt=>Math.hypot(...pt))),factor=Math.min(1,(radius-1.5)/maxRadius);
      plate=circle({radius,segments:96});art=scale([factor,factor],details);
    }
    parts=[part('Sello',createStamp(plate,art,p,logoLoops),'#9984e8')];
  }
  if(['stamp','cutterStamp'].includes(p.mode)&&p.stampHandle==='threaded')parts.push(part('Mango roscado',createThreadedHandle(p,logoLoops),'#9984e8'));
  if(p.mode==='kpop') {
    const simple=nodes.map(n=>simplifyLoop(n.points,p.smoothing)),outline=polygon({points:ccw(simple[0])}),detailSimple=regionFromLoops(simple),cavity=grow(outline,.35);
    parts=[part('Molde K-pop',subtract(up(grow(outline,3),p.reliefHeight+3),up(cavity,p.reliefHeight+1.1,2),up(detailSimple,p.reliefHeight+1.6,1.5)),'#588bff')];
  }
  if(p.mode==='roller') {parts=[part('Rodillo',createRoller(details,p),'#588bff')];warnings.push('Relieve muestreado a 128 × 96 puntos con bordes suavizados; eje pasante de 8 mm. Los detalles muy finos pueden perderse.');}
  if(p.mode==='topper') {
    const bb=measureBoundingBox(exterior), minY=bb[0][1],w=bb[1][0]-bb[0][0];
    const stem=rectangle({size:[Math.min(w*.25,5),p.topperStake+3],center:[(bb[0][0]+bb[1][0])/2,minY-p.topperStake/2+1]});
    const connector=rectangle({size:[w+1,3],center:[(bb[0][0]+bb[1][0])/2,minY+1]});
    parts=[part('Topper',up(union(exterior,stem,connector),p.brimHeight),'#588bff')];
  }
  if(p.mode==='stencil') {
    const bb=measureBoundingBox(details),w=bb[1][0]-bb[0][0]+12,h=bb[1][1]-bb[0][1]+12,cx=(bb[0][0]+bb[1][0])/2,cy=(bb[0][1]+bb[1][1])/2;
    const blank=roundedRectangle({size:[w,h],roundRadius:3,center:[cx,cy]});
    const cross=union(rectangle({size:[w,p.interiorThickness],center:[cx,cy]}),rectangle({size:[p.interiorThickness,h],center:[cx,cy]}));
    // Bridge each white island independently to a frame edge; a single cross is insufficient.
    const bridges=nodes.filter(n=>n.depth%2===1).map(n=>{const b=bounds([n.points]),y=(b[1][0]+b[1][1])/2;return rectangle({size:[w,p.interiorThickness],center:[cx,y]});});
    const cutout=subtract(details,...(bridges.length?bridges:[geom2.create()]),...(p.bars?[cross]:[]));
    parts=[part('Stencil',up(subtract(blank,cutout),p.brimHeight),'#588bff')];
  }
  if(p.mode==='set') parts=[.7,.85,1].map((factor,i)=>part(`Cortador ${Math.round(p.size*factor)} mm`,createCutter(scale([factor,factor],exterior),{...p,textHeight:Math.max(1.5,Math.floor(p.textHeight*factor*10+1e-8)/10)},null,font),['#b1a3ed','#77a0fb','#588bff'][i]));
  if(['stamp','cutterStamp'].includes(p.mode)&&p.stampHandle==='threaded')warnings.push(`Relieve hacia arriba. Vaso hembra en el sello y espiga macho en el mango. Holgura radial: ${p.tolerance.toFixed(2)} mm. Verifica el ajuste con una impresión de prueba.`);
  if(['stamp','cutterStamp'].includes(p.mode)&&p.stampHandle==='integrated')warnings.push('Pomo integrado: el relieve mira hacia arriba y la placa queda elevada. Revisa los soportes en el laminador. El mango roscado permite imprimir las dos bases planas.');
  if(p.details&&p.mode==='cutter')warnings.push('Los detalles interiores incluyen una placa de unión de 1 mm.');
  return {parts,warnings,params:p};
}


export function buildDesign(input){return input.params?.schemaVersion===2?buildAdvancedDesign(input):buildLegacyDesign(input);}
