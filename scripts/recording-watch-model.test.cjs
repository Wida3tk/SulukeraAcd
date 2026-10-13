const assert=require('node:assert/strict'),{WatchTracker,summary}=require('../recording-watch-model.js');
const tracker=new WatchTracker(120),sample=(position,wallTime,extra={})=>tracker.sample({position,wallTime,playing:true,...extra});
sample(0,0);sample(1,1000);sample(2,2000);assert.equal(tracker.state().seconds,2);
sample(90,3000,{seeking:true});sample(91,4000);assert.equal(tracker.state().seconds,3);assert.equal(tracker.state().percent,2);
tracker.reset();sample(0,5000);sample(1,6000);sample(2,7000);assert.equal(tracker.state().seconds,3,'replayed segment never counted twice');
sample(3,8000,{playing:false});sample(4,9000,{visible:false});sample(5,10000);assert.equal(tracker.state().seconds,3,'paused and hidden segments excluded');
sample(6,30000);assert.equal(tracker.state().seconds,3,'long gaps excluded');
assert.deepEqual(summary([[0,10],[5,15],[30,35]],100),{ranges:[[0,15],[30,35]],seconds:20,percent:20});
console.log('PASS: unique played segments, seek exclusion, pause/background exclusion, replay deduplication and stale heartbeat rejection.');
