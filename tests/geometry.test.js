import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import modeling from '@jscad/modeling';
import opentype from 'opentype.js';
import {serializeBinarySTL,repairMesh} from '../src/mesh.js';
import {defaults,buildDesign,createCutter,createStamp,createNut,createIntegratedHandle,createRoller,threadedVolume,curvedBrimText,verticalBrimText,regionFromLoops,triangulatePart,validateParams} from '../src/geometry.js';
import {classifyLoops} from '../src/contours.js';
const {circle,rectangle,polygon}=modeling.primitives;
const {measureVolume,measureBoundingBox,measureArea}=modeling.measurements;
const {intersect}=modeling.booleans;
const {translate}=modeling.transforms;
const {scission}=modeling.booleans;
const fontBytes=readFileSync(new URL('../public/fonts/Vera.ttf',import.meta.url));
const font=opentype.parse(fontBytes.buffer.slice(fontBytes.byteOffset,fontBytes.byteOffset+fontBytes.byteLength));
const outer=Array.from({length:48},(_,i)=>[40*Math.cos(i*Math.PI/24),40*Math.sin(i*Math.PI/24)]);
const inner=Array.from({length:24},(_,i)=>[12*Math.cos(i*Math.PI/12),12*Math.sin(i*Math.PI/12)]);

test('Nested loops preserve holes and islands independent of input winding',()=>{
  const loops=[[[-10,-10],[10,-10],[10,10],[-10,10]],[[-5,-5],[-5,5],[5,5],[5,-5]],[[-1,-1],[1,-1],[1,1],[-1,1]]];
  assert.deepEqual(classifyLoops(loops).map(n=>n.depth),[0,1,2]);assert.ok(Math.abs(measureArea(regionFromLoops(loops))-304)<.05);
});
test('Cutter blade, support and brim match default dimensions and one solid',()=>{
  const cutter=createCutter(rectangle({size:[80,60]}),defaults);
  const bb=measureBoundingBox(cutter);assert.ok(Math.abs(bb[0][2])<.001);assert.equal(bb[1][2],15);assert.ok(Math.abs(bb[1][0]-bb[0][0]-86)<.01);assert.equal(scission(cutter).length,1);
  const probe=(x,z)=>measureVolume(intersect(cutter,modeling.primitives.cuboid({size:[.1,.1,.1],center:[x,0,z]})));
  assert.ok(probe(39.5,14)>0);assert.equal(probe(39,14),0);assert.ok(probe(39,10)>0);assert.ok(probe(41,1)>0);assert.equal(probe(41,3),0);
});
test('Curved text starts at first layer and centers on a flat lower contour',()=>{
  const text=curvedBrimText(rectangle({size:[80,40]}),{...defaults,text:'ABC',brimWidth:5},font),bb=measureBoundingBox(text);
  assert.equal(bb[0][2],0);assert.equal(bb[1][2],2.5);assert.ok(Math.abs((bb[0][0]+bb[1][0])/2)<2);assert.ok(bb[1][1]<-20);
});
test('Nameplate remains attached to an asymmetric contour',()=>{
  const cutter=createCutter(polygon({points:[[-40,40],[40,-40],[40,40]]}),{...defaults,nameplate:true});assert.equal(scission(cutter).length,1);
});
test('Upright text stands on the brim beside the wall, with two legible rows',()=>{
  const exterior=rectangle({size:[80,40]}),p={...defaults,text:'FLOR 8 CM',textSecondLine:'Mi galleta Áij',brimHeight:3};
  const text=verticalBrimText(exterior,p,font),bb=measureBoundingBox(text);
  assert.ok(Math.abs(bb[0][2]-(p.brimHeight-.06))<.001);
  assert.ok(bb[1][2]>p.brimHeight+5&&bb[1][2]<p.wallHeight);
  assert.ok(bb[0][1]>-21&&bb[0][1]<-20.5,'letters rise at wall Y=-20, not brim edge Y=-23');
  const cutter=triangulatePart({name:'Texto vertical',geometry:createCutter(exterior,p,null,font)});
  assert.equal(scission(cutter.geometry).length,1);
});
test('Upright text stays joined around large and small curved walls',()=>{
  for(const radius of [12.5,40]){
    const p={...defaults,text:radius<20?'MÍ':'Mi galleta Áij'};
    const part=triangulatePart({name:'Texto curvo',geometry:createCutter(circle({radius,segments:96}),p,null,font)});
    assert.equal(scission(part.geometry).length,1);
  }
});
test('Integrated knob is one solid with its plate and accepts a one millimeter logo',()=>{
  const p={...defaults,mode:'stamp',stampHandle:'integrated'},shape=circle({radius:40,segments:96});
  const plain=createIntegratedHandle(p),logo=createIntegratedHandle(p,[[[-1,-1],[1,-1],[1,1],[-1,1]]]);
  assert.ok(measureVolume(logo)<measureVolume(plain));assert.ok(Math.abs(measureBoundingBox(logo)[1][2]-p.handleHeight)<.0001);
  const probe=z=>measureVolume(intersect(logo,modeling.primitives.cuboid({size:[.1,.1,.1],center:[0,0,z]})));
  assert.equal(probe(p.handleHeight-.5),0);assert.ok(probe(p.handleHeight-1.1)>0);
  const stamp=triangulatePart({name:'Pomo integrado',geometry:createStamp(shape,shape,p,[[[-1,-1],[1,-1],[1,1],[-1,1]]])});
  assert.equal(scission(stamp.geometry).length,1);assert.ok(Math.abs(stamp.bbox[1][2]-(p.reliefHeight+p.brimHeight+1+p.handleHeight))<.0001);
});
test('Stamp styles export one integrated piece or a separate threaded handle',()=>{
  for(const mode of ['stamp','cutterStamp'])for(const stampHandle of ['integrated','threaded']){
    const result=buildDesign({loops:[outer,inner],params:{...defaults,mode,stampHandle}});
    assert.equal(result.parts.length,(mode==='stamp'?1:2)+(stampHandle==='threaded'?1:0));
    result.parts.forEach(triangulatePart);
  }
});
test('Circular stamp fits all four image corners without cropping the relief',()=>{
  const loops=[[[-40,-40],[40,-40],[40,40],[-40,40]]];
  const stamp=buildDesign({loops,params:{...defaults,mode:'stamp'}}).parts[0].geometry;
  const slice=intersect(stamp,modeling.primitives.cuboid({size:[100,100,1],center:[0,0,defaults.threadCupDepth+1.2+.5]}));
  const expectedArea=2*(defaults.size/2-1.5)**2;
  assert.ok(Math.abs(measureVolume(slice)-expectedArea)/expectedArea<.0001);
  assert.ok(Math.abs(measureBoundingBox(stamp)[1][0]-40)<.001);
});
test('Three nut shapes are connected and mate with right-handed male thread',()=>{
  const male=translate([0,0,-.05],threadedVolume({diameter:defaults.threadDiameter,length:defaults.threadLength+.05}));
  for(const nutShape of ['heart','flower','hex']){
    const nut=createNut({...defaults,nutShape});assert.ok(measureVolume(nut)>0);assert.equal(scission(nut).length,1);assert.ok(Math.abs(measureVolume(intersect(male,nut)))<.0001);
  }
});
test('Logo removes one millimeter while preserving the blind-hole roof',()=>{
  const p={...defaults,nutShape:'hex'},plain=createNut(p),logo=createNut(p,[[[-1,-1],[1,-1],[1,1],[-1,1]]]);
  assert.ok(measureVolume(logo)<measureVolume(plain));assert.equal(scission(logo).length,1);assert.equal(measureBoundingBox(logo)[1][2],p.threadLength+3.5);
});
test('Matched stamp plate clears cutter walls below cutting edge',()=>{
  const cutter=createCutter(circle({radius:40,segments:48}),defaults),shape=circle({radius:38.4,segments:48}),stamp=createStamp(shape,shape,defaults);
  assert.ok(Math.abs(measureVolume(intersect(cutter,stamp)))<.0001);
});
test('Roller wraps a filled image around cylinder, has positive volume and closed triangle edges',()=>{
  const roller=createRoller(rectangle({size:[80,40]}),defaults),bb=measureBoundingBox(roller);
  assert.ok(measureVolume(roller)>40000);assert.ok(bb[0][0]<-17);assert.ok(bb[1][1]>17);assert.equal(bb[0][2],0);assert.equal(bb[1][2],80);
  const edges=new Map();const key=v=>v.map(n=>Math.round(n*1e5)).join(',');
  for(const poly of modeling.geometries.geom3.toPolygons(roller))for(let i=0;i<3;i++){const a=key(poly.vertices[i]),b=key(poly.vertices[(i+1)%3]),k=[a,b].sort().join('|');edges.set(k,(edges.get(k)||0)+1);}
  assert.ok([...edges.values()].every(count=>count===2),'every edge must have exactly two incident triangles');
});
test('All eight modes generate finite binary STL with correct header and triangle count',async()=>{
  for(const mode of ['cutter','cutterStamp','kpop','roller','topper','stencil','stamp','set']){
    const result=buildDesign({loops:[outer,inner],params:{...defaults,mode},font});assert.ok(result.parts.length);
    for(const raw of result.parts){const p=triangulatePart(raw),buffer=serializeBinarySTL(p.geometry),view=new DataView(buffer);assert.ok(p.volume>0,mode);assert.ok(buffer.byteLength>84);assert.equal(buffer.byteLength,84+50*view.getUint32(80,true),mode);modeling.geometries.geom3.validate(p.geometry);}
  }
});
test('Invalid dimensions are rejected before producing an STL',()=>{
  assert.throws(()=>validateParams({...defaults,size:NaN}));assert.throws(()=>validateParams({...defaults,wallHeight:20}));assert.throws(()=>validateParams({...defaults,textStyle:'flat',text:'ABC',brimHeight:3}));assert.doesNotThrow(()=>validateParams({...defaults,text:'ABC',brimHeight:4}));
});
test('Mesh cleanup preserves a valid skinny facet instead of opening the surface',()=>{
  const tetra=modeling.primitives.polyhedron({points:[[0,0,0],[10,0,0],[5,.004,0],[5,1,2]],faces:[[0,2,1],[0,1,3],[1,2,3],[2,0,3]],orientation:'outward'});
  const mesh=repairMesh(tetra,.01),data=serializeBinarySTL(mesh),view=new DataView(data);
  assert.equal(view.getUint32(80,true),4);assert.ok(Math.abs(measureVolume(mesh)-measureVolume(tetra))<.000001);
});
