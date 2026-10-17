import {Vector3,MathUtils} from 'three';

// OrbitControls damps rotation and pan, but applies perspective dolly immediately.
// Own the zoom radius so wheel, pinch and programmatic zoom share one damped target.
export function createDampedZoom({camera,orbit,element,requestRender,cancelView,reducedMotion,onPinchStart,now=()=>performance.now()}){
  const touches=new Map(),offset=new Vector3();
  let target=null,lastTime=0,pinchDistance=0;
  const radius=()=>camera.position.distanceTo(orbit.target);
  const bounded=value=>MathUtils.clamp(value,orbit.minDistance,orbit.maxDistance);
  function scaleBy(factor){
    if(!orbit.enabled||!Number.isFinite(factor)||factor<=0)return;
    cancelView();
    if(target===null)lastTime=now();
    target=bounded((target??radius())*factor);requestRender();
  }
  function wheel(event){
    if(!orbit.enabled)return;
    event.preventDefault();event.stopImmediatePropagation();
    const unit=event.deltaMode===1?16:event.deltaMode===2?element.clientHeight:1;
    const delta=MathUtils.clamp(event.deltaY*unit*(event.ctrlKey?2:1),-240,240);
    scaleBy(Math.exp(delta*.0009));
  }
  const distance=()=>{const [a,b]=touches.values();return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;};
  function down(event){
    if(event.pointerType!=='touch')return;
    touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(touches.size===2){onPinchStart?.();cancelView();pinchDistance=distance();}
  }
  function move(event){
    if(!touches.has(event.pointerId))return;
    touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(touches.size!==2)return;
    const next=distance();if(next>0&&pinchDistance>0)scaleBy(pinchDistance/next);
    pinchDistance=next;
  }
  function up(event){touches.delete(event.pointerId);pinchDistance=0;}
  element.addEventListener('wheel',wheel,{passive:false,capture:true});
  for(const [type,handler] of [['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up]])element.addEventListener(type,handler,{capture:true});
  function cancel(){target=null;}
  return {
    scaleBy,cancel,get active(){return target!==null;},get pinching(){return touches.size>1;},
    update(now){
      if(target===null)return false;
      const dt=MathUtils.clamp((now-lastTime)/1000,0,.05);lastTime=now;
      const current=radius(),alpha=1-Math.exp(-(reducedMotion.matches?28:11)*dt);
      const next=Math.abs(target-current)<.001?target:MathUtils.lerp(current,target,alpha);
      offset.subVectors(camera.position,orbit.target).setLength(bounded(next));
      camera.position.copy(orbit.target).add(offset);
      if(next===target)target=null;
      return true;
    },
    dispose(){
      cancel();touches.clear();element.removeEventListener('wheel',wheel,{capture:true});
      for(const [type,handler] of [['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up]])element.removeEventListener(type,handler,{capture:true});
    }
  };
}
