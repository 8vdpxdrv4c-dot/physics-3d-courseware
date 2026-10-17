import * as THREE from 'three';

const vertexShader=/* glsl */`
attribute float flowDistance;
varying float vFlowDistance;
void main(){
  vFlowDistance=flowDistance;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}
`;
const fragmentShader=/* glsl */`
uniform vec3 uColor;
uniform float uTime,uMotion,uSpeed,uSpacing,uPhase,uOpacity;
varying float vFlowDistance;
void main(){
  // Increasing arc distance follows the authored start -> end direction.
  float phase=fract((vFlowDistance-uTime*uSpeed)/uSpacing+uPhase);
  float tail=smoothstep(.48,.86,phase);
  float head=1.0-smoothstep(.86,.96,phase);
  float pulse=tail*head*uMotion;
  gl_FragColor=vec4(uColor*(.72+1.0*pulse),uOpacity*(.8+.2*pulse));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function flowFor(object){
  for(let current=object;current;current=current.parent)if(current.userData.directionFlow)return current.userData.directionFlow;
  return null;
}

export function setFlowDistances(geometry,values){
  geometry.setAttribute('flowDistance',new THREE.Float32BufferAttribute(values,1));
  return geometry;
}

// A stage owns one clock and one ticker, regardless of how many arrows exist.
export function createDirectionFlow({addTicker,motionPreference}){
  const time={value:0},motion={value:motionPreference.matches?0:1},materials=new Map();
  let release=null,enabled=true;
  function stop(){release?.();release=null;}
  function start(){if(enabled&&materials.size&&!release)release=addTicker(dt=>{motion.value=motionPreference.matches?0:1;if(motion.value)time.value+=dt;});}
  function clear(){
    stop();for(const [material,listener] of materials)material.removeEventListener('dispose',listener);
    materials.clear();time.value=0;enabled=true;
  }
  return {
    material(color,{speed=.5,spacing=.55,phase=0,opacity=1}={}){
      const material=new THREE.ShaderMaterial({vertexShader,fragmentShader,
        uniforms:{uColor:{value:new THREE.Color(color)},uTime:time,uMotion:motion,
          uSpeed:{value:speed},uSpacing:{value:Math.max(.02,spacing)},uPhase:{value:phase},uOpacity:{value:opacity}},
        transparent:true,depthWrite:false,toneMapped:true});
      material.userData.owned=true;
      const onDispose=()=>{
        material.removeEventListener('dispose',onDispose);materials.delete(material);
        if(!materials.size)stop();
      };
      materials.set(material,onDispose);material.addEventListener('dispose',onDispose);
      start();
      return material;
    },setEnabled(value){enabled=!!value;if(enabled)start();else stop();},clear,dispose:clear
  };
}
