import * as THREE from 'three';

// Tileable brushed metal: colour, micro-height and roughness use the same grain.
// Small optical-table mounting holes are a surface detail, not physics geometry.
export function createMetalSurface(renderer,{width=19,depth=10,perforated=true}={}){
  const size=512,canvases=Array.from({length:3},()=>{const c=document.createElement('canvas');c.width=c.height=size;return c;});
  const contexts=canvases.map(c=>c.getContext('2d'));
  const data=contexts.map(ctx=>ctx.createImageData(size,size));
  let seed=4817;const baseColor=[92,105,120];
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let y=0;y<size;y++){
    const strand=(random()-.5)*8,scratch=random()<.07?5:0;
    for(let x=0;x<size;x++){
      const wave=Math.sin(x/size*Math.PI*2+y*.07)*1.8;
      const grain=strand+wave+(random()-.5)*2+scratch,index=(y*size+x)*4;
      for(let channel=0;channel<3;channel++){
        data[0].data[index+channel]=baseColor[channel]+grain;
        data[1].data[index+channel]=128+grain*1.7;
        data[2].data[index+channel]=185+grain*2;
      }
      for(const layer of data)layer.data[index+3]=255;
    }
  }
  contexts.forEach((ctx,i)=>ctx.putImageData(data[i],0,0));
  if(perforated)for(let y=64;y<size;y+=128)for(let x=64;x<size;x+=128){
    contexts.forEach((ctx,index)=>{
      ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);
      ctx.fillStyle=['#18212c','#282828','#ededed'][index];ctx.fill();
      if(index===0){ctx.strokeStyle='#667584';ctx.lineWidth=1;ctx.stroke();}
    });
  }
  const textures=canvases.map((canvas,index)=>{
    const map=new THREE.CanvasTexture(canvas);
    map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(width/2,depth/2);
    map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    if(index===0)map.colorSpace=THREE.SRGBColorSpace;
    return map;
  });
  const material=new THREE.MeshStandardMaterial({color:0x8798ac,metalness:.55,roughness:.8,
    map:textures[0],bumpMap:textures[1],bumpScale:.018,roughnessMap:textures[2]});
  return {material,dispose(){textures.forEach(map=>map.dispose());material.dispose();}};
}
