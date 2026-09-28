import {attackTravel} from './footwork.js';
export const NAMES = {men:'큰머리',smallMen:'머리',hikiMen:'퇴격머리',kote:'손목',do:'허리',tsuki:'찌름',hikiDo:'퇴격허리',gyakuDo:'역허리'};
export const TIMING={playerWind:.19,recovery:.29,aiWind:level=>clamp(.82-level*.055,.24,.76)};
export const strikeWind=(zone,isPlayer,level)=>isPlayer?(zone==='men'?.14:zone==='smallMen'?.10:TIMING.playerWind):TIMING.aiWind(level);
export const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const attacks = ['men','smallMen','hikiMen','kote','do','tsuki','hikiDo','gyakuDo'];
const DIFFICULTY = {
  1:{guard:.15,evade:.06,attackDelay:1.55,point:.83},
  2:{guard:.28,evade:.12,attackDelay:1.28,point:.72},
  3:{guard:.42,evade:.19,attackDelay:1.03,point:.62},
  4:{guard:.55,evade:.27,attackDelay:.84,point:.53},
  5:{guard:.68,evade:.35,attackDelay:.68,point:.45},
  6:{guard:.72,evade:.38,attackDelay:.58,point:.42},
  7:{guard:.76,evade:.41,attackDelay:.49,point:.39},
  8:{guard:.80,evade:.44,attackDelay:.41,point:.36},
  9:{guard:.84,evade:.47,attackDelay:.34,point:.33},
  10:{guard:.88,evade:.50,attackDelay:.27,point:.30},
};
export class Match {
  constructor(random = Math.random) { this.random=random; this.reset(); }
  reset({level=2,practice=false,team=false,teamSize=3,ruleSet='quick'}={}) {
    this.level=level; this.practice=practice;this.team=team;this.teamSize=teamSize;this.ruleSet=ruleSet;this.teamScore={player:0,ai:0};this.teamPoints={player:0,ai:0};this.teamResults=[];this.pointSequence=[];this.bout=1;this.representative=false;this.roundTime=ruleSet==='standard'?240:180;this.time=this.roundTime;this.clock=0;this.winTarget=2;
    this.player=this.fighter(-2.65); this.ai=this.fighter(2.65);
    this.pressure=0; this.opening=0;this.clinchTime=0;this.clinchLimit=2.3;this.forcedRetreat=0;this.stoppage=0;this.pendingPenalty=null; this.aiThink=1.8; this.aiTactic='probe'; this.aiTacticTime=.8; this.lastAiZone=null;this.pointWait=0;this.counterWindow=0;this.aiGuard=0;this.aiEvade=0;this.tsubaFight=false;
    this.finished=false; this.winner=null; this.events=[]; this.stats={attacks:0,blocks:0,valid:0,contacts:0,parries:0};this.stance='chudan';this.ceremony=null;
  }
  fighter(x) { return {x,home:x,velocity:0,state:'idle',elapsed:0,zone:'men',resolved:false,score:0,points:[],warnings:0,guardTime:0,guardHeld:0,guardStyle:0,semeStyle:0,semeSwitch:0,irimi:false,clinch:false,impact:0,counter:false,startDistance:99,pushHeld:false,pushCooldown:0}; }
  get distance(){ return this.ai.x-this.player.x; }
  get inRange(){return this.distance>=1.25&&this.distance<=2.65;}
  event(type,extra={}){this.events.push({type,...extra});}
  drain(){const e=this.events;this.events=[];return e;}
  engageTsuba(){
    if(this.finished||this.ceremony||this.pointWait>0||this.forcedRetreat>0||this.distance>=1.36||this.player.state==='attack'||this.ai.state==='attack')return false;
    this.tsubaFight=true;this.clinchTime=0;
    Object.assign(this.player,{state:'clinch',elapsed:0,velocity:0,clinch:true});
    Object.assign(this.ai,{state:'clinch',elapsed:0,velocity:0,clinch:true});
    this.event('tsuba');return true;
  }
  beginCeremony(call='시작'){
    this.ceremony={elapsed:0,call};
    Object.assign(this.player,{x:-5.35,state:'entry',elapsed:0,velocity:0});
    Object.assign(this.ai,{x:5.35,state:'entry',elapsed:0,velocity:0});
    this.event('ceremony',{stage:'enter'});
  }
  stepCeremony(dt){
    const c=this.ceremony;c.elapsed+=dt;const t=c.elapsed,p=this.player,a=this.ai;
    if(t<.9){const k=t/.9;p.x=-5.35+1.08*k;a.x=5.35-1.08*k;p.state=a.state='entry';p.elapsed=a.elapsed=t;p.velocity=1.2;a.velocity=-1.2;return;}
    if(t<1.52){p.x=-4.27;a.x=4.27;p.state=a.state='bow';p.elapsed=a.elapsed=t-.9;p.velocity=a.velocity=0;return;}
    if(t<2.55){const k=(t-1.52)/1.03;p.x=-4.27+1.62*k;a.x=4.27-1.62*k;p.state=a.state='approach';p.elapsed=a.elapsed=t-1.52;p.velocity=1.58;a.velocity=-1.58;return;}
    if(t<3.10){p.x=p.home;a.x=a.home;p.state=a.state='draw';p.elapsed=a.elapsed=t-2.55;p.velocity=a.velocity=0;return;}
    p.x=p.home;a.x=a.home;p.state=a.state='idle';p.elapsed=a.elapsed=0;p.velocity=a.velocity=0;this.ceremony=null;this.event('ready',{call:c.call});
  }
  completeTeamBout(side){
    if(side)this.teamScore[side]++;
    this.teamPoints.player+=this.player.score;this.teamPoints.ai+=this.ai.score;
    this.teamResults.push({bout:this.bout,side:side||'draw',playerPoints:[...this.player.points],aiPoints:[...this.ai.points]});this.event('bout',{side:side||'draw',bout:this.bout});
    if(this.representative){this.end();return;}
    if(this.bout>=this.teamSize){
      if(this.teamScore.player===this.teamScore.ai&&this.teamPoints.player===this.teamPoints.ai){this.representative=true;this.bout='대표전';this.winTarget=1;this.event('representative');}
      else{this.end();return;}
    }else this.bout++;
    this.player.score=0;this.ai.score=0;this.player.points=[];this.ai.points=[];this.pointSequence=[];this.time=this.roundTime;
  }
  resetExchange(){
    for(const f of [this.player,this.ai]){f.x=f.home;f.state='idle';f.elapsed=0;f.velocity=0;}
    this.pressure=0;this.opening=0;this.aiThink=1.3;this.aiTactic='probe';this.aiTacticTime=.8;this.counterWindow=0;this.aiGuard=0;this.aiEvade=0;
  }
  pushAtBoundary(){
    const p=this.player,a=this.ai;
    if(p.pushCooldown>0||this.distance>1.58||a.x<4.62||p.state==='attack'||a.state==='attack')return false;
    p.pushCooldown=.72;
    // 몸받음은 상대가 대부분 중심을 지키는 기술이다. 경계 바로 앞에서만
    // 무게 중심이 무너지면 장외가 된다.
    const drive=.18+this.random()*.92;
    const resistance=.44+this.random()*.62;
    if(drive<=resistance){this.event('push',{result:'held'});return true;}
    const next=a.x+drive*.78;
    if(next<=5.4){a.x=next;this.event('push',{result:'yield'});return true;}
    a.x=5.4;
    this.issuePenalty('ai','장외');
    return true;
  }
  issuePenalty(side,reason){
    const offender=side==='player'?this.player:this.ai,recipient=side==='player'?this.ai:this.player;
    offender.warnings++;
    const point=offender.warnings>=2;
    if(point){
      offender.warnings=0;recipient.score++;recipient.points.push('penalty');this.pointSequence.push({side:side==='player'?'ai':'player',zone:'penalty'});
    }
    this.pendingPenalty={side,count:offender.warnings||2,reason,point};
    this.stoppage=1.12;this.event('stoppage',{reason});
  }
  advanceStrike(f,isPlayer,dt){
    const wind=strikeWind(f.zone,isPlayer,this.level);
    const stride=(attackTravel(f.elapsed,wind,f.zone)-attackTravel(f.elapsed-dt,wind,f.zone))*(f.counter?1.15:1);
    const available=Math.max(0,this.distance-1.05),actual=stride>=0?Math.min(stride,available):stride;
    const old=f.x;f.x=clamp(f.x+(isPlayer?1:-1)*actual,-5.4,5.4);f.velocity=(f.x-old)/dt;
  }
  attack(zone){
    if(!attacks.includes(zone)||this.finished||this.ceremony||this.pointWait>0||this.forcedRetreat>0) return false;
    const tsubaExit=this.tsubaFight&&zone==='hikiMen';
    if(this.tsubaFight&&!tsubaExit)return false;
    const counter=zone==='do'&&this.counterWindow>0;
    if(!['idle','seme'].includes(this.player.state)&&!tsubaExit&&!(counter&&this.player.state==='guard')) return false;
    if(zone==='hikiDo'||zone==='gyakuDo')this.stance='chudan';
    if(!this.practice) this.prepareDefense(zone,counter);
    if(tsubaExit){this.tsubaFight=false;this.player.clinch=this.ai.clinch=false;this.ai.state='idle';this.ai.elapsed=0;}
    Object.assign(this.player,{state:'attack',zone,elapsed:0,resolved:false,counter,startDistance:this.distance,startX:this.player.x,opponentX:this.ai.x});
    this.counterWindow=0;this.stats.attacks++; this.event('swing',{zone,counter}); return true;
  }
  prepareDefense(zone,counter){
    if(counter) return;
    const ai=DIFFICULTY[this.level] ?? DIFFICULTY[3];
    const pressureBonus=clamp(this.pressure*.34+(this.opening>0?.34:0)+(counter?.55:0),0,.88);
    const guardChance=Math.max(.03,ai.guard-pressureBonus);
    const evadeChance=Math.max(0,ai.evade-pressureBonus*.7);
    if(this.random()<guardChance){this.aiGuard=.72;this.ai.state='guard';this.ai.guardStyle=['men','smallMen','hikiMen'].includes(zone)?0:zone==='kote'?1:2;this.ai.elapsed=0;this.event('ai_guard',{zone});}
    else if(this.random()<evadeChance){this.aiEvade=.46;this.event('ai_evade',{zone});}
  }
  aiAttack(){
    const close=this.distance<1.5;
    const pool=close?['hikiMen','hikiDo','kote','do']:['men','smallMen','kote','do','tsuki','gyakuDo'];
    let index=Math.min(pool.length-1,Math.floor(this.random()*pool.length)),zone=pool[index];
    if(zone===this.lastAiZone){index=(index+1)%pool.length;zone=pool[index];}
    this.lastAiZone=zone;
    Object.assign(this.ai,{state:'attack',zone,elapsed:0,resolved:false,startDistance:Math.min(this.distance,2.4),startX:this.ai.x,opponentX:this.player.x});
    this.event('swing',{zone,player:false});
  }
  step(dt,input={}){
    if(this.finished)return;
    // Bound simulation work after tab suspension. The UI also pauses on visibility loss.
    let remaining=clamp(dt,0,.1);
    while(remaining>0){const slice=Math.min(remaining,1/120);this.tick(slice,input);remaining-=slice;}
  }
  tick(dt,input){
    if(this.finished)return;
    this.clock+=dt;
    for(const f of [this.player,this.ai])f.impact=Math.max(0,f.impact-dt*3);
    if(this.ceremony){this.stepCeremony(dt);return;}
    if(this.pointWait>0){
      const boutBefore=this.bout;
      this.pointWait-=dt;
      for(const [f,isPlayer] of [[this.player,true],[this.ai,false]]){f.elapsed+=dt;f.velocity=0;if(f.state==='attack')this.advanceStrike(f,isPlayer,dt);}
      if(this.pointWait<=0){
        if(!this.practice&&(this.player.score>=this.winTarget||this.ai.score>=this.winTarget)){
          if(this.team){const side=this.player.score>this.ai.score?'player':'ai';this.completeTeamBout(side);if(this.finished)return;}
          else{this.end();return;}
        }
        this.resetExchange();
        if(!this.practice&&!this.finished&&this.bout===boutBefore){const tied=this.player.score===this.ai.score&&this.player.score>0;this.event('restart',{call:tied?'승부':'두 판째'});}
      }
      return;
    }
    if(!this.practice){this.time=Math.max(0,this.time-dt);if(this.time<=0){if(this.team){if(this.representative){this.time=this.roundTime;}else{const side=this.player.score===this.ai.score?null:this.player.score>this.ai.score?'player':'ai';this.completeTeamBout(side);if(!this.finished)this.resetExchange();}return;}this.end();return;}}
    this.opening=Math.max(0,this.opening-dt);
    this.counterWindow=Math.max(0,this.counterWindow-dt);
    this.aiGuard=Math.max(0,this.aiGuard-dt);this.aiEvade=Math.max(0,this.aiEvade-dt);
    const p=this.player,a=this.ai;
    for(const f of [p,a]){f.elapsed+=dt;f.velocity=0;}
    p.pushCooldown=Math.max(0,p.pushCooldown-dt);
    if(this.stoppage>0){
      this.stoppage-=dt;p.state='idle';a.state='idle';p.clinch=a.clinch=false;
      p.x+=clamp(p.home-p.x,-dt*5.5,dt*5.5);a.x+=clamp(a.home-a.x,-dt*5.5,dt*5.5);
      if(this.stoppage<=0&&this.pendingPenalty){const penalty=this.pendingPenalty;this.event('hansoku',penalty);this.pendingPenalty=null;if(penalty.point)this.pointWait=2.3;this.event('resume');}
      return;
    }
    if(['idle','guard','seme'].includes(p.state)){
      const next=(input.guard||input.push)?'guard':input.seme?'seme':'idle';
      if(p.state!==next){
        p.state=next;p.elapsed=0;
        if(next==='guard')p.guardStyle=(p.guardStyle+1+Math.floor(this.clock*11)%2)%3;
        if(next==='seme'){p.semeStyle=Math.floor(this.random()*3);p.irimi=this.random()<.5;p.semeSwitch=.48+this.random()*.42;if(p.irimi)this.event('irimi');}
        else p.irimi=false;
      }
      if(p.state==='seme'){p.semeSwitch-=dt;if(p.semeSwitch<=0){p.irimi=this.random()<.48;p.semeStyle=Math.floor(this.random()*3);p.semeSwitch=.48+this.random()*.42;}}
      p.guardTime=p.state==='guard'?p.guardTime+dt:0;
      p.guardHeld=(input.guard||input.push)?.24:Math.max(0,p.guardHeld-dt);
      const move=(input.forward?1:0)-(input.back?1:0),direction=input.back?-1:p.irimi?1:move;
      p.velocity=direction*(p.state==='guard'?.85:p.irimi?1.26:p.state==='seme'?0:2.2);
      p.x=clamp(p.x+p.velocity*dt,-5.4,a.x-1.05);
    }
    if(input.push&&!p.pushHeld)this.pushAtBoundary();
    p.pushHeld=!!input.push;
    if(this.forcedRetreat>0){
      this.forcedRetreat-=dt;p.clinch=a.clinch=false;p.state='idle';a.state='idle';
      p.x=clamp(p.x-dt*2.0,-5.4,a.x-1.05);a.x=clamp(a.x+dt*2.0,p.x+1.05,5.4);
      if(this.forcedRetreat<=0)this.event('separate');return;
    }
    if(p.state==='seme'&&this.distance<=3.15&&a.state!=='attack'){
      this.pressure=clamp(this.pressure+dt*(p.irimi?.96:.58),0,1);
      if(this.pressure>=1){this.opening=1.7;this.pressure=.18;this.event('opening');}
    }else this.pressure=Math.max(0,this.pressure-dt*.12);
    const clinched=this.distance<1.32&&p.state!=='attack'&&a.state!=='attack';
    p.clinch=a.clinch=clinched;
    if(clinched){this.clinchTime+=dt;if(this.clinchTime>=this.clinchLimit){this.forcedRetreat=.58;this.clinchTime=0;this.clinchLimit=1.9+this.random()*.8;this.event('clinch_break');}}else this.clinchTime=0;
    if(a.state==='guard'&&this.aiGuard<=0){a.state='idle';a.elapsed=0;}
    if(a.state==='idle'&&!this.practice&&this.aiThink<10){
      this.aiTacticTime-=dt;
      if(this.aiTacticTime<=0){
        const roll=this.random(),retreat=clamp(.34-this.level*.026,.07,.31),guardEnd=retreat+clamp(.16+this.level*.012,.17,.28),probeEnd=guardEnd+clamp(.32-this.level*.014,.17,.31);
        this.aiTactic=roll<retreat?'retreat':roll<guardEnd?'guard':roll<probeEnd?'probe':'pressure';
        this.aiTacticTime=.45+this.random()*1.15;
        if(this.aiTactic==='guard'){this.aiGuard=.34+this.random()*.42;a.state='guard';a.elapsed=0;}
      }
      const target=this.aiTactic==='retreat'?2.9:this.aiTactic==='pressure'?1.76:2.25;
      const delta=this.distance-target;
      const pace=.72+this.level*.035,speed=delta>.12?-pace:delta<-.18?pace*.88:Math.sin(this.clock*2.1)*(.14+this.level*.009);
      a.velocity=speed;a.x=clamp(a.x+speed*dt,p.x+1.05,5.4);
      this.aiThink-=dt;
      if(this.aiThink<=0&&this.distance<2.55&&this.opening===0&&this.aiTactic!=='retreat'&&this.random()<clamp(.50+this.level*.045,.54,.94)){this.aiAttack();this.event('warning',{zone:a.zone});}
    }
    for(const [f,other,isPlayer] of [[p,a,true],[a,p,false]]){
      const wind=strikeWind(f.zone,isPlayer,this.level);
      if(f.state==='attack'){
        this.advanceStrike(f,isPlayer,dt);
        if(!f.resolved&&f.elapsed>=wind){f.resolved=true;this.resolve(f,other,isPlayer);if(this.pointWait>0)return;}
        if(f.elapsed>wind+TIMING.recovery){f.state='idle';f.elapsed=0;if(!isPlayer)this.aiThink=(DIFFICULTY[this.level]?.attackDelay ?? 1)+this.random()*.8;}
      }else if(f.state==='hit'&&f.elapsed>.48){f.state='idle';f.elapsed=0;}
    }
    p.x=clamp(p.x,-5.4,a.x-1.05);a.x=clamp(a.x,p.x+1.05,5.4);
  }
  resolve(f,other,isPlayer){
    const zone=f.zone;
    const startingReach=zone==='men'?2.55:zone==='tsuki'?2.3:2.4;
    const closeEnough=zone==='men'?this.distance>=1.05&&this.distance<=2.65:this.inRange;
    const reachable=(f.counter?this.distance>=1.045&&this.distance<=2.65:closeEnough)&&f.startDistance<=startingReach;
    if(!reachable||(zone==='tsuki'&&this.distance<1.75)){this.event('miss',{player:isPlayer,zone,reason:zone==='tsuki'&&this.distance<1.75?'너무 가깝습니다. 반 걸음 물러나세요.':'죽도가 닿기에는 거리가 멉니다.'});return;}
    if(isPlayer&&this.aiEvade>0){this.aiEvade=0;this.event('evaded',{zone});return;}
    if(isPlayer&&this.aiGuard>0){this.aiGuard=0;this.stats.parries++;this.event('parried',{zone,active:true});return;}
    if(!isPlayer&&(other.state==='guard'||other.guardHeld>0)){
      this.stats.blocks++;other.impact=.4;this.opening=other.guardTime<.32?1.4:.8;
      this.counterWindow=zone==='men'?this.opening:0;
      this.event('block',{perfect:other.guardTime<.32,zone,counterReady:zone==='men'});return;
    }
    if(isPlayer&&!f.counter&&other.state==='attack'&&other.elapsed<.22&&this.opening<=0&&!this.practice){
      this.event('parried',{zone});return;
    }
    if(isPlayer)this.stats.contacts++;
    f.score++;f.points.push(zone);this.pointSequence.push({side:isPlayer?'player':'ai',zone});if(isPlayer)this.stats.valid++;
    other.state='hit';other.elapsed=0;other.impact=1;
    this.counterWindow=0;this.pointWait=2.3;this.event('point',{player:isPlayer,zone,score:f.score,counter:!!f.counter,impact:'강타',startX:f.startX,opponentX:f.opponentX});
  }
  end(){this.finished=true;const p=this.team?this.teamScore.player:this.player.score,a=this.team?this.teamScore.ai:this.ai.score;this.winner=p===a?'draw':p>a?'player':'ai';this.event('end',{winner:this.winner});}
}
