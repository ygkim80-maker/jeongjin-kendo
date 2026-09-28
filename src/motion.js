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
  const parryDuration=counter?Math.min(.055,prepDuration*.62):0;
  const parryHand=v(-.08,1.74,.40),parryDir=v(.8,.44,.23).normalize();
  const chamber=v(0,1.98,.08),hit=v(0,1.70,.68);
  let theta0=-.58,theta1=1.37,yaw0=0,yaw1=0;
  // Big men follows the compact men line: a higher chamber and longer flying
  // entry, without the circular "butterfly stroke" path above the head.
  if(zone==='men'){chamber.set(0,2.13,.22);hit.set(0,1.78,.90);theta0=-.24;theta1=1.48;}
  if(zone==='kote'){chamber.set(.015,1.76,.21);hit.set(.035,1.27,.7);theta0=-.19;theta1=1.6;}
  // Small men keeps the same flying entry, but the shinai rises only briefly instead of a full overhead chamber.
  if(zone==='smallMen'){chamber.set(0,1.94,.26);hit.set(0,1.80,.84);theta0=-.16;theta1=1.39;}
  if(zone==='hikiMen'){chamber.set(0,1.85,.19);hit.set(0,1.68,.66);theta0=-.48;theta1=1.34;}
  // The rendered player is rotated toward the white player.  Therefore the
  // visible screen sweep has to be mirrored against the model-local x axis:
  // hiki-do / kaeshi-do visibly travel left → right, gyaku-do right → left.
  // Waist cuts first lift just above the helmet and travel through a compact
  // circular shoulder turn; they should never read as a vertical chop.
  if(zone==='do'){chamber.set(-.34,2.30,.10);hit.set(.22,1.21,.69);theta0=.14;theta1=1.72;yaw0=-1.02;yaw1=.32;}
  if(zone==='hikiDo'){chamber.set(.42,2.27,.10);hit.set(-.32,1.21,.69);theta0=.14;theta1=1.72;yaw0=1.24;yaw1=-.42;}
  if(zone==='gyakuDo'){chamber.set(-.42,2.27,.10);hit.set(.32,1.21,.69);theta0=.14;theta1=1.72;yaw0=-1.24;yaw1=.42;}
  if(zone==='tsuki'){chamber.set(0,1.26,.19);hit.set(0,1.5,.81);theta0=1.12;theta1=1.27;}
  if(counter){chamber.set(.42,2.31,.16);hit.set(-.32,1.21,.70);theta0=.14;theta1=1.72;yaw0=1.24;yaw1=-.42;}
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
    const c1=chamber.clone().add(v(waistArc?(chamber.x>0?.15:-.15):0,waistArc?.19:.12,.24)),c2=hit.clone().add(v(waistArc?(hit.x>0?.10:-.10):0,waistArc?.25:.17,-.09));
    hand=bezier(chamber,c1,c2,hit,t);
    // Accelerate the wrists through the contact instead of stopping at its key pose.
    const angular=Math.pow(t,1.55);dir=blade(mix(theta0,theta1,angular),mix(yaw0,yaw1,t));
  }else if(e<wind+followDuration){const t=(e-wind)/followDuration;hand=hit.clone().lerp(follow,1-(1-t)**2);dir=contactDir.clone().lerp(followDir,1-(1-t)**2).normalize();}
  else{const t=ease((e-wind-followDuration)/(TIMING.recovery-followDuration));hand=bezier(follow,follow.clone().add(v(0,-.025,-.08)),restHand.clone().add(v(0,-.015,.09)),restHand,t);dir=followDir.clone().lerp(restDir,t).normalize();}
  const drive=ease((e-(wind-.135))/.135),release=ease((e-wind-.09)/(TIMING.recovery-.09));
  const prep=ease(e/prepDuration)*(1-drive),weight=drive*(1-release);
  const flight=clamp((e-(wind-.135))/.135,0,1);
  const feet=attackFeet(e,wind,zone);
  if(counter){feet.frontOffset*=.85;feet.backOffset*=.85;}
  const waistLunge=counter?.82:zone==='men'?1.28:zone==='smallMen'?.78:zone==='kote'?.66:zone==='hikiDo'?-.30:zone==='gyakuDo'?.70:zone==='do'?.56:.48;
  const entryLean=zone==='men'?.24:zone==='smallMen'?.15:zone==='kote'?.12:zone==='hikiMen'?.095:zone==='hikiDo'?-.055:.065;
  return {hand,tip:hand.clone().addScaledVector(dir,1.13),lean:-.018*prep+entryLean*weight,lunge:waistLunge*weight,
    twist:(waist?.31*cutSign:.055)*weight-(waist?.14*cutSign:.018)*prep,
    sink:-.025*prep-.015*weight,frontLift:Math.sin(flight*Math.PI)*(zone==='hikiDo'?.025:zone==='men'?.18:zone==='smallMen'?.11:.075),...feet};
}
