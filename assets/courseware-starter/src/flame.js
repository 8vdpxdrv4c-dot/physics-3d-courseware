import * as THREE from 'three';

// Normalized candle geometry: the optical reference point remains at y=.95.
// The visual flame is a luminous, noisy volume, not a combustion simulation.
export const CANDLE={radius:.12,waxHeight:.59,flameCenter:.95,flameWidth:.56,flameHeight:.76,flameDepth:.44};

const densityGLSL=/* glsl */`
uniform float uTime;
float hash31(vec3 p){
  p=fract(p*.1031);p+=dot(p,p.yzx+33.33);
  return fract((p.x+p.y)*p.z);
}
float noise3(vec3 p){
  vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),
    mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),
    mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){
  float a=.57,v=0.0;
  for(int i=0;i<3;i++){v+=a*noise3(p);p=p*2.03+vec3(4.1,7.3,1.8);a*=.5;}
  return v;
}
vec2 flameDensity(vec3 p){
  float y=(p.y+.5)/(.965+.025*sin(uTime*2.2)+.01*sin(uTime*5.7));
  if(y<=0.0||y>=1.0)return vec2(0.0);
  float t=uTime;
  vec2 bend=vec2(sin(t*2.5+y*5.0),cos(t*1.8-y*4.0))*.085*y*y;
  bend.x+=(noise3(vec3(0.3,t*.7,y*2.0))-.5)*.2*y*y;
  float turbulence=fbm(vec3(p.x*5.0,y*5.5-t*1.9,p.z*5.0));
  float radius=.39*pow(max(sin(3.14159265*pow(y,.72)),0.0),.8)*(1.0-.35*y);
  radius*=.94+.12*turbulence;
  float r=length((p.xz-bend)*vec2(1.0,1.15));
  float normalized=r/max(radius,.002);
  float edge=1.0-smoothstep(.68,1.12,normalized+(turbulence-.5)*.18);
  float vertical=smoothstep(.0,.07,y)*(1.0-smoothstep(.89,1.0,y));
  float density=edge*vertical*(.78+.22*turbulence);
  float core=(1.0-smoothstep(.0,.48,normalized))*smoothstep(.03,.15,y)*(1.0-smoothstep(.42,.7,y));
  return vec2(density,core);
}
vec3 flameRadiance(vec3 p,float core){
  float y=p.y+.5;
  vec3 orange=vec3(3.8,.72,.045),gold=vec3(5.5,2.3,.23),hot=vec3(7.0,5.2,2.8);
  vec3 c=mix(orange,gold,smoothstep(.0,.65,core));
  c=mix(c,hot,core*.87);
  float blue=(1.0-smoothstep(.04,.16,y))*.45;
  return mix(c,vec3(.25,.4,2.8),blue);
}
`;

const volumeVertex=/* glsl */`
varying vec3 vLocal;
void main(){vLocal=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
`;
const volumeFragment=/* glsl */`
varying vec3 vLocal;
uniform vec3 uCameraLocal;
${densityGLSL}
void main(){
  vec3 ro=uCameraLocal,rd=normalize(vLocal-ro);
  vec3 inv=1.0/(rd+vec3(.000001));
  vec3 t0=(-vec3(.5)-ro)*inv,t1=(vec3(.5)-ro)*inv;
  vec3 nearT=min(t0,t1),farT=max(t0,t1);
  float begin=max(max(nearT.x,nearT.y),nearT.z);
  float end=min(min(farT.x,farT.y),farT.z);
  begin=max(begin,0.0);if(end<=begin)discard;
  float stepSize=(end-begin)/48.0,transmittance=1.0;
  vec3 total=vec3(0.0);
  for(int i=0;i<48;i++){
    vec3 p=ro+rd*(begin+(float(i)+.5)*stepSize);
    vec2 field=flameDensity(p);
    float alpha=1.0-exp(-field.x*stepSize*7.0);
    total+=transmittance*alpha*flameRadiance(p,field.y);
    transmittance*=1.0-alpha;
    if(transmittance<.015)break;
  }
  float opacity=1.0-transmittance;
  if(opacity<.008)discard;
  gl_FragColor=vec4(total/max(opacity,.001),opacity);
}
`;

const flatVertex=/* glsl */`
varying vec2 vUV;
varying float vWorldY;
varying float vWorldZ;
void main(){vUV=uv;vec4 world=modelMatrix*vec4(position,1.0);vWorldY=world.y;vWorldZ=world.z;gl_Position=projectionMatrix*viewMatrix*world;}
`;
const projectionFragment=/* glsl */`
varying vec2 vUV;
varying float vWorldY;
varying float vWorldZ;
uniform vec2 uClipY;
uniform vec2 uClipZ;
uniform vec3 uTint;
uniform float uOpacity;
${densityGLSL}
void main(){
  if(vWorldY<uClipY.x||vWorldY>uClipY.y||vWorldZ<uClipZ.x||vWorldZ>uClipZ.y)discard;
  vec3 total=vec3(0.0);float transmittance=1.0;
  for(int i=0;i<24;i++){
    vec3 p=vec3(vUV.x-.5,vUV.y-.5,-.5+(float(i)+.5)/24.0);
    vec2 field=flameDensity(p);
    float alpha=1.0-exp(-field.x/24.0*7.0);
    total+=transmittance*alpha*flameRadiance(p,field.y);
    transmittance*=1.0-alpha;
  }
  float opacity=(1.0-transmittance)*uOpacity;if(opacity<.008)discard;
  gl_FragColor=vec4(total/max(1.0-transmittance,.001)*uTint,opacity);
}
`;
const bodyFragment=/* glsl */`
varying vec2 vUV;
varying float vWorldY;
varying float vWorldZ;
uniform vec2 uClipY;
uniform vec2 uClipZ;
uniform vec3 uTint;
uniform float uOpacity;
void main(){
  if(vWorldY<uClipY.x||vWorldY>uClipY.y||vWorldZ<uClipZ.x||vWorldZ>uClipZ.y)discard;
  float rounded=smoothstep(.0,.065,vUV.x)*(1.0-smoothstep(.935,1.0,vUV.x));
  float shading=.64+.36*sin(vUV.x*3.14159);
  gl_FragColor=vec4(vec3(.95,.85,.66)*shading*uTint,rounded*uOpacity);
}
`;

export function createFlameVolume(){
  const time={value:0};
  const material=new THREE.ShaderMaterial({
    vertexShader:volumeVertex,fragmentShader:volumeFragment,
    uniforms:{uTime:time,uCameraLocal:{value:new THREE.Vector3()}},
    side:THREE.BackSide,transparent:true,depthWrite:false,toneMapped:false
  });material.userData.owned=true;
  const flame=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material);
  flame.position.y=CANDLE.flameCenter;
  flame.scale.set(CANDLE.flameWidth,CANDLE.flameHeight,CANDLE.flameDepth);
  flame.renderOrder=2;
  return {mesh:flame,time,
    update(seconds,camera){time.value=seconds;flame.updateWorldMatrix(true,false);material.uniforms.uCameraLocal.value.copy(camera.position);flame.worldToLocal(material.uniforms.uCameraLocal.value);}}
}

export function createCandleProjection(parent,{x,axis,m,time,virtual=false,clip=true,clipCenter=axis}){
  const group=new THREE.Group();parent.add(group);group.position.set(x,axis,0);
  group.scale.set(1,m,Math.abs(m));
  const common={uTime:time,uClipY:{value:new THREE.Vector2(clip?clipCenter-1.15:-100,clip?clipCenter+1.15:100)},uClipZ:{value:new THREE.Vector2(clip?-.8:-100,clip?.8:100)},
    uTint:{value:new THREE.Vector3(...(virtual?[.65,.45,1]:[1,1,1]))},uOpacity:{value:virtual?.45:1}};
  const bodyMat=new THREE.ShaderMaterial({vertexShader:flatVertex,fragmentShader:bodyFragment,uniforms:common,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});bodyMat.userData.owned=true;
  const body=new THREE.Mesh(new THREE.PlaneGeometry(CANDLE.radius*2,CANDLE.waxHeight),bodyMat);
  body.position.y=CANDLE.waxHeight/2;body.rotation.y=-Math.PI/2;group.add(body);
  const flameMat=new THREE.ShaderMaterial({vertexShader:flatVertex,fragmentShader:projectionFragment,uniforms:common,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});flameMat.userData.owned=true;
  const flame=new THREE.Mesh(new THREE.PlaneGeometry(CANDLE.flameWidth,CANDLE.flameHeight),flameMat);
  flame.position.y=CANDLE.flameCenter;flame.rotation.y=-Math.PI/2;flame.renderOrder=3;group.add(flame);
  return group;
}
