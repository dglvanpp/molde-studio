import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { cleanLoop, classifyLoops } from './contours.js';
import {imageOptions,rasterSize,preprocessRgba} from './image-preprocess.js';

export function safeSvg(text) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') throw new Error('El archivo SVG no es válido.');
  for (const el of [...doc.querySelectorAll('*')]) {
    if (!['svg','g','path','rect','circle','ellipse','line','polyline','polygon','defs','clipPath','title','desc'].includes(el.localName)) { el.remove(); continue; }
    for (const attr of [...el.attributes]) if (/^on/i.test(attr.name) || /href/i.test(attr.name) || /url\(|@import|javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
  }
  return new XMLSerializer().serializeToString(doc.documentElement);
}
export function svgToLoops(svg) {
  const parsed = new SVGLoader().parse(safeSvg(svg));
  const loops = [];
  for (const path of parsed.paths) {
    if (path.userData?.style?.fill === 'none') continue;
    for (const sub of path.subPaths) { const p = cleanLoop(sub.getPoints(10).map(v=>[v.x,-v.y])); if (p.length>2) loops.push(p); }
  }
  if (!loops.length) throw new Error('El SVG necesita trazados con relleno. Convierte el texto y los trazos a contornos.');
  return loops;
}
export function readDataUrl(file) {
  return new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(new Error('No se pudo leer el archivo.')); reader.readAsDataURL(file); });
}
export async function imageFileData(file) {
  if (file.size > 12*1024*1024) throw new Error('Usa una imagen de hasta 12 MB.');
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(safeSvg(await file.text()))))}`;
  if (!/^image\/(png|jpeg|webp|bmp)$/.test(file.type)) throw new Error('Formato compatible: PNG, JPG, WEBP, BMP o SVG.');
  return readDataUrl(file);
}
let traceWorker=null,traceReject=null,traceEpoch=0;
export function cancelImageTrace(){traceEpoch++;traceWorker?.terminate();traceWorker=null;if(traceReject){traceReject(new Error('Procesamiento cancelado.'));traceReject=null;}}
export async function traceImage(dataUrl,settings={},invert=false,onPreview=null){
  cancelImageTrace();const epoch=traceEpoch;
  const options=imageOptions(typeof settings==='number'?{threshold:settings,invert}:settings);
  const image=new Image();image.src=dataUrl;await image.decode();
  if(epoch!==traceEpoch)throw new Error('Procesamiento cancelado.');
  const dimensions=rasterSize(image.naturalWidth,image.naturalHeight,options),{margin,contentWidth,contentHeight}=dimensions;
  const canvas=document.createElement('canvas');canvas.hidden=true;canvas.width=dimensions.width;canvas.height=dimensions.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('Canvas no está disponible.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,margin,margin,contentWidth,contentHeight);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  let binary='';
  const result=await new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./image.worker.js',import.meta.url),{type:'module'});traceWorker=worker;
    let timer;
    const cleanup=()=>{clearTimeout(timer);worker.terminate();if(traceWorker===worker){traceWorker=null;traceReject=null;}};
    const fail=error=>{cleanup();reject(error);};traceReject=fail;
    timer=setTimeout(()=>fail(new Error('La imagen tiene demasiado detalle para procesarse. Reduce la ampliación o limpia el fondo.')),25000);
    worker.onmessage=({data})=>{
      if(data.preview){ctx.putImageData(new ImageData(data.data,data.width,data.height),0,0);binary=canvas.toDataURL('image/png');onPreview?.({binary,dimensions,settings:options});}
      else if(data.error)fail(new Error(data.error));
      else{cleanup();resolve(data.result);}
    };
    worker.onerror=event=>fail(new Error(event.message||'No se pudo cargar Potrace. Recarga la página tras actualizar la aplicación.'));
    worker.postMessage({pixels:{width:pixels.width,height:pixels.height,data:pixels.data},settings:options,margin},[pixels.data.buffer]);
  });
  if(epoch!==traceEpoch)throw new Error('Procesamiento cancelado.');
  return {...result,binary,dimensions,settings:options};
}
