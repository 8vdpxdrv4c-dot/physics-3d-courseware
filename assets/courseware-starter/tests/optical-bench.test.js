import test from 'node:test';
import assert from 'node:assert/strict';
import {opticalBench,benchRay} from '../src/optics-bench.js';
const base={objectX:-30,lensX:0,screenX:15,objectY:0,screenY:0,f:10,showScreen:true};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('independent lens motion changes both object and screen distances',()=>{
  const m=opticalBench({...base,lensX:5});near(m.u,35);near(m.s,10);near(m.v,14);near(m.imageX,19);assert.equal(m.focused,false);
  const translated=opticalBench({...base,objectX:-23,lensX:7,screenX:22});near(translated.v,15);near(translated.imageX,22);
});
test('screen focus and full image coverage are independent',()=>{
  const m=opticalBench({...base,objectX:-20,screenX:20,objectY:6});assert.ok(m.focused);assert.equal(m.covered,false);
  const aligned=opticalBench({...base,objectX:-20,screenX:20,objectY:6,screenY:-8});assert.ok(aligned.focused&&aligned.covered);
  const tooLarge=opticalBench({...base,objectX:-15,screenX:30,screenY:-10});assert.equal(tooLarge.covered,false);
});
test('aperture rays meet the same displaced image point',()=>{
  for(const objectX of [-30,-20,-15,-5])for(const objectY of [-4,0,6]){
    const state={...base,objectX,objectY},m=opticalBench(state);
    for(const y of [-1.2,0,1.2]){const ray=benchRay(state,y);near(y+ray.slope*m.v,m.imageTip);}
  }
});
test('finite screen intercepts rays only within its physical height',()=>{
  assert.equal(benchRay(base,0).intercepted,true);
  assert.equal(benchRay({...base,screenY:12},0).intercepted,false);
  assert.equal(benchRay({...base,showScreen:false},0).intercepted,false);
  assert.equal(benchRay(base,1.4),null);
});
test('focal and virtual cases do not create a focused image on a screen',()=>{
  for(const objectX of [-10,-5]){const m=opticalBench({...base,objectX});assert.equal(m.focused,false);assert.ok(m.blurRadius>0);}
  const m=opticalBench({...base,objectX:-5});near(m.v,-10);near(m.m,2);
});
