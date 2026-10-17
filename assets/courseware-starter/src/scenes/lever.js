import * as THREE from 'three';
import {box,cylinder,rod,label,tag3D,line,arrow,materials,colors,mesh,clearGroup} from '../kit.js';
import {leverBalance} from '../physics.js';

export function createLesson(stage,changed){
  const state={leftForce:2,leftArm:40,rightForce:4,rightArm:20,labels:true,forces:true};
  const defaults={...state},root=stage.root,dynamic=new THREE.Group(),scale=.085,beamY=3.1;
  box(root,1.75,.15,1.3,materials.black,0,.5,0);
  cylinder(root,.25,1.9,materials.black,0,1.5,0);
  cylinder(root,.15,2.2,materials.chrome,0,1.7,0);
  const bracket=mesh(new THREE.ConeGeometry(.55,.75,3),materials.brass,root,0,2.7,0);bracket.rotation.y=Math.PI/2;
  const axle=cylinder(root,.17,.65,materials.chrome,0,beamY,0);axle.rotation.x=Math.PI/2;
  box(root,9.4,.16,.26,materials.metal,0,beamY,0);
  box(root,9.4,.035,.03,materials.brass,0,beamY+.1,.15);
  for(let cm=-50;cm<=50;cm+=2){
    const x=cm*scale;line(root,[[x,beamY+.03,.15],[x,beamY+(cm%10===0?-.07:-.01),.15]],0xc1cad5);
    if(cm%10===0&&cm!==0)tag3D(root,Math.abs(cm).toString(),[x,beamY-.25,.18],{size:.16,width:.48});
  }
  tag3D(root,'cm',[4.7,beamY-.25,.18],{size:.16,width:.5});root.add(dynamic);
  function update(){
    clearGroup(dynamic);
    const picks=[];
    for(const [side,force,arm,sign,color] of [['left',state.leftForce,state.leftArm,-1,colors.blue],['right',state.rightForce,state.rightArm,1,colors.gold]]){
      const x=sign*arm*scale,g=new THREE.Group();root.add(g);dynamic.add(g);g.userData.dragKey=side+'Arm';picks.push(g);
      const hook=mesh(new THREE.TorusGeometry(.12,.025,12,32),materials.brass,g,x,beamY,0);hook.rotation.y=Math.PI/2;
      rod(g,[x,beamY-.12,0],[x,1.65,0],.014,materials.chrome);
      for(let i=0;i<force;i++){
        // Turned copper discs: small rounded shoulders catch the room's
        // reflections while the broad side retains a readable metal gradient.
        const profile=[[0,-.065],[.205,-.065],[.216,-.059],[.22,-.05],
          [.22,.05],[.216,.059],[.205,.065],[0,.065]].map(([r,y])=>new THREE.Vector2(r,y));
        mesh(new THREE.LatheGeometry(profile,64),materials.copper,g,x,1.6-i*.15,0);
        cylinder(g,.045,.012,materials.chrome,x,1.669-i*.15,0);
      }
      if(state.forces)arrow(g,[x,beamY-.15,.32],[x,beamY-.55-force*.1,.32],{color,head:.17,radius:.018});
      if(state.labels){
        label(g,`${force.toFixed(0)} N`,[x,1.4-force*.15,.35],{size:.23,width:1,color:sign<0?'#8fceff':'#fbd08c'});
        const y=beamY+.6;
        line(g,[[0,y,.1],[x,y,.1]],color);
        for(const px of [0,x])line(g,[[px,y-.08,.1],[px,y+.08,.1]],color);
        label(g,`${arm.toFixed(0)} cm`,[x/2,y+.22,.1],{size:.2,width:1.4});
      }
    }
    if(state.labels)label(dynamic,'支点 O',[0,beamY+.1,.72],{size:.22,width:1.2});
    stage.setDragging(picks,(key,p)=>set(key,Math.max(10,Math.min(50,Math.round(Math.abs(p.x)/scale)))));
    stage.requestRender();changed?.();
  }
  function set(key,value){state[key]=value;update();}
  function preset(name){
    const p={equal:[3,30,3,30],unequal:[2,40,4,20],left:[4,40,2,20],right:[2,20,4,40]}[name];
    [state.leftForce,state.leftArm,state.rightForce,state.rightArm]=p;update();
  }
  update();
  return {state,set,preset,reset(){Object.assign(state,defaults);update();},
    metrics(){const r=leverBalance(state.leftForce,state.leftArm/100,state.rightForce,state.rightArm/100);return {
      result:r.kind,detail:r.balanced?'左右力矩大小相等，方向相反':'保持水平比较受力；解除约束后，将向力矩较大的一侧转动',
      values:[['左侧力矩',r.leftTorque.toFixed(2),'N·m'],['右侧力矩',r.rightTorque.toFixed(2),'N·m'],['合力矩',Math.abs(r.net).toFixed(2),'N·m']],
      status:r.balanced?'平衡条件成立':'存在合力矩',formula:'F₁ × l₁ = F₂ × l₂',
      note:'静力学示意：杠杆质量忽略，外力竖直；保持杆水平，不模拟解除约束后的转动。',
      hint:'拖动挂钩改变力臂；力臂是支点到力的作用线的垂直距离。'};},dispose(){}}
}
