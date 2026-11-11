import test from 'node:test';
import assert from 'node:assert/strict';
import {emailCampaignInternals} from './src/email-campaigns.js';
test('draft validation and branded personalized template escape content',()=>{
 const draft=emailCampaignInternals.normalizeDraft({semesterStart:'2026-11-15',semesterEnd:'2026-12-17',subject:'فصل جديد',preheader:'الجدول جاهز',headline:'بداية جديدة',intro:'مرحبًا بكم',buttonLabel:'الاطلاع على جدولي'}),html=emailCampaignInternals.template(draft,{firstName:'مريم <script>',courses:[{name:'التصميم التجريبي <img>'}]});
 assert.match(html,/sulukera-logo\.png/);assert.match(html,/background:#fff;text-align:center;border-bottom/);assert.match(html,/direction:rtl;text-align:right/);assert.match(html,/15 نوفمبر 2026/);assert.match(html,/17 ديسمبر 2026/);assert(!html.includes('2026-11-15'));assert.match(html,/>سلوكيرا<\/strong>/);assert(!html.includes('فريق أكاديمية سلوكيرا'));assert.match(html,/https:\/\/acd\.sulukera\.com/);assert(!html.includes('<script>'));assert(!html.includes('<img>'));assert.match(html,/مريم &lt;script&gt;/);
});
test('professional enrollment exclusion only follows active-like records',()=>{assert.equal(emailCampaignInternals.activeProfessional({organizational_behavior:{status:'active'}}),true);assert.equal(emailCampaignInternals.activeProfessional({organizational_behavior:{status:'withdrawn'}}),false);assert.equal(emailCampaignInternals.activeProfessional(null),null);});
test('invalid or empty campaign copy is rejected',()=>{assert.throws(()=>emailCampaignInternals.normalizeDraft({semesterStart:'2026-12-17',semesterEnd:'2026-11-15'}),/INVALID_SEMESTER/);});
test('single-course restrictions prevent batch-wide course leakage',()=>{const student={planType:'QBA',allowedCourseKeys:['course_14']};assert.equal(SulukeraAcademicPolicy.subjectAllowed(student,{courseKey:'course_14',semesterNo:5}),true);assert.equal(SulukeraAcademicPolicy.subjectAllowed(student,{courseKey:'course_16',semesterNo:6}),false);});
