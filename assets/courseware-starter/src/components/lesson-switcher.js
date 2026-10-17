import './lesson-switcher.css';

let nextId=0;

/** A route-independent course picker. The host owns navigation and calls setValue. */
export function createLessonSwitcher(container,{lessons,value,onChange}={}){
  if(!container||!lessons?.length)throw new Error('课程切换器需要挂载容器和课程清单');
  const entries=lessons.map(({id,title})=>({id,title}));
  if(entries.some(item=>!item.id||!item.title)||new Set(entries.map(item=>item.id)).size!==entries.length){
    throw new Error('课程切换器的课程ID必须唯一，且需提供标题');
  }
  const document=container.ownerDocument,events=new AbortController(),signal=events.signal;
  const root=document.createElement('div');root.className='lesson-switcher';
  const uid=`lesson-switcher-${++nextId}`;
  root.innerHTML=`
    <button type="button" class="lesson-switcher__trigger" id="${uid}-trigger" aria-haspopup="menu" aria-expanded="false" aria-controls="${uid}-menu">
      <span class="lesson-switcher__current"></span>
      <svg class="lesson-switcher__chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5"/></svg>
    </button>
    <div class="lesson-switcher__panel" hidden>
      <p class="lesson-switcher__heading">切换课程</p>
      <div class="lesson-switcher__menu" id="${uid}-menu" role="menu" aria-label="课程列表"></div>
    </div>`;
  const trigger=root.querySelector('button'),current=root.querySelector('.lesson-switcher__current');
  const panel=root.querySelector('.lesson-switcher__panel'),menu=root.querySelector('[role=menu]');
  let selected='',opened=false;
  const buttons=entries.map((entry,index)=>{
    const button=document.createElement('button');button.type='button';button.className='lesson-switcher__option';
    button.setAttribute('role','menuitemradio');button.setAttribute('aria-label',entry.title);button.tabIndex=-1;
    const number=document.createElement('span');number.className='lesson-switcher__number';number.textContent=String(index+1).padStart(2,'0');number.setAttribute('aria-hidden','true');
    const title=document.createElement('span');title.className='lesson-switcher__title';title.textContent=entry.title;
    const check=document.createElement('span');check.className='lesson-switcher__check';check.textContent='✓';check.setAttribute('aria-hidden','true');
    button.append(number,title,check);menu.append(button);
    button.addEventListener('click',()=>{
      close(true);
      if(entry.id!==selected)onChange?.(entry.id);
    },{signal});
    return button;
  });
  function setValue(id){
    const index=entries.findIndex(entry=>entry.id===id);
    if(index<0)throw new Error(`未知课程：${id}`);
    selected=id;current.textContent=entries[index].title;
    trigger.setAttribute('aria-label',`当前课程：${entries[index].title}，切换课程`);
    buttons.forEach((button,i)=>button.setAttribute('aria-checked',String(i===index)));
    close(menu.contains(document.activeElement));
  }
  function close(restoreFocus=false){
    opened=false;panel.hidden=true;trigger.setAttribute('aria-expanded','false');
    if(restoreFocus)trigger.focus({preventScroll:true});
  }
  function open(index=entries.findIndex(entry=>entry.id===selected)){
    opened=true;panel.hidden=false;trigger.setAttribute('aria-expanded','true');
    buttons[index].focus({preventScroll:true});buttons[index].scrollIntoView({block:'nearest'});
  }
  trigger.addEventListener('click',()=>opened?close():open(),{signal});
  trigger.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();open(event.key==='ArrowUp'?buttons.length-1:undefined);
    }
  },{signal});
  menu.addEventListener('keydown',event=>{
    const index=buttons.indexOf(document.activeElement);let next;
    if(event.key==='ArrowDown')next=(index+1)%buttons.length;
    else if(event.key==='ArrowUp')next=(index-1+buttons.length)%buttons.length;
    else if(event.key==='Home')next=0;
    else if(event.key==='End')next=buttons.length-1;
    if(next!==undefined){event.preventDefault();buttons[next].focus({preventScroll:true});buttons[next].scrollIntoView({block:'nearest'});}
    // Tab follows the page's natural order; focusout then closes the popup.
  },{signal});
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&opened){event.preventDefault();close(true);}
    // Keep scene shortcuts (Space/R) out of this component.
    event.stopPropagation();
  },{signal});
  root.addEventListener('focusout',event=>{if(!root.contains(event.relatedTarget))close();},{signal});
  document.addEventListener('pointerdown',event=>{if(opened&&!root.contains(event.target))close();},{signal});
  container.append(root);setValue(value??entries[0].id);
  return {setValue,destroy(){events.abort();root.remove();}};
}
