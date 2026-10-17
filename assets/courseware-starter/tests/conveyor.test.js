import {test} from 'node:test';
import assert from 'node:assert/strict';
import {conveyorForces,createConveyorRun,advanceConveyor} from '../src/conveyor-physics.js';
const base={beltSpeed:1.5,initialSpeed:0,mu:.3,angle:0,mass:2};
const near=(actual,expected,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);

test('resting block: friction accelerates it forward then vanishes at synchrony',()=>{
  const r=createConveyorRun(base),f=conveyorForces(base,0);near(f.friction,5.88);near(f.acceleration,2.94);
  const time=1.5/2.94,next=advanceConveyor(base,r,1);
  near(next.v,1.5);near(next.s,1+.5*2.94*time*time+1.5*(1-time));
  near(conveyorForces(base,next.v).friction,0);
});
test('faster and opposite-running cases use relative velocity, not ground velocity',()=>{
  const f=conveyorForces(base,3);near(f.friction,-5.88);
  const config={...base,beltSpeed:-1.5,initialSpeed:1.5};
  const r=advanceConveyor(config,createConveyorRun(config),1.2);near(r.v,-1.5);
  assert.ok(r.s<1);assert.equal(conveyorForces(config,r.v).kind,'zero');
  assert.ok(conveyorForces({...base,beltSpeed:3},1).friction>0);
});
test('inclined synchrony requires sufficient static friction; downhill belt also has uphill friction',()=>{
  const config={...base,angle:20,mu:.5,beltSpeed:1,initialSpeed:1},f=conveyorForces(config,1);
  near(f.normal,19.6*Math.cos(Math.PI/9));near(f.friction,19.6*Math.sin(Math.PI/9));near(f.acceleration,0);assert.equal(f.kind,'static');
  const down={...config,beltSpeed:-1};near(conveyorForces(down,-1).friction,f.friction);
  const r=advanceConveyor(config,createConveyorRun(config),2);near(r.v,1);near(r.s,3);
});
test('instant equality above the static limit slips downhill, without false locking or chatter',()=>{
  const config={...base,mu:.2,angle:30,beltSpeed:1,initialSpeed:1},f=conveyorForces(config,1);
  assert.equal(f.synchronous,false);assert.equal(f.kind,'kinetic');
  const a=9.8*(.2*Math.cos(Math.PI/6)-.5);near(f.acceleration,a);
  const r=advanceConveyor(config,createConveyorRun(config),.2);near(r.v,1+a*.2);
  // First faster than belt: cross equality, then keep slipping in the other direction.
  const fast={...config,initialSpeed:2};const cross=1/(9.8*(.2*Math.cos(Math.PI/6)+.5));
  near(advanceConveyor(fast,createConveyorRun(fast),cross+.1).v,1+a*.1);
});
test('static threshold and frictionless limits',()=>{
  const config={...base,angle:30,mu:Math.tan(Math.PI/6)};assert.equal(conveyorForces(config,1.5).synchronous,true);
  const free={...base,mu:0,initialSpeed:2};const r=advanceConveyor(free,createConveyorRun(free),.5);near(r.s,2);near(r.v,2);
  const incline={...free,angle:30};near(conveyorForces(incline,2).acceleration,-4.9);
  const still={...free,initialSpeed:0,beltSpeed:0};near(advanceConveyor(still,createConveyorRun(still),100).s,1);
});
test('mass changes force but not the trajectory; arbitrary frame partitions agree',()=>{
  for(const config of [base,{...base,angle:30,mu:.2,initialSpeed:2,beltSpeed:1},{...base,beltSpeed:-1.5,initialSpeed:1.5}]){
    const start=createConveyorRun(config),once=advanceConveyor(config,start,1.3);let many=start;
    for(const dt of [.017,.283,.4,.1,.5])many=advanceConveyor(config,many,dt);
    near(many.s,once.s);near(many.v,once.v);near(many.time,once.time);
    const heavy={...config,mass:5},other=advanceConveyor(heavy,start,1.3);near(other.s,once.s);near(other.v,once.v);
    near(conveyorForces(heavy,start.v).friction,conveyorForces(config,start.v).friction*2.5);
  }
});
test('end events freeze at the first boundary and preserve pre-exit velocity and elapsed time',()=>{
  const config={...base,mu:0,initialSpeed:2};const r=advanceConveyor(config,createConveyorRun(config),20);
  near(r.time,3.5);near(r.s,8);near(r.v,2);near(r.beltTravel,5.25);assert.equal(r.ended,true);
  assert.deepEqual(advanceConveyor(config,r,100),r);
  const left={...config,initialSpeed:-2};const l=advanceConveyor(left,createConveyorRun(left),20);near(l.s,0);near(l.time,3.5);near(l.v,-2);
  const accelerating={...base,angle:30,mu:0,beltSpeed:0,initialSpeed:0};
  const a=advanceConveyor(accelerating,createConveyorRun(accelerating),20);near(a.s,0);near(a.time,Math.sqrt(2/4.9));
});
