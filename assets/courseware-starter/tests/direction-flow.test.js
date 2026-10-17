import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Vector3} from 'three';
import {createDirectionFlow} from '../src/direction-flow.js';
import {arrow,line,clearGroup} from '../src/kit.js';
import {dipoleLine,dipoleField} from '../src/physics.js';

function setup(){
  const root=new Group(),tickers=new Set(),preference={matches:false};
  const flow=createDirectionFlow({motionPreference:preference,addTicker(fn){tickers.add(fn);return()=>tickers.delete(fn);}});
  root.userData.directionFlow=flow;return {root,flow,tickers,preference};
}

test('path flow measures arc distance and reverses with the authoritative magnetic path',()=>{
  const s=setup();
  const path=line(s.root,[[0,0,0],[3,0,0],[3,4,0]],0xffffff,{flow:true});
  assert.deepEqual([...path.geometry.getAttribute('flowDistance').array],[0,3,7]);
  for(const polarity of [1,-1]){
    const points=dipoleLine(0,.7,3.05,polarity,100),curve=line(s.root,points,0xffffff,{flow:true});
    const positions=curve.geometry.getAttribute('position'),distances=curve.geometry.getAttribute('flowDistance');
    const index=40,point=new Vector3().fromBufferAttribute(positions,index);
    const tangent=new Vector3().fromBufferAttribute(positions,index+1).sub(new Vector3().fromBufferAttribute(positions,index-1));
    const field=new Vector3(...dipoleField(point.x,point.y,point.z,polarity));
    assert.ok(tangent.dot(field)>0);assert.equal(distances.getX(0),0);
    for(let i=1;i<distances.count;i++)assert.ok(distances.getX(i)>distances.getX(i-1));
  }
  clearGroup(s.root);assert.equal(s.tickers.size,0);
});

test('arrows follow start-to-tip distance; short heads stay within their directed span',()=>{
  const s=setup(),start=[1,2,3],end=[1,1.9,3],offset=2;
  const group=arrow(s.root,start,end,{head:.17,flow:{offset}});group.updateWorldMatrix(true,true);
  for(const object of group.children){
    const positions=object.geometry.getAttribute('position'),distances=object.geometry.getAttribute('flowDistance');
    for(let i=0;i<positions.count;i++){
      const p=new Vector3().fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld);
      const along=2-p.y;
      assert.ok(along>=-1e-7&&along<=.1000001);
      assert.ok(Math.abs(distances.getX(i)-(offset+along))<1e-6);
    }
  }
  clearGroup(s.root);assert.equal(s.tickers.size,0);
});

test('one visual clock serves all cues, respects reduced motion, and releases on cleanup',()=>{
  const s=setup();
  const path=line(s.root,[[0,0,0],[2,0,0]],0xffffff,{flow:true});
  const directed=arrow(s.root,[0,1,0],[0,0,0]);
  const dimension=line(s.root,[[0,0,0],[0,2,0]]);
  const virtual=line(s.root,[[0,0,0],[-2,0,0]],0xffffff,{dashed:true,flow:true});
  assert.equal(dimension.material.isShaderMaterial,undefined);assert.equal(virtual.material.isShaderMaterial,undefined);
  assert.equal(s.tickers.size,1);
  const uniforms=path.material.uniforms,arrowUniforms=directed.children[0].material.uniforms;
  assert.equal(uniforms.uTime,arrowUniforms.uTime);
  for(const tick of s.tickers)tick(.1);assert.equal(uniforms.uTime.value,.1);
  s.flow.setEnabled(false);assert.equal(s.tickers.size,0);
  s.flow.setEnabled(true);assert.equal(s.tickers.size,1);
  s.preference.matches=true;for(const tick of s.tickers)tick(.1);
  assert.equal(uniforms.uTime.value,.1);assert.equal(uniforms.uMotion.value,0);
  clearGroup(s.root);assert.equal(s.tickers.size,0);s.flow.clear();
  line(s.root,[[0,0,0],[1,0,0]],0xffffff,{flow:true});assert.equal(s.tickers.size,1);
  s.flow.dispose();assert.equal(s.tickers.size,0);clearGroup(s.root);
});
