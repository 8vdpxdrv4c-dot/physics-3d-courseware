import * as THREE from 'three';
import {box,cylinder,rod,label,line,arrow,materials,colors,mesh,clearGroup} from '../kit.js';
import {createMagneticModel,traceField,magnitude} from '../magnetic-field.js';
import {createParameterTransition} from '../parameter-transition.js';
export const modes=[['bar','条形磁铁'],['horseshoe','蹄形磁铁'],['unlike','异名相对'],['like','同名相对'],['ring','环形磁铁'],['solenoid','通电螺线管']];
const CENTER=3.5,defaults={mode:'bar',polarity:1,strength:1,gap:1.5,density:6,probeX:2.4,probeY:1.2,probeZ:0,sectionHeight:0,lines:true,internal:false,labels:true,filings:false,section:false};
const own=mat=>{mat.userData.owned=true;return mat;};
const tag=(parent,text,position,options={})=>label(parent,text,position,{size:.27,width:2.6,weight:600,outline:true,...options});
export function createLesson(stage,changed){
  const root=stage.root,state={...defaults},rig=new THREE.Group(),bodies=new THREE.Group(),curves=new THREE.Group(),probe=new THREE.Group(),labels=new THREE.Group(),filings=new THREE.Group();
  root.add(rig);rig.position.y=CENTER;rig.add(bodies,curves,probe,labels,filings);
  cylinder(root,4.8,.16,materials.black,0,.5,0,96);
  const trim=mesh(new THREE.TorusGeometry(4.75,.018,8,100),materials.brass,root,0,.6,0);trim.rotation.x=Math.PI/2;
  for(const x of [-1.7,1.7]){cylinder(root,.065,1.8,materials.chrome,x,1.5,0);box(root,.5,.1,.65,materials.black,x,.66,0);}
  const base=box(root,4.1,.12,1.5,materials.black,0,2.43,0);
  let model=createMagneticModel(state),paths=[],filingMesh=null,filingData=[],tapRelease=null,aligned=false;
  const transition=createParameterTransition(stage,state,()=>update(false));
  const p=()=>[state.probeX,state.probeY,state.probeZ];
  function magnetMaterial(color){return own(new THREE.MeshStandardMaterial({color,metalness:.22,roughness:.56,transparent:state.internal,opacity:state.internal?.28:1,depthWrite:!state.internal}));}
  function drawBodies(){
    clearGroup(bodies);const north=magnetMaterial(0xb74750),south=magnetMaterial(0x397fa4);
    for(const b of model.bodies){
      const g=new THREE.Group();bodies.add(g);g.position.set(...b.center);if(b.axis==='y')g.rotation.z=Math.PI/2;
      const positive=b.sign*state.polarity>0;
      if(state.mode==='horseshoe'){box(g,b.length,b.width,b.width,magnetMaterial(0x3b4c5d),0,0,0,.035);if(b.axis==='y')box(g,.32,b.width+.01,b.width+.01,positive?north:south,b.length/2-.16,0,0,.02);continue;}
      box(g,b.length/2,b.width,b.width,positive?north:south,b.length/4,0,0,.035);
      box(g,b.length/2,b.width,b.width,positive?south:north,-b.length/4,0,0,.035);
      if(state.labels&&state.mode!=='horseshoe'){
        tag(g,positive?'N':'S',[b.length*.32,0,b.width/2+.035],{size:.34,width:.5,color:'#f3e5cf'});
        tag(g,positive?'S':'N',[-b.length*.32,0,b.width/2+.035],{size:.34,width:.5,color:'#f3e5cf'});
      }
    }
    if(state.mode==='horseshoe'&&state.labels){tag(bodies,state.polarity>0?'N':'S',[-1.2,1.5,0],{color:'#fac4a6',size:.38});tag(bodies,state.polarity>0?'S':'N',[1.2,1.5,0],{color:'#b2d6ff',size:.38});}
    if(state.mode==='ring')for(const sign of [-1,1]){
      const shape=new THREE.Shape();shape.absarc(0,0,1.3,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,.65,0,Math.PI*2,true);shape.holes.push(hole);
      const geo=new THREE.ExtrudeGeometry(shape,{depth:.35,bevelEnabled:false,curveSegments:64});geo.rotateY(Math.PI/2);geo.translate(sign<0?-.35:0,0,0);
      mesh(geo,sign*state.polarity>0?north:south,bodies);
      if(state.labels)tag(bodies,sign*state.polarity>0?'N 面':'S 面',[sign*.6,1.55,0],{size:.25,width:1.1});
    }
    if(state.mode==='solenoid'){
      const points=[];for(let i=0;i<=640;i++){const t=i/640,angle=t*20*Math.PI;points.push(new THREE.Vector3(-1.5+3*t,.9*Math.cos(angle),.9*Math.sin(angle)));}
      mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),640,.035,8,false),materials.brass,bodies);
      rod(bodies,[-1.5,.9,0],[-2.1,.9,0],.035,materials.brass);rod(bodies,[1.5,.9,0],[2.1,.9,0],.035,materials.brass);
      if(state.labels){tag(bodies,state.polarity>0?'S':'N',[-1.8,1.4,0],{size:.35});tag(bodies,state.polarity>0?'N':'S',[1.8,1.4,0],{size:.35});tag(bodies,'电流 I',[0,1.42,1.05],{color:'#c6a6ff',size:.25});}
      const current=[];for(let i=0;i<=32;i++){const a=state.polarity*(.12+i*.045);current.push([0,1.12*Math.cos(a),1.12*Math.sin(a)]);}
      line(bodies,current,colors.violet,{flow:{speed:.6,spacing:.7}});arrow(bodies,current.at(-4),current.at(-1),{color:colors.violet,radius:.012,head:.14});
    }
    base.visible=state.mode!=='horseshoe';
  }
  function drawLines(recompute=true){
    clearGroup(curves);curves.visible=state.lines;if(!state.lines)return;
    if(recompute||!paths.length)paths=model.seeds(state.density,state.section).map(seed=>traceField(model,seed));
    for(const points of paths){
      let run=[],inside=null,offset=0,runStart=0;
      const flush=()=>{if(run.length>1&&(!inside||state.internal)){
        const color=inside?0x70d8b6:colors.blue,flow={spacing:1.2,speed:.65,offset:runStart};
        const obj=line(curves,run,color,{opacity:inside?.9:.64,flow});if(inside)obj.material.depthTest=false;
        if(run.length>10){const j=Math.floor(run.length*.54),a=run[Math.max(0,j-1)],b=run[Math.min(run.length-1,j+2)];const head=arrow(curves,a,b,{color,radius:.007,head:.1,flow:{...flow,offset:runStart+j*.075}});if(inside)head.traverse(o=>{if(o.material)o.material.depthTest=false;});}
      }};
      points.forEach((point,i)=>{const nextInside=model.inside(point);if(i)offset+=magnitude(point.map((v,k)=>v-points[i-1][k]));
        if(inside!==nextInside){if(run.length)run.push(point);flush();run=i?[points[i-1],point]:[point];inside=nextInside;runStart=offset;}else run.push(point);
      });flush();
    }
  }
  function drawProbe(){
    clearGroup(probe);clearGroup(labels);labels.visible=state.labels;
    const point=p(),field=model.field(point),n=magnitude(field),blocked=model.inside(point)&&state.mode!=='solenoid';
    const sphere=mesh(new THREE.SphereGeometry(.075,20,16),materials.gold,probe,...point);sphere.userData.dragKey='probe';
    if(!blocked&&n>1e-8){
      const d=new THREE.Vector3(...field).normalize(),origin=new THREE.Vector3(...point);
      const northEnd=origin.clone().addScaledVector(d,.45),southEnd=origin.clone().addScaledVector(d,-.45);
      const north=rod(probe,point,northEnd.toArray(),.045,materials.red),south=rod(probe,point,southEnd.toArray(),.045,materials.cyan);north.userData.dragKey=south.userData.dragKey='probe';
      arrow(probe,origin.clone().addScaledVector(d,.5).toArray(),origin.clone().addScaledVector(d,1).toArray(),{radius:.014,head:.15,color:colors.gold});
      tag(labels,'N',[northEnd.x,northEnd.y+.2,northEnd.z],{size:.21,width:.5,color:'#ffb9a3'});
    }
    tag(labels,blocked?'探针位于磁体内':n<1e-8?'B = 0 · 无确定方向':'探针 · 红端为 N',[point[0],point[1]+.72,point[2]],{color:'#f3cf8a',size:.23});
    for(const [end,name]of [[[4.5,0,0],'x'],[[0,2.8,0],'y'],[[0,0,3.4],'z']]){line(labels,[[0,0,0],end],0x62798b,{dashed:true,opacity:.4});tag(labels,name,end,{size:.18,width:.5});}
    stage.setDragging([sphere],(key,point)=>{transition.cancel();state.probeX=THREE.MathUtils.clamp(point.x,-5,5);state.probeY=THREE.MathUtils.clamp(point.y-CENTER,-2.4,3);update(false);},{preserveOffset:true});
  }
  const dummy=new THREE.Object3D();
  function paintFilings(t=0){
    if(!filingMesh)return;
    filingData.forEach((item,i)=>{dummy.position.set(...item.p);dummy.rotation.set(0,0,item.start+item.delta*t);dummy.scale.set(1,1,1);dummy.updateMatrix();filingMesh.setMatrixAt(i,dummy.matrix);});filingMesh.instanceMatrix.needsUpdate=true;stage.requestRender();
  }
  function drawFilings(){
    tapRelease?.();tapRelease=null;clearGroup(filings);filingMesh=null;filingData=[];aligned=false;filings.visible=state.filings;if(!state.filings)return;
    // Virtual vertical slice z = h: grains rotate in this plane without travelling.
    const plateMat=own(new THREE.MeshPhysicalMaterial({color:0x9ac8de,transparent:true,opacity:.065,side:THREE.DoubleSide,depthWrite:false,roughness:.8}));
    mesh(new THREE.PlaneGeometry(9.2,5.6),plateMat,filings,0,.3,state.sectionHeight);
    for(let row=0;row<20;row++)for(let col=0;col<33;col++){
      const point=[-4.5+col*.28,-2.35+row*.28,state.sectionHeight+.02];if(model.inside(point))continue;
      const b=model.field(point),start=Math.sin(row*27.3+col*11.1)*Math.PI,target=Math.atan2(b[1],b[0]),delta=((target-start+Math.PI*1.5)%Math.PI)-Math.PI/2;
      filingData.push({p:point,start,delta:Math.hypot(b[0],b[1])<1e-8?0:delta});
    }
    filingMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.105,.018,.018),materials.chrome,filingData.length);filings.add(filingMesh);paintFilings();
  }
  function tap(){if(!state.filings)return;tapRelease?.();if(matchMedia('(prefers-reduced-motion: reduce)').matches){paintFilings(1);aligned=true;changed?.();return;}const started=performance.now();tapRelease=stage.addVisualTicker(()=>{const t=Math.min(1,(performance.now()-started)/1100);paintFilings(t*t*(3-2*t));if(t===1){tapRelease();tapRelease=null;aligned=true;changed?.();}});}
  function update(rebuild=true){if(rebuild){model=createMagneticModel(state);drawBodies();drawLines(true);drawFilings();}drawProbe();root.userData.directionFlow.setEnabled(state.lines||state.mode==='solenoid');stage.requestRender();changed?.();}
  function set(key,value){transition.cancel();state[key]=value;
    if(key==='section'){stage.setHome(value?[0,3.8,19]:[-4,7,18],[0,3.5,0]);stage.view();}
    if(['probeX','probeY','probeZ'].includes(key))update(false);
    else if(key==='labels'){drawBodies();update(false);}
    else if(key==='internal'){drawBodies();drawLines(false);update(false);}
    else if(key==='filings'||key==='sectionHeight'){drawFilings();update(false);}
    else update(true);
  }
  function preset(name){const half=state.gap/2;
    const coords={north:state.mode==='horseshoe'?[-1.2,1.7,0]:state.mode==='like'?[-half+.25,0,0]:[state.mode==='unlike'?half+2.6:2.2,0,0],south:state.mode==='horseshoe'?[1.2,1.7,0]:[-(state.mode==='unlike'||state.mode==='like'?half+2.6:2.2),0,0],side:[0,2,0],center:[0,0,0]};
    let point=coords[name];if(state.polarity<0&&['north','south'].includes(name))point=coords[name==='north'?'south':'north'];
    transition.move({probeX:point[0],probeY:point[1],probeZ:point[2]});
  }
  update();
  return {state,set,preset,tap,
    setMode(mode){transition.cancel();state.mode=mode;state.polarity=1;paths=[];state.probeX=2.4;state.probeY=1.2;state.probeZ=0;update();},
    reset(){transition.cancel();Object.assign(state,defaults);paths=[];update();stage.setHome([-4,7,18],[0,3.5,0]);stage.view();},
    metrics(){const b=model.field(p()),n=magnitude(b),blocked=model.inside(p())&&state.mode!=='solenoid';
      const detail=state.mode==='like'?'同名相对：合场由矢量叠加决定，对称中心可为零，周围仍有磁场。':state.mode==='ring'?'环形磁铁沿轴向磁化，平的两端面为异名磁极；内孔不是一个磁极。':state.mode==='solenoid'?'右手四指沿紫色电流方向，拇指指向 N 端；反向电流使磁场反向。':'磁针红色 N 端沿当地磁场方向；磁感线只是描述磁场的曲线。';
      return {result:blocked?'探针进入磁体 · 请移到外部':n<1e-8?'对称中心 · B = 0':'小磁针 N 极 · 指向磁场方向',detail,
        formula:'外部 N → S　·　内部 S → N',status:modes.find(x=>x[0]===state.mode)[1],
        values:[['探针相对场强',blocked?'—':(n/10).toFixed(3),''],['B 方向',blocked||n<1e-8?'未定义':b.map(v=>(v/n).toFixed(2)).join(' / '),''],['场强倍率',state.strength.toFixed(1),'×'],['线条显示',state.section?'中央 z = 0 截面':'三维空间',''],...(state.filings?[['铁屑状态',aligned?'已沿平面分量排列':'待轻敲','']]:[])],
        badge:state.mode==='ring'?'轴向磁化环 · 相对磁场模型':'六种磁场 · 矢量叠加模型',
        note:'定性模型，场强不以 T 标定。永磁体用规定磁化方向的等效闭合电流近似；蹄形按三段磁化，螺线管按同轴线圈近似，忽略引线与材料响应。近电流线处作有限核心处理。蓝色外部、绿色内部；图窗裁切不表示磁感线终止。铁屑只转向该截面内的磁场分量，不模拟聚集与相互作用。线数只改变显示数量。',
        hint:state.filings?'轻敲后铁屑原地转向；截面位置是 z 坐标，非粒子沿磁感线运动。':'移动探针比较磁场方向；绿色内部线需开启透视。'};
    },dispose(){transition.cancel();tapRelease?.();}
  };
}
