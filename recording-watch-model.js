(function(root){
 function mergeRanges(ranges,duration){
  const sorted=ranges.filter(r=>Array.isArray(r)&&r.length===2&&r.every(Number.isFinite)).map(([a,b])=>[Math.max(0,a),Math.min(duration,b)]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]),result=[];
  for(const range of sorted){const last=result.at(-1);if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else result.push(range.slice());}return result;
 }
 function summary(ranges,duration){const merged=mergeRanges(ranges,duration),seconds=merged.reduce((n,[a,b])=>n+b-a,0);return {ranges:merged,seconds,percent:duration>0?Math.min(100,Math.floor(seconds/duration*100)):0};}
 class WatchTracker{
  constructor(duration,ranges=[]){this.duration=duration;this.ranges=mergeRanges(ranges,duration);this.previous=null;}
  reset(){this.previous=null;}
  sample({position,wallTime,playing,visible=true,seeking=false,rate=1}){
   if(!Number.isFinite(position)||!Number.isFinite(wallTime)){this.reset();return this.state();}
   const previous=this.previous;this.previous={position,wallTime,playing,visible,rate};
   if(!previous||!playing||!previous.playing||!visible||!previous.visible||seeking)return this.state();
   const elapsed=(wallTime-previous.wallTime)/1000,delta=position-previous.position;
   // Ignore jumps, hidden/background playback, stalls and long gaps between reports.
   if(elapsed<=0||elapsed>5||delta<=0||delta>elapsed*Math.max(rate,previous.rate)+0.4)return this.state();
   this.ranges=mergeRanges([...this.ranges,[previous.position,position]],this.duration);return this.state();
  }
  state(){return summary(this.ranges,this.duration);}
 }
 root.SulukeraWatch={mergeRanges,summary,WatchTracker};if(typeof module!=='undefined')module.exports=root.SulukeraWatch;
})(globalThis);
