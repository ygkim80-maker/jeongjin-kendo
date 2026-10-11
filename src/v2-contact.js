// Contact precedes the lateral pass. A near miss cannot trigger the impact cue.
export function menContact(distance, elapsed, wind, lateralOffset, radius = 0.26) {
  return elapsed >= wind - 0.025 && elapsed <= wind + 0.055 &&
    Math.abs(lateralOffset) < 0.24 && distance <= radius;
}

export function smooth01(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

export function menPrototypePath(elapsed, wind, start = -2.55) {
  const drive = smooth01((elapsed - wind + .14) / .14);
  const side = smooth01((elapsed - wind) / .26);
  const forward = smooth01((elapsed - wind - .14) / .60);
  return {x: start + .82 * drive + .65 * side + 2.9 * forward, z: -1.2 * side};
}
