// Centimetres. The ideal mirror is x = 0; the object is in x < 0.
export function mirrorPoint(point){return [-point[0],point[1],point[2]];}

export function planeMirror({distance,height,lateral=0,screenDistance=distance}){
  if(![distance,height,lateral,screenDistance].every(Number.isFinite)||distance<=0||height<=0||screenDistance<=0){
    throw new RangeError('平面镜参数必须有限，物距、物高和光屏距离需大于零');
  }
  const objectBase=[-distance,0,lateral],objectTip=[-distance,height,lateral];
  return {objectBase,objectTip,imageBase:mirrorPoint(objectBase),imageTip:mirrorPoint(objectTip),
    objectDistance:distance,imageDistance:distance,signedImageDistance:-distance,
    objectHeight:height,imageHeight:height,separation:2*distance,magnification:1,virtual:true,
    screenOffset:screenDistance-distance,screenImage:false};
}

// Reflect a ray at a chosen point of the finite display mirror. No paraxial approximation.
export function reflectRay(source,hit,exitLength=55){
  if(source[0]>=0||Math.abs(hit[0])>1e-10||!Number.isFinite(exitLength)||exitLength<=0)throw new RangeError('光源须在镜前，反射点须在镜面');
  const delta=hit.map((v,i)=>v-source[i]),length=Math.hypot(...delta);
  const incoming=delta.map(v=>v/length),outgoing=[-incoming[0],incoming[1],incoming[2]];
  const end=hit.map((v,i)=>v+outgoing[i]*exitLength);
  return {source:[...source],hit:[...hit],end,incoming,outgoing,image:mirrorPoint(source),length:length+exitLength};
}

// Slow illustrative dot follows only source -> mirror -> reflected endpoint.
export function pointOnReflectedRay(ray,progress){
  const t=Math.max(0,Math.min(1,progress));
  const first=Math.hypot(...ray.hit.map((v,i)=>v-ray.source[i]));
  const second=Math.hypot(...ray.end.map((v,i)=>v-ray.hit[i]));
  const travelled=t*(first+second),before=travelled<=first;
  const start=before?ray.source:ray.hit,end=before?ray.hit:ray.end;
  const fraction=before?travelled/first:(travelled-first)/second;
  return start.map((v,i)=>v+(end[i]-v)*fraction);
}
