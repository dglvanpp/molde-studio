import {preprocessRgba} from './image-preprocess.js';
import {traceMask} from './potrace-pipeline.js';
self.onmessage=({data})=>{
  try{
    const corrected=preprocessRgba(data.pixels,data.settings,data.margin);
    self.postMessage({preview:true,width:corrected.width,height:corrected.height,data:corrected.data},[corrected.data.buffer]);
    self.postMessage({result:traceMask(corrected)});
  }catch(error){self.postMessage({error:error.message});}
};
