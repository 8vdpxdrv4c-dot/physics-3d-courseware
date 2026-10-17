// Dimensionless Biot–Savart model: prescribed magnetization represented by
// closed surface-current loops. No permeability/ferromagnetic response solver.
export const magnitude=v=>Math.hypot(...v);
const add=(a,b,k=1)=>a.map((x,i)=>x+k*b[i]);
export function currentSegments(points,current=1){
  return points.map((a,i)=>{const b=points[(i+1)%points.length],v=b.map((x,j)=>x-a[j]),length=magnitude(v);return {a,d:v.map(x=>x/length),length,current};});
}
export function circleLoop(x,r,n=48,current=1){return currentSegments(Array.from({length:n},(_,i)=>[x,r*Math.cos(i*2*Math.PI/n),r*Math.sin(i*2*Math.PI/n)]),current);}
export function segmentField(segments,p){
  let bx=0,by=0,bz=0;
  for(const s of segments){
    const rx=p[0]-s.a[0],ry=p[1]-s.a[1],rz=p[2]-s.a[2],d=s.d;
    const t=rx*d[0]+ry*d[1]+rz*d[2],q=t-s.length;
    const cx=d[1]*rz-d[2]*ry,cy=d[2]*rx-d[0]*rz,cz=d[0]*ry-d[1]*rx;
    // Finite wire core regularizes near-wire illustration only.
    const rho2=cx*cx+cy*cy+cz*cz,den=Math.max(rho2,.0004);
    const k=s.current*(t/Math.sqrt(den+t*t)-q/Math.sqrt(den+q*q))/den;
    bx+=cx*k;by+=cy*k;bz+=cz*k;
  }
  return [bx,by,bz];
}
function bar(center,length=2,width=.7,axis='x',sign=1){
  const map=([x,y,z])=>axis==='y'?[center[0]+y,center[1]+x,center[2]-z]:[center[0]+x,center[1]+y,center[2]+z];
  const segments=[];
  for(let i=0;i<12;i++){const x=-length/2+(i+.5)*length/12,r=width/2;segments.push(...currentSegments([[x,r,r],[x,-r,r],[x,-r,-r],[x,r,-r]].map(map),sign*length/12));}
  return {center,length,width,axis,sign,segments,inside(p){const q=p.map((v,i)=>v-center[i]);return axis==='x'?Math.abs(q[0])<length/2&&Math.abs(q[1])<width/2&&Math.abs(q[2])<width/2:Math.abs(q[1])<length/2&&Math.abs(q[0])<width/2&&Math.abs(q[2])<width/2;}};
}
export function createMagneticModel({mode='bar',gap=1.5,polarity=1,strength=1}={}){
  let bodies=[],segments=[];
  if(mode==='bar')bodies=[bar([0,0,0],2.4,.8)];
  if(mode==='unlike'||mode==='like'){const x=gap/2+1;bodies=[bar([-x,0,0]),bar([x,0,0],2,.7,'x',mode==='like'?-1:1)];}
  if(mode==='horseshoe')bodies=[bar([-1.2,0,0],2.4,.65,'y',1),bar([1.2,0,0],2.4,.65,'y',-1),bar([0,-.875,0],1.75,.65,'x',-1)];
  if(bodies.length)segments=bodies.flatMap(b=>b.segments);
  if(mode==='solenoid')for(let i=0;i<10;i++)segments.push(...circleLoop(-1.35+i*.3,.9,32,.3));
  if(mode==='ring')for(let i=0;i<8;i++){const x=-.35+(i+.5)*.7/8;segments.push(...circleLoop(x,1.3,32,.7/8),...circleLoop(x,.65,32,-.7/8));}
  const inside=p=>mode==='ring'?Math.abs(p[0])<.35&&Math.hypot(p[1],p[2])>.65&&Math.hypot(p[1],p[2])<1.3:mode==='solenoid'?Math.abs(p[0])<1.5&&Math.hypot(p[1],p[2])<.9:bodies.some(b=>b.inside(p));
  function field(p){return segmentField(segments,p).map(x=>x*polarity*strength);}
  function seeds(count=6,section=false){
    const result=[],angles=section?[0,Math.PI]:Array.from({length:count},(_,i)=>i*2*Math.PI/count);
    const around=(x,r)=>angles.forEach(a=>result.push([x,r*Math.cos(a),r*Math.sin(a)]));
    if(mode==='bar'){for(const r of section?[.16,.3,.48,.7]:[.25,.52])around(1.25,r);}
    if(mode==='solenoid'){for(const r of section?[.2,.45,.7,1]:[.35,.7])around(1.6,r);}
    if(mode==='ring'){for(const r of section?[.74,.9,1.08,1.23]:[.85,1.1])around(.42,r);}
    if(mode==='unlike'||mode==='like'){
      for(const r of section?[.14,.3,.5,.72]:[.22,.5]){around(-gap/2+.04,r);around(gap/2+2.06,r);}
    }
    if(mode==='horseshoe')for(const r of section?[.12,.25,.4,.6]:[.2,.42])for(const a of angles)result.push([-1.2+r*Math.cos(a),1.25,r*Math.sin(a)]);
    return result;
  }
  return {mode,bodies,segments,inside,field,seeds};
}
// RK4 integration of dX/ds = B/|B|. Stop at the drawing boundary or a null.
// Boundary clipping is a view limit, not an endpoint of the physical field.
export function traceField(model,seed,{step=.075,maxSteps=620}={}){
  const dir=(p,sign)=>{const b=model.field(p),n=magnitude(b);return n<1e-9?null:b.map(x=>sign*x/n);};
  const integrate=sign=>{
    const points=[seed];let p=seed;
    for(let i=0;i<maxSteps;i++){
      const a=dir(p,sign);if(!a)break;
      const b=dir(add(p,a,step/2),sign);if(!b)break;
      const c=dir(add(p,b,step/2),sign);if(!c)break;
      const d=dir(add(p,c,step),sign);if(!d)break;
      const q=p.map((x,j)=>x+step*(a[j]+2*b[j]+2*c[j]+d[j])/6);
      if(Math.abs(q[0])>6.4||q[1]<-2.7||q[1]>3.7||Math.abs(q[2])>4.2)break;
      if(i>25&&magnitude(q.map((x,j)=>x-seed[j]))<step*.65){points.push(seed);return {points,closed:true};}
      points.push(q);p=q;
    }
    return {points,closed:false};
  };
  const forward=integrate(1);if(forward.closed)return forward.points;
  return integrate(-1).points.reverse().slice(0,-1).concat(forward.points);
}
