/* Supplemental templates do not change lesson progress, attendance or grades. */
function professionalSheetResources(session){
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 return Object.values(session?.sheetResources||{}).filter(r=>r&&/^[a-zA-Z0-9_-]{20,100}$/.test(r.fileId||'')&&String(r.title||'').trim()).map(r=>{
  const base='https://docs.google.com/spreadsheets/d/'+r.fileId;
  return `<section class="pro-sheet-resource" style="margin-top:12px;padding:16px;border:1px solid #b9d9cf;border-radius:14px;background:linear-gradient(135deg,#effaf5,#f5f8ff);line-height:1.9"><strong style="display:block;color:#105b43;font-size:15px">▤ ${escape(r.title)}</strong><p style="margin:5px 0 12px;font-size:13px;color:#344c5d">أداة تطبيقية للقاء. سجّل الدخول بحساب Google لإنشاء نسختك الخاصة وتعديلها، دون تغيير الملف الأصلي.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn-out" href="${base}/preview" target="_blank" rel="noopener noreferrer">معاينة الأداة</a><a class="btn-out" style="background:#106c4b;color:white;border-color:#106c4b" href="${base}/copy" target="_blank" rel="noopener noreferrer">إنشاء نسختي من الأداة ↗</a></div></section>`;
 }).join('');
}
