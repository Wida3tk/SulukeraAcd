// The October 2026 sheet inserted a VAT column before the net amount; columns are now found by header labels.
const assert=require('node:assert/strict');require('../revenue-model.js');
const pad=()=>Array(6).fill(null).map(()=>[]),headerOld=['#','التاريخ',null,'الأسبوع',null,'التصنيف',null,null,'المنتج',null,null,null,null,null,'مرجع الطلب',null,'المبيعات شامل الضريبة',null,'المبيعات بدون الضريبة',null,'منصة البيع'];
const headerNew=['#','التاريخ',null,'الأسبوع',null,'التصنيف',null,null,'المنتج',null,null,null,null,null,'مرجع الطلب',null,'المبيعات شامل الضريبة',null,'الضريبة','المبيعات بدون الضريبة',null,'منصة البيع'];
const old=[...pad(),headerOld,[1,'2026-09-03',null,'الأسبوع الأول',null,'الإشراف - تحصيل',null,null,'قسط',null,null,null,null,null,11,null,115,null,100,null,'PayTabs']];
const vat=[...pad(),headerNew,[1,'2026-10-03',null,'الأسبوع الأول',null,'التعليم المستمر',null,null,'دورة',null,null,null,null,null,12,null,230,null,30,200,null,'عصارة']];
const p=SulukeraRevenue.parse({sheets:{'سبتمبر 26':old,'اكتوبر 26':vat}});
assert.deepEqual(p.periods.map(x=>x.month).sort(),['2026-09','2026-10']);
const oct=p.periods.find(x=>x.month==='2026-10').rows[0],sep=p.periods.find(x=>x.month==='2026-09').rows[0];
assert.equal(oct.net,200);assert.equal(oct.gross,230);assert.equal(oct.platform,'عصارة');assert.equal(oct.reference,'12');assert.equal(oct.state,'included');
assert.equal(sep.net,100);assert.equal(sep.kind,'collection');assert.equal(sep.platform,'PayTabs');
assert.equal(p.issues.filter(i=>/تخطيط قديم/.test(i.reason)).length,0);
console.log('revenue VAT column: ok');
