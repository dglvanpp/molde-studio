const DB_NAME='molde-studio',VERSION=1,STORE='designs';
function database() {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,VERSION);
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
async function transaction(mode,operation) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,mode);let request;
    try{request=operation(tx.objectStore(STORE));}catch(error){db.close();reject(error);return;}
    tx.oncomplete=()=>{resolve(request?.result);db.close();};
    tx.onerror=tx.onabort=()=>{reject(tx.error||new Error('No se pudo guardar en este navegador.'));db.close();};
  });
}
export const saveDesign=(design)=>transaction('readwrite',store=>store.put({...design,version:1,id:design.id||crypto.randomUUID(),updatedAt:Date.now(),params:JSON.stringify(design.params)}));
export const listDesigns=async()=>(await transaction('readonly',store=>store.getAll())).sort((a,b)=>b.updatedAt-a.updatedAt).map(d=>({...d,params:JSON.parse(d.params)}));
export const removeDesign=(id)=>transaction('readwrite',store=>store.delete(id));
