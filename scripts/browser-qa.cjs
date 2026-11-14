const {chromium}=require(process.env.MORTI_PLAYWRIGHT || 'playwright');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.MORTI_BROWSER||'/opt/brave.com/brave/brave',args:['--no-sandbox','--allow-file-access-from-files','--disable-dev-shm-usage','--disable-crash-reporter','--disable-breakpad']});
 const page=await browser.newPage({viewport:{width:1440,height:1200}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file://'+path.resolve(process.env.MORTI_HTML || 'index.html')+'?qa=1');await page.waitForFunction(()=>window.__morti?.morti,undefined,{timeout:15000});await page.screenshot({path:'artifacts/start.png',fullPage:true});
 await page.click('#start');await page.waitForTimeout(300);
 const initial=await page.evaluate(()=>{const s=window.__morti;return {x:s.morti.x,hidden:!s.bomb.visible,started:s.started};});
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(900);await page.keyboard.up('ArrowRight');await page.keyboard.press('Space');await page.waitForTimeout(300);
 const moved=await page.evaluate(()=>({x:window.__morti.morti.x,y:window.__morti.morti.y,score:window.__morti.score}));
 await page.screenshot({path:'artifacts/game.png',fullPage:true});
 if(!initial.hidden||!initial.started||moved.x<=initial.x||moved.score<=0)throw Error('Movement / pickup / hidden boss failed: '+JSON.stringify({initial,moved}));
 await page.click('#pause');if(!await page.locator('#pause-screen').isVisible())throw Error('Pause missing');await page.click('#resume');
 // Real encounter updates and collision detection, with controlled positioning for repeatability.
 await page.evaluate(()=>{const s=window.__morti;s.morti.setPosition(12700,560).setVelocity(0,0);});await page.waitForTimeout(300);
 for(let n=1;n<=3;n++){
  await page.evaluate(()=>{const s=window.__morti;s.morti.setPosition(13020,575).setVelocity(0,0);s.bomb.setPosition(13230,577).setVelocity(0,0);s.chase='dizzy';s.stateUntil=s.playTime+100000;});
  await page.waitForTimeout(180);
  await page.evaluate(()=>{window.__morti.chase='chase';window.__morti.stateUntil=0});
  await page.waitForFunction(()=>window.__morti.chase==='pounce',undefined,{timeout:3000});
  await page.keyboard.down('Space');await page.waitForTimeout(50);await page.keyboard.up('Space');
  await page.waitForFunction(n=>window.__morti.crashes===n,n,{timeout:3000});
 }
 const won=await page.evaluate(()=>({state:window.__morti.chase,count:window.__morti.crashes}));if(won.state!=='defeated')throw Error('Boss did not yield');
 await page.evaluate(()=>{window.__morti.morti.setPosition(14100,460).setVelocity(0,0);});await page.waitForTimeout(200);if(!await page.locator('#finish-screen').isVisible())throw Error('Feast did not finish');
 await page.screenshot({path:'artifacts/finish.png',fullPage:true});
 await page.click('#again');await page.waitForTimeout(500);const reset=await page.evaluate(()=>({score:window.__morti.score,boss:window.__morti.chase,started:window.__morti.started}));if(reset.score!==0||reset.boss!=='hidden'||!reset.started)throw Error('Restart broken: '+JSON.stringify(reset));
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/mobile.png',fullPage:true});
 console.log(JSON.stringify({initial,moved,won,reset,errors}));await browser.close();if(errors.length)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1)});
