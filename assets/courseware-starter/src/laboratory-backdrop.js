import * as THREE from 'three';

// Grade only the visible panorama once at load time. The original image still
// feeds PMREM lighting, so a quieter backdrop does not dull the apparatus.
export function createLaboratoryBackdrop(renderer,source){
  const target=new THREE.WebGLRenderTarget(source.image.width,source.image.height,{
    type:THREE.HalfFloatType,depthBuffer:false,stencilBuffer:false,samples:0
  });
  target.texture.name='laboratory-muted-backdrop';
  target.texture.colorSpace=THREE.LinearSRGBColorSpace;
  target.texture.mapping=THREE.EquirectangularReflectionMapping;
  const material=new THREE.ShaderMaterial({
    uniforms:{panorama:{value:source}},depthTest:false,depthWrite:false,toneMapped:false,
    vertexShader:`varying vec2 vUv;
      void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
    fragmentShader:`uniform sampler2D panorama;varying vec2 vUv;
      void main(){
        vec3 color=texture2D(panorama,vUv).rgb;
        float luminance=dot(color,vec3(0.2126,0.7152,0.0722));
        color=mix(vec3(luminance),color,0.62);
        // A soft shoulder subdues lamp bokeh without clipping it flat.
        color/=1.0+0.65*luminance;
        gl_FragColor=vec4(color,1.0);
      }`
  });
  const geometry=new THREE.PlaneGeometry(2,2),quad=new THREE.Mesh(geometry,material);
  const scene=new THREE.Scene();scene.add(quad);
  const previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),level=renderer.getActiveMipmapLevel();
  try{
    renderer.setRenderTarget(target);renderer.render(scene,new THREE.Camera());
  }catch(error){target.dispose();throw error;}
  finally{
    renderer.setRenderTarget(previous,face,level);geometry.dispose();material.dispose();
  }
  return target;
}
