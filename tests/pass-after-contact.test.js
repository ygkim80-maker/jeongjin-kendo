import test from 'node:test';
import assert from 'node:assert/strict';
import {attackPassProgress} from '../src/footwork.js';

test('the passing lane begins only after the strike reaches contact',()=>{
  for(const wind of [.10,.19,.24,.25,.60]){
    assert.equal(attackPassProgress(0,wind),0);
    assert.equal(attackPassProgress(wind-.001,wind),0);
    assert.equal(attackPassProgress(wind,wind),0);
    assert.ok(attackPassProgress(wind+.08,wind)>0);
    assert.equal(attackPassProgress(wind+.20,wind),1);
  }
});
