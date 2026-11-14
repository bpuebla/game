// Executes the real Phaser Canvas renderer under a simulated DOM. This catches
// engine boot/physics errors and captures game frames; it is NOT browser QA.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require(process.env.MORTI_JSDOM||'jsdom');
const native=require(process.env.MORTI_CANVAS||'@napi-rs/canvas');
for(const [file,alias]of [['/usr/share/fonts/truetype/croscore/Arimo-Regular.ttf','Arial'],['/usr/share/fonts/truetype/croscore/Arimo-Bold.ttf','Arial'],['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','DM Sans']])if(fs.existsSync(file))native.GlobalFonts.registerFromPath(file,alias);
const frames=new WeakMap(),errors=[];
const virtual=new VirtualConsole();virtual.on('jsdomError',e=>{errors.push(e.message);console.error(e.stack||e.message)});virtual.on('error',console.error);
const dom=new JSDOM(fs.readFileSync(process.env.MORTI_HTML||'index.html','utf8'),{
 url:'file:///tmp/standalone-morti.html?qa=1',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:virtual,
 beforeParse(w){
  w.focus=()=>{};w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});
  for(const dim of ['width','height']){const original=Object.getOwnPropertyDescriptor(w.HTMLCanvasElement.prototype,dim);Object.defineProperty(w.HTMLCanvasElement.prototype,dim,{get:original.get,set(value){original.set.call(this,value);const rec=frames.get(this);if(rec)rec.canvas[dim]=value;}});}
  w.Image=native.Image;w.CanvasRenderingContext2D=native.createCanvas(1,1).getContext('2d').constructor;w.FORCE_CANVAS=true;
  w.HTMLCanvasElement.prototype.getContext=function(kind,opts){
   if(kind!=='2d')return null;
   let record=frames.get(this);if(!record){const canvas=native.createCanvas(this.width||300,this.height||150);const ctx=canvas.getContext('2d');const draw=ctx.drawImage.bind(ctx);ctx.drawImage=(image,...args)=>draw(frames.get(image)?.canvas||image,...args);const pattern=ctx.createPattern.bind(ctx);ctx.createPattern=(image,...args)=>pattern(frames.get(image)?.canvas||image,...args);record={canvas,ctx};frames.set(this,record);}
   if(record.canvas.width!==this.width)record.canvas.width=this.width;if(record.canvas.height!==this.height)record.canvas.height=this.height;return record.ctx;
  };
  w.HTMLCanvasElement.prototype.toDataURL=function(){this.getContext('2d');return frames.get(this).canvas.toDataURL('image/png')};
  w.HTMLElement.prototype.getBoundingClientRect=function(){return {x:0,y:0,left:0,top:0,right:1280,bottom:720,width:1280,height:720,toJSON(){}}};
  Object.defineProperty(w.HTMLElement.prototype,'clientWidth',{get(){return 1280}});Object.defineProperty(w.HTMLElement.prototype,'clientHeight',{get(){return 720}});
 }
});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 for(let i=0;i<150&&!dom.window.__morti?.morti;i++)await wait(100);
 const w=dom.window,s=w.__morti;
 assert.ok(s?.morti,'Real Phaser scene must finish creating; errors: '+errors.join('; '));
 const canvas=w.document.querySelector('#game canvas');assert.ok(canvas,'Game canvas exists');
 fs.mkdirSync('artifacts',{recursive:true});
 const screenshot=name=>{fs.writeFileSync('artifacts/'+name+'.png',frames.get(canvas).canvas.toBuffer('image/png'))};
 s.game.loop.stop();let clock=1000;
 if(process.env.MORTI_BENCH_ONLY){const start=performance.now();for(let i=0;i<30;i++)s.game.step(clock+=1000/60,1000/60);console.log(JSON.stringify({meanRenderMs:(performance.now()-start)/30,displayObjects:s.children.list.length,tweens:s.tweens.getTweens().length}));dom.window.close();process.exit(0);}
 const advance=ms=>{for(let i=0;i<Math.ceil(ms/(1000/60));i++){clock+=1000/60;s.game.headlessStep(clock,1000/60)}};
 const capture=name=>{s.cameras.main.centerOn(s.morti.x,s.morti.y-95);s.game.step(clock+=1000/60,1000/60);screenshot(name)};
 capture('runtime-start');
 w.document.getElementById('start').click();advance(300);
 const start=s.morti.x;s.cursors.right.isDown=true;advance(900);s.cursors.right.isDown=false;advance(200);
 assert.ok(s.morti.x>start+100,'Real physics moves Morti');assert.ok(s.score>0,'Actual overlap awards jamón');
 capture('runtime-game');
 s.togglePause();const pauseTime=s.playTime;advance(150);assert.equal(s.playTime,pauseTime,'Pause freezes gameplay time');s.togglePause();
 // Canelo walks in every zone and physically carries a stationary passenger.
 assert.equal(s.canelos.length,3);
 const cat=s.canelos[0].sprite;cat.setPosition(1600,552).setVelocityX(60);
 const catTop=cat.body.top;s.morti.setPosition(1600,catTop-42).setVelocity(0,0);advance(150);
 const rideX=s.morti.x,catX=cat.x;advance(400);
 assert.ok(Math.abs(cat.x-catX)>15,'Canelo keeps walking');assert.ok(Math.abs(s.morti.x-rideX)>10,'Canelo carries Morti');
 // A real floor puddle triggers the upside-down skid and then releases control.
 s.morti.setPosition(4500,575).setVelocity(180,0);advance(150);
 const puddleArt=s.add.container(4500,615);s.puddles.push({x:s.morti.x,until:s.playTime+3000,art:puddleArt,armed:true});advance(30);
 assert.equal(s.morti.flipY,true);assert.ok(Math.abs(s.morti.body.velocity.x)>600);capture('runtime-pee');
 advance(1100);assert.equal(s.morti.flipY,false,'Skid recovers upright');
 s.puddles.forEach(p=>p.art.destroy());s.puddles=[];s.morti.setPosition(500,575).setVelocity(0,0);advance(100);
 // Drive the house continuously with the same real keyboard state and physics.
 s.cursors.right.isDown=true;let pulse=false,falls=0,previousX=s.morti.x;const trace=[];
 for(let frame=0;frame<10000&&s.morti.x<12620;frame++){
  const body=s.morti.body,feet=body.bottom;
  const obstacle=s.platforms.getChildren().some(p=>p.body.x>s.morti.x&&p.body.x-s.morti.x<190&&p.body.y<feet-8&&p.body.y>feet-155);
  const pit=[[3910,4060],[6900,7060],[8980,9150]].some(([a,b])=>s.morti.x>a-90&&s.morti.x<b);
  const shouldJump=body.blocked.down&&(obstacle||pit||body.blocked.right);
  s.cursors.space.isDown=shouldJump&&!pulse;pulse=s.cursors.space.isDown;
  if(process.env.MORTI_TRACE&&s.morti.x>10600&&trace.length<50&&(pulse||body.blocked.right||frame%20===0))trace.push({frame,x:s.morti.x,y:s.morti.y,feet,down:body.blocked.down,jump:pulse,vy:body.velocity.y,skid:s.skidUntil>s.playTime});
  advance(1000/60);
  if(s.morti.x<previousX-300)falls++;previousX=s.morti.x;
 }
 s.cursors.right.isDown=false;s.cursors.space.isDown=false;
 console.log({traversalX:s.morti.x,falls,score:s.score,...(process.env.MORTI_TRACE?{trace}:{})});
 assert.ok(s.morti.x>=12600,'Entire furniture route must be traversable');
 advance(200);assert.notEqual(s.chase,'hidden');
 const previousPosition={x:s.morti.x,y:s.morti.y};s.paused=true;s.physics.pause();s.encounterText.setVisible(false);s.encounterPanel.setVisible(false);
 for(const [name,x]of [['stairs',3960],['hallway',4900],['kitchen',9750]]){s.morti.body.reset(x,500);capture('runtime-'+name);}
 s.morti.body.reset(previousPosition.x,previousPosition.y);s.paused=false;s.physics.resume();s.encounterText.setVisible(true);s.encounterPanel.setVisible(true);
 // Camping on either stool or outside the bait zone must never start a charge.
 for(const x of [12830,13550,12730,13700]){
  s.morti.setPosition(x,x===12830||x===13550?485:575).setVelocity(0,0);s.bomb.setPosition(13200,577).setVelocity(0,0);s.chase='chase';s.stateUntil=0;
  advance(2500);assert.equal(s.crashes,0,'Camping must not earn a win');assert.notEqual(s.chase,'pounce','Camping must not trigger charges');
 }
 for(let n=1;n<=3;n++){
  // Stand on the floor inside, wait for the windup, then jump the actual charge.
  s.morti.setPosition(13020,575).setVelocity(0,0);s.bomb.setPosition(13230,577).setVelocity(0,0);s.chase='dizzy';s.stateUntil=s.playTime+100000;advance(150);
  s.chase='chase';s.stateUntil=0;advance(20);assert.equal(s.chase,'windup','Floor bait starts windup');
  for(let frame=0;frame<40&&s.chase!=='pounce';frame++)advance(1000/60);
  assert.equal(s.chase,'pounce','Windup becomes a real fast charge');assert.equal(Math.abs(s.bomb.body.velocity.x),950);
  s.cursors.space.isDown=true;advance(20);s.cursors.space.isDown=false;advance(500);
  assert.equal(s.crashes,n,'Successful jump earns exactly one stool crash');
 }
 capture('runtime-finale');assert.equal(s.chase,'defeated');
 s.morti.setPosition(14100,460).setVelocity(0,0);advance(150);assert.ok(s.finished,'Actual update finishes at feast');
 w.document.getElementById('again').click();advance(100);await wait(250);advance(500);const reset=w.__morti;assert.equal(reset.score,0);assert.equal(reset.chase,'hidden');assert.equal(reset.started,true);assert.equal(errors.length,0,'No uncaught runtime errors');
 console.log(JSON.stringify({renderer:'real Phaser Canvas under simulated DOM',moved:s.morti.x>start,score:s.score,crashes:s.crashes,restart:true,errors}));dom.window.close();process.exit(0);
})().catch(e=>{console.error(e);dom.window.close();process.exit(1)});
