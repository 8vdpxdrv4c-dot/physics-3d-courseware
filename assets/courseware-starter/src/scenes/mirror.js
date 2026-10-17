import * as THREE from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {box,cylinder,rod,mesh,label as baseLabel,tag3D,line,arrow,materials,colors,clearGroup} from '../kit.js';
import {planeMirror,reflectRay,pointOnReflectedRay} from '../mirror-physics.js';
import {createParameterTransition} from '../parameter-transition.js';

const S=.1,BASE=1.2,HALF_WIDTH=3.05;
const defaults={distance:30,height:20,lateral:0,screenDistance:30,extensions:true,labels:true,mode:'observe'};
export const modes=[['observe','镜面观察'],['measure','对称测量'],['rays','光路追踪'],['screen','光屏检验']];
export const views={
  observe:{position:[-11,5.9,6.5],target:[-.3,2.4,0]},
  measure:{position:[-2.5,6.8,14.5],target:[0,2.15,0]},
  rays:{position:[-3.6,7.2,13.5],target:[-.25,2.5,0]},
  screen:{position:[-6.8,7.8,12.5],target:[0,2.35,0]}
};
const label=(parent,text,position,options={})=>baseLabel(parent,text,position,{size:.27,width:2.3,weight:600,outline:true,...options});
const own=mat=>{mat.userData.owned=true;return mat;};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

function arrowObject(material){
  // A round luminous arrow remains legible when the camera moves along the mirror.
  // Optical coordinates use its vertical centre line; thickness is illustrative.
  const object=new THREE.Group();
  cylinder(object,.075,.77,material,0,.385,0);
  mesh(new THREE.ConeGeometry(.24,.28,40),material,object,0,.86,0);
  return object;
}

export function createLesson(stage,changed){
  const state={...defaults},root=stage.root,markers=new THREE.Group(),construction=new THREE.Group(),rayGroup=new THREE.Group();
  const transition=createParameterTransition(stage,state,update);
  root.add(markers,construction,rayGroup);
  let playing=false,phase=0,rayData=[];
  const dots=[];
  // Upright framed mirror with a real planar reflection in observation mode.
  const reflector=new Reflector(new THREE.PlaneGeometry(HALF_WIDTH*2,4),{
    textureWidth:1024,textureHeight:1024,clipBias:.001,multisample:0,color:new THREE.Color(.5,.52,.55)
  });
  const releaseQualityTarget=stage.registerQualityTarget(reflector.getRenderTarget(),2);
  reflector.rotation.y=-Math.PI/2;reflector.position.set(0,2.85,0);root.add(reflector);
  const back=box(root,.09,4,HALF_WIDTH*2,materials.black,.065,2.85,0,.025);
  const fadedMaterial=own(new THREE.MeshPhysicalMaterial({color:0x7cb9df,metalness:.1,roughness:.32,transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide}));
  const faded=mesh(new THREE.PlaneGeometry(HALF_WIDTH*2,4),fadedMaterial,root,0,2.85,0);faded.rotation.y=-Math.PI/2;faded.castShadow=false;
  for(const z of [-HALF_WIDTH-.07,HALF_WIDTH+.07]){
    box(root,.2,4.2,.16,materials.black,.02,2.85,z,.04);
    box(root,.03,4,.018,materials.brass,-.095,2.85,z-.07*Math.sign(z),.002);
    box(root,1.28,.14,.62,materials.black,.04,.45,z,.06);
    cylinder(root,.1,.45,materials.chrome,.04,.73,z);
    const knob=cylinder(root,.12,.25,materials.brass,.04,1.1,z,24);knob.rotation.x=Math.PI/2;
  }
  for(const y of [.78,4.92])box(root,.2,.14,HALF_WIDTH*2+.28,materials.metal,.02,y,0,.025);

  // Shared optical bench and centimetre ruler. Negative/positive halves are spatial coordinates.
  const ruler=new THREE.Group();ruler.position.z=-1.2;root.add(ruler);
  box(ruler,11.5,.38,.44,materials.black,0,.60,3.6);
  rod(ruler,[-5.7,.82,3.36],[5.7,.82,3.36],.028,materials.chrome);
  for(let cm=-50;cm<=50;cm+=2){
    const x=cm*S;line(ruler,[[x,.78,3.84],[x,cm%10===0?.64:.70,3.84]],cm%10===0?0xaac4d9:0x526c81);
    if(cm%10===0)tag3D(ruler,String(Math.abs(cm)),[x,.51,3.85],{size:.18,width:.55,weight:600,outline:true});
  }
  tag3D(ruler,'cm',[5.6,.51,3.85],{size:.17,width:.5,weight:600,outline:true});

  const source=new THREE.Group();root.add(source);source.userData.dragKey='mirror-object';
  const luminous=own(new THREE.MeshStandardMaterial({color:0xffd38a,emissive:0xea9e35,emissiveIntensity:.8,metalness:.25,roughness:.43}));
  const sourceArrow=arrowObject(luminous);source.add(sourceArrow);
  cylinder(source,.16,.11,materials.brass,0,-.055,0);
  cylinder(source,.065,.57,materials.chrome,0,-.395,0);
  box(source,.72,.14,.62,materials.black,0,-.75,0,.05);
  const ghost=new THREE.Group();root.add(ghost);
  const ghostMaterial=own(new THREE.MeshBasicMaterial({color:colors.violet,transparent:true,opacity:.33,depthWrite:false,depthTest:false,side:THREE.DoubleSide}));
  const ghostArrow=arrowObject(ghostMaterial);ghostArrow.scale.x=-1;ghostArrow.traverse(object=>{object.castShadow=false;object.receiveShadow=false;});ghost.add(ghostArrow);

  const screen=new THREE.Group();root.add(screen);screen.userData.dragKey='mirror-screen';
  const screenSurface=own(new THREE.MeshStandardMaterial({color:0xc6cdd4,metalness:0,roughness:1}));
  box(screen,.07,3.15,1.8,screenSurface,0,1.25,0,.012);
  for(const z of [-.94,.94])box(screen,.12,3.25,.07,materials.black,0,1.25,z,.01);
  for(const y of [-.37,2.87])box(screen,.12,.07,1.94,materials.chrome,0,y,0,.01);
  cylinder(screen,.07,.3,materials.chrome,0,-.55,0);box(screen,.8,.14,.62,materials.black,0,-.75,0,.04);

  // Explanation overlays must not appear as reflected physical objects.
  const renderReflection=reflector.onBeforeRender;
  reflector.onBeforeRender=function(...args){
    const groups=[markers,construction,rayGroup],visible=groups.map(group=>group.visible);
    groups.forEach(group=>group.visible=false);
    try{renderReflection.apply(this,args);}finally{groups.forEach((group,i)=>group.visible=visible[i]);}
  };
  const world=point=>[point[0]*S,BASE+point[1]*S,point[2]*S];
  const model=()=>planeMirror(state);
  function stopPoints(){playing=false;stage.setAnimation(null,false);}
  function moveDots(){rayData.forEach((ray,i)=>dots[i].position.set(...world(pointOnReflectedRay(ray,phase))));}
  function distanceGuide(a,b,text,color,labelOffset=0){
    line(construction,[a,b],color,{opacity:.85});
    const vertical=Math.abs(b[1]-a[1])>Math.abs(b[0]-a[0]);
    for(const p of [a,b])line(construction,vertical?[[p[0]-.09,p[1],p[2]],[p[0]+.09,p[1],p[2]]]:[[p[0],p[1]-.09,p[2]],[p[0],p[1]+.09,p[2]]],color);
    if(text)label(markers,text,[(a[0]+b[0])/2+labelOffset,a[1]+.24,a[2]],{color:'#'+new THREE.Color(color).getHexString(),size:.23,width:2.2});
  }
  function update(){
    const m=model(),observe=state.mode==='observe',measuring=state.mode==='measure',showRays=['rays','screen'].includes(state.mode);
    source.position.set(-state.distance*S,BASE,state.lateral*S);sourceArrow.scale.y=state.height*S;
    ghost.position.set(state.distance*S,BASE,state.lateral*S);ghostArrow.scale.y=state.height*S;
    // The opaque mirror never becomes transmissive physically: this is an explicit diagram mode.
    reflector.visible=back.visible=observe;faded.visible=!observe;
    ghost.visible=measuring||(state.mode==='rays'&&state.extensions);
    screen.visible=state.mode==='screen';screen.position.set(state.screenDistance*S,BASE,state.lateral*S);
    clearGroup(markers);clearGroup(construction);clearGroup(rayGroup);dots.length=0;rayData=[];
    markers.visible=construction.visible=state.labels;
    label(markers,observe?'平面镜':'镜面位置 · 教学透视',[0,5.22,0],{size:.26,width:3});
    label(markers,'物体 A',[-state.distance*S,BASE+state.height*S+.35,state.lateral*S],{color:'#f4ce8a',size:.28});
    if(ghost.visible)label(markers,'虚像 A′',[state.distance*S,BASE+state.height*S+.35,state.lateral*S],{color:'#cbb0ff',size:.25,width:1.8});
    if(!observe){
      const z=1.9,y=.93;
      const labelOffset=state.distance<20?.55:0;
      distanceGuide([-state.distance*S,y,z],[0,y,z],`物距 ${state.distance.toFixed(0)} cm`,colors.blue,-labelOffset);
      distanceGuide([0,y,z],[state.distance*S,y,z],`像距 ${state.distance.toFixed(0)} cm`,colors.violet,labelOffset);
      line(construction,[[-state.distance*S,BASE,state.lateral*S],[state.distance*S,BASE,state.lateral*S]],0xb8ccdf,{dashed:true,opacity:.45});
      line(construction,[[0,BASE+.17,state.lateral*S],[.17,BASE+.17,state.lateral*S],[.17,BASE,state.lateral*S]],0xa6bdd0);
    }
    if(measuring){
      for(const sign of [-1,1]){
        const outward=state.distance<22?1:-1;
        const x=sign*(state.distance*S+outward*.58),z=state.lateral*S;
        distanceGuide([x,BASE,z],[x,BASE+state.height*S,z],'',sign<0?colors.gold:colors.violet);
        label(markers,`${state.height.toFixed(0)} cm`,[x+outward*sign*.32,BASE+state.height*S*.5,z],{size:.22,width:1.2,color:sign<0?'#f4ce8a':'#cbb0ff'});
      }
    }
    if(showRays){
      const hits=[[0,Math.max(4,state.height-9),state.lateral-8],[0,state.height+2,state.lateral-4],[0,Math.min(34,state.height+10),state.lateral+8]];
      for(const hit of hits){
        const first=reflectRay(m.objectTip,hit);let length=50;
        if(first.outgoing[1]>0)length=Math.min(length,(38-hit[1])/first.outgoing[1]);
        else if(first.outgoing[1]<0)length=Math.min(length,-hit[1]/first.outgoing[1]);
        const ray=reflectRay(m.objectTip,hit,length);rayData.push(ray);
        const points=[ray.source,ray.hit,ray.end].map(world),flow={speed:.9,spacing:1.35};
        line(rayGroup,points,colors.gold,{flow});
        const incidentLength=new THREE.Vector3(...points[0]).distanceTo(new THREE.Vector3(...points[1]));
        for(let segment=0;segment<2;segment++){
          const a=new THREE.Vector3(...points[segment]),b=new THREE.Vector3(...points[segment+1]);
          const p=a.clone().lerp(b,.55),q=a.clone().lerp(b,.65);
          arrow(rayGroup,p.toArray(),q.toArray(),{radius:.008,head:.09,flow:{...flow,offset:(segment?incidentLength:0)+a.distanceTo(p)}});
        }
        if(state.extensions)line(rayGroup,[world(ray.hit),world(ray.image)],colors.violet,{dashed:true,opacity:.8});
        const dotMaterial=own(new THREE.MeshBasicMaterial({color:0xfff0c6}));
        const dot=mesh(new THREE.SphereGeometry(.045,16,12),dotMaterial,rayGroup);dot.castShadow=false;dot.visible=state.mode==='rays';dots.push(dot);
      }
      if(state.mode==='screen'){
        label(markers,'光屏 · 无清晰像',[state.screenDistance*S,4.44,state.lateral*S],{size:.25,width:2.8});
        // Only an auxiliary locator under the screen: no arrow is drawn onto its surface.
        line(construction,[[state.distance*S,.72,state.lateral*S-.5],[state.distance*S,.72,state.lateral*S+.5]],colors.violet,{dashed:true});
        label(markers,'虚像位置（辅助标记）',[state.distance*S,.64,state.lateral*S-1.1],{size:.2,width:3,color:'#cbb0ff'});
      }
      moveDots();
    }
    root.userData.directionFlow.setEnabled(showRays);
    stage.setDragging([source,...(screen.visible?[screen]:[])],(key,p)=>{
      transition.cancel();stopPoints();phase=0;
      if(key==='mirror-object'){state.distance=Math.round(clamp(-p.x/S,10,50));state.lateral=Math.round(clamp(p.z/S,-12,12));}
      else state.screenDistance=Math.round(clamp(p.x/S,10,50));
      update();
    },{plane:new THREE.Plane(new THREE.Vector3(0,1,0),-BASE),preserveOffset:true});
    stage.requestRender();changed?.();
  }
  function set(key,value){
    transition.cancel();if(state[key]===value)return;stopPoints();phase=0;state[key]=value;update();
  }
  function setMode(mode){
    if(!views[mode])return;set('mode',mode);
    stage.setHome(views[mode].position,views[mode].target);stage.view('perspective');
  }
  function preset(name){
    stopPoints();phase=0;
    if(['before','at','after'].includes(name))transition.move({screenDistance:clamp(state.distance+({before:-10,at:0,after:10}[name]),10,50)});
    else transition.move({near:{distance:15},far:{distance:45},tall:{height:28},offset:{lateral:10}}[name]);
  }
  update();
  return {state,set,setMode,preset,
    reset(){transition.cancel();const mode=state.mode;stopPoints();phase=0;Object.assign(state,defaults,{mode});update();},
    get isPlaying(){return playing;},
    togglePoints(){
      if(state.mode!=='rays')return;transition.cancel();playing=!playing;
      stage.setAnimation(dt=>{phase=(phase+dt/4)%1;moveDots();stage.requestRender();},playing);changed?.();
    },
    metrics(){
      const m=model(),mode=state.mode;
      const result=mode==='screen'?'虚像 · 光屏不能承接':mode==='rays'?(state.extensions?'反向延长线 · 交于虚像':'实际光线 · 只在镜前'):'正立 · 等大 · 等距 · 虚像';
      const detail={observe:'像的实际高度等于物高；透视远近造成的画面大小变化，不是像高变化。',measure:'物像连线垂直镜面；淡化镜面与紫色箭头用于定位虚像。',rays:state.extensions?'实线是实际光路；紫色虚线是反向延长线，反射光线不在镜后会聚。':'已隐藏反向延长线；实际反射光线仍只在镜前传播。',screen:Math.abs(m.screenOffset)<.01?'光屏已到虚像位置，屏上仍无清晰像；镜后没有反射光线会聚。':`光屏在虚像${m.screenOffset<0?'靠镜面一侧':'远离镜面一侧'} ${Math.abs(m.screenOffset).toFixed(0)} cm，仍不能承接虚像。`}[mode];
      return {result,detail,status:mode==='rays'?(playing?'光点播放中':'光路示意'):modes.find(item=>item[0]===mode)[1],
        formula:'d物 = d像　·　h物 = h像',
        values:[['物到镜面',m.objectDistance.toFixed(0),'cm'],['像到镜面',m.imageDistance.toFixed(0),'cm'],['物高 / 像高',`${m.objectHeight.toFixed(0)} / ${m.imageHeight.toFixed(0)}`,'cm'],['物像间距',m.separation.toFixed(0),'cm'],...(mode==='screen'?[['光屏状态','不能承接','']]:[])],
        note:'理想单面平面镜，忽略厚度、折射与衍射。以箭头竖直中心参考线测垂直距离，物体厚度仅作造型；镜面淡化不代表透光。光点为慢速路径演示，不是实际光速。',
        hint:mode==='observe'?'拖动物体改变物距和横向位置；从镜前观察反射。':mode==='screen'?'拖动光屏，或用“像前 / 像位 / 像后”比较；光屏始终无清晰像。':'拖动物体或调节参数；紫色表示虚像与辅助延长线。',
        badge:{observe:'理想平面镜 · 实时反射',measure:'对称测量 · 镜面淡化示意',rays:'实线：实际光路 · 虚线：反向延长',screen:'光屏检验 · 镜后无反射光会聚'}[mode]};
    },
    dispose(){transition.cancel();stopPoints();releaseQualityTarget();reflector.dispose();}
  };
}
