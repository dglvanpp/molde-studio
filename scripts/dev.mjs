import {build} from 'vite';
import config from '../vite.config.js';
import {serve} from './serve.mjs';
// Rollup watch avoids dependency prebundling limitations in restricted Windows environments.
const watcher=await build({...config,configFile:false,build:{...config.build,watch:{}}});
let server;
watcher.on('event',event=>{
  if(event.code==='ERROR')console.error(event.error);
  if(event.code==='END'){if(!server)server=serve();else console.log('Cambios compilados. Actualiza el navegador.');}
});
