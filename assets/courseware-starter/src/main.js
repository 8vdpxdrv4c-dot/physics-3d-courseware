import './style.css';
import {createStage} from './stage.js';
import {createLessonSwitcher} from './components/lesson-switcher.js';
import {createQualityToggle,getSavedQuality} from './components/quality-toggle.js';
import * as lens from './scenes/lens.js';
import * as lever from './scenes/lever.js';
import * as magnet from './scenes/magnet.js';
import * as conveyor from './scenes/conveyor.js';
import * as mirror from './scenes/mirror.js';
import * as lensExam from './scenes/lens-exam.js';

const registry={lens,lever,magnet,conveyor,mirror,'lens-exam':lensExam};
const icons={
  play:'<path d="m8 5 11 7-11 7z"/>',
  conveyor:'<rect x="2" y="9" width="20" height="8" rx="4"/><path d="M7 9V4h7v5M5 17v4m14-4v4M6 13h12"/>',
  move:'<path d="M12 3v18M3 12h18m-12-6 3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/>',
  reset:'<path d="M4 10a8 8 0 1 1 1 9M4 4v6h6"/>',
  lens:'<ellipse cx="12" cy="12" rx="4" ry="10"/><path d="M2 12h20"/>',
  mirror:'<rect x="5" y="2" width="14" height="17" rx="2"/><path d="m9 7 6-2m-6 6 6-2M8 22h8m-4-3v3"/>',
  measure:'<path d="M3 6h18v12H3zM7 6v4m5-4v7m5-7v4"/>',
  rays:'<path d="M17 2v20M3 4l14 8L3 20m8-12 6 4-6 4"/>',
  light:'<path d="M12 20V5m-4 4 4-6 4 6M6 21h12"/>',
  screen:'<path d="M5 4h14v13H5zM12 17v4m-4 0h8"/>',
  lever:'<path d="M2 8h20M12 8 8 20h8zM4 8v7m16-7v7M2 15h4m12 0h4"/>',
  field:'<path d="M5 14V7a3 3 0 0 1 6 0v7m2 0V7a3 3 0 0 1 6 0v7M3 14h6v6H3zm12 0h6v6h-6z"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
};
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.info}</svg>`;
const app=document.querySelector('#app');
app.innerHTML=`
  <main class="laboratory">
    <header class="masthead">
      <div class="series"><span class="series-mark">◈</span> PHYSICS ATELIER <span class="series-line"></span> 三维交互课件 · 第一组</div>
      <div class="title-row"><h1 id="discipline">光学实验室</h1><span class="title-divider"></span><h2 id="lesson-title">凸透镜成像</h2></div>
      <p id="subtitle"></p>
    </header>
    <nav class="lesson-nav" aria-label="课件组切换"></nav>
    <div id="stage" class="stage"><div class="loading">正在准备实验仪器…</div></div>
    <div class="scene-topline"><span class="live-dot"></span><span id="model-badge"></span><span class="flow-key">流光仅示方向</span><button id="help" aria-label="查看模型说明与来源">${icon('info')}</button></div>
    <div class="left-controls">
      <aside class="object-rail" aria-label="实验视图"></aside>
      <section class="preset-bar" aria-label="典型状态"><span class="overline">典型状态</span><div id="presets"></div></section>
    </div>
    <button id="toggle-parameters" class="parameter-toggle" aria-controls="control-panel" aria-expanded="false">实验参数</button>
    <button id="mobile-playback" class="mobile-playback" aria-label="播放或暂停实验" hidden></button>
    <aside id="control-panel" class="control-panel" aria-label="实验参数">
      <div class="panel-heading"><div><span class="overline">EXPERIMENT CONTROLS</span><h3>实验参数</h3></div><span id="status" class="status-chip"></span></div>
      <div id="playback-controls" class="playback-controls" hidden><div class="playback-readout"><span id="elapsed"></span><span id="travel"></span></div><div class="playback-buttons"><button id="playback" class="primary"></button><button id="slow" class="secondary" aria-pressed="false">慢放 ×0.5</button><button id="step" class="secondary">前进 0.1 s</button><button id="restart" class="secondary">重新放置</button></div><p>调参回到初态并暂停 · +s 沿带向右</p></div>
      <div id="parameters"></div>
      <div id="metrics" class="metrics" aria-label="计算结果"></div>
      <div id="toggles" class="toggles"></div>
      <div id="lesson-tools" class="lesson-tools" hidden><button id="section-view" class="secondary"></button><button id="tap-filings" class="secondary">轻敲铁屑板</button></div>
      <div class="panel-actions"><button id="primary" class="primary"></button><button id="secondary" class="secondary"></button></div>
      <p id="model-note" class="model-note"></p>
    </aside>
    <section class="observation" aria-label="观察结果" aria-live="polite"><span class="observation-tab">观察结果</span><h3 id="result"></h3><p id="result-detail"></p></section>
    <footer class="scene-footer"><span id="hint"></span><span>拖动空白处旋转 · 右键平移 · 滚轮缩放</span></footer>
  </main>
  <dialog id="guide"><button class="close-guide" aria-label="关闭说明">×</button><span class="overline">ABOUT THIS EXPERIMENT</span><h2>模型与教学说明</h2><div id="guide-content"></div></dialog>`;

const fields={
  'lens-exam':[['objectX','蜡烛坐标','x物',-50,10,.1,'cm'],['lensX','透镜坐标','x镜',-15,15,.1,'cm'],['screenX','光屏坐标','x屏',-10,50,.1,'cm'],['objectY','烛台升降','Δy物',-8,10,.1,'cm'],['screenY','光屏升降','Δy屏',-12,12,.1,'cm']],
  lens:[['u','物距','u',5,50,.1,'cm'],['f','焦距','f',5,15,.1,'cm'],['screen','光屏距离','s',5,50,.1,'cm'],['lensX','透镜坐标','x镜',-15,15,.1,'cm']],
  lever:[['leftForce','左侧拉力','F₁',1,6,1,'N'],['leftArm','左侧力臂','l₁',10,50,1,'cm'],['rightForce','右侧拉力','F₂',1,6,1,'N'],['rightArm','右侧力臂','l₂',10,50,1,'cm']],
  magnet:[['probeX','探针位置','x',-5,5,.1,''],['probeY','探针位置','y',-2.4,3,.1,''],['probeZ','探针位置','z',-4,4,.1,''],['density','显示线数','',4,10,1,'组'],['strength','场强倍率','',.5,2,.1,'×'],['gap','磁极间距','',.8,3,.1,''],['sectionHeight','铁屑截面','z',-2,2,.1,'']],
  conveyor:[['beltSpeed','带速','v带',-3,3,.1,'m/s'],['initialSpeed','物块初速度','v₀',-3,3,.1,'m/s'],['mu','摩擦系数','μ',0,.8,.01,''],['angle','倾角','θ',0,35,1,'°'],['mass','质量','m',.5,5,.1,'kg']],
  mirror:[['distance','物到镜面','d',10,50,1,'cm'],['height','物体高度','h',10,28,1,'cm'],['lateral','沿镜面移动','z',-12,12,1,'cm'],['screenDistance','光屏到镜面','s',10,50,1,'cm']]
};
const presetOptions={lens:[['camera','u > 2f'],['equal','u = 2f'],['projector','f < u < 2f'],['focus','u = f'],['magnifier','u < f']],lever:[['unequal','省力平衡'],['equal','等臂平衡'],['left','左矩较大'],['right','右矩较大']],magnet:[['axial','磁轴延长线'],['equator','赤道平面'],['spatial','空间位置']],conveyor:[['rest','静止放上'],['faster','物块更快'],['reverse','反向运行'],['sync','水平同速'],['incline','倾斜同速'],['slip','静摩擦不足']]};
presetOptions.mirror=[['near','靠近镜面'],['far','远离镜面'],['tall','增加物高'],['offset','横向移动']];
presetOptions.magnet=[['north','靠近 N 极'],['south','靠近 S 极'],['side','正侧方'],['center','对称中心']];
presetOptions['lens-exam']=[['focus','① 调整焦面'],['height','② 调整屏高'],['lensmove','③ 移动透镜'],['virtual','④ 虚像判别']];
let stage,lesson=null,activeId='',manifest=null,lessonSwitcher=null;
const $=s=>document.querySelector(s);
const lessonActions={
  'lens-exam':{label:lesson=>lesson.state.solution?'隐藏解析':'显示解析',icon:'info',run:lesson=>lesson.set('solution',!lesson.state.solution),title:'对照理论像距与光屏覆盖，检查自己的判断'},
  lens:{label:'光屏自动对焦',icon:'screen',run:lesson=>lesson.focusScreen(),enabled:lesson=>lesson.canFocus(),title:'将光屏移动到理论实像位置'},
  lever:null,
  conveyor:null,
  mirror:{label:lesson=>lesson.state.mode==='rays'?(lesson.isPlaying?'暂停光点':'播放光点'):'光屏移到像的位置',icon:'light',
    visible:lesson=>['rays','screen'].includes(lesson.state.mode),
    run:lesson=>lesson.state.mode==='rays'?lesson.togglePoints():lesson.preset('at'),
    title:'光点只沿实际反射路径运动；光屏不能承接虚像'},
  magnet:{label:lesson=>lesson.state.mode==='solenoid'?'反转电流':'反转磁极',icon:'field',run:lesson=>lesson.set('polarity',-lesson.state.polarity),title:'同时反转磁极、场线箭头和探针方向'}
};
const interactionHelp={
  'lens-exam':'四道自编情境依次探究对焦、屏高、透镜位置和虚像。焦距固定为10 cm；坐标原点在轨道中央。物距等于透镜坐标减蜡烛坐标，屏距等于光屏坐标减透镜坐标。可拖动三仪器；白色小球调节烛台高度，拖动屏面同时改变屏的位置和高度。先操作再显示解析。对焦与完整承接是两个独立条件。',
  mirror:'左侧依次为镜面观察、对称测量、光路追踪和光屏检验，切换时相机平滑过渡。拖动金色物体改变物距及沿镜面的横向位置，物高由滑块调节。观察模式用真实平面反射渲染；其余模式淡化镜面用于看清几何关系，这不代表镜子透光。紫色箭头仅定位虚像，静态紫色虚线是反射光线的反向延长；光点与金色流光都只在镜前。光屏检验时隐藏虚像箭头，屏上不绘制图像。教学光点采用慢速，不编码实际光速；改变参数或模式会停止光点并回到路径起点。重置实验保留当前模式和视角。',
  lens:'直接调节物距、焦距和光屏位置，或选择典型状态观察成像；实像可使用“光屏自动对焦”检验。烛焰闪动为视觉效果；流光仅指传播方向，不模拟光速。',
  lever:'直接调节拉力与力臂，或选择典型状态比较力矩；当前模型为保持水平的静态受力示意。箭头流光只指示受力方向，不表示重物运动或力的大小。',
  magnet:'左侧选择六种磁体。探针红色 N 端沿计算得到的磁场方向；对称零场点隐藏方向箭头。磁感线、探针和铁屑来自同一个场函数。2D 模式选中央 z=0 对称平面；铁屑板可沿 z 轴平移，轻敲后原地转向平面内磁场分量。绿色线表示内部透视；蓝色线表示外部场。显示线数不改变场强，强度倍率会改变读数但不改变线的方向形状。流光仅示方向。',
  conveyor:'先预测摩擦力方向，再开始实验；可暂停、继续、慢放或前进0.1秒。空格切换播放（输入框内无效），R复位视角。重新放置保留参数，重置实验恢复默认参数。带速和物块速度相对于地面，均按沿带方向计正负；相对速度等于两者之差。力箭头按本次重力统一缩放，速度箭头仅示方向、大小以读数为准。箭头流光不表示实际速度；带面纹理、滚筒与物块运动则跟随同一个物理时钟。'
};

function renderFields(){
  $('#parameters').innerHTML=fields[activeId].map(([key,title,symbol,min,max,step,unit])=>`
    <div class="parameter" data-parameter="${key}">
      <div class="parameter-title"><label for="range-${key}">${title} <i>${symbol}</i></label><div class="number-group"><input id="number-${key}" type="number" min="${min}" max="${max}" step="${step}" aria-label="${title}${symbol}数值"><span>${unit}</span></div></div>
      <input id="range-${key}" type="range" min="${min}" max="${max}" step="${step}" aria-label="${title}${symbol}">
      <div class="range-ticks"><span>${min}</span><span>${(min+max)/2}</span><span>${max}</span></div>
    </div>`).join('');
  for(const [key,title,symbol,min,max,step] of fields[activeId]){
    for(const prefix of ['range','number']){
      const input=$(`#${prefix}-${key}`);
      const commit=()=>{
        const n=input.valueAsNumber;if(!Number.isFinite(n)){input.value=lesson.state[key];sync();return;}
        const bounded=Math.max(min,Math.min(max,n));
        const v=Number((min+Math.round((bounded-min)/step)*step).toFixed(8));if(prefix==='number')input.value=v;lesson.set(key,v);if(prefix==='number')input.value=Number(lesson.state[key].toFixed(2));
        $('#presets').querySelectorAll('button').forEach(b=>b.classList.remove('selected'));
      };
      input.addEventListener(prefix==='range'?'input':'change',commit);
      if(prefix==='number'){
        input.addEventListener('input',()=>{
          const n=input.valueAsNumber;
          // Leave incomplete edits alone, e.g. the first digit of a two-digit value.
          if(!Number.isFinite(n)||n<min||n>max)return;
          if(Math.abs((n-min)/step-Math.round((n-min)/step))>1e-6)return;
          commit();
        });
        input.addEventListener('blur',commit);
      }
    }
  }
  const options=['lens','lens-exam'].includes(activeId)?[['rays','显示光路'],['labels','对象与焦点标注'],['showScreen','显示光屏']]:activeId==='lever'?[['forces','显示力与方向'],['labels','显示力臂标注']]:activeId==='conveyor'?[['forces','显示受力箭头'],['velocities','显示速度方向']]:activeId==='mirror'?[['extensions','显示反向延长线'],['labels','显示测量与标注']]:[['lines','显示空间磁感线'],['internal','内部磁场透视'],['filings','铁屑截面实验'],['labels','显示磁极与探针标注']];
  $('#toggles').innerHTML=options.map(([key,title])=>`<label class="switch-row"><span>${title}</span><input type="checkbox" data-toggle="${key}"><span class="switch" aria-hidden="true"></span></label>`).join('');
  document.querySelectorAll('[data-toggle]').forEach(input=>input.addEventListener('change',()=>lesson.set(input.dataset.toggle,input.checked)));
  $('#lesson-tools').hidden=activeId!=='magnet';
  $('#section-view').onclick=()=>lesson.set('section',!lesson.state.section);
  $('#tap-filings').onclick=()=>lesson.tap();
  renderPresets();
  $('#primary').onclick=()=>lessonActions[activeId]?.run(lesson);
  $('#secondary').textContent='重置实验';
  $('#secondary').onclick=()=>{lesson.reset();$('#presets').querySelectorAll('button').forEach(b=>b.classList.remove('selected'));};
  $('#playback-controls').hidden=activeId!=='conveyor';
  $('#mobile-playback').hidden=activeId!=='conveyor';
  $('#mobile-playback').onclick=()=>lesson.togglePlayback?.();
  $('#playback').onclick=()=>lesson.togglePlayback?.();
  $('#slow').onclick=()=>lesson.set('slow',!lesson.state.slow);
  $('#step').onclick=()=>lesson.step?.();
  $('#restart').onclick=()=>lesson.restart?.();
}

function renderPresets(){
  const options=activeId==='mirror'&&lesson?.state.mode==='screen'?[['before','像前'],['at','像的位置'],['after','像后']]:presetOptions[activeId];
  $('#presets').innerHTML=options.map(([id,title])=>`<button data-preset="${id}">${title}</button>`).join('');
  $('#presets').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>applyPreset(b.dataset.preset)));
}

function sync(){
  if(!lesson)return;
  for(const [key,,,min,max] of fields[activeId]){
    const n=lesson.state[key];if(document.activeElement!==$(`#number-${key}`))$(`#number-${key}`).value=Number(n.toFixed(2));$(`#range-${key}`).value=n;
    $(`#range-${key}`).style.setProperty('--fill',`${(n-min)/(max-min)*100}%`);
  }
  document.querySelectorAll('[data-toggle]').forEach(el=>el.checked=!!lesson.state[el.dataset.toggle]);
  const m=lesson.metrics();$('#result').textContent=m.result;$('#result-detail').textContent=m.detail;
  $('#model-badge').textContent=m.badge||manifest.lessons.find(item=>item.id===activeId).model;
  $('#status').textContent=m.status;$('#model-note').textContent=m.note;$('#hint').textContent=m.hint;
  $('#metrics').innerHTML=`<div class="formula">${m.formula}</div>`+m.values.map(([name,value,unit])=>`<div class="metric"><span>${name}</span><strong>${value}<small>${unit}</small></strong></div>`).join('');
  const action=lessonActions[activeId];$('#primary').hidden=!action||!(action.visible?.(lesson)??true);
  if(action){$('#primary').innerHTML=icon(action.icon)+`<span>${typeof action.label==='function'?action.label(lesson):action.label}</span>`;$('#primary').title=action.title;$('#primary').disabled=!(action.enabled?.(lesson)??true);}
  if(activeId==='mirror'){
    $('.parameter[data-parameter=screenDistance]').hidden=lesson.state.mode!=='screen';
    $('[data-toggle=extensions]').closest('label').hidden=!['rays','screen'].includes(lesson.state.mode);
    document.querySelectorAll('[data-mode]').forEach(button=>{const selected=button.dataset.mode===lesson.state.mode;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});
    if(lesson.state.mode==='screen'){
      const before=$('[data-preset=before]'),after=$('[data-preset=after]');
      if(before)before.disabled=lesson.state.distance<=10;
      if(after)after.disabled=lesson.state.distance>=50;
    }
  }
  if(activeId==='magnet'){
    $('.parameter[data-parameter=density]').hidden=lesson.state.section;
    $('.parameter[data-parameter=gap]').hidden=!['like','unlike'].includes(lesson.state.mode);
    $('.parameter[data-parameter=sectionHeight]').hidden=!lesson.state.filings;
    $('#tap-filings').hidden=!lesson.state.filings;
    $('#section-view').textContent=lesson.state.section?'返回 3D 空间':'查看 2D 中央截面';
    document.querySelectorAll('[data-magnet-mode]').forEach(b=>{const selected=b.dataset.magnetMode===lesson.state.mode;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
  }
  $('#secondary').disabled=false;
  if(lesson.playback){const p=lesson.playback();
    $('#playback').textContent=p.ended?'重新开始':p.running?'暂停实验':p.time?'继续实验':'开始实验';
    $('#mobile-playback').textContent=$('#playback').textContent;
    $('#elapsed').textContent=`t = ${p.time.toFixed(2)} s`;$('#travel').textContent=`s = ${p.position.toFixed(2)} m`;
    $('#slow').setAttribute('aria-pressed',p.slow);$('#slow').textContent=p.slow?'慢放中 ×0.5':'慢放 ×0.5';
    $('#step').disabled=p.running||p.ended;
  }
}

function applyPreset(id){lesson.preset(id);$('#presets').querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b.dataset.preset===id));}

function renderRail(){
  if(activeId==='magnet'){
    $('.object-rail').innerHTML=magnet.modes.map(([mode,title],i)=>`<button data-magnet-mode="${mode}" aria-pressed="${i===0}"><span class="mode-number">0${i+1}</span><span>${title}</span></button>`).join('');
    document.querySelectorAll('[data-magnet-mode]').forEach(b=>b.addEventListener('click',()=>{lesson.setMode(b.dataset.magnetMode);sync();}));return;
  }
  if(activeId==='mirror'){
    const symbols=['mirror','measure','rays','screen'];
    $('.object-rail').innerHTML=mirror.modes.map(([mode,title],i)=>`<button data-mode="${mode}" aria-pressed="${i===0}">${icon(symbols[i])}<span>${title}</span></button>`).join('');
    document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{lesson.setMode(button.dataset.mode);renderPresets();sync();}));
    return;
  }
  const items=['lens','lens-exam'].includes(activeId)?[['light','观察光源','source'],['lens','光路正视','front'],['screen','观察光屏','screen']]:activeId==='lever'?[['lever','杠杆','perspective'],['screen','力臂正视','front'],['reset','重置实验','reset']]:activeId==='conveyor'?[['conveyor','立体','perspective'],['screen','侧视','front'],['move','俯视','top']]:[['field','磁场','perspective'],['screen','正视','front'],['move','俯视','top']];
  $('.object-rail').innerHTML=items.map(([symbol,title,action],i)=>`<button data-rail="${action}" class="${i===0?'selected':''}">${icon(symbol)}<span>${title}</span></button>`).join('');
  document.querySelectorAll('[data-rail]').forEach(b=>b.addEventListener('click',()=>{
    const action=b.dataset.rail;if(action==='reset'){lesson.reset();}
    else if(action==='source')lesson.focusPosition('source');
    else if(action==='screen')lesson.focusPosition('screen');
    else stage.view(action);
    $('.object-rail').querySelectorAll('button').forEach(btn=>btn.classList.toggle('selected',btn===b));
  }));
}

function selectLesson(id){
  const config=manifest.lessons.find(l=>l.id===id)||manifest.lessons[0];id=config.id;
  if(activeId===id)return;
  lesson?.dispose();lesson=null;stage.clear();activeId=id;
  $('#discipline').textContent=config.discipline;$('#lesson-title').textContent=config.title;$('#subtitle').textContent=config.subtitle;
  $('#model-badge').textContent=config.model;document.title=`${config.title} · 物理实验室`;
  lessonSwitcher.setValue(id);
  $('.laboratory').dataset.lesson=id;
  renderFields();renderRail();lesson=registry[id].createLesson(stage,sync);
  if(id==='magnet')stage.setHome([-4,7,18],[0,3.5,0]);
  else if(id==='conveyor')stage.setHome([4,10.8,10.5],[0,2.5,0]);
  else if(id==='mirror')stage.setHome(mirror.views.observe.position,mirror.views.observe.target);
  else if(['lens','lens-exam'].includes(id))stage.setHome([-4.5,5.5,17],[0,2.8,0]);
  else stage.setHome([-4.5,4.7,12.7],[-.6,2.25,0]);
  stage.view('perspective',{animate:false});sync();
  if(!['magnet','mirror'].includes(id))$('#presets').querySelector('button')?.classList.add('selected');
}

async function init(){
  manifest=await fetch('./batch.json').then(r=>{if(!r.ok)throw Error('课件清单无法读取');return r.json();});
  if(!manifest.lessons?.length||manifest.lessons.some(l=>!registry[l.id]))throw Error('课件清单包含尚未实现的模型');
  lessonSwitcher=createLessonSwitcher($('.lesson-nav'),{
    lessons:manifest.lessons,
    onChange:id=>{location.hash='/'+id;}
  });
  stage=createStage($('#stage'),()=>$('#presets').querySelectorAll('button').forEach(button=>button.classList.remove('selected')),{quality:getSavedQuality()});$('.loading').remove();
  createQualityToggle($('.laboratory'),stage);
  $('#toggle-parameters').onclick=()=>{
    const open=$('.laboratory').classList.toggle('parameters-open');
    $('#toggle-parameters').setAttribute('aria-expanded',open);$('#toggle-parameters').textContent=open?'收起参数':'实验参数';
  };
  selectLesson(location.hash.replace('#/',''));
  window.addEventListener('hashchange',()=>selectLesson(location.hash.replace('#/','')));
  $('#help').addEventListener('click',()=>{
    const m=lesson.metrics();
    const source=activeId==='mirror'?'https://openstax.org/books/university-physics-volume-3/pages/2-1-images-formed-by-plane-mirrors':['lens','lens-exam'].includes(activeId)?'https://openstax.org/books/college-physics-2e/pages/25-6-image-formation-by-lenses':activeId==='lever'?'https://openstax.org/books/college-physics-2e/pages/9-2-the-second-condition-for-equilibrium':activeId==='conveyor'?'https://openstax.org/books/university-physics-volume-1/pages/6-2-friction':'https://openstax.org/books/university-physics-volume-2/pages/12-4-magnetic-field-of-a-current-loop';
    $('#guide-content').innerHTML=`<p>${m.note}</p><h3>如何探究</h3><p>${m.hint}</p><p>数值、场景与观察结果由同一份状态计算。参数改变不会自动恢复相机；“复位视角”只改变相机。</p><h3>操作方式</h3><p>${interactionHelp[activeId]}</p>${activeId==='conveyor'?'<h3>摩擦力判据</h3><p>滑动时，f = −μmg cosθ · sign(v − v带)。同速时，需要的静摩擦力为 mg sinθ；只有 |mg sinθ| ≤ μmg cosθ 才能保持同步。倾角过大时，即使瞬间同速也会向下相对滑动。</p><p>物理计算使用 1/120 秒固定步长，并在同速与带端事件处分段解析求解。无空气阻力，不模拟物块翻转、带面弹性、离带后的下落。页面隐藏时冻结实验，恢复后继续；卡顿超过0.25秒的部分不追赶。</p>':''}<h3>来源</h3><p><a href="${source}" target="_blank" rel="noreferrer">OpenStax · 相关物理原理</a></p><p class="fineprint">本组为重新编写的交互样例，视觉依据用户提供的参考图。</p>`;
    $('#guide').showModal();
  });
  $('.close-guide').onclick=()=>$('#guide').close();
  $('#guide').addEventListener('click',e=>{if(e.target===$('#guide'))$('#guide').close();});
  document.addEventListener('keydown',e=>{
    if(['INPUT','TEXTAREA'].includes(e.target.tagName)||e.target.isContentEditable||$('#guide').open)return;
    if(e.code==='Space'&&lesson.togglePlayback){e.preventDefault();if(!e.repeat)lesson.togglePlayback();return;}
    if(e.target.tagName==='BUTTON')return;
    if(e.key.toLowerCase()==='r')stage.view();
  });
}
init().catch(error=>{console.error(error);$('#stage').innerHTML=`<div class="error-state"><h2>实验室暂时未能加载</h2><p>${error.message}</p><p>请使用启动脚本打开本地服务，并确认浏览器支持 WebGL 2。</p></div>`;});
