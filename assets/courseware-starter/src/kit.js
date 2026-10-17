import * as THREE from 'three';
import {flowFor,setFlowDistances} from './direction-flow.js';

export const colors = { gold:0xfac16b, blue:0x61b8ff, ink:0x0b1421, white:0xdce8fa, violet:0xbc99f7 };
export const materials = {
  metal: new THREE.MeshStandardMaterial({color:0x778494,metalness:.9,roughness:.38,envMapIntensity:1.25}),
  // A dark coated support needs diffuse response as well as metallic reflections.
  black: new THREE.MeshStandardMaterial({color:0x303d4e,metalness:.28,roughness:.64}),
  chrome: new THREE.MeshStandardMaterial({color:0xc0cbd4,metalness:1,roughness:.32,envMapIntensity:1.3}),
  brass: new THREE.MeshStandardMaterial({color:0xd0aa68,metalness:.98,roughness:.4,envMapIntensity:1.5}),
  copper: new THREE.MeshStandardMaterial({color:0xd5a070,metalness:.98,roughness:.26,envMapIntensity:1.9}),
  gold: new THREE.MeshStandardMaterial({color:0xffc56d,emissive:0xd77821,emissiveIntensity:1.3,metalness:.3,roughness:.4}),
  blue: new THREE.MeshStandardMaterial({color:0x62baff,emissive:0x144467,emissiveIntensity:.25,metalness:.3,roughness:.4}),
  white: new THREE.MeshStandardMaterial({color:0xe6edf4,roughness:.61,metalness:.1}),
  red: new THREE.MeshStandardMaterial({color:0xae3442,metalness:.25,roughness:.5}),
  cyan: new THREE.MeshStandardMaterial({color:0x338ac2,metalness:.25,roughness:.5})
};

export function mesh(geometry, material, parent, x=0,y=0,z=0) {
  const obj=new THREE.Mesh(geometry,material);obj.position.set(x,y,z);
  obj.castShadow=true;obj.receiveShadow=true;parent?.add(obj);return obj;
}
export function box(parent,w,h,d,material,x=0,y=0,z=0,bevel=.025) {
  const shape=new THREE.Shape(), a=w/2,b=h/2,r=Math.min(bevel,a*.4,b*.4);
  shape.moveTo(-a+r,-b);shape.lineTo(a-r,-b);shape.quadraticCurveTo(a,-b,a,-b+r);
  shape.lineTo(a,b-r);shape.quadraticCurveTo(a,b,a-r,b);shape.lineTo(-a+r,b);
  shape.quadraticCurveTo(-a,b,-a,b-r);shape.lineTo(-a,-b+r);shape.quadraticCurveTo(-a,-b,-a+r,-b);
  const geo=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:bevel>0,bevelThickness:r*.3,bevelSize:r*.3,bevelSegments:2,steps:1});
  geo.translate(0,0,-d/2);return mesh(geo,material,parent,x,y,z);
}
export function cylinder(parent,radius,height,mat,x=0,y=0,z=0,segments=40) {
  return mesh(new THREE.CylinderGeometry(radius,radius,height,segments),mat,parent,x,y,z);
}
export function rod(parent,a,b,radius=.025,mat=materials.chrome) {
  a=new THREE.Vector3(...a);b=new THREE.Vector3(...b);const d=b.clone().sub(a);
  const obj=cylinder(parent,radius,d.length(),mat);obj.position.copy(a).add(b).multiplyScalar(.5);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return obj;
}
function labelTexture(text,{color='#bacde4',weight=400,outline=false}={}) {
  const canvas=document.createElement('canvas'),font=`${weight} 76px Georgia, "Microsoft YaHei", serif`;
  let ctx=canvas.getContext('2d');ctx.font=font;
  canvas.width=Math.ceil(ctx.measureText(text).width)+40;canvas.height=128;ctx=canvas.getContext('2d');ctx.font=font;
  ctx.textAlign='center';ctx.textBaseline='middle';
  if(outline){ctx.strokeStyle='#07121f';ctx.lineWidth=9;ctx.lineJoin='round';ctx.strokeText(text,canvas.width/2,64);}
  ctx.fillStyle=color;ctx.fillText(text,canvas.width/2,64);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}
export function label(parent,text,position,{size=.23,width=1.3,...style}={}) {
  const texture=labelTexture(text,style),canvas=texture.image;
  const mat=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false});mat.userData.owned=true;
  const sprite=new THREE.Sprite(mat);sprite.position.set(...position);const w=Math.min(width,size*canvas.width/76);sprite.scale.set(w,w*128/canvas.width,1);parent.add(sprite);return sprite;
}
// Instrument markings are local-space meshes: perspective and occlusion follow
// their parent ruler, with no camera-facing update or mirrored back-face text.
export function tag3D(parent,text,position,{size=.23,width=1.3,rotation=[0,0,0],...style}={}) {
  const texture=labelTexture(text,style),canvas=texture.image;
  texture.anisotropy=8;
  const w=Math.min(width,size*canvas.width/76);
  const mat=new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.02,depthTest:true,depthWrite:false,toneMapped:false});
  mat.userData.owned=true;
  const tag=new THREE.Mesh(new THREE.PlaneGeometry(w,w*128/canvas.width),mat);
  tag.name=`3d-tag:${text}`;tag.position.set(...position);tag.rotation.set(...rotation);
  tag.raycast=()=>{};parent.add(tag);return tag;
}
export function line(parent,points,color=colors.gold,{dashed=false,opacity=1,flow=false}={}) {
  const geo=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));
  const manager=flow&&!dashed?flowFor(parent):null;
  let mat;
  if(manager){
    let length=typeof flow==='object'?(flow.offset??0):0;const distances=points.map((point,index)=>{if(index)length+=new THREE.Vector3(...point).distanceTo(new THREE.Vector3(...points[index-1]));return length;});
    setFlowDistances(geo,distances);mat=manager.material(color,{opacity,...(typeof flow==='object'?flow:{})});
  }else mat=dashed?new THREE.LineDashedMaterial({color,dashSize:.12,gapSize:.08,transparent:true,opacity}):new THREE.LineBasicMaterial({color,transparent:true,opacity});
  mat.userData.owned=true;const obj=new THREE.Line(geo,mat);if(dashed)obj.computeLineDistances();parent.add(obj);return obj;
}
export function arrow(parent,start,end,{color=colors.gold,radius=.018,head=.17,unlit=false,flow=true}={}) {
  const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),d=b.clone().sub(a),len=d.length();
  if(len<.001)return new THREE.Group();
  head=Math.min(head,len*.55);
  const manager=flow?flowFor(parent):null,options=typeof flow==='object'?flow:{};
  const mat=manager?manager.material(color,{spacing:Math.max(.2,Math.min(.65,len*.7)),...options}):unlit?new THREE.MeshBasicMaterial({color,toneMapped:false}):new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.55,roughness:.35});mat.userData.owned=true;
  const group=new THREE.Group();parent.add(group);
  const shaftLength=len-head*.6,shaftEnd=a.clone().addScaledVector(d,shaftLength/len);
  const shaft=rod(group,start,shaftEnd.toArray(),radius,mat);
  const cone=mesh(new THREE.ConeGeometry(head*.38,head,20),mat,group);
  cone.position.copy(b).addScaledVector(d.clone().normalize(),-head/2);
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
  if(manager){
    for(const [object,offset] of [[shaft,shaftLength/2],[cone,len-head/2]]){
      const position=object.geometry.getAttribute('position'),distances=[];
      for(let i=0;i<position.count;i++)distances.push(position.getY(i)+offset+(options.offset??0));
      setFlowDistances(object.geometry,distances);object.castShadow=false;object.receiveShadow=false;
    }
  }
  return group;
}
export function stand(parent,x,{height=1.7,z=0}={}) {
  const g=new THREE.Group();parent.add(g);g.position.set(x,0,z);
  box(g,.65,.12,.65,materials.black,0,.54,0);
  box(g,.51,.12,.48,materials.metal,0,.65,0);
  cylinder(g,.115,height-.6,materials.chrome,0,(height+.6)/2,0);
  cylinder(g,.19,.18,materials.black,0,.82,0);
  cylinder(g,.135,.065,materials.brass,0,height,0);
  const knob=cylinder(g,.1,.21,materials.black,.21,.83,0);knob.rotation.z=Math.PI/2;
  for(let i=0;i<12;i++){const angle=i*Math.PI/6;rod(g,[.15,.83+.1*Math.cos(angle),.1*Math.sin(angle)],[.29,.83+.1*Math.cos(angle),.1*Math.sin(angle)],.008,materials.chrome);}
  return g;
}
export function clearGroup(group) {
  const geometries=new Set(),mats=new Set(),textures=new Set();
  group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);const arr=Array.isArray(o.material)?o.material:[o.material];
    arr.forEach(m=>{if(m?.userData.owned){mats.add(m);if(m.map)textures.add(m.map);}});});
  group.clear();geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());mats.forEach(m=>m.dispose());
}
