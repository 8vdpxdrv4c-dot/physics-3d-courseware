import {thinLens} from './physics.js';

export const BENCH_SCALE=.12;
export const FLAME_REFERENCE=.95;
export function opticalBench(state){
  const {objectX,lensX,screenX,objectY=0,screenY=0,f=10}=state;
  if(![objectX,lensX,screenX,objectY,screenY,f].every(Number.isFinite))throw new RangeError('仪器坐标必须有限');
  const u=lensX-objectX,s=screenX-lensX;
  if(!(u>0&&s>0))throw new RangeError('仪器顺序应为物体、透镜、光屏');
  const image=thinLens(u,f,s),base=objectY*BENCH_SCALE;
  const imageBase=image.limit?null:image.m*base,imageTip=image.limit?null:image.m*(base+FLAME_REFERENCE);
  const imageBounds=image.limit?null:[image.m*base,image.m*(base+1.33)].sort((a,b)=>a-b);
  const screenBounds=[screenY*BENCH_SCALE-1.15,screenY*BENCH_SCALE+1.15];
  const covered=!!imageBounds&&imageBounds[0]>=screenBounds[0]&&imageBounds[1]<=screenBounds[1]&&Math.abs(image.m)*.28<=.8;
  const blurRadius=1.3*Math.abs(1+s/u-s/f);
  return {...image,u,s,imageX:image.limit?null:lensX+image.v,imageBase,imageTip,imageBounds,screenBounds,covered,
    blurRadius,spotY:-s/u*(base+FLAME_REFERENCE),
    status:image.limit?'无有限像距':!image.real?'虚像不能承接':!image.focused?'屏距未对焦':covered?'清晰且完整':'已对焦 · 像超出光屏'};
}

// Point source -> aperture -> outgoing slope. World height and centimetres are kept explicit.
export function benchRay(state,lensHeight){
  const m=opticalBench(state),sourceY=state.objectY*BENCH_SCALE+FLAME_REFERENCE;
  if(Math.abs(lensHeight)>1.3+1e-9)return null;
  const slope=(lensHeight-sourceY)/m.u-lensHeight/state.f;
  const screenY=lensHeight+slope*m.s;
  return {sourceY,lensHeight,slope,screenY,intercepted:state.showScreen&&screenY>=m.screenBounds[0]&&screenY<=m.screenBounds[1]};
}
