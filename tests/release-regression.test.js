import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {strikeFinish} from '../src/footwork.js';
import {Match} from '../src/engine.js';

test('final v1.2 referee geometry is preserved verbatim',()=>{
  const extract=s=>s.slice(s.indexOf('  buildReferees(){'),s.indexOf('  setNames(')).replace(/\r/g,'');
  const baseline=execFileSync('git',['show','174009a:src/scene.js'],{encoding:'utf8'});
  assert.equal(extract(readFileSync(new URL('../src/scene.js',import.meta.url),'utf8')),extract(baseline));
});
test('live-game finish contacts first and clears sideways before crossing',()=>{
  for(const gap of [1.58,1.8,2.52]){
    assert.deepEqual(strikeFinish(.24,.24,gap),{forward:0,lateral:0});
    for(let e=.24;e<1.1;e+=.005){
      const p=strikeFinish(e,.24,gap);
      assert.ok(Math.hypot(gap-p.forward,p.lateral)>.95);
      if(p.forward>=gap)assert.ok(p.lateral>1.1);
    }
  }
});
test('live match finishes a reachable cut without freezing the clock',()=>{
  const m=new Match(()=>.99);m.reset({practice:true});m.player.x=-1;m.ai.x=1.5;
  assert.equal(m.attack('men'),true);
  for(let i=0;i<240;i++)m.step(1/120);
  assert.ok(m.player.contactX!=null);assert.equal(m.player.state,'idle');assert.ok(m.clock>1.9);
});
