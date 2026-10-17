// Short user-triggered parameter demonstrations; never used for physical time integration.
export function createParameterTransition(stage,state,update){
  let release=null;
  function cancel(){release?.();release=null;}
  function move(target){
    cancel();
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){Object.assign(state,target);update();return;}
    const start=performance.now(),from={};for(const key of Object.keys(target))from[key]=state[key];
    let last=-1;
    release=stage.addVisualTicker(()=>{
      const t=Math.min(1,(performance.now()-start)/750);
      // Rebuild teaching annotations at most 25 times per second during this finite transition.
      const frame=Math.floor(t*19);if(frame===last&&t<1)return;last=frame;
      const k=t*t*(3-2*t);for(const key of Object.keys(target))state[key]=from[key]+(target[key]-from[key])*k;
      if(t===1){Object.assign(state,target);cancel();}update();
    });
  }
  return {move,cancel};
}
