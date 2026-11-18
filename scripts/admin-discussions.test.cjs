const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1300, height: 950 } });
    await page.setContent('<html dir="rtl"><body style="font-family:Arial;background:#f5f8fc;padding:20px"><div id="adminDiscussionContent"></div></body></html>');
    await page.addStyleTag({ content: '.card{background:white;padding:22px;margin-bottom:18px;border-radius:14px}.btn{padding:10px;font:inherit;border-radius:8px;border:1px solid #ccd8e8;background:white}.btn-primary{background:#244bea;color:white}' });
    await page.addStyleTag({ path: 'admin-discussions.css' });
    await page.evaluate(() => {
      window.currentUser = { role: 'admin' };
      window.cwEscape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
      window.tasks = [
        { key: 'one', version: 'v1', kind: 'discussion', lessonId: 'l1', studentKey: 's1', subjectKey: 'subject1', subjectName: 'بروتوكولات التقييم', batch: 'Q3', week: 4, studentName: 'رقية', studentId: 'SUL-087', prompt: 'اشرح المفهوم', answer: 'إجابة الطالب كاملة <script>unsafe</script>', max: 6 },
        { key: 'two', version: 'v2', kind: 'discussion', lessonId: 'l2', studentKey: 's2', attemptId: 'attempt2', subjectKey: 'subject2', subjectName: 'برمجة اكتساب المهارات', batch: 'Q2', week: 2, studentName: 'خديجة', studentId: 'SUL-020', prompt: 'اشرح المهارة', answer: 'مشاركة جديدة للتحسين', max: 6, referral: { status: 'open', reason: 'تحتاج مراجعة الإدارة' } },
      ];
      window.failed = false;
      window.writes = [];
      window.cwApi = async (path, body) => {
        if (path === '/review-queue') return { tasks: tasks.slice(0, 1), referrals: tasks.slice(1) };
        if (failed) throw Error('NETWORK_ERROR');
        writes.push(body);
        return { synced: true };
      };
      window.navTo = page => { window.destination = page; };
    });
    await page.addScriptTag({ path: 'admin-discussions.js' });
    await page.evaluate(() => renderAdminDiscussions());
    assert.equal(await page.locator('[data-ad-task]').count(), 2);
    assert.equal(await page.locator('.ad-text script').count(), 0);
    await page.getByLabel('الدرجة من 6').fill('0');
    await page.getByLabel('ملاحظة للطالب (اختياري)').fill('تعليق محفوظ');
    await page.evaluate(() => { failed = true; });
    await page.getByRole('button', { name: 'حفظ والانتقال للتالي' }).click();
    await page.waitForFunction(() => document.getElementById('adStatus').textContent.includes('NETWORK_ERROR'));
    assert.equal(await page.getByLabel('ملاحظة للطالب (اختياري)').inputValue(), 'تعليق محفوظ');
    await page.locator('[data-ad-task="1"]').click();
    await page.locator('[data-ad-task="0"]').click();
    assert.equal(await page.getByLabel('الدرجة من 6').inputValue(), '0');
    await page.evaluate(() => { failed = false; });
    await page.getByRole('button', { name: 'حفظ والانتقال للتالي' }).click();
    await page.waitForFunction(() => writes.length === 1 && document.querySelectorAll('[data-ad-task]').length === 1);
    assert.deepEqual(await page.evaluate(() => [writes[0].score, writes[0].queueReview, writes[0].sourceSubmittedAt]), [0, true, 'v1']);
    await page.getByLabel('الدرجة من 6').fill('6');
    await page.screenshot({ path: '.tools/admin-discussions-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: '.tools/admin-discussions-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'حفظ والانتقال للتالي' }).click();
    await page.waitForFunction(() => writes.length === 2);
    assert.equal(await page.evaluate(() => writes[1].attemptId), 'attempt2');
    assert.match(await page.locator('body').innerText(), /اكتمل رصد جميع المناقشات/);
    await page.evaluate(() => { currentUser = { role: 'student' }; document.getElementById('adminDiscussionContent').innerHTML = ''; });
    await page.evaluate(() => renderAdminDiscussions());
    assert.equal(await page.locator('#adminDiscussionContent').innerHTML(), '');
    console.log('PASS admin review entry, referrals, zero grade, version guard, improvement attempt, draft recovery, mobile layout, student exclusion');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
