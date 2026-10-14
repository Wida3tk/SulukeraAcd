const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const context={escapeHtml:v=>String(v).replaceAll('<','&lt;')};vm.createContext(context);vm.runInContext(fs.readFileSync('professional-exam-results-ui.js','utf8'),context);
assert.equal(context.professionalApprovedResultsMarkup({e:{score:18,approved:false,evaluated:false}}),'');
assert.equal(context.professionalApprovedResultsMarkup({e:{score:18,approved:true,evaluated:false}}),'');
const html=context.professionalApprovedResultsMarkup({e:{title:'الوحدة الأولى',score:18,approved:true,evaluated:true,passed:true}});assert.match(html,/18/);assert.match(html,/نتيجة معتمدة بعد إكمال التقييم/);assert.match(html,/أعلى درجة محفوظة/);
console.log('PASS official profile displays only evaluated, approved professional results');
