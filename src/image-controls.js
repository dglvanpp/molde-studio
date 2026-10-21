import {robustImageDefaults as imageDefaults,imageOptions} from './image-preprocess.js';
const fields=[
  ['threshold','Umbral blanco y negro',1,254,1,''],
  ['imageScale','Ampliación de imagen',100,300,25,'%'],
  ['lineWeight','Grosor de línea',-4,4,1,'px'],
  ['closeGaps','Cerrar pequeñas roturas',0,4,1,'px'],
  ['blur','Desenfoque gaussiano',0,2,.1,'px']
];
const display=(key,value)=>key==='imageScale'?Math.round(value*100):value;
export function imageControlsHtml(){
  return `<div class="image-corrections"><h3>Corregir imagen</h3>${fields.map(([key,label,min,max,step,unit])=>`<label class="range-field"><span>${label}<span class="value-box"><output id="${key}-value" for="${key}">${display(key,imageDefaults[key])}</output><span>${unit}</span></span></span><input id="${key}" data-image-param="${key}" aria-label="${label}" type="range" min="${min}" max="${max}" step="${step}" value="${display(key,imageDefaults[key])}"/></label>`).join('')}<p class="field-note">Grosor negativo adelgaza; positivo engrosa. El cierre une pequeñas roturas. El blur suaviza y vuelve a aplicar un umbral binario. Revisa que los detalles interiores sigan separados.</p><div class="image-actions"><button type="button" class="button secondary" id="invert-image" aria-pressed="false">Invertir blanco y negro</button><button type="button" class="link-button" id="reset-image">Restablecer correcciones</button></div><p class="field-note">La ampliación mejora la resolución del trazado. El tamaño del STL se controla en milímetros.</p><figure class="binary-preview"><img id="binary-image" alt="Vista previa de la imagen corregida en blanco y negro"/><figcaption id="binary-info">Preparando vista previa…</figcaption></figure></div>`;
}
export function syncImageControls(input){
  const p=imageOptions(input);
  for(const [key] of fields){document.getElementById(key).value=display(key,p[key]);document.getElementById(`${key}-value`).value=display(key,p[key]);}
  const invert=document.getElementById('invert-image');invert.setAttribute('aria-pressed',p.invert);invert.classList.toggle('selected',p.invert);
}
export function bindImageControls(onChange){
  const read=()=>imageOptions(Object.fromEntries([...fields.map(([key])=>[key,Number(document.getElementById(key).value)/(key==='imageScale'?100:1)]),['invert',document.getElementById('invert-image').getAttribute('aria-pressed')==='true']]));
  const update=()=>{const p=read();syncImageControls(p);onChange(p);};
  document.querySelectorAll('[data-image-param]').forEach(el=>el.addEventListener('input',update));
  document.getElementById('invert-image').addEventListener('click',()=>{const p=read();p.invert=!p.invert;syncImageControls(p);onChange(p);});
  document.getElementById('reset-image').addEventListener('click',()=>{syncImageControls(imageDefaults);onChange({...imageDefaults});});
}
