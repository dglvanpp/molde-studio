import jscad from '@jscad/modeling';
import unionGeom3Sub from '@jscad/modeling/src/operations/booleans/unionGeom3Sub.js';
import subtractGeom3Sub from '@jscad/modeling/src/operations/booleans/subtractGeom3Sub.js';
import {validateAdvanced} from './advanced-config.js';
import {scaleToLongestSide} from './potrace-pipeline.js';
import {classifyLoops,area,simplifyLoop,bounds,flattenCommands,contains,normalizeLoops} from './contours.js';
import {regionFromLoops} from './regions.js';
import {offsetRegion as grow} from './offsets.js';
import {threadedVolume} from './threads.js';
import {roundedGripBody} from './stamp-system.js';
import {shapedGripBody} from './grip-shapes.js';
import {triangulatePart} from './solid-mesh.js';
import {loftRings} from './loft-rings.js';
import {planarIntersect,planarSubtract} from './planar-boolean.js';
import {extrudePlanar} from './extrude-planar.js';
import {robustBoolean} from './robust-csg.js';
import {buildLegacyDesign,defaults as legacyDefaults,verticalBrimText,curvedBrimText} from './geometry.js';
const {polygon,circle,rectangle,roundedRectangle,cylinderElliptic}=jscad.primitives;
const {union,subtract,intersect}=jscad.booleans;
const {translate,rotateX,rotateZ,mirrorX,mirrorY,scale}=jscad.transforms;
const {measureBoundingBox,measureArea,measureVolume}=jscad.measurements;
const {geom2}=jscad.geometries;
const TAU=Math.PI*2;
const up=(shape,h,z=0)=>{geom2.validate(shape);if(Math.abs(measureArea(shape))<.001)throw new Error('Una pared desaparece con estas medidas. Aumenta el diseño o reduce su grosor.');return extrudePlanar(shape,h,z);};
const ring=(shape,t)=>subtract(shape,grow(shape,-t));
const box2=shape=>{const b=measureBoundingBox(shape);return {minX:b[0][0],minY:b[0][1],maxX:b[1][0],maxY:b[1][1]};};
function bottomAnchor(shape){const pts=geom2.toOutlines(shape).flat(),min=Math.min(...pts.map(p=>p[1]));return pts.filter(p=>p[1]<min+.001).sort((a,b)=>Math.abs(a[0])-Math.abs(b[0]))[0];}

/** Letter paths stay inside the existing brim; never add a name tab. */
export function firstLayerText(exterior,p,font){
  if(!p.text||!font)return null;
  return scale([1,1,p.textExtrusion/2.5],curvedBrimText(exterior,{...p,brimWidth:p.symmetric?p.brimWidth/2:p.brimWidth,textHeight:p.textSize*25.4/72},font));
}

function pressHandle(exterior,p,base){
  const thickness=Math.min(3.5,p.pressLength/6,p.pressWidth/6);
  const shape=(w,h,r)=>r>0?roundedRectangle({size:[w,h],roundRadius:r}):rectangle({size:[w,h]});
  let frame=subtract(shape(p.pressLength,p.pressWidth,p.pressRadius),shape(p.pressLength-2*thickness,p.pressWidth-2*thickness,Math.max(0,p.pressRadius-thickness)));
  frame=rotateZ(p.pressRotation*Math.PI/180,frame);
  const rotated=box2(frame),ext=p.symmetric?p.brimWidth/2:p.brimWidth,b=box2(exterior);
  let pos;
  if(p.pressPosition==='front'){const a=bottomAnchor(exterior);pos=[a[0],a[1]-ext-p.pressOverlap+2*p.pressOverlap-rotated.maxY];}
  if(p.pressPosition==='back')pos=[(b.minX+b.maxX)/2,b.maxY+ext-p.pressOverlap-rotated.minY];
  if(p.pressPosition==='left')pos=[b.minX-ext+p.pressOverlap-rotated.maxX,(b.minY+b.maxY)/2];
  if(p.pressPosition==='right')pos=[b.maxX+ext-p.pressOverlap-rotated.minX,(b.minY+b.maxY)/2];
  const solid=up(translate(pos,frame),p.brimHeight);
  if(Math.abs(measureVolume(intersect(solid,base)))<.01)throw new Error('El asa no toca la empuñadura. Aumenta Solapamiento o cambia Posición / Rotación.');
  return solid;
}

export function createAdvancedCutter(exterior,p,font=null){
  const wall=p.bladeThickness+(p.extraEnabled?p.extraThickness:0),bw=p.symmetric?p.brimWidth/2:p.brimWidth,inner=wall+(p.symmetric?p.brimWidth/2:0);
  const baseRegion=subtract(grow(exterior,bw),grow(exterior,-inner));
  const base=p.pressEnabled?up(baseRegion,p.brimHeight):null;
  const extra=p.extraEnabled?p.extraDepth:0,bevelH=p.sharpEnabled?p.bevelHeight:0,sections=[];
  const add=(z,delta,t)=>sections.push({z,outer:grow(exterior,delta),inner:grow(exterior,-t)});
  if(p.brimShape==='round'){
    const r=Math.min(p.brimHeight*.45,bw*.45,1.5);
    for(let i=0;i<=6;i++){const a=i*Math.PI/12;add(r-r*Math.cos(a),bw-r+r*Math.sin(a),inner);}
    for(let i=0;i<=6;i++){const a=i*Math.PI/12;add(p.brimHeight-r+r*Math.sin(a),bw-r+r*Math.cos(a),inner);}
  }else{add(0,bw,inner);add(p.brimHeight,bw,inner);}
  add(p.brimHeight,0,extra>0?wall:p.bladeThickness);
  if(extra>0){add(p.brimHeight+extra,0,wall);add(p.brimHeight+extra,0,p.bladeThickness);}
  add(p.brimHeight+p.bladeDepth-bevelH,0,p.bladeThickness);
  if(bevelH)add(p.brimHeight+p.bladeDepth,0,p.tipWidth);
  let body=loftRings(sections);
  if(p.pressEnabled)body=unionGeom3Sub(triangulatePart({name:'Cortador',geometry:body}).geometry,pressHandle(exterior,p,base));
  if(p.text&&p.textStyle==='flat'&&p.textExtrusion<=p.brimHeight)throw new Error('Para ver el texto plano sin añadir pestañas, su extrusión debe superar la altura de empuñadura. También puedes elegir Vertical sobre la empuñadura.');
  const text=p.text&&font&&p.textStyle==='vertical'?verticalBrimText(exterior,{...p,textSecondLine:'',textHeight:p.textSize*25.4/72,textDepth:p.textExtrusion,wallThickness:wall,wallHeight:p.brimHeight+(extra||p.bladeDepth-bevelH),bladeHeight:p.brimHeight+p.bladeDepth},font):firstLayerText(exterior,p,font);
  return text?robustBoolean('union',triangulatePart({name:'Cuerpo del cortador',geometry:body}).geometry,text):body;
}

export function connectionAnchor(exterior,p){
  const bb=box2(exterior),outlines=geom2.toOutlines(exterior),r=(p.stampHandle==='integrated'?p.handleDiameter:p.threadDiameter)/2+.8;
  const manual=[bb.minX+(bb.maxX-bb.minX)*p.connectionX/100,bb.minY+(bb.maxY-bb.minY)*p.connectionY/100];
  const candidates=p.connectionMode==='manual'?[manual]:[[(bb.minX+bb.maxX)/2,(bb.minY+bb.maxY)/2]];
  if(p.connectionMode==='auto')for(let y=1;y<12;y++)for(let x=1;x<12;x++)candidates.push([bb.minX+(bb.maxX-bb.minX)*x/12,bb.minY+(bb.maxY-bb.minY)*y/12]);
  const anchor=candidates.find(c=>Array.from({length:64},(_,i)=>[c[0]+r*Math.cos(i*TAU/64),c[1]+r*Math.sin(i*TAU/64)]).every(pt=>outlines.reduce((inside,l)=>contains(pt,l)?!inside:inside,false))&&Math.abs(measureArea(subtract(circle({radius:r,segments:64,center:c}),exterior)))<.001);
  if(!anchor)throw new Error('La rosca no cabe en esa posición. Usa Auto, cambia X/Y o reduce el diámetro.');
  return anchor;
}

export function createFemaleGrip(p,logoLoops=null){
  let body=p.gripShape==='circle'?roundedGripBody(p.stampHandle==='integrated'?{...p,threadDiameter:8}:p):shapedGripBody(p);
  const cavity=translate([0,0,p.handleHeight],rotateZ(.037,rotateX(Math.PI,threadedVolume({diameter:p.threadDiameter,pitch:2,length:p.threadCupDepth,clearance:p.tolerance,segments:48}))));
  const major=p.threadDiameter/2+p.tolerance,minor=major-.75,h=.65;
  const mouth=cylinderElliptic({height:h+.08,startRadius:[minor,minor],endRadius:[major+.3,major+.3],center:[0,0,p.handleHeight-h/2+.04],segments:48});
  if(p.stampHandle!=='integrated')body=robustBoolean('subtract',robustBoolean('subtract',body,cavity),mouth);
  if(logoLoops?.length){
    const radius=p.handleDiameter/2-p.handleBottomRound-.5;
    const normalized=normalizeLoops(logoLoops,2*radius),maxR=Math.max(...normalized.flat().map(pt=>Math.hypot(...pt)));
    const logo=regionFromLoops(normalized.map(l=>l.map(pt=>pt.map(x=>x*radius/maxR))));
    body=robustBoolean('subtract',body,up(mirrorY(logo),1.08,-.08));
  }
  return body;
}

export function createMaleStamp(exterior,details,p,logoLoops=null){
  const length=p.stampHandle==='integrated'?p.handleHeight:p.threadCupDepth-.5,anchor=connectionAnchor(exterior,p),plate=up(exterior,p.stampBack,length);
  const art=planarIntersect(details,exterior);
  const voids=planarSubtract(exterior,art);
  const z=length+p.stampBack,onPlane=poly=>poly.vertices.every(v=>Math.abs(v[2]-z)<1e-7);
  const raised=up(art,p.stampPrintDepth,z);
  // Stitch the exposed terrace to the relief; avoid coplanar BSP overlap.
  const faces=[...jscad.geometries.geom3.toPolygons(plate).filter(poly=>!onPlane(poly)),...jscad.geometries.geom3.toPolygons(raised).filter(poly=>!onPlane(poly))];
  if(Math.abs(measureArea(voids))>.001)faces.push(...jscad.geometries.geom3.toPolygons(up(voids,1,z-1)).filter(onPlane));
  const main=triangulatePart({name:'Placa del sello',geometry:jscad.geometries.geom3.create(faces)}).geometry;
  const male=p.stampHandle==='integrated'?translate([anchor[0],anchor[1],0],createFemaleGrip(p,logoLoops)):translate([anchor[0],anchor[1],length],rotateZ(.037,rotateX(Math.PI,threadedVolume({diameter:p.threadDiameter,pitch:2,length,segments:48}))));
  return unionGeom3Sub(main,male);
}

export function buildAdvancedDesign({loops,params,font=null,logoLoops=null}){
  const p=validateAdvanced(params),scaled=scaleToLongestSide(loops,p.size);
  if(p.mirror!==Boolean(p.stampInvert&&['stamp','cutterStamp'].includes(p.mode)))for(const l of scaled)for(const point of l)point[0]*=-1;
  const nodes=classifyLoops(scaled);if(!nodes.length)throw new Error('El dibujo no contiene áreas cerradas.');
  const root=nodes[0],original=bounds([root.points]),simple=simplifyLoop(root.points,p.smoothing),b=bounds([simple]);
  // RDP may omit an extremum: restore the exact nominal SVG bounds afterwards.
  const corrected=simple.map(pt=>pt.map((v,k)=>original[k][0]+(v-b[k][0])*(original[k][1]-original[k][0])/(b[k][1]-b[k][0])));
  const exterior=polygon({points:area(corrected)<0?corrected.reverse():corrected});
  let details=regionFromLoops(nodes.map((n,i)=>i===0?corrected:simplifyLoop(n.points,Math.min(.05,p.smoothing))));
  if(p.removeOuterEdge&&['stamp','cutterStamp'].includes(p.mode)){
    const innerNodes=nodes.filter(n=>n.depth>=2);
    if(!innerNodes.length)throw new Error('Al eliminar el borde no quedan detalles para imprimir. Desmarca Eliminar borde exterior.');
    details=regionFromLoops(innerNodes.map(n=>simplifyLoop(n.points,Math.min(.05,p.smoothing))));
  }
  const parts=[],warnings=[],part=(name,geometry,color='#588bff')=>({name,geometry,color});
  if(nodes.filter(n=>n.depth===0).length>1)warnings.push('Se usa la silueta de mayor área como límite del cortador.');
  if(['cutter','cutterStamp'].includes(p.mode))parts.push(part('Cortador',createAdvancedCutter(exterior,p,font)));
  if(p.mode==='set')for(const factor of [.7,.85,1])parts.push(part(`Cortador ${(p.size*factor).toFixed(1)} mm`,createAdvancedCutter(scale([factor,factor],exterior),p,font)));
  if(['stamp','cutterStamp'].includes(p.mode)){
    const footprint=p.stampBase==='circle'?circle({radius:Math.max(...nodes.flatMap(n=>n.points).map(pt=>Math.hypot(...pt)))+.5,segments:96}):exterior;
    const plate=p.mode==='cutterStamp'?grow(exterior,-p.bladeThickness-(p.extraEnabled?p.extraThickness:0)-p.stampTolerance):footprint;
    parts.push(part('Sello · relieve arriba',createMaleStamp(plate,details,p,logoLoops),'#9984e8'));
    if(p.stampHandle!=='integrated')parts.push(part('Agarre · rosca interior',createFemaleGrip(p,logoLoops),'#9984e8'));
    warnings.push(p.stampHandle==='integrated'?'Sello integrado con relieve arriba y mango bajo la placa: revisa sus soportes en el laminador.':'El agarre se apoya en Z=0 con el vaso abierto arriba. El sello tiene una espiga trasera debajo de la placa: revisa sus soportes en el laminador.');
  }
  if(!parts.length){
    const legacy=buildLegacyDesign({loops,params:{...legacyDefaults,mode:p.mode,size:p.size,brimHeight:p.brimHeight,reliefHeight:p.stampPrintDepth,rollerDiameter:p.rollerDiameter,topperStake:p.topperStake,mirror:p.mirror,interiorThickness:p.interiorThickness},font,logoLoops});
    return {...legacy,params:p};
  }
  return {parts,warnings,params:p};
}
