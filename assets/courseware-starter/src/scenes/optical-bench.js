import * as THREE from 'three';
import {box,cylinder,rod,label,tag3D,line,arrow,materials,colors,clearGroup,mesh} from '../kit.js';
import {CANDLE,createFlameVolume,createCandleProjection} from '../flame.js';
import {opticalBench,benchRay,BENCH_SCALE as S,FLAME_REFERENCE as H} from '../optics-bench.js';
import {createParameterTransition} from '../parameter-transition.js';

const AXIS=3.3;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const own=mat=>{mat.userData.owned=true;return mat;};
const text=(parent,value,pos,options={})=>label(parent,value,pos,{size:.25,width:2.8,weight:600,outline:true,...options});
export function createOpticsLesson(stage,changed,{exam=false}={}){
  const defaults={objectX:-30,lensX:0,screenX:exam?24:15,objectY:0,screenY:0,u:30,screen:15,f:10,rays:true,labels:true,showScreen:true,solution:false,challenge:'focus'};
  const state={...defaults},root=stage.root,draw=new THREE.Group(),markers=new THREE.Group();root.add(draw,markers);
  const tween=createParameterTransition(stage,state,update);
  box(root,13.1,.22,.65,materials.black,0,.52,0);
  for(const z of [-.25,.25])rod(root,[-6.5,.67,z],[6.5,.67,z],.035,materials.chrome);
  // Keep the complete ruler face above the tabletop for true depth-tested tags.
  box(root,13.05,.36,.035,materials.black,0,.59,.34,.004);
  for(let n=-50;n<=50;n++){
    const x=n*S;line(root,[[x,.75,.366],[x,n%5===0?.63:.69,.366]],n%5===0?0xadc7df:0x52687d);
    if(n%10===0)tag3D(root,String(n),[x,.51,.37],{size:.18,width:.6,weight:600,outline:true});
  }
  tag3D(root,'cm',[6.4,.51,.37],{size:.17,width:.5,weight:600,outline:true});
  function mount(key){
    const group=new THREE.Group();group.userData.dragKey=key;root.add(group);
    box(group,.75,.15,.75,materials.black,0,.72,0,.05);box(group,.56,.1,.53,materials.metal,0,.84,0);
    const shaft=cylinder(group,.075,1,materials.chrome);
    cylinder(group,.16,.18,materials.black,0,1.02,0);
    const screw=cylinder(group,.09,.2,materials.brass,.2,1.02,0);screw.rotation.z=Math.PI/2;
    return {group,move(x,top){group.position.x=x;shaft.scale.y=Math.max(.2,top-.85);shaft.position.y=(top+.85)/2;}};
  }
  const sourceMount=mount('objectX'),lensMount=mount('lensX'),screenMount=mount('screenX');
  const lens=new THREE.Group();root.add(lens);lens.userData.dragKey='lensX';
  const rim=mesh(new THREE.TorusGeometry(1.36,.07,16,80),materials.black,lens,0,AXIS,0);rim.rotation.y=Math.PI/2;
  for(const x of [-.07,.07]){const r=mesh(new THREE.TorusGeometry(1.31,.012,8,80),materials.brass,lens,x,AXIS,0);r.rotation.y=Math.PI/2;}
  const glass=own(new THREE.MeshPhysicalMaterial({color:0xb2d7f3,roughness:.12,transmission:.9,thickness:.25,ior:1.5,transparent:true,opacity:.7,clearcoat:.5}));
  const body=mesh(new THREE.SphereGeometry(1,64,40),glass,lens,0,AXIS,0);body.scale.set(.15,1.28,1.28);
  cylinder(lens,.075,.15,materials.chrome,0,AXIS+1.46,0);
  const source=new THREE.Group();source.userData.dragKey='objectX';root.add(source);
  cylinder(source,.17,.13,materials.brass,0,-.065,0);
  cylinder(source,CANDLE.radius,CANDLE.waxHeight,own(new THREE.MeshStandardMaterial({color:0xefe1c8,roughness:.78})),0,CANDLE.waxHeight/2,0);
  rod(source,[0,CANDLE.waxHeight-.01,0],[0,CANDLE.waxHeight+.1,0],.012,materials.black);
  const fire=createFlameVolume();source.add(fire.mesh);
  const candleLight=new THREE.PointLight(0xffbd72,.45,3,2);candleLight.position.y=.9;source.add(candleLight);
  const heightHandle=mesh(new THREE.SphereGeometry(.07,20,12),materials.white,source,0,1.4,0);heightHandle.userData.dragKey=exam?'objectY':'objectX';heightHandle.visible=exam;
  const flameRelease=stage.addVisualTicker((dt,time)=>{fire.update(time,stage.camera);candleLight.intensity=.45+.025*Math.sin(time*7);});
  const screen=new THREE.Group();screen.userData.dragKey=exam?'screenBody':'screenX';root.add(screen);
  box(screen,.06,2.34,1.65,own(new THREE.MeshStandardMaterial({color:0x8c99aa,roughness:.95})),0,0,0);
  for(const z of [-.85,.85])box(screen,.09,2.43,.04,materials.chrome,0,0,z);
  for(const y of [-1.2,1.2])box(screen,.09,.04,1.74,materials.chrome,0,y,0);

  function normalize(){state.u=state.lensX-state.objectX;state.screen=state.screenX-state.lensX;}
  function update(){
    normalize();const m=opticalBench(state),lx=state.lensX*S,sourceBase=AXIS+state.objectY*S,screenCenter=AXIS+state.screenY*S;
    source.position.set(state.objectX*S,sourceBase,0);lens.position.x=lx;screen.position.set(state.screenX*S,screenCenter,0);
    sourceMount.move(source.position.x,sourceBase-.1);lensMount.move(lx,AXIS-1.35);screenMount.move(screen.position.x,screenCenter-1.2);
    screen.visible=screenMount.group.visible=state.showScreen;
    clearGroup(draw);clearGroup(markers);markers.visible=state.labels;
    line(markers,[[-6,AXIS,0],[6,AXIS,0]],0xadc3d6,{dashed:true,opacity:.45});
    for(const sign of [-1,1])for(const mult of [1,2]){
      const x=lx+sign*mult*state.f*S;if(Math.abs(x)>6.4)continue;
      line(markers,[[x,AXIS-.04,0],[x,AXIS-.25,0]],0xc0d4e8);
      text(markers,mult===1?'F':'2F',[x,AXIS-.4,.05],{size:.22,width:.6});
    }
    text(markers,'蜡烛',[source.position.x,sourceBase+1.65,0],{color:'#f7ce8b'});
    text(markers,'凸透镜',[lx,AXIS+1.8,0]);
    if(state.showScreen)text(markers,'光屏',[screen.position.x,screenCenter+1.48,0]);
    const objectHeight=state.objectY*S+H;
    if(state.rays){
      const heights=[0,Math.min(1.2,objectHeight),-.9];
      for(const h of heights){
        const ray=benchRay(state,h);if(!ray)continue;
        let end=ray.intercepted?m.s:Math.max(m.s,50-state.lensX);
        if(ray.slope>0)end=Math.min(end,(6.4-AXIS-h)/ray.slope);
        if(ray.slope<0)end=Math.min(end,(.55-AXIS-h)/ray.slope);
        end=Math.max(.1,end);
        const at=d=>[lx+d*S,AXIS+h+ray.slope*d,0];
        const points=[[source.position.x,sourceBase+H,0],[lx,AXIS+h,0],at(end)],flow={spacing:1.2,speed:.9};
        line(draw,points,colors.gold,{flow});
        const incident=Math.hypot(m.u*S,h-objectHeight);
        const a=at(end*.5),b=at(Math.min(end,end*.5+.8));
        arrow(draw,a,b,{radius:.008,head:.095,flow:{...flow,offset:incident+Math.hypot(a[0]-lx,a[1]-AXIS-h)}});
        if(!m.real&&!m.limit&&Math.abs(m.imageX)<60&&AXIS+m.imageTip<7)
          line(draw,[[lx,AXIS+h,0],[m.imageX*S,AXIS+m.imageTip,0]],colors.violet,{dashed:true,opacity:.75});
      }
    }
    if(!m.limit&&Math.abs(m.imageX)<52&&Math.abs(m.m)<6){
      const imageBase=AXIS+m.imageBase;
      if(m.real&&m.focused&&state.showScreen)createCandleProjection(draw,{x:screen.position.x-.06,axis:imageBase,m:m.m,time:fire.time,clipCenter:screenCenter});
      if(!m.real||!state.showScreen){
        createCandleProjection(draw,{x:m.imageX*S,axis:imageBase,m:m.m,time:fire.time,virtual:!m.real,clip:false});
        text(markers,m.real?'理论像位置（示意）':'虚像位置（示意）',[m.imageX*S,Math.min(6.6,Math.max(1,AXIS+m.imageTip)+.4),0],{size:.2,color:'#c3acfa'});
      }
      line(markers,[[m.imageX*S,.79,.48],[m.imageX*S,1.04,.48]],colors.violet);
    }
    if(state.showScreen&&(!m.focused||!m.real)){
      const spotMat=own(new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
        uniforms:{radius:{value:Math.max(.035,m.blurRadius)},center:{value:m.spotY-state.screenY*S}},
        vertexShader:'varying vec2 p;void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:'varying vec2 p;uniform float radius;uniform float center;void main(){float r=length(vec2(p.x,p.y-center))/radius;float a=.3*exp(-2.5*r*r);if(a<.005)discard;gl_FragColor=vec4(1.,.65,.23,a);}'
      }));
      const spot=mesh(new THREE.PlaneGeometry(1.6,2.3),spotMat,draw,screen.position.x-.055,screenCenter,0);spot.rotation.y=-Math.PI/2;spot.castShadow=false;
    }
    stage.root.userData.directionFlow.setEnabled(state.rays);
    stage.setDragging([source,sourceMount.group,lens,lensMount.group,...(state.showScreen?[screen,screenMount.group]:[])],(key,p)=>{
      if(key==='objectY')set('objectY',(p.y-AXIS-1.4)/S);
      else if(key==='screenBody'){tween.cancel();state.screenX=clamp(p.x/S,state.lensX+5,50);state.screenY=clamp((p.y-AXIS)/S,-12,12);update();}
      else set(key,p.x/S);
    },{preserveOffset:true});
    stage.requestRender();changed?.();
  }
  function set(key,value){
    tween.cancel();
    if(key==='u')state.objectX=clamp(state.lensX-value,-50,state.lensX-5);
    else if(key==='screen')state.screenX=clamp(state.lensX+value,state.lensX+5,50);
    else if(key==='objectX')state.objectX=clamp(value,exam?-50:Math.max(-50,state.lensX-50),state.lensX-5);
    else if(key==='screenX')state.screenX=clamp(value,state.lensX+5,exam?50:Math.min(50,state.lensX+50));
    else if(key==='lensX')state.lensX=clamp(value,Math.max(-15,state.objectX+5,exam?-Infinity:state.screenX-50),Math.min(15,state.screenX-5,exam?Infinity:state.objectX+50));
    else if(key==='objectY')state.objectY=clamp(value,-8,10);
    else if(key==='screenY')state.screenY=clamp(value,-12,12);
    else state[key]=value;
    update();
  }
  function preset(name){
    if(exam){
      state.challenge=name;state.solution=false;
      const cases={focus:{objectX:-30,lensX:0,screenX:24,objectY:0,screenY:0},height:{objectX:-20,lensX:0,screenX:20,objectY:6,screenY:0},lensmove:{objectX:-30,lensX:5,screenX:15,objectY:0,screenY:0},virtual:{objectX:-5,lensX:0,screenX:20,objectY:0,screenY:0}};
      tween.move({...cases[name],f:10});
    }else{
      const u={camera:30,equal:20,projector:15,focus:10,magnifier:5}[name];
      tween.move({objectX:-u,lensX:0,screenX:u>10?10*u/(u-10):20,objectY:0,screenY:0,f:10});
    }
  }
  update();
  return {state,set,preset,
    reset(){tween.cancel();Object.assign(state,defaults);update();},
    focusScreen(){const m=opticalBench(state);if(m.real&&m.imageX<=50)tween.move({screenX:m.imageX});},
    canFocus(){const m=opticalBench(state);return m.real&&m.imageX<=50&&m.imageX>=state.lensX+5;},
    focusPosition(kind){if(kind==='lens')stage.focusAt([state.lensX*S,AXIS,0]);else if(kind==='screen'){const x=state.screenX*S,y=AXIS+state.screenY*S;stage.viewAt([x-3.5,y+1.2,7.5],[x,y,0]);}else stage.focusAt([state.objectX*S,AXIS+state.objectY*S+.5,0]);},
    metrics(){
      const m=opticalBench(state),questions={focus:'移动光屏，让像清晰。',height:'已对焦，为什么像仍不完整？试着上下移动光屏。',lensmove:'透镜移动后，物距和屏距怎样同时改变？',virtual:'物距小于焦距时，移动光屏能得到清晰像吗？'};
      const solution=m.limit?'物体在焦点，没有有限像距。':!m.real?'v<0，虚像在物体同侧；光屏只能收到发散光。':`理论像距 ${m.v.toFixed(1)} cm，像面坐标 ${m.imageX.toFixed(1)} cm。${m.covered?(m.focused?'当前屏面覆盖像。':'屏高范围足够，仍需将光屏移到焦面。'):'需检查上下覆盖；若像本身大于屏，平移也无法完整承接。'}`;
      return {result:exam?(state.solution?m.status:questions[state.challenge]):m.kind,
        detail:exam?(state.solution?solution:'先动手判断，再点“显示解析”；题目为自编探究情境。'):!m.limit&&Math.abs(m.imageX)>52?'理论像在当前导轨显示范围之外，像距读数仍有效。':m.real?'实像分支：物近像远，|m| 增大。':m.limit?'出射光线平行，光屏不能得到清晰像。':'虚像分支：物体靠近透镜，|v| 与 |m| 减小。',
        values:exam&&!state.solution?[['物距 u',m.u.toFixed(1),'cm'],['屏距 s',m.s.toFixed(1),'cm'],['焦距 f','10','cm'],['探究提示','观察光屏后展开解析','']]:[['物距 u',m.u.toFixed(1),'cm'],['屏距 s',m.s.toFixed(1),'cm'],['理论像距 v',m.limit?'∞':m.v.toFixed(1),'cm'],['放大率 m',m.limit?'—':m.m.toFixed(2),''],['光屏状态',state.showScreen?m.status:'已移开','']],
        formula:'u = x镜 − x物　·　1/f = 1/u + 1/v',status:m.focused?'已对焦':m.limit?'焦点处':m.real?'实像探究':'虚像探究',
        note:'理想近轴薄透镜。三仪器位置独立；光屏只接收实际到达其边界内的光线。模糊斑为几何光学示意，非辐射或衍射求解。屏距与理论像距差小于 0.35 cm 时显示为已对焦，这是演示容差。',
        hint:exam?'拖动三仪器改变位置；白色小球调节蜡烛高度，拖动屏面调节屏高。':'拖动蜡烛、透镜或光屏；物距和屏距始终从透镜位置量起。'};
    },dispose(){tween.cancel();flameRelease();}}
}
