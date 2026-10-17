import test from 'node:test';
import assert from 'node:assert/strict';
import {thinLens, leverBalance, dipoleField, dipoleLine} from '../src/physics.js';
const near = (a,b,tol=1e-9) => assert.ok(Math.abs(a-b)<tol, `${a} != ${b}`);

test('thin-lens canonical positions and signed magnification', () => {
  for (const [u,f,v,m] of [[30,10,15,-.5],[20,10,20,-1],[15,10,30,-2],[5,10,-10,2]]) {
    const result = thinLens(u,f,Math.abs(v));
    near(result.v,v); near(result.m,m); near(1/u+1/result.v,1/f);
    assert.equal(result.focused,v>0);
  }
  assert.equal(thinLens(10,10,20).v,null);
  assert.equal(thinLens(5,10,20).focused,false);
});
test('screen movement changes focus, not the image position', () => {
  near(thinLens(30,10,15).v, thinLens(30,10,40).v);
  assert.equal(thinLens(30,10,40).focused,false);
});
test('lens remains numerically consistent near focus', () => {
  for (const u of [9.999,10.001,12,49.9]) {
    const s=thinLens(u,10,20); near(1/u+1/s.v,.1,1e-8);
  }
});
test('lever torque uses perpendicular distance and balances an unequal-force pair', () => {
  assert.equal(leverBalance(2,.4,4,.2).balanced,true);
  assert.ok(leverBalance(3,.4,2,.2).net>0);
  near(leverBalance(2,.3,2,.3).net,0);
});
test('dipole field polarity reversal, reflection symmetry and axis orientation', () => {
  const a=dipoleField(2,1,.7), b=dipoleField(2,1,.7,-1);
  a.forEach((v,i)=>near(v,-b[i]));
  const mirror=dipoleField(-2,1,.7);
  near(a[0],mirror[0]); near(a[1],-mirror[1]);
  assert.ok(dipoleField(2,0,0)[0]>0);
  assert.ok(dipoleField(0,2,0)[0]<0);
  assert.equal(dipoleField(0,0,0),null);
});
test('rendered dipole-line tangents agree with the same field used by the probe', () => {
  for(const polarity of [1,-1]) {
    const pts=dipoleLine(0,.7,3,polarity,400);
    for(let i=20;i<pts.length-20;i+=30) {
      const p=pts[i], next=pts[i+1], prev=pts[i-1], b=dipoleField(...p,polarity);
      const d=next.map((v,j)=>v-prev[j]);
      const cos=d.reduce((s,v,j)=>s+v*b[j],0)/Math.hypot(...d)/Math.hypot(...b);
      assert.ok(cos>.999);
    }
  }
});
