import {Vector3} from 'three';
import {Dojo} from './scene.js';
import {attackTravel} from './footwork.js';
import {strikeWind} from './engine.js';
import {menContact,smooth01,passLaneOffset} from './v2-contact.js';

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

function draw(now){
  const dt=Math.min((now-last)/1000,.045);last=now;
  if(playing){time+=dt;if(time>=duration){time=0;hitShown=false;minGap=Infinity;scrubbing=false;}}
  const e=Math.max(0,(time-.85)*.72);
  match.clock=time;
  match.ai.x=.8;match.ai.state='idle';match.ai.elapsed=0;
  if(time<.85){match.player.x=startX;match.player.state='idle';match.player.elapsed=0;}
  else if(time<2.7){
    // Keep the centre line until impact; the sideways lane begins only after it.
    match.player.state='attack';match.player.elapsed=e;
    const clearance=smooth01((e-wind)/.48);
    match.player.x=startX+attackTravel(e,wind,'men')+3.0*clearance;
  }else{
    match.player.state='idle';match.player.elapsed=0;
    match.player.x=1.95;
  }
  // Establish side clearance before the torso crosses the opponent's x plane.
  if(match.player.state==='attack')dojo.player.passOffset=passLaneOffset(e,wind);
  else if(time<.85)dojo.player.passOffset=0;
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
