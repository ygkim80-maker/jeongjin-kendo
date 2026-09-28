import './style.css';
import {Match,NAMES,clamp,TIMING} from './engine.js';
import {Dojo} from './scene.js';
if('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(sessionStorage.getItem('jeongjin-sw-reloaded')==='20260919-12')return;
    sessionStorage.setItem('jeongjin-sw-reloaded','20260919-12');
    location.reload();
  });
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?build=20260919-12',{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{}));
}
const $=id=>document.getElementById(id);
const match=new Match();
const teamSlots=['선봉','2위','중견','부장','주장'];
const teamSizeLabel=document.createElement('label');teamSizeLabel.htmlFor='team-size';teamSizeLabel.textContent='단체전 인원';const teamSizeSelect=document.createElement('select');teamSizeSelect.id='team-size';teamSizeSelect.innerHTML='<option value="3" selected>3인전</option><option value="5">5인전</option>';teamSizeLabel.append(teamSizeSelect);document.querySelector('.team-roster').before(teamSizeLabel);
const settingsSave=document.createElement('button');settingsSave.id='settings-save';settingsSave.className='primary settings-save';settingsSave.type='button';settingsSave.textContent='설정 저장';document.querySelector('.roster-settings').append(settingsSave);
const teamStatus=document.createElement('span');teamStatus.id='team-status';teamStatus.className='team-status hidden';document.querySelector('.scoreboard .clock').append(teamStatus);
const teamStrip=document.createElement('div');teamStrip.id='team-strip';teamStrip.className='team-strip hidden';teamStrip.innerHTML='<div class="team-strip-top"><b id="team-progress">1경기/3경기</b><strong id="team-clock">03:00</strong><span id="team-round">단체전 · 선봉</span></div><div class="team-strip-summary"><strong>남색팀</strong><b id="team-left-wins">0</b><span id="team-totals">승수 0:0 · 다득점 0:0</span><b id="team-right-wins">0</b><strong>흰색팀</strong></div><div class="team-strip-bout"><span id="team-left-player">남색 선봉</span><div id="team-left-points" class="points"></div><small>현재 대결</small><div id="team-right-points" class="points"></div><span id="team-right-player">흰색 선봉</span></div>';document.querySelector('.scoreboard').append(teamStrip);
const SCORE_GLYPH={men:'ㅁ',smallMen:'ㅁ',hikiMen:'ㅁ',kote:'ㅅ',do:'ㅎ',hikiDo:'ㅎ',gyakuDo:'ㅎ',tsuki:'ㅉ',penalty:'반',win:'■'};
const REFEREE_CALL={men:'머리',smallMen:'머리',hikiMen:'머리',kote:'손목',do:'허리',hikiDo:'허리',gyakuDo:'허리',tsuki:'찌름'};
const held=new Set(),pointers=new Map();
const pressStarted=new Map(),tapUntil=new Map();
let dojo,started=false,paused=false,muted=false,context=null,last=0,uiTime=0,hitPause=0,cueUntil=0,pointUntil=0,buffer=null,lastPoint=null,refereeTimer=null;
let koreanVoices=[];
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function error(message){$('error').classList.remove('hidden');$('error').textContent=message;}
try{dojo=new Dojo($('scene'));}catch(e){error('3D 화면을 시작하지 못했습니다. 브라우저의 하드웨어 가속을 켠 후 Chrome 또는 Edge에서 다시 열어주세요. '+e.message);}
function unlock(){try{context??=new (window.AudioContext||window.webkitAudioContext)();if(context.state==='suspended')context.resume().catch(()=>{});}catch{}}
function sound(kind){
  if(muted||!context)return;
  const t=context.currentTime,g=context.createGain();g.connect(context.destination);g.gain.setValueAtTime(.0001,t);
  if(kind==='point'||kind==='block'){
    const duration=kind==='point'?.13:.055,n=Math.floor(context.sampleRate*duration),b=context.createBuffer(1,n,context.sampleRate),d=b.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,3);
    const src=context.createBufferSource();src.buffer=b;const filter=context.createBiquadFilter();filter.type='bandpass';filter.frequency.value=kind==='point'?1800:3100;filter.Q.value=.8;src.connect(filter);filter.connect(g);g.gain.linearRampToValueAtTime(.3,t+.002);g.gain.exponentialRampToValueAtTime(.0001,t+duration);src.start(t);src.onended=()=>{src.disconnect();filter.disconnect();g.disconnect();};
  }else{
    const osc=context.createOscillator();osc.type='sine';osc.frequency.setValueAtTime(kind==='start'?390:180,t);osc.frequency.exponentialRampToValueAtTime(kind==='start'?590:65,t+.1);osc.connect(g);g.gain.linearRampToValueAtTime(.04,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.15);osc.start(t);osc.stop(t+.16);osc.onended=()=>{osc.disconnect();g.disconnect();};
  }
}
function loadVoices(){if('speechSynthesis' in window)koreanVoices=window.speechSynthesis.getVoices().filter(v=>v.lang?.toLowerCase().startsWith('ko'));}
loadVoices();if('speechSynthesis' in window)window.speechSynthesis.addEventListener?.('voiceschanged',loadVoices);
function speechVoice(role){
  const referee=koreanVoices.find(v=>/injoon|male|hyunsu|민준|남성/i.test(v.name))||koreanVoices[0]||null;
  if(role==='referee')return referee;
  return koreanVoices.find(v=>v!==referee&&/female|sunhi|sora|heami|유미|여성/i.test(v.name))||koreanVoices.find(v=>v!==referee)||referee;
}
function voice(text,role='referee'){
  if(muted||!('speechSynthesis' in window))return;
  const utterance=new SpeechSynthesisUtterance(text);utterance.lang='ko-KR';utterance.volume=1;utterance.voice=speechVoice(role);
  if(role==='fighter'){utterance.rate=1.5;utterance.pitch=1.25;}
  // 심판은 낮게 끌지 않고, 중저음의 짧고 강한 명령으로 외친다.
  else{utterance.rate=1.28;utterance.pitch=.62;}
  // 판정은 선수 기합을 즉시 끊고 들어가야 한 박자 늦지 않는다.
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
function judgeCall(text){clearTimeout(refereeTimer);refereeTimer=setTimeout(()=>voice(text,'referee'),500);}
function clearInput(){held.clear();pressedCodes.clear();pointers.clear();pressStarted.clear();tapUntil.clear();buffer=null;document.querySelectorAll('.controls .active').forEach(b=>b.classList.remove('active'));}
function teamModeLabel(){const size=Number($('team-size').value)||3;const option=$('start-match-mode').querySelector('option[value="team"]');option.textContent=`단체전 · ${size}인 승부`;}
function readSettings(){try{return JSON.parse(localStorage.getItem('jeongjin-settings')||'{}');}catch{return {};}}
function saveSettings(){
  const data={matchMode:$('match-mode').value,teamSize:Number($('team-size').value),difficulty:Number($('difficulty').value),player:$('player-name').value,opponent:$('opponent-name').value,teamPlayers:teamSlots.map((_,i)=>$(`team-player-${i}`).value),teamOpponents:teamSlots.map((_,i)=>$(`team-opponent-${i}`).value)};
  localStorage.setItem('jeongjin-settings',JSON.stringify(data));$('start-match-mode').value=data.matchMode;$('start-difficulty').value=String(data.difficulty);teamModeLabel();syncNames();verdict('설정을 저장했습니다.',data.matchMode==='team'?`첫 화면에 단체전 · ${data.teamSize}인 승부로 반영됩니다.`:'개인전 선수 설정이 반영됐습니다.');$('settings-panel').close();
}
function restoreSettings(){
  const data=readSettings();if(!Object.keys(data).length){teamModeLabel();return;}
  $('match-mode').value=data.matchMode||'solo';$('start-match-mode').value=data.matchMode||'solo';$('team-size').value=String(data.teamSize||3);$('difficulty').value=String(data.difficulty||3);$('start-difficulty').value=String(data.difficulty||3);$('player-name').value=data.player||'수련자';$('opponent-name').value=data.opponent||'맞수';teamSlots.forEach((_,i)=>{$(`team-player-${i}`).value=data.teamPlayers?.[i]||`남색 ${teamSlots[i]}`;$(`team-opponent-${i}`).value=data.teamOpponents?.[i]||`흰색 ${teamSlots[i]}`;});teamModeLabel();
}
function start(practice=false){
  if(!dojo)return;
  unlock();clearInput();lastPoint=null;$('highlight').classList.add('hidden');const team=$('start-match-mode').value==='team',teamSize=Number($('team-size').value),ruleSet=$('rule-set').value,level=Number($('start-difficulty').value);$('match-mode').value=team?'team':'solo';match.reset({level,practice,team,teamSize,ruleSet});syncNames();started=true;paused=false;hitPause=0;cueUntil=0;pointUntil=0;
  $('overlay').classList.add('hidden');$('pause-overlay').classList.add('hidden');$('point-flash').classList.remove('show');$('pause').textContent='일시정지  ESC';
  $('timer').previousElementSibling.textContent=practice?'자유 수련 · 타격 연습':team?`단체전 · ${teamSize}인 승부`:ruleSet==='standard'?'표준전 · 4분 · 2본 선취':'초급전 · 3분 · 2본 선취';$('match-title').textContent=team?'제1도장 · 단체 대련':ruleSet==='standard'?'제1도장 · 표준 대련':'제1도장 · 초급 대련';
  verdict('입장 · 3보 · 인사','양 끝에서 들어와 짧게 인사한 뒤, 흰 선에서 죽도를 꺼내 중단세로 정렬합니다.');
  match.beginCeremony();updateUI();
}
function setPaused(value,announce=true){
  if(!started||match.finished)return;paused=value;clearInput();
  if(announce)voice(value?'중지':'계속');
  $('pause-overlay').classList.toggle('hidden',!value);$('pause-title').textContent='잠시, 호흡을 고르세요.';$('result-detail').textContent='대련 시간과 선수의 움직임이 멈춰 있습니다.';$('resume').classList.remove('hidden');
  $('pause').textContent=value?'계속하기  ESC':'일시정지  ESC';
}
function returnToIntro(){clearInput();started=false;paused=false;match.reset();$('overlay').classList.remove('hidden');$('pause-overlay').classList.add('hidden');$('point-flash').classList.remove('show');$('pause').textContent='일시정지  ESC';}
function verdict(title,detail){$('verdict').textContent=title;$('verdict-detail').textContent=detail;$('live-verdict').textContent=title;}
function cue(text,duration=1.1){$('cue').textContent=text;cueUntil=match.clock+duration;$('cue').classList.add('show');}
function action(zone){
  if(!started||paused||match.finished||match.ceremony||$('help').open)return;
  const movement=input(),technique=(zone==='men'||zone==='smallMen')&&movement.back?'hikiMen':zone==='do'&&movement.back?'hikiDo':zone==='do'&&movement.forward?'gyakuDo':zone;
  unlock();if(!match.attack(technique)&&match.player.state==='attack'&&match.player.elapsed>TIMING.playerWind+.12)buffer={zone:technique,until:match.clock+.2};
}
function events(){for(const e of match.drain()){
  if(e.type==='warning')cue(`${NAMES[e.zone]} 공격이 옵니다 · 방어 SPACE`,1.1);
  if(e.type==='ceremony'){cue('입장 · 세 발 · 인사',1.35);}
  if(e.type==='ready'){sound('start');voice(e.call);cue(e.call==='시작'?'중단 정렬 · 시작':'중단 정렬 · 두 판째',1.1);verdict(e.call,'이제부터 유효격자를 노릴 수 있습니다.');}
  if(e.type==='clinch_break'){cue('근접 대치 · 서로 물러납니다',1);verdict('죽도를 맞대고 대치했습니다.','이 간격에서는 후퇴하거나 퇴격 머리로 변화를 만드세요.');}
  if(e.type==='tsuba'){cue('코등이 싸움 · 중심을 다툽니다',1.25);verdict('코등이 싸움에 들어갔습니다.','양쪽이 코등이를 맞대고 밀고 비빈 뒤, 세 걸음씩 물러나 다시 공격합니다.');}
  if(e.type==='tsuba_break'){cue('코등이 싸움 종료 · 세 걸음 후퇴',1.15);verdict('심판이 간격을 정리합니다.','양쪽이 세 걸음 물러난 뒤 다시 공격할 수 있습니다.');}
  if(e.type==='push')cue(e.result==='held'?'상대가 중심을 지켰습니다':e.result==='yield'?'몸받음 · 상대가 물러납니다':'몸받음',.75);
  if(e.type==='stoppage'){voice('중지');cue('중지 · 시작선으로 복귀',1.1);verdict('장외 가능성으로 경기를 중단합니다.','심판이 선수를 시작선으로 되돌립니다.');}
  if(e.type==='hansoku'){const offender=e.side==='player'?'남색':'흰색';cue(`${offender} 경고 △ ${e.point?'· 반칙 2회, 상대 1점':'· 누적 1회'}`,1.5);verdict(`${offender} 장외 경고`,e.point?'경고 2회로 상대에게 한 판이 주어졌습니다.':'두 번째 경고는 상대에게 한 판이 주어집니다.');}
  if(e.type==='resume')voice('계속');
  if(e.type==='separate'){cue('간격을 다시 잡습니다',.8);}
  if(e.type==='irimi'){cue('이리미 · 중심을 지키며 진입',.7);verdict('세메를 몸으로 구체화합니다.','상체를 숙이지 말고 허리와 발이 함께 들어가며 타격 기회를 만드세요.');}
  if(e.type==='opening'){cue('빈틈이 열렸습니다 · 지금 타격',1.3);verdict('칼끝으로 중심을 잡았습니다.','머리·손목·허리 중 한 곳을 자신 있게 치세요.');}
  if(e.type==='miss'){if(e.player){verdict('거리에서 벗어난 타격',e.reason);cue('간격을 다시 잡으세요',.8);}}
  if(e.type==='ai_guard')cue('상대가 죽도를 세웠습니다',.45);
  if(e.type==='ai_evade'){verdict('상대가 간격을 비켜냈습니다.','타격 전에 세메로 중심을 흔드세요.');cue('회피 · 다시 중심을 잡으세요',.8);}
  if(e.type==='parried'){sound('block');verdict(e.active?'상대가 타격을 받아냈습니다.':'상대가 죽도를 받아냈습니다.','세메로 방어를 흔들거나 상대가 공격할 때 빈틈을 노리세요.');cue('막혔습니다 · 중심을 먼저',.8);}
  if(e.type==='contact'){sound('block');verdict('타격은 닿았지만 유효타가 아닙니다.','기합·잔심·중심이 갖춰진 기회를 만드세요.');cue('타격 · 유효격자 아님',.9);}
  if(e.type==='block'){sound('block');verdict(e.counterReady?'머리를 받아냈습니다. 허리로 연결하세요.':e.perfect?'정확한 순간에 받아냈습니다.':'방어 성공. 이제 반격하세요.',e.counterReady?'A를 누르면 받은 자세에서 바로 받아허리로 이어집니다.':`방어를 풀고 ${e.perfect?'여유 있게':'빠르게'} 타격하면 빈틈을 노릴 수 있습니다.`);cue(e.counterReady?'머리 방어 성공 · 받아허리 A':'방어 성공 · 반격의 기회',.9);}
  if(e.type==='swing'){sound('swing');voice(NAMES[e.zone]||'머리','fighter');}
  if(e.type==='point'){
    lastPoint={player:e.player,zone:e.zone,startX:e.startX,opponentX:e.opponentX};sound('point');judgeCall(REFEREE_CALL[e.zone]||'득점');dojo.impact(e.player,e.zone);if(reduced)dojo.shake=0;hitPause=reduced?0:.035;pointUntil=match.clock+1.8;cueUntil=0;
    const technique=e.counter?'받아허리':NAMES[e.zone];
    $('point-flash').classList.add('show');$('point-flash').querySelector('span').textContent=`${e.player?'남색 · 수련자':'흰색 · 맞수'} / ${technique}`;
    verdict(e.player?`${technique}, 강타로 한 판.`:`맞수의 ${technique}, 강타로 한 판.`,e.player?'좋은 간격과 기회가 만났습니다. 자세를 회복하며 다음 수를 준비하세요.':'공격 준비 동작을 보고 방어하거나, 거리를 벌려 피해보세요.');
  }
  if(e.type==='restart')voice(e.call);
  if(e.type==='bout'){syncNames();voice('시작');cue(`${e.side==='draw'?'무승부':e.side==='player'?'남색':'흰색'} · 다음 대결`,1.2);verdict(`단체전 ${e.bout}번째 대결 종료`,`현재 단체 점수 ${match.teamScore.player} : ${match.teamScore.ai}`);}
  if(e.type==='representative'){cue('승수·다득점 동률 · 대표전',1.6);verdict('대표전 · 한 판 승부','대표 선수 한 명이 1본으로 승부를 결정합니다.');}
  if(e.type==='end'){
    const record={at:new Date().toISOString(),team:match.team,winner:e.winner,player:match.team?match.teamScore.player:match.player.score,opponent:match.team?match.teamScore.ai:match.ai.score,teamPoints:match.team?match.teamPoints:null,attacks:match.stats.attacks,blocks:match.stats.blocks};const history=JSON.parse(localStorage.getItem('jeongjin-match-records')||'[]');localStorage.setItem('jeongjin-match-records',JSON.stringify([record,...history].slice(0,100)));
    clearInput();$('pause-overlay').classList.remove('hidden');$('pause-title').textContent=e.winner==='draw'?'서로의 검을 배웠습니다.':e.winner==='player'?'좋은 한 판이었습니다.':'다음 한 판을 향해.';
    $('result-detail').textContent=`${match.player.score} : ${match.ai.score} · ${e.winner==='draw'?'무승부':e.winner==='player'?'수련자 승리':'맞수 승리'} — 타격 ${match.stats.attacks}회, 방어 성공 ${match.stats.blocks}회`;
    $('resume').classList.add('hidden');$('highlight').classList.toggle('hidden',!lastPoint);$('pause').textContent='대련 종료';
  }
}}
function input(){const values=[...held,...pointers.values()];for(const [key,until] of tapUntil)if(match.clock<until)values.push(key);else tapUntil.delete(key);return Object.fromEntries(values.map(k=>[k,true]));}
function releaseTap(id,key){const startTime=pressStarted.get(id);if(startTime!==undefined&&['forward','back'].includes(key)&&match.clock-startTime<.09)tapUntil.set(key,startTime+.09);pressStarted.delete(id);}
function scoreCells(points,target,side){
  const first=match.pointSequence[0];
  return Array.from({length:target},(_,i)=>{
    const zone=points[i],isFirst=i===0&&first?.side===side;
    return `<span class="score-cell${zone?' filled':''}${isFirst?' first-point':''}">${zone?SCORE_GLYPH[zone]||'·':''}</span>`;
  }).join('');
}
function teamRoster(){
  const size=match.teamSize||3;
  return size===3?['선봉','중견','주장']:teamSlots.slice(0,size);
}
function rosterInputIndex(boutIndex){return (match.teamSize||3)===3?[0,2,4][boutIndex]??0:boutIndex;}
function updateUI(){
  const seconds=Math.ceil(match.time);$('timer').textContent=match.practice?'연습':`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  const timeText=match.practice?'연습':`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  const playerScore=match.team?match.teamScore.player:match.player.score,aiScore=match.team?match.teamScore.ai:match.ai.score,target=match.team?2:match.winTarget;
  if(match.team){$('p-score').innerHTML=scoreCells(Array(playerScore).fill('win'),target,'none');$('a-score').innerHTML=scoreCells(Array(aiScore).fill('win'),target,'none');}
  else{$('p-score').innerHTML=scoreCells(match.player.points,target,'player');$('a-score').innerHTML=scoreCells(match.ai.points,target,'ai');}
  $('p-count').textContent=String(playerScore);$('a-count').textContent=String(aiScore);
  $('p-warnings').innerHTML='△'.repeat(match.player.warnings);$('a-warnings').innerHTML='△'.repeat(match.ai.warnings);
  const slot=match.representative?'대표전':teamRoster()[Math.min(Number(match.bout)||1,match.teamSize)-1];$('team-status').classList.add('hidden');document.querySelector('.scoreboard').classList.toggle('team-mode',match.team&&started);teamStrip.classList.toggle('hidden',!match.team||!started);if(match.team){$('team-progress').textContent=match.representative?'대표전':`${match.bout}경기/${match.teamSize}경기`;$('team-clock').textContent=timeText;$('team-round').textContent=match.representative?'단판 승부':`단체전 · ${slot}`;$('team-left-wins').textContent=match.teamScore.player;$('team-right-wins').textContent=match.teamScore.ai;$('team-totals').textContent=`승수 ${match.teamScore.player}:${match.teamScore.ai} · 다득점 ${match.teamPoints.player}:${match.teamPoints.ai}`;$('team-left-player').textContent=$('player-label').textContent;$('team-right-player').textContent=$('opponent-label').textContent;$('team-left-points').innerHTML=scoreCells(match.player.points,2,'player');$('team-right-points').innerHTML=scoreCells(match.ai.points,2,'ai');}
  const d=match.distance,label=match.tsubaFight?'코등이 싸움':d<1.25?'코등이 간격':d<=2.65?'일족일도':'원거리';$('distance-label').textContent=label;
  $('hud-distance').textContent=match.team?`승수 ${match.teamScore.player}:${match.teamScore.ai} · 다득점 ${match.teamPoints.player}:${match.teamPoints.ai}`:label;$('control-distance').textContent=label;$('distance-marker').style.left=`${clamp((d-.3)/10.5*100,0,100)}%`;
  $('distance-help').textContent=match.tsubaFight?'코등이 싸움 중입니다. 양쪽이 밀고 비빈 뒤 세 걸음씩 물러납니다.':d<1.25?'너무 가깝습니다. E를 누르면 코등이 싸움으로 들어갑니다.':d<=2.65?'죽도가 닿는 거리입니다. 빈틈을 노리세요.':'한 걸음씩 들어가 타격 거리를 만드세요.';
  $('pressure-fill').style.width=`${match.pressure*100}%`;$('hud-pressure').style.width=`${match.pressure*100}%`;$('pressure-label').textContent=match.opening>0?'빈틈':match.pressure>.45?'압박 중':'대치';$('hud-opening').textContent=$('pressure-label').textContent;
  if(match.clock>cueUntil)$('cue').classList.remove('show');if(match.clock>pointUntil)$('point-flash').classList.remove('show');
  const inp=input();document.querySelectorAll('[data-hold]').forEach(b=>b.classList.toggle('active',!!inp[b.dataset.hold]||(b.dataset.hold==='guard'&&!!inp.push)));
  const counterButton=document.querySelector('[data-action="do"]');counterButton.classList.toggle('counter-ready',match.counterWindow>0);counterButton.querySelector('.attack-name').textContent=match.counterWindow>0?'받아허리':'허리';
  document.querySelectorAll('[data-stance]').forEach(b=>{const selected=b.dataset.stance===match.stance;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
}
$('start').onclick=()=>start(false);$('practice').onclick=()=>start(true);$('pause').onclick=()=>setPaused(!paused);$('resume').onclick=()=>setPaused(false);$('restart').onclick=()=>start(match.practice);$('highlight').onclick=()=>{if(lastPoint&&dojo){dojo.highlight(lastPoint);$('highlight').textContent='슬로 재생 중';setTimeout(()=>{$('highlight').textContent='마지막 유효격자 다시 보기';},3300);}};
$('sound').onclick=()=>{muted=!muted;unlock();$('sound').textContent=muted?'소리 꺼짐':'소리 켜짐';$('sound').setAttribute('aria-pressed',String(!muted));};
$('camera').onclick=()=>{if(dojo)dojo.view=(dojo.view+1)%4;};
$('difficulty').onchange=()=>{match.level=Number($('difficulty').value);if(started)verdict('맞수의 수준을 바꿨습니다.','다음 공격부터 새 수준에 맞춰 대응합니다.');};
let wasPaused=false;
const openHelp=()=>{wasPaused=paused;setPaused(true,false);$('settings-panel').close();$('help').showModal();};
$('help-from-settings').onclick=openHelp;
$('help-close').onclick=()=>$('help').close();$('help').addEventListener('close',()=>{if(!wasPaused)setPaused(false,false);});
let settingsWasPaused=false;
$('settings-toggle').onclick=()=>{settingsWasPaused=paused;setPaused(true,false);$('settings-panel').showModal();};
$('settings-close').onclick=()=>$('settings-panel').close();$('settings-panel').addEventListener('close',()=>{if(!settingsWasPaused)setPaused(false,false);});
$('settings-save').onclick=saveSettings;
const keys={ArrowLeft:'back',ArrowRight:'forward',ArrowUp:'menGuard',Space:'seme',Digit1:'push',ShiftLeft:'guard',ShiftRight:'guard'};
const pressedCodes=new Set();
window.addEventListener('keydown',e=>{
  if(['SELECT','INPUT','TEXTAREA'].includes(e.target.tagName)||$('help').open||$('settings-panel').open)return;
  if(keys[e.code]||['KeyQ','KeyW','KeyS','KeyD','KeyA','KeyE','KeyR','F1','Escape','KeyC'].includes(e.code))e.preventDefault();
  if(e.repeat)return;
  if(e.code==='F1'){returnToIntro();return;}if(e.code==='Escape'){if(match.finished)returnToIntro();else setPaused(!paused);return;}if(e.code==='KeyC'){if(dojo)dojo.view=(dojo.view+1)%4;return;}if(e.code==='KeyE'){if(started&&match.engageTsuba()){updateUI();return;}match.stance='chudan';updateUI();return;}if(e.code==='KeyR'){match.stance='jodan';updateUI();return;}
  if(!started||paused||match.finished)return;
  if(keys[e.code]){pressedCodes.add(e.code);held.add(keys[e.code]);pressStarted.set(e.code,match.clock);}
  const zone={KeyQ:'tsuki',KeyW:'men',KeyS:'smallMen',KeyD:'kote',KeyA:'do'}[e.code];if(zone)action(zone);
});
window.addEventListener('keyup',e=>{releaseTap(e.code,keys[e.code]);pressedCodes.delete(e.code);held.clear();for(const code of pressedCodes)held.add(keys[code]);});
document.querySelectorAll('[data-hold]').forEach(button=>{
  button.addEventListener('pointerdown',e=>{e.preventDefault();if(!started||paused||match.finished)return;button.setPointerCapture(e.pointerId);pointers.set(e.pointerId,button.dataset.hold);pressStarted.set(e.pointerId,match.clock);unlock();});
  const release=e=>{releaseTap(e.pointerId,pointers.get(e.pointerId));pointers.delete(e.pointerId);};button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
});
const joystick=$('joystick'),stick=$('joystick-stick');
function moveStick(event){const box=joystick.getBoundingClientRect(),x=(event.clientX-(box.left+box.width/2))/(box.width/2),y=(event.clientY-(box.top+box.height/2))/(box.height/2),limit=.55;stick.style.transform=`translate(calc(-50% + ${Math.max(-limit,Math.min(limit,x))*22}px),calc(-50% + ${Math.max(-limit,Math.min(limit,y))*22}px))`;pointers.set(event.pointerId,Math.abs(x)>.22?(x>0?'forward':'back'):Math.abs(y)>.3&&y<0?'seme':'');}
joystick.addEventListener('pointerdown',e=>{if(!started||paused||match.finished)return;joystick.setPointerCapture(e.pointerId);moveStick(e);unlock();});joystick.addEventListener('pointermove',e=>{if(pointers.has(e.pointerId))moveStick(e);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(type,e=>{pointers.delete(e.pointerId);stick.style.transform='translate(-50%,-50%)';});
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>action(b.dataset.action));
function syncNames(){const team=$('match-mode').value==='team'||$('start-match-mode').value==='team',boutIndex=match.representative?0:match.team?Math.min(Number(match.bout)||1,match.teamSize)-1:0,index=match.team?rosterInputIndex(boutIndex):boutIndex,slot=match.representative?'대표':teamRoster()[boutIndex]||teamSlots[index];const player=(team?$(`team-player-${index}`).value:$('player-name').value).trim()||(team?`남색 ${slot}`:'수련자'),opponent=(team?$(`team-opponent-${index}`).value:$('opponent-name').value).trim()||(team?`흰색 ${slot}`:'맞수');$('player-label').textContent=player;$('opponent-label').textContent=opponent;}
['player-name','opponent-name',...teamSlots.flatMap((_,i)=>[`team-player-${i}`,`team-opponent-${i}`])].forEach(id=>$(id).addEventListener('input',syncNames));
$('match-mode').addEventListener('change',()=>{$('start-match-mode').value=$('match-mode').value;syncNames();});$('start-match-mode').addEventListener('change',()=>{$('match-mode').value=$('start-match-mode').value;syncNames();});
restoreSettings();syncNames();
document.querySelectorAll('[data-stance]').forEach(b=>b.onclick=()=>{if(match.player.state==='attack')return;match.stance=b.dataset.stance;updateUI();});
function loseFocus(){pressedCodes.clear();clearInput();if(started&&!match.finished)setPaused(true,false);}
window.addEventListener('blur',loseFocus);document.addEventListener('visibilitychange',()=>{if(document.hidden)loseFocus();});
function frame(now){
  const dt=Math.min((now-last)/1000||.016,.1);last=now;
  const active=started&&!paused&&!match.finished;
  if(active){
    if(hitPause>0)hitPause-=dt;else match.step(dt,input());
    if(buffer){if(match.clock>buffer.until)buffer=null;else if(match.attack(buffer.zone))buffer=null;}
    events();
  }else if(!started)match.clock+=dt;
  if(dojo)dojo.render(match,paused?0:dt,active||!started);
  uiTime+=dt;if(uiTime>.05){updateUI();uiTime=0;}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
