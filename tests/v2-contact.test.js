import test from 'node:test';
import assert from 'node:assert/strict';
import {menContact,smooth01,passLaneOffset} from '../src/v2-contact.js';
import {attackTravel} from '../src/footwork.js';

test('men contact requires timing, blade proximity and centre line',()=>{
  assert.equal(menContact(.22,.24,.24,.04),true);
  assert.equal(menContact(.5,.24,.24,.04),false);
  assert.equal(menContact(.22,.12,.24,.04),false);
  assert.equal(menContact(.22,.24,.24,.5),false);
});
test('pass interpolation starts only at contact and is bounded',()=>{
  assert.equal(smooth01(-1),0);
  assert.equal(smooth01(0),0);
  assert.equal(smooth01(1),1);
  assert.equal(smooth01(2),1);
});
test('accelerated demo clears the opponent before the body crosses',()=>{
  const start=-2.55,opponent=.8,wind=.24;
  for(let e=wind;e<=.9;e+=.005){
    const x=start+attackTravel(e,wind,'men')+3*smooth01((e-wind)/.48);
    const z=passLaneOffset(e,wind);
    assert.ok(Math.hypot(opponent-x,z)>.9,`overlap risk at ${e.toFixed(3)}s`);
  }
});
