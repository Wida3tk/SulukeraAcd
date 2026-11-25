// Background tabs may batch timers about once per minute. Playback must still
// advance continuously within real elapsed time; tab visibility is not required.
export const MAX_RECORDING_CHECKPOINT_GAP=90;
export function continuousPlaybackRange(run,body,now){
 const position=Number(body.position),rate=Number(body.rate)||1;
 if(!Number.isFinite(position)||!Number.isFinite(rate)||rate<.25||rate>2)return null;
 const elapsed=(now-run.last_time)/1000,delta=position-run.last_position;
 const end=Math.min(run.duration_seconds,position);
 if(run.playing&&!body.seeking&&elapsed>0&&elapsed<=MAX_RECORDING_CHECKPOINT_GAP&&delta>0&&delta<=elapsed*rate+.4&&end>run.last_position)return [run.last_position,end];
 return null;
}
