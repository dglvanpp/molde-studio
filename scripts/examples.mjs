import {readFileSync,writeFileSync,mkdirSync,existsSync,unlinkSync} from 'node:fs';
import {PNG} from 'pngjs';
import ImageTracer from 'imagetracerjs';
import opentype from 'opentype.js';
import {tracerOptions,tracedDataToLoops} from '../src/trace-contours.js';
import {defaults,buildDesign,triangulatePart} from '../src/geometry.js';
import {createThreadedHandle} from '../src/stamp-system.js';
import {serializeBinarySTL} from '../src/mesh.js';
const raster=PNG.sync.read(readFileSync(new URL('../tests/fixtures/flower-canvas.png',import.meta.url))),loops=tracedDataToLoops(ImageTracer.imagedataToTracedata(raster,tracerOptions));
const bytes=readFileSync(new URL('../public/fonts/Vera.ttf',import.meta.url)),font=opentype.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const out=new URL('../examples/',import.meta.url);mkdirSync(out,{recursive:true});const report=[];
function save(name,part){const ready=triangulatePart(part),data=serializeBinarySTL(ready.geometry);writeFileSync(new URL(name,out),new Uint8Array(data));report.push({file:name,triangles:ready.triangles,volumeMm3:ready.volume,boundsMm:ready.bbox,bytes:data.byteLength});}
save('flor-cortador-firma.stl',buildDesign({loops,params:{...defaults,roundedBrim:false,text:'FLOR 8 CM',textSecondLine:'MOLDE STUDIO'},font}).parts[0]);
save('flor-cortador-redondo.stl',buildDesign({loops,params:{...defaults,roundedBrim:true,text:'FLOR 8 CM',textSecondLine:'MOLDE STUDIO'},font}).parts[0]);
save('sello-pomo-integrado.stl',buildDesign({loops,params:{...defaults,mode:'stamp',stampHandle:'integrated'},logoLoops:[[[-1,-1],[1,-1],[0,1]]]}).parts[0]);
const stamp=buildDesign({loops,params:{...defaults,mode:'stamp',stampHandle:'threaded',stampBase:'silhouette'}});save('flor-sello.stl',stamp.parts[0]);save('mango-roscado.stl',stamp.parts[1]);
save('mango-roscado-logo.stl',{name:'Mango con logo',geometry:createThreadedHandle(defaults,[[[-5,-5],[-5,5],[-2,5],[0,0],[2,5],[5,5],[5,-5],[2,-5],[2,0],[0,-3],[-2,0],[-2,-5]]])});
for(const name of ['mango-flor.stl','mango-corazon-logo.stl']){const path=new URL(name,out);if(existsSync(path))unlinkSync(path);}
writeFileSync(new URL('verificacion.json',out),JSON.stringify(report,null,2));console.log(report.map(r=>`${r.file}: ${r.triangles} triángulos, ${r.bytes} bytes`).join('\n'));
