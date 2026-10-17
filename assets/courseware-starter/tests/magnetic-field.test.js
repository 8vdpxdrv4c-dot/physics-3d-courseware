import test from 'node:test';
import assert from 'node:assert/strict';
import {circleLoop,segmentField,createMagneticModel,magnitude,traceField} from '../src/magnetic-field.js';
const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('finite current polygon converges to circular-loop axis formula',()=>{
  for(const x of [0,.5,2,5]){const b=segmentField(circleLoop(0,1,256),[x,0,0]);near(b[0],2*Math.PI/(1+x*x)**1.5,.0004);near(b[1],0);near(b[2],0);}
});
test('all six models reverse and scale the same vector field',()=>{
  for(const mode of ['bar','horseshoe','like','unlike','ring','solenoid']){
    const p=[2.6,1.3,.7],a=createMagneticModel({mode}).field(p),b=createMagneticModel({mode,polarity:-1,strength:2}).field(p);
    a.forEach((v,i)=>near(b[i],-2*v));assert.ok(magnitude(a)>0);
  }
});
test('like-facing center is a null; unlike-facing center reinforces',()=>{
  assert.ok(magnitude(createMagneticModel({mode:'like'}).field([0,0,0]))<1e-9);
  const b=createMagneticModel({mode:'unlike'}).field([0,0,0]);assert.ok(b[0]>0);near(b[1],0);near(b[2],0);
  assert.ok(magnitude(createMagneticModel({mode:'like'}).field([0,.2,0]))>1e-4);
});
test('bar internal direction is S to N and solenoid follows right hand rule',()=>{
  for(const mode of ['bar','solenoid'])assert.ok(createMagneticModel({mode}).field([0,0,0])[0]>0);
});
test('ring has opposite outer and inner bound currents, with an open bore',()=>{
  const model=createMagneticModel({mode:'ring'});assert.equal(model.inside([0,0,0]),false);assert.equal(model.inside([0,1,0]),true);assert.ok(model.field([0,0,0])[0]<0);assert.ok(model.field([0,1,0])[0]>0);
});
test('traced line tangent follows the field; display density cannot change it',()=>{
  const m=createMagneticModel(),p=[2,1,.4],b=m.field(p),points=traceField(m,[1.25,.52,0]);m.seeds(12);assert.deepEqual(m.field(p),b);
  for(let i=1;i<points.length-1;i+=17){const tangent=points[i+1].map((v,k)=>v-points[i-1][k]),f=m.field(points[i]);assert.ok(tangent.reduce((s,v,k)=>s+v*f[k],0)>0);}
});
