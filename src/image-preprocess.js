/** Local raster corrections. Mask value 1 means black/foreground. */
export const imageDefaults = Object.freeze({threshold:128,invert:false,imageScale:1,lineWeight:0,closeGaps:0,blur:0});
export const robustImageDefaults = Object.freeze({...imageDefaults,lineWeight:1,closeGaps:1,blur:.8});

export function imageOptions(input={}) {
  const p={...imageDefaults,...input};
  for(const [key,min,max,integer] of [['threshold',1,254,true],['imageScale',1,3,false],['lineWeight',-4,4,true],['closeGaps',0,4,true],['blur',0,2,false]]){
    if(!Number.isFinite(p[key])||p[key]<min||p[key]>max||(integer&&!Number.isInteger(p[key])))throw new Error(`Corrección de imagen fuera de rango: ${key}.`);
  }
  p.invert=Boolean(p.invert);return p;
}

export function rasterSize(width,height,options={}) {
  const p=imageOptions(options);
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error('La imagen no tiene dimensiones válidas.');
  const factor=Math.min(1,420/Math.max(width,height))*p.imageScale;
  // Closing needs dilation AND erosion; leave enough white around either step.
  const margin=4+Math.abs(p.lineWeight)+2*p.closeGaps+Math.ceil(p.blur*3);
  const contentWidth=Math.max(1,Math.round(width*factor)),contentHeight=Math.max(1,Math.round(height*factor));
  return {width:contentWidth+margin*2,height:contentHeight+margin*2,contentWidth,contentHeight,margin};
}

/** Square structuring element; separable running sums keep each pass O(w*h). */
export function morphology(mask,width,height,radius,dilate=true) {
  if(mask.length!==width*height||!Number.isInteger(radius)||radius<0||radius>4)throw new Error('Máscara o radio morfológico inválido.');
  if(radius===0)return mask.slice();
  const horizontal=new Uint8Array(mask.length),out=new Uint8Array(mask.length),window=2*radius+1;
  for(let y=0;y<height;y++){
    const start=y*width;let sum=0;
    for(let k=0;k<=radius&&k<width;k++)sum+=mask[start+k];
    for(let x=0;x<width;x++){
      horizontal[start+x]=dilate?Number(sum>0):Number(sum===window);
      if(x-radius>=0)sum-=mask[start+x-radius];
      if(x+radius+1<width)sum+=mask[start+x+radius+1];
    }
  }
  for(let x=0;x<width;x++){
    let sum=0;for(let k=0;k<=radius&&k<height;k++)sum+=horizontal[k*width+x];
    for(let y=0;y<height;y++){
      out[y*width+x]=dilate?Number(sum>0):Number(sum===window);
      if(y-radius>=0)sum-=horizontal[(y-radius)*width+x];
      if(y+radius+1<height)sum+=horizontal[(y+radius+1)*width+x];
    }
  }
  return out;
}

export function preprocessRgba({width,height,data},options={},margin=4) {
  const p=imageOptions(options);
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||data.length!==width*height*4)throw new Error('Los píxeles de la imagen no son válidos.');
  if(!Number.isInteger(margin)||margin<0||margin*2>=Math.min(width,height))throw new Error('Margen de imagen inválido.');
  let mask=new Uint8Array(width*height);
  for(let y=margin;y<height-margin;y++)for(let x=margin;x<width-margin;x++){
    const at=y*width+x,i=at*4,a=data[i+3]/255;
    const luminance=(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2])*a+255*(1-a);
    const black=luminance<p.threshold;mask[at]=Number(p.invert?!black:black);
  }
  if(p.lineWeight)mask=morphology(mask,width,height,Math.abs(p.lineWeight),p.lineWeight>0);
  if(p.blur)mask=gaussianRethreshold(mask,width,height,p.blur);
  if(p.closeGaps){mask=morphology(mask,width,height,p.closeGaps,true);mask=morphology(mask,width,height,p.closeGaps,false);}
  const rgba=new Uint8ClampedArray(data.length);let dark=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const at=y*width+x,i=at*4;
    // Inversion and dilation must never create foreground at the canvas edge.
    if(x<4||y<4||x>=width-4||y>=height-4)mask[at]=0;
    const v=mask[at]?0:255;dark+=mask[at];rgba[i]=rgba[i+1]=rgba[i+2]=v;rgba[i+3]=255;
  }
  return {width,height,data:rgba,mask,dark,settings:p};
}

/** Separable Gaussian on foreground coverage, then a strict 50% threshold. */
export function gaussianRethreshold(mask,width,height,sigma){
  if(!Number.isFinite(sigma)||sigma<0||sigma>2)throw new Error('Blur fuera de rango.');
  if(!sigma)return mask.slice();
  const radius=Math.ceil(sigma*3),kernel=Array.from({length:radius*2+1},(_,i)=>Math.exp(-((i-radius)**2)/(2*sigma*sigma)));
  const sum=kernel.reduce((a,b)=>a+b,0);for(let i=0;i<kernel.length;i++)kernel[i]/=sum;
  const tmp=new Float32Array(mask.length),out=new Uint8Array(mask.length);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let k=-radius;k<=radius;k++)if(x+k>=0&&x+k<width)tmp[y*width+x]+=mask[y*width+x+k]*kernel[k+radius];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    let value=0;for(let k=-radius;k<=radius;k++)if(y+k>=0&&y+k<height)value+=tmp[(y+k)*width+x]*kernel[k+radius];
    out[y*width+x]=Number(value>=.5);
  }
  return out;
}
