const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
// Cumulative forward displacement: never rewind a committed strike to its starting point.
export function attackTravel(elapsed,wind,zone='do'){
  const drive=smooth((elapsed-(wind-.14))/.14),follow=smooth((elapsed-wind)/.20);
  // Big men commits through the target: the contact step is decisive, then
  // the trailing foot gathers while the body clears along the passing lane.
  if(zone==='men')return .82*drive+.68*follow;
  if(zone==='smallMen')return .60*drive+.46*follow;
  if(zone==='hikiMen')return -.22*drive-.38*follow;
  if(zone==='hikiDo')return -.34*drive-.46*follow;
  if(zone==='do')return .44*drive+.36*follow;
  if(zone==='gyakuDo')return .42*drive+.34*follow;
  if(zone==='kote')return .48*drive+.38*follow;
  // Tsuki commits one clear, longer step into the throat line.  Its follow
  // through is restrained, unlike a cut which must pass the opponent.
  if(zone==='tsuki')return .58*drive+.18*follow;
  return .38*drive+.28*follow;
}
export function attackFeet(elapsed,wind,zone='do'){
  const travel=attackTravel(elapsed,wind,zone),drive=smooth((elapsed-(wind-.14))/.14);
  const follow=smooth((elapsed-wind)/.20),collect=smooth((elapsed-wind-.02)/.21);
  if(zone==='hikiDo'||zone==='hikiMen')return {frontOffset:-travel*(1-collect),backOffset:-.21*drive+.21*follow,backLift:.04*Math.sin(drive*Math.PI)};
  const reach=zone==='men'?.34:zone==='smallMen'?.26:zone==='kote'?.27:zone==='gyakuDo'?.10:.20;
  return {frontOffset:reach*(drive-follow),backOffset:-Math.min(.38,travel)*(1-collect),backLift:.07*Math.sin(collect*Math.PI)};
}
