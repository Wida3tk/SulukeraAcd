import {test} from 'node:test';
import assert from 'node:assert/strict';
import {continuousPlaybackRange as range,MAX_RECORDING_CHECKPOINT_GAP} from './src/recording-playback-policy.js';
const run={playing:1,last_time:1000,last_position:10,duration_seconds:1000};
test('continuous listening is credited in hidden tabs, including minute-throttled timers',()=>{
 assert.deepEqual(range(run,{position:70,rate:1,visible:false,seeking:false},61000),[10,70]);
 assert.deepEqual(range(run,{position:130,rate:2,visible:false},61000),[10,130]);
 assert.deepEqual(range(run,{position:100,rate:1,visible:false},91000),[10,100]);
 assert.equal(MAX_RECORDING_CHECKPOINT_GAP,90);
});
test('paused, stationary, seeking, implausible jumps and long disconnected gaps award nothing',()=>{
 assert.equal(range({...run,playing:0},{position:20,visible:false},11000),null);
 assert.equal(range(run,{position:10,visible:false},11000),null);
 assert.equal(range(run,{position:70,rate:1,visible:false,seeking:true},61000),null);
 assert.equal(range(run,{position:900,rate:1,visible:false},11000),null);
 assert.equal(range(run,{position:101,rate:1,visible:false},92000),null);
 assert.equal(range(run,{position:20,rate:8,visible:false},11000),null);
});
