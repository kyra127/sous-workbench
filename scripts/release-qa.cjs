const { chromium } = require('playwright');
(async()=>{
  const browser = await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page = await browser.newPage({viewport:{width:393,height:852}});
  const errors=[];
  page.on('console',m=>{if(m.type()==='error') errors.push('console: '+m.text())});
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  await page.goto('http://127.0.0.1:8126/?resetAppData=1&firstUse=1',{waitUntil:'networkidle'});
  await page.screenshot({path:'../audit-2026-07-27/13-release-registration.png',fullPage:true});
  const entryVisible=await page.locator('#v30Entry:not([hidden])').isVisible().catch(()=>false);
  if(entryVisible){ await page.locator('#v30BusinessName').fill('Release QA Bakery'); await page.locator('#v30Email').fill('qa@example.com'); await page.locator('#v30EntryForm button[type=submit]').click(); }
  await page.waitForSelector('#sousSetup:not([hidden])'); await page.waitForTimeout(200);
  const industry={count:await page.locator('#v7TemplateGrid [data-v7-template]').count(),activeCount:await page.locator('#sousSetup .setup-progress span.on').count(),otherCount:await page.locator('#v7TemplateGrid [data-v7-template="blank"]').count(),otherSelected:await page.locator('#v7TemplateGrid [data-v7-template="blank"]').getAttribute('aria-pressed')};
  await page.screenshot({path:'../audit-2026-07-27/14-release-industry.png',fullPage:true});
  await page.locator('#v7TemplateGrid [data-v7-template="bakery"]').click(); await page.locator('[data-v7-preview]').click(); await page.waitForTimeout(150);
  const productStep={activeCount:await page.locator('#sousSetup .setup-progress span.on').count(),label:await page.locator('#v7StepLabel').innerText()};
  await page.setViewportSize({width:320,height:568}); await page.locator('[data-v7-import]').scrollIntoViewIfNeeded();
  const importBox=await page.locator('[data-v7-import]').boundingBox();
  const scrollState=await page.evaluate(()=>({height:document.documentElement.scrollHeight,viewport:innerHeight,top:document.querySelector('[data-v7-import]')?.getBoundingClientRect().top,bottom:document.querySelector('[data-v7-import]')?.getBoundingClientRect().bottom}));
  await page.screenshot({path:'../audit-2026-07-27/15-release-products-320.png'}); await page.locator('[data-v7-import]').click(); await page.waitForTimeout(500); await page.setViewportSize({width:393,height:852});
  const nav=await page.locator('nav.tabs [data-page]').evaluateAll(nodes=>nodes.map(n=>({label:n.getAttribute('aria-label'),current:n.getAttribute('aria-current'),height:n.getBoundingClientRect().height})));
  const pricing=await page.locator('#statRevenue').innerText();
  await page.locator('header.top .account-settings').click(); await page.waitForTimeout(250);
  const settings={deleteCount:await page.locator('[data-workspace-delete]').count(),renameCount:await page.locator('[data-workspace-rename]').count(),importCount:await page.locator('[data-sous-import]').count(),defaultHidden:await page.locator('#prefDelivery').evaluate(el=>el.closest('.card').getBoundingClientRect().height===0),industryText:await page.locator('[data-v29-workspace] small').first().innerText()};
  await page.screenshot({path:'../audit-2026-07-27/16-release-settings.png',fullPage:true}); await page.locator('#page-settings .back-chip').click(); await page.waitForTimeout(100);
  const returnedPage=await page.locator('.page.on').getAttribute('id');
  await page.evaluate(()=>go('prep')); await page.waitForTimeout(100);
  const prepDisabled=await page.locator('#page-prep button').filter({hasText:'生成备货摘要'}).isDisabled().catch(()=>null);
  await page.evaluate(()=>go('content')); await page.waitForTimeout(100);
  const contentAdvanced=await page.locator('details.sous-content-advanced').count();
  const duplicateApi=await page.evaluate(()=>({available:!!window.sousDuplicateGuard,exact:window.sousDuplicateGuard?.compare({sourceImages:[{fingerprint:'same'}]},{id:1,sourceImages:[{fingerprint:'same'}]})?.score||0,visual:window.sousDuplicateGuard?.compare({sourceImages:[{visualHash:'0123456789abcdef'.repeat(4)}]},{id:2,sourceImages:[{visualHash:'0123456789abcdef'.repeat(4)}]})?.score||0}));
  console.log(JSON.stringify({entryVisible,industry,productStep,importBox,scrollState,nav,pricing,settings,returnedPage,prepDisabled,contentAdvanced,duplicateApi,errors},null,2));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});



