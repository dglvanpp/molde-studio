import jscad from '@jscad/modeling';
const {polygon,cylinder}=jscad.primitives;
const {union,intersect}=jscad.booleans;
const {extrudeHelical}=jscad.extrusions;
const {translate}=jscad.transforms;
const TAU=Math.PI*2;
/** Right-hand helical thread. clearance is RADIAL, in mm. */
export function threadedVolume({diameter=10.5,pitch=2,length=8,clearance=0,segments=40}={}) {
  const depth=pitch*.375,root=diameter/2-depth+clearance,major=diameter/2+clearance;
  const profile=polygon({points:[[root-.08,-pitch*.34],[major,-pitch*.09],[major,pitch*.09],[root-.08,pitch*.34]]});
  const helix=translate([0,0,-pitch],extrudeHelical({angle:TAU*(length/pitch+2),pitch,segmentsPerRotation:segments},profile));
  const clip=cylinder({radius:major+.1,height:length,center:[0,0,length/2],segments});
  const core=cylinder({radius:root,height:length,center:[0,0,length/2],segments});
  return union(core,intersect(helix,clip));
}
