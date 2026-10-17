const STORAGE_KEY='physics-courseware-render-quality';

export function getSavedQuality(){
  try{return localStorage.getItem(STORAGE_KEY)==='low'?'low':'high';}
  catch{return 'high';}
}

export function createQualityToggle(container,stage){
  const button=document.createElement('button');
  button.type='button';button.className='quality-toggle';
  button.innerHTML='<span class="quality-caption">画质：</span><span class="quality-value"></span>';
  const value=button.querySelector('.quality-value');
  function sync(){
    container.dataset.quality=stage.quality;
    const low=stage.quality==='low',current=low?'低画质':'高画质',next=low?'高画质':'低画质';
    value.textContent=current;
    button.setAttribute('aria-label',`当前${current}，切换为${next}`);
    button.title=`点击切换为${next}`;
  }
  button.addEventListener('click',()=>{
    stage.setQuality(stage.quality==='high'?'low':'high');sync();
    try{localStorage.setItem(STORAGE_KEY,stage.quality);}catch{/* Session choice still applies. */}
  });
  // Space activates this button without also starting or pausing the experiment.
  button.addEventListener('keydown',event=>event.stopPropagation());
  container.append(button);sync();
  return {destroy(){button.remove();}};
}
