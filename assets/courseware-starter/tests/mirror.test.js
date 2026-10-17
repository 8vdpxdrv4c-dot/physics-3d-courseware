import test from 'node:test';
import assert from 'node:assert/strict';
import {planeMirror,mirrorPoint,reflectRay,pointOnReflectedRay} from '../src/mirror-physics.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);

test('plane reflection preserves height, lateral location and equal perpendicular distance',()=>{
  for(const distance of [10,30,45,50])for(const height of [10,20,28])for(const lateral of [-12,0,12]){
    const m=planeMirror({distance,height,lateral});
    assert.deepEqual(m.imageTip,[distance,height,lateral]);
    assert.deepEqual(mirrorPoint(m.imageTip),m.objectTip);
    near(m.separation,2*distance);near(m.imageHeight,m.objectHeight);near(m.signedImageDistance,-distance);
  }
});
test('reflected rays obey reflection law and their backward extensions meet the same image point',()=>{
  for(const source of [[-10,10,-12],[-30,20,0],[-50,28,12]])for(const hit of [[0,6,-15],[0,18,0],[0,25,15]]){
    const ray=reflectRay(source,hit),back=ray.image.map((v,i)=>v-hit[i]),length=Math.hypot(...back);
    near(Math.hypot(...ray.incoming),1);near(Math.hypot(...ray.outgoing),1);
    near(ray.outgoing[0],-ray.incoming[0]);near(ray.outgoing[1],ray.incoming[1]);near(ray.outgoing[2],ray.incoming[2]);
    near(dot(back.map(v=>v/length),ray.outgoing),-1);
  }
});
test('animated points stay on actual ray segments and never enter the mirror back half-space',()=>{
  const ray=reflectRay([-30,20,10],[0,12,-5]);
  assert.deepEqual(pointOnReflectedRay(ray,0),ray.source);
  pointOnReflectedRay(ray,1).forEach((v,i)=>near(v,ray.end[i]));
  for(let i=0;i<=1000;i++)assert.ok(pointOnReflectedRay(ray,i/1000)[0]<=1e-10);
  const first=Math.hypot(...ray.hit.map((v,i)=>v-ray.source[i]));
  pointOnReflectedRay(ray,first/ray.length).forEach((v,i)=>near(v,ray.hit[i]));
});
test('screen before, at and beyond the virtual image cannot receive an image or move it',()=>{
  for(const screenDistance of [10,30,50]){
    const m=planeMirror({distance:30,height:20,lateral:4,screenDistance});
    assert.equal(m.screenImage,false);assert.deepEqual(m.imageTip,[30,20,4]);near(m.screenOffset,screenDistance-30);
  }
});
test('invalid physical parameters are rejected before geometry is built',()=>{
  for(const distance of [0,-1,NaN,Infinity])assert.throws(()=>planeMirror({distance,height:20}),RangeError);
});
