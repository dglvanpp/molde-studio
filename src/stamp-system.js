import jscad from '@jscad/modeling';
import {threadedVolume} from './threads.js';
import {regionFromLoops} from './regions.js';
import {normalizeLoops,contains} from './contours.js';
import {triangulatePart} from './solid-mesh.js';
import subtractGeom3Sub from '@jscad/modeling/src/operations/booleans/subtractGeom3Sub.js';
import unionGeom3Sub from '@jscad/modeling/src/operations/booleans/unionGeom3Sub.js';
const {polygon,cylinderElliptic}=jscad.primitives;
const {union,subtract,intersect}=jscad.booleans;
const {extrudeLinear,extrudeRotate}=jscad.extrusions;
const {translate,mirrorY}=jscad.transforms;
const {measureBoundingBox}=jscad.measurements;
const {geom2}=jscad.geometries;
const TAU=Math.PI*2;
const THREAD_PITCH=2,ROOF_THICKNESS=1.2,SOCKET_WALL=1.2,AXIAL_CLEARANCE=.5,THREAD_SEGMENTS=48;

// Exactly six new controls. Relief height belongs to the existing stamp controls.
export const threadDefaults={threadCupDepth:3.7,tolerance:.2,threadDiameter:15,handleHeight:17,handleDiameter:15,handleBottomRound:2};
export function validateThreadParams(input={}){
  const p={...threadDefaults,...input};
  for(const key of Object.keys(threadDefaults))if(!Number.isFinite(p[key]))throw new Error(`Parámetro no numérico: ${key}.`);
  if(p.threadCupDepth<=AXIAL_CLEARANCE)throw new Error('La profundidad del vaso debe superar 0.5 mm.');
  if(p.tolerance<0||p.threadDiameter<=THREAD_PITCH*.75)throw new Error('Diámetro de rosca u holgura no válidos.');
  if(p.handleDiameter<p.threadDiameter)throw new Error('El diámetro del agarre debe ser al menos el diámetro de la rosca.');
  if(p.handleHeight<=1.2)throw new Error('El agarre debe superar 1.2 mm de altura.');
  const maxRound=Math.min(p.handleHeight/2,p.handleDiameter/2-.8);
  if(p.handleBottomRound<0||p.handleBottomRound>maxRound+1e-9)throw new Error(`El redondeo inferior debe estar entre 0 y ${maxRound.toFixed(2)} mm.`);
  return p;
}
const up=(region,height,z=0)=>translate([0,0,z],extrudeLinear({height},region));

/** Exterior shape is in XY. Require 1.2 mm of lateral material around the socket. */
export function socketAnchor(exterior,input={}){
  const p=validateThreadParams(input),outlines=geom2.toOutlines(exterior),bb=measureBoundingBox(exterior),radius=p.threadDiameter/2+p.tolerance+.3+SOCKET_WALL;
  const candidates=[[(bb[0][0]+bb[1][0])/2,(bb[0][1]+bb[1][1])/2],[0,0]];
  for(let yi=1;yi<12;yi++)for(let xi=1;xi<12;xi++)candidates.push([bb[0][0]+(bb[1][0]-bb[0][0])*xi/12,bb[0][1]+(bb[1][1]-bb[0][1])*yi/12]);
  const center=candidates[0];candidates.sort((a,b)=>Math.hypot(a[0]-center[0],a[1]-center[1])-Math.hypot(b[0]-center[0],b[1]-center[1]));
  const anchor=candidates.find(c=>Array.from({length:64},(_,i)=>[c[0]+radius*Math.cos(i*TAU/64),c[1]+radius*Math.sin(i*TAU/64)]).every(pt=>outlines.reduce((inside,loop)=>contains(pt,loop)?!inside:inside,false)));
  if(!anchor)throw new Error('El receptáculo no cabe con una pared lateral de 1.2 mm. Aumenta el sello o reduce la rosca.');
  return anchor;
}

/** Female volume keeps the original helix phase: clearance is applied once, radially. */
export function femaleSocketTool(input={}){
  const p=validateThreadParams(input),major=p.threadDiameter/2+p.tolerance,minor=major-THREAD_PITCH*.375;
  const thread=threadedVolume({diameter:p.threadDiameter,pitch:THREAD_PITCH,length:p.threadCupDepth,clearance:p.tolerance,segments:THREAD_SEGMENTS});
  // Mouth cone starts below Z=0 without translating or rephasing the screw tool.
  const entryHeight=Math.min(.7,p.threadCupDepth/3),entry=cylinderElliptic({startRadius:[major+.3,major+.3],endRadius:[minor,minor],height:entryHeight+.08,center:[0,0,(entryHeight-.08)/2],segments:THREAD_SEGMENTS});
  return union(thread,entry);
}

/** Plate base Z=0; downward-opening female cavity; image relief rises above the roof. */
export function createThreadedStamp(exterior,detailRegion,input={}){
  const p=validateThreadParams(input),anchor=socketAnchor(exterior,p),plateHeight=p.threadCupDepth+ROOF_THICKNESS,reliefHeight=input.reliefHeight??3;
  if(!Number.isFinite(reliefHeight)||reliefHeight<=0)throw new Error('La altura de relieve debe ser positiva.');
  const plate=up(exterior,plateHeight);
  const raised=detailRegion?up(intersect(detailRegion,exterior),reliefHeight,plateHeight):null;
  const solid=raised?union(plate,raised):plate;
  // Triangulate the complete exterior before cutting the socket. Retessellating
  // a concave plate after this cut can overlap its long, flat underside faces.
  let prepared;
  try{prepared=triangulatePart({name:'Placa y relieve del sello',geometry:solid}).geometry;}
  catch(error){
    if(!raised)throw error;
    // Fine sampled curves can make retessellation overlap tiny coplanar facets.
    prepared=triangulatePart({name:'Placa y relieve del sello',geometry:unionGeom3Sub(plate,raised)}).geometry;
  }
  return subtractGeom3Sub(prepared,translate([anchor[0],anchor[1],0],femaleSocketTool(p)));
}

/** Revolved profile: quarter-circle from (r-R,0) to (r,R), full body to Z=h. */
export function roundedGripBody(input={}){
  const p=validateThreadParams(input),r=p.handleDiameter/2,h=p.handleHeight,R=p.handleBottomRound;
  const points=[[0,0],[r-R,0]];
  if(R>0)for(let i=1;i<=18;i++){const a=-Math.PI/2+i*Math.PI/36;points.push([r-R+R*Math.cos(a),R+R*Math.sin(a)]);}
  else points[1]=[r,0];
  points.push([r,h],[0,h]);
  return extrudeRotate({segments:64},polygon({points}));
}

/** Male is printed tip-up; the free grip face and optional 1 mm engraving face downward. */
export function createThreadedHandle(input={},logoLoops=null){
  const p=validateThreadParams(input),maleLength=p.threadCupDepth-AXIAL_CLEARANCE;
  let body=roundedGripBody(p);
  if(logoLoops?.length){
    const flatRadius=p.handleDiameter/2-p.handleBottomRound,margin=Math.min(.6,flatRadius*.25),targetRadius=flatRadius-margin;
    const normalized=normalizeLoops(logoLoops,2*targetRadius),maxRadius=Math.max(...normalized.flat().map(pt=>Math.hypot(...pt)));
    const logo=regionFromLoops(normalized.map(loop=>loop.map(pt=>pt.map(value=>value*targetRadius/maxRadius))));
    // Mirror the local Y axis so the logo reads from the exposed bottom face.
    body=subtract(body,up(mirrorY(logo),1.08,-.08));
  }
  const male=translate([0,0,p.handleHeight],threadedVolume({diameter:p.threadDiameter,pitch:THREAD_PITCH,length:maleLength,segments:THREAD_SEGMENTS}));
  return union(body,male);
}

export function assemblyPlacement(exterior,input={}){
  const p=validateThreadParams(input),anchor=socketAnchor(exterior,p);
  return [anchor[0],anchor[1],-p.handleHeight];
}
