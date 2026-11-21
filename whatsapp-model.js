(function(root){
  const digits=value=>String(value||'').replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c<='٩'?1632:1776)));
  function phone(value,country='966'){
    let raw=digits(value).trim(),code=digits(country).replace(/^\+/,'');
    if(!/^[1-9]\d{0,3}$/.test(code)||!raw||/[^\d+\s().-]/.test(raw))return '';
    raw=raw.replace(/[\s().-]/g,'');
    if(raw.startsWith('00'))raw='+'+raw.slice(2);
    if(raw.startsWith('+'))raw=raw.slice(1);
    else if(raw.startsWith('0'))raw=code+raw.slice(1);
    else if(code==='966'&&/^5\d{8}$/.test(raw))raw=code+raw;
    if(!/^[1-9]\d{7,14}$/.test(raw))return '';
    if(raw.startsWith('966')&&!/^9665\d{8}$/.test(raw))return '';
    return raw;
  }
  const personalize=(text,student)=>String(text).replace(/\{الاسم\}/g,student.name).replace(/\{الرقم_الطلابي\}/g,student.id||'');
  function queue(rows,selected,text){
    const seen=new Map(),out=[];
    for(const row of rows){
      if(!selected.has(row.key)||!row.eligible||!row.phone)continue;
      if(seen.has(row.phone)){seen.get(row.phone).sharedNames.push(row.name);continue;}
      const item={...row,text:personalize(text,row),sharedNames:[row.name],status:'pending'};
      seen.set(row.phone,item);out.push(item);
    }
    return out;
  }
  function link(item){return 'https://web.whatsapp.com/send?phone='+encodeURIComponent(item.phone)+'&text='+encodeURIComponent(item.text);}
  root.SulukeraWhatsApp={phone,personalize,queue,link};
  if(typeof module!=='undefined')module.exports=root.SulukeraWhatsApp;
})(globalThis);
