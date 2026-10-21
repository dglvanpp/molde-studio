// A simple closed six-lobed contour is the editable, local starter design.
const points=Array.from({length:180},(_,i)=>{const t=i*Math.PI*2/180,r=115+15*Math.cos(6*t);return [160+r*Math.cos(t),160+r*Math.sin(t)];});
export const demoSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320"><rect width="320" height="320" fill="white"/><path d="M ${points.map(p=>p.join(' ')).join(' L ')} Z" fill="none" stroke="black" stroke-width="7"/><circle cx="160" cy="160" r="35" fill="none" stroke="black" stroke-width="6"/><circle cx="149" cy="152" r="4"/><circle cx="171" cy="152" r="4"/><path d="M146 169 Q160 184 174 169" fill="none" stroke="black" stroke-width="5"/></svg>`;
export const demoDataUrl=`data:image/svg+xml;base64,${btoa(demoSvg)}`;
