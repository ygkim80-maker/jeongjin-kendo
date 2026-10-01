import {Vector3} from 'three';
import {clamp,TIMING} from './engine.js';
import {attackFeet} from './footwork.js';
const v=(x,y,z)=>new Vector3(x,y,z);
const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
function bezier(a,b,c,d,t){const u=1-t;return a.clone().multiplyScalar(u*u*u).addScaledVector(b,3*u*u*t).addScaledVector(c,3*u*t*t).addScaledVector(d,t*t*t);}
/** Shared continuous action timeline. Blade direction follows an arc, never a lerped tip. */
export function attackMotion(zone,e,wind,restHand,restTip,counter=false){
  const restDir=restTip.clone().sub(restHand).normalize();
  const prepDuration=Math.max(.035,wind-.11),swingDuration=wind-prepDuration,followDuration=.075;
  // A kaeshi-do starts in the exact high men guard the player was using.
  // Keeping it for a few frames makes the deflection read before the turn.
  const parryDuration=counter?Math.min(.075,prepDuration*.62):0;
  // Kaeshi-do first receives men above the helmet.  Only after this readable
  // diagonal shield does the waist and shinai unwind into the do cut.
  const parryHand=v(-.04,2.06,.24),parryDir=v(.58,.31,.75).normalize();
  const chamber=v(0,1.98,.08),hit=v(0,1.70,.68);
  let theta0=-.58,theta1=1.37,yaw0=0,yaw1=0;
  // Big men: both hands rise together just above the forehead while the
  // shinai folds clearly behind the helmet.  A near-vertical blade here made
  // the elbows circle like a butterfly stroke; the deeper rear angle keeps
  // the preparation on one compact cutting plane.
  if(zone==='men'){chamber.set(0,2.04,.17);hit.set(0,1.73,.82);theta0=-.94;theta1=1.43;}
  // Kote is a compact wrist cut: the hands rise only to eye level, the tip
  // folds a little behind the men, and both wrists snap down on one plane.
  // This must not borrow the large circular preparation used by big men.
  if(zone==='kote'){chamber.set(.01,1.86,.27);hit.set(.025,1.29,.76);theta0=-.43;theta1=1.53;}
  // Small men keeps the same flying entry, but the shinai rises only briefly instead of a full overhead chamber.
  if(zone==='smallMen'){chamber.set(0,1.94,.26);hit.set(0,1.80,.84);theta0=-.16;theta1=1.39;}
  if(zone==='hikiMen'){chamber.set(0,1.85,.19);hit.set(0,1.68,.66);theta0=-.48;theta1=1.34;}
  // Waist cuts are not downward men cuts.  The hands load beside and just
  // above the helmet, then cross the torso while the blade turns through a
  // broad horizontal arc at do height.  In the player's facing direction,
  // The coordinates below are the fighter's own left/right, not the camera's.
  // For the blue fighter looking at white: plain/hiki/kaeshi-do travel from
  // the fighter's left to right, while gyaku-do travels right to left like a
  // right-handed baseball swing.
  // The plain A-button do uses the same visible left → right cut as hiki-do;
  // only its footwork stays forward instead of retreating.
  if(zone==='do'){chamber.set(.44,1.98,.13);hit.set(-.35,1.20,.73);theta0=1.34;theta1=1.68;yaw0=2.78;yaw1=-.50;}
  if(zone==='hikiDo'){chamber.set(.44,1.98,.13);hit.set(-.35,1.20,.70);theta0=1.34;theta1=1.68;yaw0=2.78;yaw1=-.50;}
  // Gyaku-do must read as the true mirror of hiki/kaeshi-do.  Give it a
  // wider opposite-side load and let the tip cross the centreline earlier,
  // instead of hiding the reversal in the final few frames.
  if(zone==='gyakuDo'){chamber.set(-.54,1.98,.13);hit.set(.46,1.20,.73);theta0=1.34;theta1=1.68;yaw0=-2.78;yaw1=.58;}
  // Thrust is a straight neck-line action, not a raised empty-air poke.  The
  // contact key targets the defender's tare/men gap at issoku-itto distance.
  if(zone==='tsuki'){chamber.set(0,1.40,.25);hit.set(0,1.42,.42);theta0=1.32;theta1=1.36;}
  if(counter){chamber.set(.44,1.98,.13);hit.set(-.35,1.20,.70);theta0=1.34;theta1=1.68;yaw0=2.78;yaw1=-.50;}
  const blade=(theta,yaw)=>v(Math.sin(yaw)*Math.sin(theta),Math.cos(theta),Math.cos(yaw)*Math.sin(theta));
  const chamberDir=blade(theta0,yaw0),contactDir=blade(theta1,yaw1);
  const waist=['do','hikiDo','gyakuDo'].includes(zone),cutSign=zone==='gyakuDo'?-1:1;
  const follow=hit.clone().add(v(waist?.05*cutSign:0,zone==='tsuki'?-.025:-.10,.035));
  const followDir=blade(theta1+(zone==='tsuki'?.025:.20),yaw1+(waist?.2*cutSign:0));
  let hand,dir;
  if(counter&&e<parryDuration){hand=parryHand.clone();dir=parryDir.clone();}
  else if(e<prepDuration){const start=counter?parryHand:restHand.clone(),startDir=counter?parryDir:restDir.clone(),remaining=Math.max(.001,prepDuration-parryDuration),t=ease(counter?(e-parryDuration)/remaining:e/prepDuration);hand=start.lerp(chamber,t);dir=startDir.lerp(chamberDir,t).normalize();}
  else if(e<=wind){
    const t=clamp((e-prepDuration)/swingDuration,0,1);
    const waistArc=['do','hikiDo','gyakuDo'].includes(zone)||counter;
    // Lift into a shallow overhead arc, then let the shoulder turn carry the
    // shinai across the target rather than dropping it straight down.
    const menCut=zone==='men';
    const koteCut=zone==='kote';
    const c1=chamber.clone().add(v(waistArc?(chamber.x>0?.15:-.15):0,waistArc?.19:menCut?.035:koteCut?.025:.12,menCut?.13:koteCut?.10:.24));
    const c2=hit.clone().add(v(waistArc?(hit.x>0?.10:-.10):0,waistArc?.25:menCut?.10:koteCut?.055:.17,menCut?-.035:koteCut?.015:-.09));
    hand=bezier(chamber,c1,c2,hit,t);
    // Accelerate the wrists through the contact instead of stopping at its key pose.
    const angular=Math.pow(t,1.55);
    if(waistArc){
      // Route the tip around the crown/shoulder before it reaches the torso.
      // Two angular legs produce a visible rotation instead of a diagonal chop.
      const turn=cutSign<0?-1:1,midTheta=1.42;
      const split=zone==='gyakuDo'?.36:.46,midYaw=zone==='gyakuDo'?0:1.15*turn;
      if(t<split){const q=ease(t/split);dir=blade(mix(theta0,midTheta,q),mix(yaw0,midYaw,q));}
      else{const q=ease((t-split)/(1-split));dir=blade(mix(midTheta,theta1,q),mix(midYaw,yaw1,q));}
    }else dir=blade(mix(theta0,theta1,angular),mix(yaw0,yaw1,t));
  }else if(e<wind+followDuration){const t=(e-wind)/followDuration;hand=hit.clone().lerp(follow,1-(1-t)**2);dir=contactDir.clone().lerp(followDir,1-(1-t)**2).normalize();}
  else{const t=ease((e-wind-followDuration)/(TIMING.recovery-followDuration));hand=bezier(follow,follow.clone().add(v(0,-.025,-.08)),restHand.clone().add(v(0,-.015,.09)),restHand,t);dir=followDir.clone().lerp(restDir,t).normalize();}
  const drive=ease((e-(wind-.135))/.135),release=ease((e-wind-.09)/(TIMING.recovery-.09));
  const prep=ease(e/prepDuration)*(1-drive),weight=drive*(1-release);
  const flight=clamp((e-(wind-.135))/.135,0,1);
  const feet=attackFeet(e,wind,zone);
  if(counter){feet.frontOffset*=.85;feet.backOffset*=.85;}
  const waistLunge=counter?.82:zone==='men'?1.16:zone==='smallMen'?.78:zone==='kote'?.73:zone==='hikiDo'?-.30:zone==='gyakuDo'?.70:zone==='do'?.56:.48;
  const entryLean=zone==='men'?.14:zone==='smallMen'?.15:zone==='kote'?.09:zone==='hikiMen'?.095:zone==='hikiDo'?-.055:.065;
  return {hand,tip:hand.clone().addScaledVector(dir,1.13),lean:-.018*prep+entryLean*weight,lunge:waistLunge*weight,
    twist:(waist?(zone==='gyakuDo'?.54:.43)*cutSign:.055)*weight-(waist?.20*cutSign:.018)*prep,
    sink:-.025*prep-.015*weight,frontLift:Math.sin(flight*Math.PI)*(zone==='hikiDo'?.025:zone==='men'?.115:zone==='smallMen'?.11:.075),...feet};
}
