/* Actual meeting time is kept separately from manually entered hours. */
(function(root){
  function meetingRecord(lecturer,meeting,source={}){
    const start=Date.parse(meeting?.start),end=Date.parse(meeting?.end);
    if(!lecturer||!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>86400000||meeting.source!=='zoom_meeting_summary')throw Error('INVALID_PRODUCTIVITY_MEETING');
    const safe=String(lecturer).replace(/[.#$\[\]/]/g,'_');
    const key=`meeting_${start}`;
    const period=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit'}).format(new Date(start));
    return {username:safe,period,key,path:`lecturerProductivity/${period}/${safe}/meetings/${key}`,record:{...source,startsAt:new Date(start).toISOString(),endsAt:new Date(end).toISOString(),durationMinutes:(end-start)/60000,source:'zoom_meeting_summary'}};
  }
  function automaticHours(record){return Object.values(record?.meetings||{}).reduce((sum,m)=>sum+(Math.max(0,Number(m.durationMinutes)||0)/60),0);}
  root.SulukeraProductivity={meetingRecord,automaticHours};
})(globalThis);
