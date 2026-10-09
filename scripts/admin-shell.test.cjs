const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {
  chromium
}
=require('playwright');
(async()=>{
  const html=fs.readFileSync('index.html','utf8');for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script\s*>/gi))if(match[1].trim())new vm.Script(match[1]);new vm.Script(fs.readFileSync('admin-shell.js','utf8'));  const browser=await chromium.launch({
    channel:'msedge',headless:true
  }
  );try{
    const page=await browser.newPage({
      viewport:{
        width:1440,height:1100
      }
    }
    ),errors=[];page.on('pageerror',e=>errors.push(e.message));  await page.route('**/*',route=>{
      const url=new URL(route.request().url());if(url.hostname==='admin.test'){
        const file=path.resolve(url.pathname==='/'?'index.html':url.pathname.slice(1));if(!file.startsWith(process.cwd()+path.sep)||!fs.existsSync(file))return route.abort();return route.fulfill({
          body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'
        }
        );
      }
      if(url.hostname==='www.gstatic.com')return route.fulfill({
        contentType:'text/javascript',body:"window.firebase=window.firebase||{initializeApp(){},auth(){return {currentUser:null,signOut:async()=>{}}},database(){throw Error('unexpected backend access in visual tests')}}"
      }
      );return route.abort();
    }
    );  await page.goto('https://admin.test/',{
      waitUntil:'load'
    }
    );assert.equal(await page.locator('#loginScreen').isVisible(),true);assert.equal(await page.locator('#appShell').isVisible(),false);assert.deepEqual(errors,[]);  await page.evaluate(()=>{
      currentUser={
        role:'admin',name:'فريق الإدارة',username:'fixture'
      }
      ;students=[{
        id:'001',_fbKey:'s1',firstName:'طالب تجريبي',email:'fixture@example.invalid',phone:'000',program:'شهادة تحليل السلوك التطبيقي',track:'QBA',batch:'Q1',accountStatus:'active',totalAmount:1
      }
      ,{
        id:'002',_fbKey:'s2',firstName:'طالب تجريبي',batch:'Q2',accountStatus:'withdrawn'
      }
      ];subjects=[{
        _fbKey:'c1',name:'مقرر تجريبي',batch:'Q1',students:[0],lecturerUserId:'fixture-lecturer'
      }
      ];grades={
      }
      ;scheduleData={
        weekly:{
        }
      }
      ;examSchedulesData={
      }
      ;semestersData={
      }
      ;examExceptionsData={
      }
      ;studentRequestsData=[{
        id:'r1',type:'academic',status:'pending',studentKey:'s1',createdAt:'2026-10-09'
      }
      ];advisorCasesData=[];document.getElementById('sidebarUserName').textContent=currentUser.name;document.getElementById('sidebarUserRole').textContent='مدير النظام';document.getElementById('loginScreen').style.display='none';document.getElementById('appShell').style.display='block';renderNav();renderAdminDashboard();document.getElementById('page-dashboard').classList.add('active');refreshPage=()=>{
      }
      ;navTo('dashboard',null);
    }
    );  assert.equal(await page.locator('.ops-kpi').first().locator('.ops-kpi-value').textContent(),'1');assert.equal(await page.locator('.admin-quick-access button').count(),6);assert.equal(await page.locator('.sidebar').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(16, 29, 58)');assert.equal(await page.locator('.sidebar-footer .sidebar-user').count(),1);  const ids=await page.evaluate(()=>['dashboard',...adminNavGroups.flatMap(g=>g.items.map(i=>i.id))]);assert.equal(new Set(ids).size,ids.length);for(const id of ids){
      await page.evaluate(id=>navTo(id,null),id);assert.equal(await page.locator(`.nav-item[data-page-id="${id}"]`).getAttribute('aria-current'),'page');if(id!=='dashboard'){
        const active=page.locator('.nav-group').filter({
          has:page.locator(`.nav-item[data-page-id="${id}"]`)
        }
        );assert.equal(await active.locator('.nav-group-head').getAttribute('aria-expanded'),'true');await active.locator('.nav-group-head').click();assert.equal(await active.locator('.nav-group-head').getAttribute('aria-expanded'),'true');
      }
    }
    await page.keyboard.press('Control+k');await page.locator('#adminCommandQuery').fill('الأداء');assert.equal(await page.locator('.admin-command-results button').count(),1);await page.keyboard.press('Enter');assert.equal(await page.locator('.admin-command').evaluate(n=>n.open),false);assert.equal(await page.locator('.nav-item[data-page-id=performance]').getAttribute('aria-current'),'page');  await page.keyboard.press('Control+k');await page.locator('#adminCommandQuery').fill('does-not-exist');assert.equal(await page.locator('.admin-command-results button').count(),0);await page.keyboard.press('Escape');  await page.evaluate(()=>navTo('dashboard',null));for(const width of [1440,1280,1024,768,390]){
      await page.setViewportSize({
        width,height:1100
      }
      );await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Overflow at ${width}`);await page.screenshot({
        path:`.tools/executive-navy-${width}.png`,fullPage:true
      }
      );
    }
    await page.locator('#adminMenuToggle').click();assert.equal(await page.locator('.admin-nav-shade').isVisible(),true);assert.equal(await page.locator('.sidebar').evaluate(n=>n.inert),false);await page.screenshot({
      path:'.tools/executive-navy-mobile-drawer.png',fullPage:true
    }
    );await page.locator('.admin-drawer-close').click();assert.equal(await page.locator('.sidebar').evaluate(n=>n.inert),true);  await page.setViewportSize({
      width:1440,height:1100
    }
    );await page.waitForTimeout(250);await page.locator('#adminMenuToggle').click();await page.locator('#adminMenuToggle').click();await page.waitForTimeout(250);assert.equal(await page.locator('.sidebar').evaluate(n=>Math.round(n.getBoundingClientRect().width)),76);await page.locator('.nav-item[data-page-id=performance]').click();assert.equal(await page.locator('.nav-item[data-page-id=performance]').getAttribute('aria-current'),'page');await page.locator('#adminMenuToggle').click();  await page.evaluate(()=>{
      renderAdminDashboard();renderAdminDashboard();
    }
    );assert.equal(await page.locator('.admin-quick-access').count(),1);assert.equal(await page.locator('.admin-context').count(),1);  for(const role of ['lecturer','finance','student']){
      await page.evaluate(role=>{
        currentUser={
          role,name:'اختبار'
        }
        ;renderNav();
      }
      ,role);assert.equal(await page.locator('body').evaluate(n=>n.classList.contains('admin-shell')),false);assert.equal(await page.locator('.admin-tools').isVisible(),false);
    assert.equal(await page.locator('.sidebar-logo + .sidebar-user').count(),1);assert.equal(await page.locator('.admin-menu-toggle').isVisible(),false);
    }
    assert.deepEqual(errors,[]);console.log(`PASS: full HTML, real dashboard fixture counts, ${ids.length} existing routes, active accordions, Ctrl K keyboard search, five widths, mobile drawer, icon rail, role isolation, repeat renders; no backend writes`);
  }
  finally{
    await browser.close();
  }
}
)().catch(e=>{
  console.error(e);process.exitCode=1;
}
);
