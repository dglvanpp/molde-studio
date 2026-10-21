import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const types={'.wasm':'application/wasm','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.ttf':'font/ttf','.png':'image/png','.ico':'image/x-icon','.json':'application/json'};
export function serve(port=4173){
  const server=http.createServer(async(req,res)=>{
    try{
      if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
      if(!file.startsWith(resolve(root)+sep)){res.writeHead(403);res.end();return;}
      const info=await stat(file);if(!info.isFile()){res.writeHead(404);res.end();return;}
      const data=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
    }catch{res.writeHead(404);res.end('Archivo no encontrado. Ejecuta npm run build si cambiaste el código.');}
  });
  server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`El puerto ${port} ya está en uso. Si Molde Studio ya está abierto, visita http://127.0.0.1:${port}/`:e.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`\nMolde Studio — http://127.0.0.1:${port}/\nTodo se procesa en este equipo. Ctrl+C para cerrar.\n`));return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url))serve();
