import test from 'node:test';
import assert from 'node:assert/strict';
import jscad from '@jscad/modeling';
import {defaults,createCutter,triangulatePart,validateParams} from '../src/geometry.js';
import {offsetRegion} from '../src/offsets.js';
import {createThreadedStamp,createThreadedHandle,assemblyPlacement} from '../src/stamp-system.js';
import {serializeBinarySTL} from '../src/mesh.js';
const {rectangle,circle,polygon,cuboid}=jscad.primitives;
const {measureVolume,measureBoundingBox,measureArea}=jscad.measurements;
const {intersect,subtract}=jscad.booleans;
const {translate}=jscad.transforms;
const volume=shape=>Math.abs(measureVolume(shape));
const probe=(shape,xyz,size=.1)=>volume(intersect(shape,cuboid({size:[size,size,size],center:xyz})));
const ready=geometry=>{const part=triangulatePart({name:'Prueba de corrección',geometry});serializeBinarySTL(part.geometry);return part;};

test('Concave U offset closes a narrow channel without a crossed or open polygon',()=>{
  const shape=polygon({points:[[-10,-10],[10,-10],[10,10],[1,10],[1,-5],[-1,-5],[-1,10],[-10,10]]});
  const expanded=offsetRegion(shape,3);
  jscad.geometries.geom2.validate(expanded);
  assert.ok(measureArea(expanded)>measureArea(shape));
  ready(createCutter(shape,{...defaults,smoothing:.05,brimWidth:3}));
});

test('Rounded brim has filleted upper/lower edges, a flat foot and an open center',()=>{
  const flat=ready(createCutter(rectangle({size:[80,60]}),{...defaults,roundedBrim:false}));
  const round=ready(createCutter(rectangle({size:[80,60]}),{...defaults,roundedBrim:true}));
  assert.ok(round.volume<flat.volume);
  assert.ok(Math.abs(round.bbox[0][2])<1e-6);assert.equal(round.bbox[1][2],15);
  assert.ok(probe(round.geometry,[41,0,.05])>0);
  assert.equal(probe(round.geometry,[42.9,0,.05]),0);
  assert.ok(probe(round.geometry,[42.9,0,1])>0);
  assert.equal(probe(round.geometry,[0,0,1]),0);
});

test('Stamp relief faces +Z and its female socket is blind with a 1.2 mm roof',()=>{
  const plate=circle({radius:25,segments:64}),art=subtract(circle({radius:22,segments:64}),circle({radius:20,segments:64}));
  const stamp=ready(createThreadedStamp(plate,art,{...defaults,reliefHeight:3}));
  assert.ok(Math.abs(stamp.bbox[0][2])<1e-6);
  assert.ok(Math.abs(stamp.bbox[1][2]-7.9)<1e-5);
  assert.equal(probe(stamp.geometry,[0,0,1]),0);
  assert.ok(probe(stamp.geometry,[0,0,3.8])>0);
  assert.ok(probe(stamp.geometry,[0,0,4.8])>0);
  assert.ok(probe(stamp.geometry,[21,0,7])>0);
  assert.equal(probe(stamp.geometry,[18,0,7]),0);
});

test('Handle rests at Z=0 with male thread up; six controls change its dimensions',()=>{
  for(const handleBottomRound of [0,2,4.5]){
    const part=ready(createThreadedHandle({...defaults,handleBottomRound}));
    assert.ok(Math.abs(part.bbox[0][2])<1e-5);
    assert.ok(Math.abs(part.bbox[1][2]-20.2)<1e-4);
    assert.ok(Math.abs(part.bbox[1][0]-part.bbox[0][0]-15)<1e-4);
    assert.ok(probe(part.geometry,[0,0,.1])>0);
  }
  const p={...defaults,threadCupDepth:5,threadDiameter:18,handleHeight:20,handleDiameter:22};
  const part=ready(createThreadedHandle(p));
  assert.ok(Math.abs(part.bbox[1][2]-24.5)<1e-4);
  assert.ok(Math.abs(part.bbox[1][0]-part.bbox[0][0]-22)<1e-4);
});

test('Male and female share the helix phase with clearance applied only to the socket',()=>{
  const plate=circle({radius:25,segments:64});
  for(const tolerance of [.1,.2,.4]){
    const p={...defaults,tolerance};
    const stamp=createThreadedStamp(plate,null,p),handle=translate(assemblyPlacement(plate,p),createThreadedHandle(p));
    assert.ok(volume(intersect(stamp,handle))<1e-5);
  }
});

test('Underside logo is engraved 1 mm and leaves the flat support and solid roof',()=>{
  const logo=[[[-1,-1],[1,-1],[1,0],[0,0],[0,1],[-1,1]]];
  const plain=createThreadedHandle(defaults),engraved=createThreadedHandle(defaults,logo),part=ready(engraved);
  // The fitted L logo has 36.015 mm² area. A 1 mm pocket removes that volume.
  // Subtracting two almost identical BSP meshes is itself numerically unstable.
  assert.ok(Math.abs(volume(plain)-volume(engraved)-36.015)<.001);
  assert.equal(probe(part.geometry,[-1,1,.98],.02),0);
  assert.ok(probe(part.geometry,[-1,1,1.02],.02)>0);
});

test('Impossible sockets and grip rounding fail before export',()=>{
  assert.throws(()=>validateParams({...defaults,mode:'stamp',handleDiameter:12,threadDiameter:15}),/agarre/);
  assert.throws(()=>validateParams({...defaults,mode:'stamp',handleBottomRound:8}),/redondeo/);
  assert.throws(()=>createThreadedStamp(circle({radius:6}),null,defaults),/no cabe/);
});
