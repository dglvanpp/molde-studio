import test from 'node:test';
import assert from 'node:assert/strict';
import ImageTracer from 'imagetracerjs';
import {imageDefaults,imageOptions,rasterSize,morphology,preprocessRgba} from '../src/image-preprocess.js';
import {tracerOptions,tracedDataToLoops} from '../src/trace-contours.js';
import {classifyLoops} from '../src/contours.js';
const raster=(w=32,h=32)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4).fill(255)});
const pixel=(im,x,y,value,alpha=255)=>{const at=(y*im.width+x)*4;im.data[at]=im.data[at+1]=im.data[at+2]=value;im.data[at+3]=alpha;};
test('Threshold inversion is an exact complement, including equality at 128',()=>{
  const im=raster();[127,128,129].forEach((v,i)=>pixel(im,10+i,10,v));
  const a=preprocessRgba(im),b=preprocessRgba(im,{invert:true});
  assert.deepEqual([0,1,2].map(i=>a.mask[10*32+10+i]),[1,0,0]);
  for(let y=4;y<28;y++)for(let x=4;x<28;x++)assert.equal(a.mask[y*32+x]+b.mask[y*32+x],1);
  assert.equal(b.mask[0],0);
});
test('Dilation grows 3x3 to 5x5, erosion shrinks it to one pixel, neutral leaves it intact',()=>{
  const im=raster();for(let y=14;y<=16;y++)for(let x=14;x<=16;x++)pixel(im,x,y,0);
  assert.equal(preprocessRgba(im).dark,9);assert.equal(preprocessRgba(im,{lineWeight:1}).dark,25);assert.equal(preprocessRgba(im,{lineWeight:-1}).dark,1);
  const plain=preprocessRgba(im);assert.deepEqual(morphology(plain.mask,32,32,0),plain.mask);
});
test('Closing repairs a one-pixel break, preserves the hole, and cannot bridge a wide gap',()=>{
  const im=raster();for(let i=8;i<=23;i++){pixel(im,i,8,0);pixel(im,i,23,0);pixel(im,8,i,0);pixel(im,23,i,0);}pixel(im,15,8,255);
  const repaired=preprocessRgba(im,{closeGaps:1});assert.equal(repaired.mask[8*32+15],1);assert.equal(repaired.mask[16*32+16],0);
  const nodes=classifyLoops(tracedDataToLoops(ImageTracer.imagedataToTracedata(repaired,{...tracerOptions,pathomit:0,ltres:.1,qtres:.1})));
  assert.ok(nodes.some(n=>n.depth===1),'the repaired loop has an interior hole');
  for(let x=12;x<=18;x++)pixel(im,x,8,255);
  assert.equal(preprocessRgba(im,{closeGaps:1}).mask[8*32+15],0);
});
test('Resolution preserves proportions and reserves a safe morphology margin',()=>{
  const small=rasterSize(640,320),large=rasterSize(640,320,{imageScale:3,lineWeight:4,closeGaps:4});
  assert.equal(small.contentWidth,420);assert.equal(large.contentWidth,1260);assert.equal(large.contentWidth/large.contentHeight,2);assert.equal(large.margin,16);
  const dim=rasterSize(16,16,{lineWeight:4,closeGaps:4}),im=raster(dim.width,dim.height);
  for(let y=dim.margin;y<dim.height-dim.margin;y++)for(let x=dim.margin;x<dim.width-dim.margin;x++)pixel(im,x,y,0);
  const out=preprocessRgba(im,{lineWeight:4,closeGaps:4},dim.margin);
  for(let x=0;x<im.width;x++){assert.equal(out.mask[x],0);assert.equal(out.mask[(im.height-1)*im.width+x],0);}
  assert.equal(out.dark,24*24);
});
test('Transparent pixels composite on white and corrections never mutate the source',()=>{
  const im=raster();pixel(im,16,16,0,0);const copy=im.data.slice(),out=preprocessRgba(im,{lineWeight:1});
  assert.equal(out.dark,0);assert.deepEqual(im.data,copy);assert.ok(out.data.every((v,i)=>i%4===3?v===255:v===0||v===255));
});
test('Invalid correction settings are rejected and old saved designs have neutral defaults',()=>{
  assert.deepEqual(imageOptions({threshold:100,invert:true}),{...imageDefaults,threshold:100,invert:true});
  assert.throws(()=>imageOptions({imageScale:20}));assert.throws(()=>imageOptions({lineWeight:1.5}));assert.throws(()=>imageOptions({closeGaps:NaN}));
});
