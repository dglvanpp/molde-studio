import test from 'node:test';
import {readFileSync} from 'node:fs';
import {Resvg} from '@resvg/resvg-js';
import {PNG} from 'pngjs';
import ImageTracer from 'imagetracerjs';
import opentype from 'opentype.js';
import assert from 'node:assert/strict';
import {serializeBinarySTL} from '../src/mesh.js';
import {demoSvg} from '../src/demo.js';
import {tracerOptions,tracedDataToLoops} from '../src/trace-contours.js';
import {defaults,buildDesign,triangulatePart} from '../src/geometry.js';
import modeling from '@jscad/modeling';
const source=PNG.sync.read(new Resvg(demoSvg).render().asPng()),pixels={width:328,height:328,data:new Uint8ClampedArray(328*328*4).fill(255)};
for(let y=0;y<320;y++)for(let x=0;x<320;x++){const i=(y*320+x)*4,j=((y+4)*328+x+4)*4,v=source.data[i]<128?0:255;pixels.data[j]=pixels.data[j+1]=pixels.data[j+2]=v;}
export const demoLoops=tracedDataToLoops(ImageTracer.imagedataToTracedata(pixels,tracerOptions));
for(const mode of ['cutter','cutterStamp','kpop','roller','topper','stencil','stamp','set'])test(`Raster flower → ${mode} → connected watertight geometry`,()=>{
  for(const part of buildDesign({loops:demoLoops,params:{...defaults,mode}}).parts)modeling.geometries.geom3.validate(triangulatePart(part).geometry);
});
const browserPixels=PNG.sync.read(readFileSync(new URL('./fixtures/flower-canvas.png',import.meta.url))),browserLoops=tracedDataToLoops(ImageTracer.imagedataToTracedata(browserPixels,tracerOptions));
for(const mode of ['cutter','cutterStamp','kpop','roller','topper','stencil','stamp','set'])test(`Browser Canvas raster → ${mode} → valid STL geometry`,()=>{
  for(const part of buildDesign({loops:browserLoops,params:{...defaults,mode}}).parts)modeling.geometries.geom3.validate(triangulatePart(part).geometry);
});
const fontBytes=readFileSync(new URL('../public/fonts/Vera.ttf',import.meta.url)),font=opentype.parse(fontBytes.buffer.slice(fontBytes.byteOffset,fontBytes.byteOffset+fontBytes.byteLength));
for(const mode of ['cutter','set'])test(`Browser flower with two upright text rows → ${mode} → printable binary STL`,()=>{
  const design=buildDesign({loops:browserLoops,params:{...defaults,mode,text:'FLOR 8 CM',textSecondLine:'MOLDE STUDIO'},font});
  for(const part of design.parts){const ready=triangulatePart(part),data=serializeBinarySTL(ready.geometry),view=new DataView(data);assert.equal(data.byteLength,84+view.getUint32(80,true)*50);assert.equal(modeling.booleans.scission(ready.geometry).length,1);}
});
for(const [text,textSecondLine] of [['MOLDE','STUDIO'],['FLOR 8 CM','MOLDE STUDIO']])test(`Rounded set with two rows ${text} / ${textSecondLine} closes all three sizes`,()=>{
  const design=buildDesign({loops:browserLoops,params:{...defaults,mode:'set',roundedBrim:true,text,textSecondLine},font});
  for(const part of design.parts){const ready=triangulatePart(part);serializeBinarySTL(ready.geometry);modeling.geometries.geom3.validate(ready.geometry);assert.equal(modeling.booleans.scission(ready.geometry).length,1);}
});
test('Concave flower stamp with silhouette base exports a closed plate and threaded handle',()=>{
  const design=buildDesign({loops:browserLoops,params:{...defaults,mode:'stamp',stampBase:'silhouette'}});
  for(const part of design.parts){const ready=triangulatePart(part);serializeBinarySTL(ready.geometry);modeling.geometries.geom3.validate(ready.geometry);assert.ok(Math.abs(ready.bbox[0][2])<1e-5);}
});
