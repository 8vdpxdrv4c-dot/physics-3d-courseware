import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {FXAAPass} from 'three/addons/postprocessing/FXAAPass.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {createDampedZoom} from './damped-zoom.js';
import {createMetalSurface} from './metal-surface.js';
import {createDirectionFlow} from './direction-flow.js';
import {createLaboratoryBackdrop} from './laboratory-backdrop.js';
import {box,cylinder,materials,clearGroup} from './kit.js';

export function createStage(container,onManipulation,{quality='high'}={}) {
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x060d17);
  scene.fog=new THREE.FogExp2(0x060d17,.018);
  // AA belongs to the quality-controlled offscreen target. The canvas itself
  // must not retain MSAA when low quality is selected.
  const renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.02;container.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','可旋转和缩放的三维物理实验场景');
  const pmrem=new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  let environmentTarget=null,backgroundTexture=null,backdropTarget=null,disposed=false;
  const reflectiveMaterials=[materials.metal,materials.chrome,materials.brass,materials.copper];
  scene.environmentIntensity=1.05;
  const environmentReady=new THREE.TextureLoader().loadAsync('./textures/laboratory-blurred-environment-v1.png').then(map=>{
    if(disposed){map.dispose();return;}
    map.colorSpace=THREE.SRGBColorSpace;map.mapping=THREE.EquirectangularReflectionMapping;
    backgroundTexture=map;environmentTarget=pmrem.fromEquirectangular(map);
    backdropTarget=createLaboratoryBackdrop(renderer,map);
    scene.background=backdropTarget.texture;scene.backgroundBlurriness=.04;scene.backgroundIntensity=.32;
    scene.environment=environmentTarget.texture;
    // Both images have the same orientation: the visible room owns its reflections.
    scene.backgroundRotation.y=.95;scene.environmentRotation.y=.95;
    // Explicit maps let bare metals use their own reflection strength instead
    // of inheriting scene.environmentIntensity (which also lights the screen).
    for(const material of reflectiveMaterials){
      material.envMap=environmentTarget.texture;
      material.envMapRotation.copy(scene.environmentRotation);material.needsUpdate=true;
    }
    pmrem.dispose();requestRender();
  }).catch(error=>{pmrem.dispose();console.warn('实验室环境图加载失败，保留深色背景。',error);});
  const camera=new THREE.PerspectiveCamera(37,1,.1,100);camera.position.set(-4.5,4.7,12.7);
  // Canvas antialiasing does not cover the composer's offscreen geometry pass.
  // Match HDR colour and depth sample support before allocating an MSAA target.
  const gl=renderer.getContext();
  const colorSamples=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES)||[]);
  const depthSamples=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,gl.SAMPLES)||[]);
  const maxSamples=Math.max(0,...colorSamples.filter(n=>n<=4&&depthSamples.includes(n)));
  let renderQuality=quality==='low'?'low':'high';
  const qualityTargets=new Map();
  function createComposer(){
    const high=renderQuality==='high',samples=high?maxSamples:0;
    const sceneTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples});
    sceneTarget.texture.name='courseware-scene';
    const next=new EffectComposer(renderer,sceneTarget);next.addPass(new RenderPass(scene,camera));
    if(high)next.addPass(new UnrealBloomPass(new THREE.Vector2(800,600),.09,.3,1.6));
    // Retain output conversion in both modes so lighting, metals and custom
    // flame shaders keep the same exposure and colour response.
    next.addPass(new OutputPass());
    if(high&&samples<2)next.addPass(new FXAAPass());
    const size=renderer.getSize(new THREE.Vector2());next.setSize(size.x,size.y);
    return next;
  }
  let composer=createComposer();
  function disposeComposer(){composer.passes.forEach(pass=>pass.dispose());composer.dispose();}
  function updateTargetSamples(target,preferred){
    const samples=renderQuality==='high'?Math.min(preferred,maxSamples):0;
    if(target.samples!==samples){target.dispose();target.samples=samples;}
  }
  function setQuality(value){
    if(!['high','low'].includes(value)||value===renderQuality)return;
    // Release MSAA buffers and bloom mip levels rather than merely hiding a pass.
    disposeComposer();renderQuality=value;composer=createComposer();
    qualityTargets.forEach((samples,target)=>updateTargetSamples(target,samples));
    requestRender();
  }
  const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.dampingFactor=.085;
  orbit.enableZoom=false; // Wheel and pinch are integrated by the shared damped radius controller.
  orbit.target.set(0,2.15,0);orbit.minDistance=5;orbit.maxDistance=26;
  orbit.maxPolarAngle=Math.PI*.48;orbit.enablePan=true;
  // Room bounce lifts undersides; the broad studio fill reveals support faces.
  const bounce=new THREE.HemisphereLight(0xbac9dc,0x8b94a1,2.35);bounce.name='room-bounce';scene.add(bounce);
  RectAreaLightUniformsLib.init();
  const fill=new THREE.RectAreaLight(0xc9d8e8,4.2,9,6);fill.name='soft-fill';
  fill.position.set(2.5,6,7);fill.lookAt(0,2,0);scene.add(fill);
  const key=new THREE.SpotLight(0xc2dcff,190,30,Math.PI/4,.85,2);key.name='key';
  key.position.set(-3,10,6);key.target.position.set(0,1.5,0);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);key.shadow.bias=-.0002;key.shadow.normalBias=.025;
  scene.add(key,key.target);
  const rim=new THREE.DirectionalLight(0x90badc,.65);rim.name='rim';rim.position.set(2,5,-7);scene.add(rim);
  const warm=new THREE.SpotLight(0xffc478,90,25,.7,.9,2);warm.name='warm';warm.position.set(-7,6,1);warm.target.position.set(-2,1,0);scene.add(warm,warm.target);
  // Five elevated fills lift every side without adding shadow maps. Keep them
  // clear of the apparatus: inverse-square falloff stays broad and gradual.
  const subjectFill=new THREE.Group();subjectFill.name='subject-point-fill';
  const fillPositions=[
    ['top',0xf0f3f8,36,[0,8.5,0]],
    ['front',0xdce8f5,48,[0,5.5,6]],
    ['back',0xdbe6f5,52,[0,5.8,-6]],
    ['left',0xf4e8d8,46,[-7,5.8,0]],
    ['right',0xe5edf8,46,[7,5.8,0]],
  ];
  for(const [name,color,intensity,position] of fillPositions){
    const light=new THREE.PointLight(color,intensity,0,2);
    light.name=`subject-fill-${name}`;light.position.set(...position);
    light.castShadow=false;subjectFill.add(light);
  }
  scene.add(subjectFill);
  const tabletop=new THREE.Group();scene.add(tabletop);
  const metalSurface=createMetalSurface(renderer);
  const tableBody=new THREE.MeshStandardMaterial({color:0x303e4d,metalness:.45,roughness:.6});
  box(tabletop,19,.32,10,tableBody,0,.2,0);
  // Clear the slab's bevel; a coplanar skin would hide the texture or z-fight.
  const surface=new THREE.Mesh(new THREE.PlaneGeometry(19,10),metalSurface.material);surface.rotation.x=-Math.PI/2;surface.position.y=.38;surface.receiveShadow=true;tabletop.add(surface);
  for(const x of [-7.5,7.5])for(const z of [-3.5,3.5])cylinder(tabletop,.2,3,materials.black,x,-1.4,z);
  box(tabletop,19,.2,.12,materials.chrome,0,.2,5);
  const root=new THREE.Group();scene.add(root);
  let renderId,dirty=true,active=false,inFrame=false,previous=0,tick=()=>{};
  const visualTickers=new Set(),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let cameraTransition=null;
  let home={position:[-4.5,4.7,12.7],target:[-.6,2.25,0]};
  const requestRender=()=>{dirty=true;if(!renderId&&!inFrame)renderId=requestAnimationFrame(frame);};
  const directionFlow=createDirectionFlow({motionPreference:reducedMotion,addTicker(fn){visualTickers.add(fn);requestRender();return()=>{visualTickers.delete(fn);requestRender();};}});
  root.userData.directionFlow=directionFlow;
  function frame(now){renderId=0;inFrame=true;const elapsed=(now-previous)/1000||0,dt=Math.min(elapsed,.04);previous=now;
    const cameraMoving=!!cameraTransition;
    if(cameraTransition){
      const move=cameraTransition,t=THREE.MathUtils.clamp((now-move.started)/move.duration,0,1);
      const eased=t*t*t*(t*(t*6-15)+10);
      camera.position.lerpVectors(move.fromPosition,move.position,eased);
      orbit.target.lerpVectors(move.fromTarget,move.target,eased);
      if(t===1){cameraTransition=null;orbit.enableDamping=move.damping;}
    }
    let moved=orbit.update();const zoomMoving=zoom.update(now);if(zoomMoving)moved=orbit.update()||moved;
    if(active)tick(Math.min(elapsed,.25),now/1000);
    const visualMotion=visualTickers.size>0&&!reducedMotion.matches&&!document.hidden;
    if(!document.hidden)visualTickers.forEach(fn=>fn(visualMotion?dt:0,reducedMotion.matches?0:now/1000));
    if(dirty||active||moved||visualMotion||cameraMoving||zoomMoving){composer.render(dt);dirty=false;}
    inFrame=false;if((active||moved||dirty||visualMotion||cameraTransition||zoom.active)&&!document.hidden)renderId=requestAnimationFrame(frame);
  }
  const onVisibility=()=>{previous=performance.now();requestRender();},onMotionPreference=()=>requestRender();
  document.addEventListener('visibilitychange',onVisibility);reducedMotion.addEventListener('change',onMotionPreference);
  orbit.addEventListener('change',requestRender);
  function cancelCameraTransition(){
    if(cameraTransition){orbit.enableDamping=cameraTransition.damping;cameraTransition=null;requestRender();}
  }
  orbit.addEventListener('start',cancelCameraTransition);
  const zoom=createDampedZoom({camera,orbit,element:renderer.domElement,requestRender,cancelView:cancelCameraTransition,reducedMotion,
    onPinchStart:()=>{drag=null;orbit.enabled=true;}});
  function resizeViewport(){
    const {width,height}=container.getBoundingClientRect();if(!width||!height)return;
    const ratio=Math.min(devicePixelRatio,2);renderer.setPixelRatio(ratio);composer.setPixelRatio(ratio);
    renderer.setSize(width,height,false);composer.setSize(width,height);camera.aspect=width/height;
    camera.fov=Math.min(110,THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(37/2))*Math.max(1,1.6/camera.aspect))));
    // The buffer fills the viewport; shift composition away from floating controls.
    if(container.classList.contains('stage')){
      const narrow=width<=1000,centerX=narrow?width*.53:(112+width-(width>=1650?332:291))/2;
      const centerY=height*.48;
      camera.setViewOffset(width,height,width/2-centerX,height/2-centerY,width,height);
    }
    camera.updateProjectionMatrix();requestRender();
  }
  const resize=new ResizeObserver(resizeViewport);resize.observe(container);window.addEventListener('resize',resizeViewport);
  function moveCamera(position,target,{animate=true}={}){
    zoom.cancel();
    cancelCameraTransition();
    const fromPosition=camera.position.clone(),fromTarget=orbit.target.clone(),damping=orbit.enableDamping;
    // Flush OrbitControls' remaining inertia without displaying the temporary pose.
    orbit.enableDamping=false;orbit.update();camera.position.copy(fromPosition);orbit.target.copy(fromTarget);orbit.update();
    if(!animate){camera.position.copy(position);orbit.target.copy(target);orbit.update();orbit.enableDamping=damping;requestRender();return;}
    cameraTransition={fromPosition,fromTarget,position:position.clone(),target:target.clone(),
      started:performance.now(),duration:reducedMotion.matches?180:850,damping};
    requestRender();
  }
  function view(name='perspective',options={}){
    const position=new THREE.Vector3(),target=new THREE.Vector3();
    if(name==='front'){position.set(0,2.8,17);target.set(0,2.7,0);}
    else if(name==='top'){position.set(0,17,.2);target.set(0,1.7,0);}
    else{position.set(...home.position);target.set(...home.target);}
    moveCamera(position,target,options);
  }
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,0,1),0);
  let picks=[],drag=null,moveDrag=null,pickingPlane=null,preserveDragOffset=false;
  const dragOffset=new THREE.Vector3();
  function cast(event){const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);}
  renderer.domElement.addEventListener('pointerdown',e=>{
    cancelCameraTransition();zoom.cancel();if(e.button!==0||zoom.pinching)return;cast(e);const hits=raycaster.intersectObjects(picks,true);
    if(hits.length){let o=hits[0].object;while(o&&!o.userData.dragKey)o=o.parent;
      if(o){
        plane.copy(pickingPlane||new THREE.Plane(new THREE.Vector3(0,0,1),0));dragOffset.set(0,0,0);
        if(preserveDragOffset){const hit=new THREE.Vector3();if(raycaster.ray.intersectPlane(plane,hit))dragOffset.copy(o.getWorldPosition(new THREE.Vector3())).sub(hit);}
        onManipulation?.();drag=o.userData.dragKey;orbit.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);
      }}
  });
  renderer.domElement.addEventListener('pointermove',e=>{
    if(!drag)return;cast(e);const hit=new THREE.Vector3();
    if(raycaster.ray.intersectPlane(plane,hit))moveDrag?.(drag,hit.add(dragOffset));
  });
  const stop=()=>{drag=null;orbit.enabled=true;};renderer.domElement.addEventListener('pointerup',stop);renderer.domElement.addEventListener('pointercancel',stop);
  requestRender();
  return {scene,root,renderer,camera,orbit,requestRender,view,environmentReady,setQuality,
    get quality(){return renderQuality;},
    registerQualityTarget(target,highSamples){
      qualityTargets.set(target,highSamples);updateTargetSamples(target,highSamples);
      return()=>qualityTargets.delete(target);
    },
    viewAt(position,target){moveCamera(new THREE.Vector3(...position),new THREE.Vector3(...target));},
    setHome(position,target){home={position,target};},
    focusAt(position,distance=7){const target=new THREE.Vector3(...position),offset=camera.position.clone().sub(orbit.target).normalize().multiplyScalar(distance);moveCamera(target.clone().add(offset),target);},
    zoomBy:zoom.scaleBy,
    setAnimation(fn,enabled){tick=fn||(()=>{});active=enabled;previous=performance.now();requestRender();},
    addVisualTicker(fn){visualTickers.add(fn);requestRender();return()=>{visualTickers.delete(fn);requestRender();};},
    setDragging(objects,callback,{plane:customPlane=null,preserveOffset=false}={}){picks=objects;moveDrag=callback;pickingPlane=customPlane;preserveDragOffset=preserveOffset;},
    clear(){cancelCameraTransition();zoom.cancel();stop();picks=[];active=false;clearGroup(root);directionFlow.clear();visualTickers.clear();qualityTargets.clear();},
    dispose(){disposed=true;directionFlow.dispose();clearGroup(root);clearGroup(tabletop);subjectFill.children.forEach(light=>light.dispose());cancelAnimationFrame(renderId);resize.disconnect();window.removeEventListener('resize',resizeViewport);zoom.dispose();orbit.dispose();disposeComposer();qualityTargets.clear();renderer.dispose();metalSurface.dispose();tableBody.dispose();reflectiveMaterials.forEach(material=>{if(material.envMap===environmentTarget?.texture){material.envMap=null;material.needsUpdate=true;}});environmentTarget?.dispose();backgroundTexture?.dispose();backdropTarget?.dispose();pmrem.dispose();document.removeEventListener('visibilitychange',onVisibility);reducedMotion.removeEventListener('change',onMotionPreference);}}
}
