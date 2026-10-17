import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {createDampedZoom} from '../src/damped-zoom.js';

function setup(){
  const camera=new PerspectiveCamera();camera.position.set(0,0,10);
  const orbit={enabled:true,target:new Vector3(),minDistance:5,maxDistance:26};
  const element=new EventTarget();element.clientHeight=720;
  let time=0,pinches=0;
  const zoom=createDampedZoom({camera,orbit,element,requestRender(){},cancelView(){},reducedMotion:{matches:false},now:()=>time,onPinchStart:()=>pinches++});
  return {zoom,camera,orbit,element,get radius(){return camera.position.length();},get pinches(){return pinches;},
    step(ms){time+=ms;zoom.update(time);},
    event(type,properties){const event=new Event(type,{cancelable:true});Object.assign(event,properties);element.dispatchEvent(event);return event;}};
}

test('zoom input does not jump; repeated input stays bounded and settles without overshoot',()=>{
  const s=setup();s.zoom.scaleBy(.5);assert.equal(s.radius,10);
  let previous=s.radius;
  for(let i=0;i<100;i++){s.step(16);assert.ok(s.radius>=5&&s.radius<=previous);previous=s.radius;}
  assert.equal(s.radius,5);assert.equal(s.zoom.active,false);
  for(let i=0;i<100;i++)s.event('wheel',{deltaY:200,deltaMode:1});
  assert.equal(s.radius,5);
  for(let i=0;i<100;i++)s.step(16);
  assert.equal(s.radius,26);
});

test('zoom convergence follows elapsed time across different render frame rates',()=>{
  const a=setup(),b=setup();a.zoom.scaleBy(.6);b.zoom.scaleBy(.6);
  for(let i=0;i<15;i++)a.step(1000/30);
  for(let i=0;i<60;i++)b.step(1000/120);
  assert.ok(Math.abs(a.radius-b.radius)<1e-8);
  assert.ok(a.radius>6&&a.radius<6.02);
});

test('reverse zoom, cancellation and disposal do not retain stale movement',()=>{
  const s=setup();s.zoom.scaleBy(2);s.step(32);const before=s.radius;
  s.zoom.scaleBy(.25);assert.equal(s.radius,before);s.step(32);assert.ok(s.radius<before);
  s.zoom.cancel();const stopped=s.radius;s.step(32);assert.equal(s.radius,stopped);
  const wheel=s.event('wheel',{deltaY:-100,deltaMode:0});assert.equal(wheel.defaultPrevented,true);
  s.zoom.dispose();s.event('wheel',{deltaY:100,deltaMode:0});s.step(32);assert.equal(s.radius,stopped);
});

test('two-finger pinch uses the same damped radius while preserving the orbit target',()=>{
  const s=setup(),target=s.orbit.target.clone();
  s.event('pointerdown',{pointerType:'touch',pointerId:1,clientX:0,clientY:0});
  s.event('pointerdown',{pointerType:'touch',pointerId:2,clientX:100,clientY:0});
  s.event('pointermove',{pointerType:'touch',pointerId:2,clientX:150,clientY:0});
  assert.equal(s.radius,10);assert.equal(s.pinches,1);assert.equal(s.zoom.pinching,true);
  for(let i=0;i<100;i++)s.step(16);
  assert.ok(Math.abs(s.radius-10*100/150)<1e-8);assert.deepEqual(s.orbit.target,target);
  s.event('pointerup',{pointerId:2});assert.equal(s.zoom.pinching,false);
});
