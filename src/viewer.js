import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
export class Viewer {
  constructor(element) {
    this.element=element;this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#edf1f7');
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.setClearColor('#edf1f7');element.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label','Vista 3D: arrastra para girar; usa la rueda para acercar.');
    this.camera=new THREE.PerspectiveCamera(38,1,.1,4000);this.camera.up.set(0,0,1);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.1;
    this.scene.add(new THREE.HemisphereLight('#ffffff','#8d9db9',2.8));
    const key=new THREE.DirectionalLight('#ffffff',3);key.position.set(-60,-80,150);this.scene.add(key);
    const fill=new THREE.DirectionalLight('#adc4ff',1.1);fill.position.set(100,50,30);this.scene.add(fill);
    const underside=new THREE.DirectionalLight('#ffffff',2.5);underside.position.set(-50,-60,-100);this.scene.add(underside);
    this.grid=new THREE.GridHelper(300,60,'#bac5d7','#dbe2ec');this.grid.rotation.x=Math.PI/2;this.grid.position.z=-.12;this.scene.add(this.grid);
    this.group=new THREE.Group();this.scene.add(this.group);this.materials=[];this.parts=[];
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(element);
    this.renderer.setAnimationLoop(()=>{this.controls.update();this.renderer.render(this.scene,this.camera);});
  }
  resize(){const {width,height}=this.element.getBoundingClientRect();if(!width||!height)return;this.renderer.setSize(width,height);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}
  show(parts,selection='all') {
    while(this.group.children.length){const obj=this.group.children[0];obj.geometry?.dispose();obj.material?.dispose();this.group.remove(obj);}
    this.parts=parts;this.materials=[];
    const visible=selection==='all'?parts:parts.filter((_,i)=>i===Number(selection));
    const totalWidth=visible.reduce((s,p)=>s+p.bbox[1][0]-p.bbox[0][0]+12,0)-12;let cursor=-totalWidth/2;
    for(const part of visible){const width=part.bbox[1][0]-part.bbox[0][0],geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(part.positions,3));toCreasedNormals(geometry,Math.PI/6);
      const material=new THREE.MeshStandardMaterial({color:part.color,metalness:.08,roughness:.36,flatShading:false,side:THREE.FrontSide});
      const mesh=new THREE.Mesh(geometry,material);mesh.position.set(cursor-part.bbox[0][0],0,-part.bbox[0][2]);cursor+=width+12;this.group.add(mesh);this.materials.push(material);
    }
    this.fit();
  }
  fit(view=this.view||'iso') {
    this.view=view;
    const box=new THREE.Box3().setFromObject(this.group),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    if(!Number.isFinite(size.x)||!size.x)return;
    const distance=Math.max(size.x/Math.max(.45,this.camera.aspect),size.y,size.z)*1.95;
    this.grid.position.z=view==='bottom'?box.max.z+.12:-.12;
    const direction={top:[0,-.001,distance*1.35],bottom:[distance*.12,-distance*.18,-distance*1.35],front:[0,-distance*1.35,distance*.1],iso:[distance*.68,-distance,distance*.98]}[view];
    this.controls.target.copy(center);this.camera.position.copy(center).add(new THREE.Vector3(...direction));
    this.controls.update();this.resize();
  }
  wireframe(enabled){this.materials.forEach(m=>m.wireframe=enabled);}
  gridVisible(enabled){this.grid.visible=enabled;}
}
