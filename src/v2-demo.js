import {Vector3} from 'three';
import {Dojo} from './scene.js';
import {strikeWind} from './engine.js';
import {menContact,smooth01,menPrototypePath} from './v2-contact.js';

const duration=4, wind=strikeWind('men',true,3);
const canvas=document.querySelector('#stage');
const status=document.querySelector('#status');
const slider=document.querySelector('#time');
const label=document.querySelector('#time-label');
const toggle=document.querySelector('#toggle');
const dojo=new Dojo(canvas);
dojo.view=2;
dojo.referees.forEach(r=>{r.red.visible=false;r.white.visible=false;});
// The study frame removes officiating silhouettes so the blade/contact read clearly.
dojo.scene.children.filter(o=>o.type==='Group'&&o!==dojo.player.root&&o!==dojo.ai.root&&
  (Math.abs(o.position.z+1.9)<.01||Math.abs(o.position.z-3.15)<.01)).forEach(o=>o.visible=false);

const fighter=(x)=>({x,velocity:0,state:'idle',elapsed:0,zone:'men',guardStyle:0,semeStyle:0,irimi:false,counter:false});
const startX=-2.55;
const match={player:fighter(startX),ai:fighter(0.8),clock:0,level:3,pointWait:0,stance:'chudan'};
let time=0,playing=true,last=performance.now(),hitShown=false,minGap=Infinity,scrubbing=false;

// Alternate planted feet in world space rather than sliding both with the root.
dojo.beforeRender=()=>{
  const e=Math.max(0,(time-.85)*.72), f=dojo.player;
  const step=.09;
  f.root.updateMatrixWorld(true);
  for(let i=0;i<2;i++){
    const phase=Math.max(0,e-(i===0?step:0));
    const cycle=Math.floor(phase/(step*2)), t=phase-cycle*step*2;
    const end=cycle*step*2+(i===0?step:0)+step;
    const a=menPrototypePath(Math.max(0,end-step*2),wind);
    const b=menPrototypePath(end,wind);
    const swing=smooth01(t/step);
    const moving=Math.hypot(b.x-a.x,b.z-a.z)>.01;
    const world=new Vector3(a.x+(b.x-a.x)*swing+(i===0?-.13:.32),
      .05+(moving&&t<step?Math.sin(Math.PI*t/step)*.09:0),a.z+(b.z-a.z)*swing+(i===0?.15:-.15));
    const ankle=f.pelvis.worldToLocal(world);
    const leg=f.legs[i], hip=new Vector3(i===0?-.14:.14,0,0);
    leg.foot.position.copy(ankle);leg.foot.rotation.x=0;
    const knee=hip.clone().lerp(ankle,.5);knee.z+=.09;
    for(const [mesh,from,to] of [[leg.upper,hip,knee],[leg.lower,knee,ankle]]){
      const direction=to.clone().sub(from);
      mesh.position.copy(from).add(to).multiplyScalar(.5);
      mesh.scale.y=direction.length();
      mesh.quaternion.setFromUnitVectors(new Vector3(0,1,0),direction.normalize());
    }
    f.trousers[i].rotation.x=-Math.atan2(ankle.z,1.02);
  }
};

function draw(now){
  const dt=Math.min((now-last)/1000,.045);last=now;
  if(playing){time+=dt;if(time>=duration){time=0;hitShown=false;minGap=Infinity;scrubbing=false;}}
  const e=Math.max(0,(time-.85)*.72);
  match.clock=time;
  match.ai.x=.8;match.ai.state='idle';match.ai.elapsed=0;
  const path=menPrototypePath(e,wind),next=menPrototypePath(e+.001,wind);
  match.player.x=path.x;
  match.player.state=time>=.85&&e<wind+.22?'attack':'idle';
  match.player.elapsed=match.player.state==='attack'?e:0;
  match.player.velocity=(next.x-path.x)*720;
  dojo.player.passOffset=path.z;
  dojo.render(match,dt,true);

  const bladeTip=dojo.player.shinai.localToWorld(new Vector3(0,1.125,0));
  const helmet=dojo.ai.head.localToWorld(new Vector3(0,0,0));
  const gap=bladeTip.distanceTo(helmet);
  const lateral=Math.abs(dojo.player.root.position.z-dojo.ai.root.position.z);
  if(time>=.85&&e<wind+.10)minGap=Math.min(minGap,gap);
  status.dataset.gap=gap.toFixed(3);
  status.dataset.minGap=Number.isFinite(minGap)?minGap.toFixed(3):'-';
  status.dataset.lateral=lateral.toFixed(3);
  status.dataset.tip=bladeTip.toArray().map(n=>n.toFixed(2)).join(',');
  status.dataset.head=helmet.toArray().map(n=>n.toFixed(2)).join(',');
  if(!hitShown&&menContact(gap,e,wind,lateral)){
    hitShown=true;
  }
  let message='중단세로 대치합니다.',kind='';
  if(time>=.85&&e<wind-.08)message='양손을 함께 올려 큰머리를 준비합니다.';
  else if(time>=.85&&e<wind+.055){message=`머리 접촉 검사 · 검 끝과 면 중심 ${gap.toFixed(2)}m`;kind=hitShown?'hit':'';}
  else if(time>=.85&&e<.70){message=hitShown?'머리 접촉 확인 → 이제 옆으로 빠져나갑니다.':scrubbing?'타임라인 탐색 중 · 처음부터 재생하면 접촉을 검증합니다.':`접촉 실패 · 최근접 ${minGap.toFixed(2)}m`;kind=hitShown?'hit':scrubbing?'':'miss';}
  else if(time>=.85){message=hitShown?'상대 몸을 관통하지 않고 옆으로 통과합니다.':scrubbing?'타임라인 탐색 중 · 처음부터 재생하면 접촉을 검증합니다.':'궤도 재조정이 필요합니다.';kind=hitShown?'hit':scrubbing?'':'miss';}
  status.textContent=message;status.className=`status ${kind}`;
  slider.value=time.toFixed(2);label.textContent=`${time.toFixed(1)} / ${duration.toFixed(1)}초`;
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
toggle.addEventListener('click',()=>{playing=!playing;toggle.textContent=playing?'일시정지':'재생';last=performance.now();});
document.querySelector('#replay').addEventListener('click',()=>{time=0;hitShown=false;minGap=Infinity;scrubbing=false;playing=true;toggle.textContent='일시정지';});
slider.addEventListener('input',()=>{time=Number(slider.value);hitShown=false;minGap=Infinity;scrubbing=true;playing=false;toggle.textContent='재생';});
