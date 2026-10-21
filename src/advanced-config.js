export const advancedDefaults={
  schemaVersion:2,mode:'cutter',size:50,sizeMode:'longest',smoothing:.15,
  bladeDepth:12.5,bladeThickness:1.1,extraEnabled:true,extraDepth:8,extraThickness:.8,
  sharpEnabled:true,tipWidth:.4,bevelHeight:2,
  stampBack:4.5,stampTolerance:1,stampPrintDepth:3,stampInvert:false,removeOuterEdge:false,
  connectionMode:'auto',connectionX:50,connectionY:50,threadCupDepth:3.7,tolerance:.2,threadDiameter:10.5,
  stampHandle:'threaded',stampBase:'silhouette',gripShape:'circle',
  handleHeight:12,handleDiameter:15,handleBottomRound:2,
  brimHeight:4,brimWidth:3.5,brimShape:'round',symmetric:false,
  pressEnabled:false,pressLength:50,pressWidth:60,pressRadius:3,pressPosition:'front',pressRotation:0,pressOverlap:3,
  text:'',textSize:8,textExtrusion:.7,textStyle:'vertical',fontChoice:'vera',mirror:false,
  rollerDiameter:32,topperStake:55,interiorThickness:1
};
export function validateAdvanced(input={}){
  const p={...advancedDefaults,...input};
  const ranges={size:[50,150],smoothing:[.05,.5],bladeDepth:[5,30],bladeThickness:[.4,3],extraDepth:[0,25],extraThickness:[0,3],tipWidth:[.2,2],bevelHeight:[.2,8],stampBack:[1.2,12],stampTolerance:[0,3],stampPrintDepth:[.5,8],connectionX:[0,100],connectionY:[0,100],threadCupDepth:[1,12],tolerance:[.05,.6],threadDiameter:[8,24],handleHeight:[6,35],handleDiameter:[12,40],handleBottomRound:[0,8],brimHeight:[1,8],brimWidth:[2,10],pressLength:[15,100],pressWidth:[15,100],pressRadius:[0,20],pressRotation:[-180,180],pressOverlap:[.2,12],textSize:[4,36],textExtrusion:[.4,8],rollerDiameter:[24,60],topperStake:[25,90],interiorThickness:[.5,3]};
  for(const [key,[lo,hi]] of Object.entries(ranges))if(!Number.isFinite(p[key])||p[key]<lo||p[key]>hi)throw new Error(`Valor inválido: ${key} (${lo}–${hi}).`);
  const enums={mode:['cutter','cutterStamp','stamp','set','kpop','roller','topper','stencil'],sizeMode:['longest'],connectionMode:['auto','manual'],brimShape:['square','round'],pressPosition:['front','back','left','right'],fontChoice:['vera','custom'],stampHandle:['threaded','integrated'],stampBase:['silhouette','circle'],gripShape:['circle','heart','flower','hex'],textStyle:['vertical','flat']};
  for(const [key,values] of Object.entries(enums))if(!values.includes(p[key]))throw new Error(`Opción inválida: ${key}.`);
  if(p.extraEnabled&&p.extraDepth>p.bladeDepth-(p.sharpEnabled?p.bevelHeight:0))throw new Error('La profundidad Extra debe terminar antes del bisel de la cuchilla.');
  if(p.sharpEnabled&&(p.tipWidth>p.bladeThickness||p.bevelHeight>=p.bladeDepth))throw new Error('La punta debe ser más fina que la cuchilla y el bisel menor que su profundidad.');
  if(p.pressEnabled&&p.pressRadius>=Math.min(p.pressLength,p.pressWidth)/2)throw new Error('El radio del asa debe ser menor que la mitad de su lado menor.');
  if(['stamp','cutterStamp'].includes(p.mode)&&p.stampHandle==='threaded'){
    const minimum=p.threadDiameter+2*(p.tolerance+.3+1.2);
    if(p.handleDiameter<minimum)throw new Error(`La rosca interior necesita un agarre de al menos ${minimum.toFixed(1)} mm. Aumenta su diámetro o reduce la rosca.`);
    if(p.handleHeight-p.threadCupDepth<Math.max(1.2,p.handleBottomRound))throw new Error('El vaso debe dejar fondo sólido y quedar por encima del redondeo inferior.');
    if(p.handleBottomRound>Math.min(p.handleHeight/2,p.handleDiameter/2-.8))throw new Error('El redondeo inferior es demasiado grande para el agarre.');
  }
  p.text=String(p.text??'').trim().slice(0,48);
  return p;
}
export function migrateAdvanced(old={}){
  if(old.schemaVersion===2)return {...advancedDefaults,...old};
  return {...advancedDefaults,mode:old.mode||'cutter',size:Math.max(50,Math.min(150,old.size??50)),
    text:[old.text,old.textSecondLine].filter(Boolean).join(' '),textStyle:old.textStyle||'vertical',
    textExtrusion:old.textStyle==='flat'?Math.max(2.5,advancedDefaults.brimHeight+.5):(old.textDepth||.7),mirror:!!old.mirror,
    stampHandle:old.stampHandle||'threaded',stampBase:old.stampBase||'silhouette',gripShape:old.gripShape||old.nutShape||'circle',
    fontChoice:old.fontChoice||'vera'};
}
