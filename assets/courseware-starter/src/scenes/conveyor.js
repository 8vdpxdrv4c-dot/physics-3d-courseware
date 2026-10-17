import * as THREE from 'three';
import {box,cylinder,rod,label as baseLabel,tag3D,line,arrow,mesh,materials,colors} from '../kit.js';
import {CONVEYOR_LENGTH,conveyorForces,createConveyorRun,advanceConveyor} from '../conveyor-physics.js';

const SCALE=.9, HALF=CONVEYOR_LENGTH*SCALE/2, R=.4, WIDTH=1.65;
// Projection legibility: scale both dimensions so the width cap cannot shrink
// longer labels, and outline letters against the moving belt and bright metal.
const label=(parent,text,position,options={})=>baseLabel(parent,text,position,{
  ...options,size:(options.size??.23)*1.5,width:(options.width??1.3)*1.5,weight:600,outline:true
});
const defaults={beltSpeed:1.5,initialSpeed:0,mu:.3,angle:0,mass:2,forces:true,velocities:true,slow:false};
export const conveyorPresets={
  rest:{beltSpeed:1.5,initialSpeed:0,mu:.3,angle:0,mass:2},
  faster:{beltSpeed:1.5,initialSpeed:3,mu:.3,angle:0,mass:2},
  reverse:{beltSpeed:-1.5,initialSpeed:1.5,mu:.3,angle:0,mass:2},
  incline:{beltSpeed:1,initialSpeed:1,mu:.5,angle:20,mass:2},
  sync:{beltSpeed:1.5,initialSpeed:1.5,mu:.3,angle:0,mass:2},
  slip:{beltSpeed:1,initialSpeed:1,mu:.2,angle:30,mass:2},
};

function makeBelt(parent){
  const points=[[-HALF,R],[HALF,R]];
  for(let i=1;i<=40;i++){const a=Math.PI/2-i*Math.PI/40;points.push([HALF+R*Math.cos(a),R*Math.sin(a)]);}
  points.push([-HALF,-R]);
  for(let i=1;i<=40;i++){const a=-Math.PI/2-i*Math.PI/40;points.push([-HALF+R*Math.cos(a),R*Math.sin(a)]);}
  const vertices=[],uv=[],indices=[];let distance=0;
  points.forEach(([x,y],i)=>{
    if(i)distance+=Math.hypot(x-points[i-1][0],y-points[i-1][1]);
    vertices.push(x,y,-WIDTH/2,x,y,WIDTH/2);uv.push(distance/.4,0,distance/.4,1);
    if(i){const j=i*2;indices.push(j-2,j-1,j,j-1,j+1,j);}
  });
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#455c64';ctx.fillRect(0,0,128,128);
  for(let y=0;y<128;y+=3){ctx.fillStyle=y%2?'#4b6268':'#3b515a';ctx.fillRect(0,y,128,1);}
  ctx.fillStyle='#192c38';ctx.fillRect(0,0,6,128);ctx.fillStyle='#68818a';ctx.fillRect(6,0,2,128);
  ctx.fillStyle='#b69355';ctx.fillRect(12,5,92,4);ctx.fillRect(12,119,92,4);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;
  const material=new THREE.MeshStandardMaterial({map:texture,roughness:.85,metalness:.12,side:THREE.DoubleSide});material.userData.owned=true;
  mesh(geometry,material,parent);
  return texture;
}

export function createLesson(stage,changed){
  const state={...defaults},root=stage.root,rig=new THREE.Group();root.add(rig);
  const beltMap=makeBelt(rig),rollers=[];
  // Open return run, paired drums, axle bearings and an electric drive.
  for(const x of [-HALF,HALF]){
    const roller=new THREE.Group();rig.add(roller);roller.position.x=x;rollers.push(roller);
    const drum=cylinder(roller,R-.025,WIDTH+.05,materials.metal);drum.rotation.x=Math.PI/2;
    for(const z of [-WIDTH/2-.055,WIDTH/2+.055]){
      const cap=cylinder(roller,R-.045,.045,materials.chrome,0,0,z);cap.rotation.x=Math.PI/2;
      const hub=cylinder(roller,.14,.075,materials.brass,0,0,z*1.05);hub.rotation.x=Math.PI/2;
      for(let i=0;i<6;i++){const a=i*Math.PI/3;const bolt=cylinder(roller,.028,.055,materials.black,.25*Math.cos(a),.25*Math.sin(a),z*1.045,6);bolt.rotation.x=Math.PI/2;}
    }
    for(const z of [-1.01,1.01]){
      box(rig,.55,.45,.16,materials.black,x,-.02,z,.07);
      const bearing=cylinder(rig,.16,.23,materials.chrome,x,0,z);bearing.rotation.x=Math.PI/2;
      const nut=cylinder(rig,.075,.255,materials.brass,x,0,z,6);nut.rotation.x=Math.PI/2;
    }
  }
  for(const z of [-1.03,1.03]){
    box(rig,HALF*2+.4,.23,.16,materials.metal,0,-.22,z,.045);
    box(rig,HALF*2,.025,.025,materials.brass,0,-.08,z+.09);
    for(let x=-3;x<=3;x+=1.5){const bolt=cylinder(rig,.035,.18,materials.chrome,x,-.22,z,6);bolt.rotation.x=Math.PI/2;}
  }
  const drive=cylinder(rig,.28,.72,materials.black,HALF,0,-1.53);drive.rotation.x=Math.PI/2;
  for(let z=-1.8;z< -1.25;z+=.08){const fin=cylinder(rig,.3,.025,materials.metal,HALF,0,z);fin.rotation.x=Math.PI/2;}
  box(rig,.5,.15,.45,materials.black,HALF,-.33,-1.53);
  const legs=[];
  for(const x of [-HALF+.45,HALF-.45])for(const z of [-.92,.92]){
    const foot=box(root,.67,.12,.56,materials.black,0,.46,0,.06);
    const post=cylinder(root,.085,1,materials.chrome),sleeve=cylinder(root,.14,1,materials.metal);
    legs.push({x,z,foot,post,sleeve});
  }
  const brace=rod(root,[0,0,0],[0,1,0],.065,materials.metal);
  const scaleGroup=new THREE.Group();rig.add(scaleGroup);
  for(let s=0;s<=8;s++){
    const x=(s-4)*SCALE;line(scaleGroup,[[x,-.05,1.13],[x,-.19,1.13]],0xb8cad8);
    tag3D(scaleGroup,String(s),[x,-.38,1.16],{size:.24,width:.525,weight:600,outline:true});
  }
  tag3D(scaleGroup,'+s / m',[HALF+1,-.35,1.14],{size:.255,width:1.95,weight:600,outline:true});
  arrow(rig,[HALF+.35,.12,.65],[HALF+1.1,.12,.65],{color:0xb2c6d9,radius:.014,head:.13,flow:false});

  const cargo=new THREE.Group();rig.add(cargo);
  box(cargo,.78,.67,.72,materials.brass,0,.34,0,.055);
  box(cargo,.58,.05,.56,materials.metal,0,.7,0,.04);
  for(const x of [-.27,.27])box(cargo,.035,.6,.735,materials.black,x,.35,0,.005);
  const inset=box(cargo,.29,.21,.025,materials.black,0,.36,.38,.02);
  label(cargo,'m',[0,.36,.405],{size:.2,width:.27,color:'#f4cf90'});
  const forceGroup=new THREE.Group();root.add(forceGroup);
  const dot=mesh(new THREE.SphereGeometry(.05,16,12),materials.white,forceGroup);
  const zeroF=label(forceGroup,'f = 0',[.8,.18,0],{size:.22,width:1,color:'#f5ca81'});
  function vector(parent,color,text){
    const obj=arrow(parent,[0,0,0],[0,1,0],{color,radius:.022,head:.16,flow:{speed:.55,spacing:.5}});
    const tag=label(parent,text,[0,0,0],{color:'#'+new THREE.Color(color).getHexString(),size:.24,width:1.3});
    return {obj,tag};
  }
  const gravity=vector(forceGroup,0xef8a83,'G'),normal=vector(forceGroup,colors.blue,'N'),friction=vector(forceGroup,colors.gold,'f');
  const velocityGroup=new THREE.Group();rig.add(velocityGroup);
  const velocity=vector(velocityGroup,0x8bdbbc,'v'),relative=vector(velocityGroup,colors.violet,'v相对'),beltVelocity=vector(velocityGroup,colors.blue,'v带');
  const vZero=label(velocityGroup,'v = 0',[.35,2.55,-.8],{size:.22,width:1.2,color:'#8bdbbc'});
  const relativeZero=label(velocityGroup,'v相对 = 0',[.35,3.12,-1.65],{size:.21,width:1.5,color:'#bc99f7'});
  const beltZero=label(velocityGroup,'v带 = 0',[.35,1.85,-.1],{size:.2,width:1.5,color:'#61b8ff'});
  const yAxis=new THREE.Vector3(0,1,0),tangent=new THREE.Vector3(),n=new THREE.Vector3(),world=new THREE.Vector3();
  let run=createConveyorRun(state),running=false,uiElapsed=0,accumulator=0;
  const FIXED_STEP=1/120;
  function orient(item,start,direction,length){
    const shown=length>.002;item.obj.visible=shown;item.tag.visible=shown;if(!shown)return;
    item.obj.position.copy(start);item.obj.quaternion.setFromUnitVectors(yAxis,direction);item.obj.scale.y=length;
    item.tag.position.copy(start).addScaledVector(direction,length+.29);item.tag.position.z+=.06;
  }
  function arrange(){
    const theta=state.angle*Math.PI/180;
    rig.rotation.z=theta;rig.position.y=1.12+HALF*Math.sin(theta);rig.updateMatrixWorld(true);
    for(const leg of legs){
      const p=rig.localToWorld(new THREE.Vector3(leg.x,-.34,leg.z)),height=p.y-.52;
      leg.foot.position.set(p.x,.46,p.z);leg.post.position.set(p.x,.52+height/2,p.z);leg.post.scale.y=height;
      leg.sleeve.position.set(p.x,.52+height*.22,p.z);leg.sleeve.scale.y=height*.44;
    }
    const a=legs[0].post.position.clone();a.y=.65;
    const b=rig.localToWorld(new THREE.Vector3(HALF-.45,-.39,-.92));
    brace.position.copy(a).add(b).multiplyScalar(.5);brace.scale.y=a.distanceTo(b);brace.quaternion.setFromUnitVectors(yAxis,b.sub(a).normalize());
  }
  function render(){
    root.userData.directionFlow.setEnabled(state.forces||state.velocities);
    const force=conveyorForces(state,run.v),x=(run.s-4)*SCALE,theta=state.angle*Math.PI/180;
    cargo.position.set(x,R+.008,0);
    beltMap.offset.x=-run.beltTravel*SCALE/.4;
    rollers.forEach(o=>o.rotation.z=-run.beltTravel*SCALE/R);
    tangent.set(Math.cos(theta),Math.sin(theta),0);n.set(-Math.sin(theta),Math.cos(theta),0);
    world.set(x,R+.35,1.12);rig.localToWorld(world);forceGroup.position.copy(world);forceGroup.visible=state.forces;
    orient(gravity,new THREE.Vector3(),new THREE.Vector3(0,-1,0),1.25);
    gravity.tag.position.set(-.32,-.9,.08);
    orient(normal,new THREE.Vector3(),n,1.25*force.normal/force.weight);
    orient(friction,new THREE.Vector3(),tangent.clone().multiplyScalar(Math.sign(force.friction)||1),1.25*Math.abs(force.friction)/force.weight);
    zeroF.visible=Math.abs(force.friction)<1e-8;
    velocityGroup.visible=state.velocities;
    // Speed comparisons occupy fixed, separated lanes; forces follow the block.
    // This keeps the comparison readable even at the raised end of a steep belt.
    function speedArrow(item,value,y,z){orient(item,new THREE.Vector3(.35,y,z),new THREE.Vector3(Math.sign(value)||1,0,0),Math.min(2.3,Math.abs(value)*.62));}
    speedArrow(velocity,run.v,2.55,-.8);speedArrow(relative,force.relative,3.12,-1.65);
    orient(beltVelocity,new THREE.Vector3(.35,1.85,-.1),new THREE.Vector3(Math.sign(state.beltSpeed)||1,0,0),Math.min(1.6,Math.abs(state.beltSpeed)*.5));
    vZero.visible=Math.abs(run.v)<1e-8;relativeZero.visible=Math.abs(force.relative)<1e-8;beltZero.visible=Math.abs(state.beltSpeed)<1e-8;
    stage.requestRender();
  }
  function publish(){render();changed?.();}
  function setRunning(value){running=value&&!run.ended;stage.setAnimation(tick,running);publish();}
  function tick(dt){
    accumulator+=dt*(state.slow ? .5 : 1);uiElapsed+=dt;
    while(accumulator>=FIXED_STEP&&!run.ended){run=advanceConveyor(state,run,FIXED_STEP);accumulator-=FIXED_STEP;}
    render();
    if(run.ended){running=false;accumulator=0;stage.setAnimation(null,false);changed?.();}
    else if(uiElapsed>=.1){uiElapsed=0;changed?.();}
  }
  function restart(){running=false;accumulator=0;run=createConveyorRun(state);stage.setAnimation(null,false);arrange();publish();}
  function set(key,value){if(state[key]===value)return;state[key]=value;if(['forces','velocities','slow'].includes(key))publish();else restart();}
  arrange();render();
  return {state,set,
    preset(name){Object.assign(state,conveyorPresets[name]);restart();},
    reset(){Object.assign(state,defaults);restart();},
    restart,
    togglePlayback(){if(run.ended)restart();setRunning(!running);},
    step(){if(running)setRunning(false);run=advanceConveyor(state,run,.1);accumulator=0;publish();},
    playback(){return {running,ended:run.ended,time:run.time,position:run.s,slow:state.slow};},
    metrics(){
      const f=conveyorForces(state,run.v),signed=v=>(Math.abs(v)<.0005?'0.00':(v>0?'+':'')+v.toFixed(2));
      const direction=f.friction>1e-8?'沿 +s':f.friction< -1e-8?'沿 −s':'为零';
      const result=f.kind==='zero'?'水平同步 · 摩擦力为零':f.kind==='static'?'倾斜同步 · 静摩擦向上':Math.abs(f.friction)<1e-8?'相对滑动 · 摩擦力为零':`滑动摩擦 · ${direction}`;
      let detail=f.kind==='zero'?'物块与带面同速，没有其他沿带方向的力。':f.kind==='static'?'静摩擦力平衡重力沿斜面分量，物块随带匀速运动。':Math.abs(f.relative)<1e-8?'瞬间同速，但静摩擦不足：物块将相对带面向下滑。':`相对带面${f.relative>0?'向 +s 滑动':'向 −s 滑动'}，摩擦力方向与相对滑动相反。`;
      if(f.kind==='kinetic'&&Math.abs(f.friction)<1e-8)detail='接触面无摩擦（μ = 0），相对滑动不产生摩擦力。';
      if(run.ended)detail=`已到${run.s===0?'左':'右'}端，定格离带前一刻；速度读数保留。`;
      return {result,detail,status:run.ended?'到达带端':running?'实验进行中':run.time?'已暂停':'待开始',
        formula:'v相对 = v − v带',
        values:[['物块速度 v',signed(run.v),'m/s'],['带速 v带',signed(state.beltSpeed),'m/s'],['相对速度',signed(f.relative),'m/s'],[f.kind==='static'?'静摩擦 f':'摩擦力 f',signed(f.friction),'N'],['沿带加速度',signed(f.acceleration),'m/s²'],['同步所需 |f静|',(f.weight*Math.sin(state.angle*Math.PI/180)).toFixed(2),'N'],['最大静摩擦 μN',f.capacity.toFixed(2),'N']],
        note:'匀速带长 8 m；+s 沿带向右，倾斜时向上。物块按质点计算，μs = μk，g = 9.8 m/s²。调参回到初态并暂停；质心到端点即定格。',
        hint:'先比较相对速度，再判断摩擦方向；空格暂停，R复位视角。'};
    },
    dispose(){running=false;stage.setAnimation(null,false);}
  };
}
