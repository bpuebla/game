import Phaser from 'phaser';
import './style.css';
import { ARENA, FLOOR, WORLD, furniture, gaps, roomAt, resolveCrash, collect, resetEncounter, STOOLS, CHARGE_SPEED, CANELO_PATROLS, canChargeAt, type ChaseState, type Furniture } from './rules';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const asset=(name:string)=>(window as unknown as {__mortiAssets?:Record<string,string>}).__mortiAssets?.[name] ?? `assets/${name}`;
let game: Phaser.Game;
let active: House;
let muted = false;
let audio: AudioContext | undefined;
let toastTimer: ReturnType<typeof setTimeout>;
function toast(message: string, duration = 3500) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),duration); }
function tone(frequency: number, duration = .09, shape: OscillatorType = 'sine') {
  if(muted) return; try { audio ??= new AudioContext(); if(audio.state==='suspended') void audio.resume(); const o=audio.createOscillator(), gain=audio.createGain(); o.type=shape; o.frequency.setValueAtTime(frequency,audio.currentTime); o.frequency.exponentialRampToValueAtTime(frequency*.55,audio.currentTime+duration); gain.gain.setValueAtTime(.045,audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration); o.connect(gain).connect(audio.destination);o.start();o.stop(audio.currentTime+duration); }catch{/* Audio is optional. */}
}
function bestScore(value?: number) { try { const old=Number(localStorage.getItem('morti-best')||0);if(value!==undefined)localStorage.setItem('morti-best',String(Math.max(old,value)));return Math.max(old,value??0); }catch{return value??0;} }

class House extends Phaser.Scene {
  morti!: Phaser.Physics.Arcade.Sprite;
  canelos: {sprite:Phaser.Physics.Arcade.Sprite;min:number;max:number}[]=[];
  staticObjects: Phaser.GameObjects.GameObject[]=[];
  staticItems:{object:Phaser.GameObjects.Image;left:number;right:number}[]=[];
  lastProgress=-1;
  scorePopup!: Phaser.GameObjects.Text;
  skidUntil=0; skidDirection=1;
  chargeStartX=0; chargeHitPlayer=false;
  chris!: Phaser.GameObjects.Sprite;
  bomb!: Phaser.Physics.Arcade.Sprite;
  platforms!: Phaser.Physics.Arcade.StaticGroup;
  pickups!: Phaser.Physics.Arcade.StaticGroup;
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  scoreText!: Phaser.GameObjects.Text;
  encounterText!: Phaser.GameObjects.Text;
  encounterPanel!: Phaser.GameObjects.Graphics;
  progress!: Phaser.GameObjects.Graphics;
  collected=new Set<number>(); playTime=0; score=0; started=false; paused=false; finished=false;
  checkpoint={x:170,y:540}; cp=0;
  chase: ChaseState='hidden'; crashes=0; stateUntil=0; pounceDir=1; invulnerable=0; hitUntil=0; lastGround=0; jumpBuffered=0; lastJump=false; lastY=0;
  puddles: {x:number;until:number;art:Phaser.GameObjects.Container;armed:boolean}[]=[];
  puddleAt=0; nextPee=4000; peeUntil=0; chrisX=3000; warned=false;
  touch={left:false,right:false,jump:false}; messages=new Set<string>(); room=''; jamonId=0;
  heroBase={x:1,y:1}; bossBase={x:1,y:1}; caneloBase={x:1,y:1};
  debugMode=new URLSearchParams(location.search).has('qa');
  constructor(){super('House');}
  preload(){this.load.image('characters',asset('characters.png'));this.load.image('room',asset('room.png'));this.load.image('hallway',asset('hallway.png'));this.load.image('kitchen',asset('kitchen.png'));}
  create(){
    active=this;
    this.makeCharacters(); this.makeTextures();
    this.physics.world.setBounds(0,-100,WORLD,950);
    this.staticDraw(()=>this.drawHouse());
    this.platforms=this.physics.add.staticGroup();
    let start=0;for(const [a,b] of gaps){this.addPlatform(start,FLOOR,a-start,80);start=b;}this.addPlatform(start,FLOOR,WORLD-start,80);
    for(const f of furniture){this.staticDraw(()=>this.drawFurniture(f));this.addPlatform(f.x,f.y,f.w,f.kind==='shelf'?22:f.h);}
    this.makeCanelos();
    this.morti=this.physics.add.sprite(170,540,'morti').setDisplaySize(100,88).setDepth(15);
    this.heroBase={x:this.morti.scaleX,y:this.morti.scaleY};
    this.morti.setCollideWorldBounds(false);this.morti.setMaxVelocity(760,850);
    const body=this.morti.body as Phaser.Physics.Arcade.Body; body.setSize(this.morti.width*.48,this.morti.height*.73);body.setOffset(this.morti.width*.28,this.morti.height*.25);
    this.physics.add.collider(this.morti,this.platforms);
    this.physics.add.collider(this.morti,this.canelos.map(c=>c.sprite));
    this.pickups=this.physics.add.staticGroup();this.placeJamon();
    this.physics.add.overlap(this.morti,this.pickups,(_m,j)=>this.eat(j as Phaser.Physics.Arcade.Image));
    this.chris=this.add.sprite(3000,585,'chris').setDisplaySize(82,74).setDepth(10);
    this.bomb=this.physics.add.sprite(13230,570,'bomboniel').setDisplaySize(88,78).setDepth(14).setVisible(false);
    this.bossBase={x:this.bomb.scaleX,y:this.bomb.scaleY};
    const bb=this.bomb.body as Phaser.Physics.Arcade.Body;bb.setSize(this.bomb.width*.6,this.bomb.height*.72);bb.setOffset(this.bomb.width*.25,this.bomb.height*.27);bb.setAllowGravity(false);
    this.physics.add.overlap(this.morti,this.bomb,()=>this.bombHit());
    this.staticDraw(()=>this.drawArena());this.prepareStaticArtwork();this.makeHUD();
    this.cameras.main.setBounds(0,0,WORLD,720).startFollow(this.morti,true,.09,.09,0,95);
    this.cursors=this.input.keyboard!.createCursorKeys();
    this.keys=this.input.keyboard!.addKeys('A,D,W,P,ESC') as Record<string,Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on('keydown-P',()=>this.togglePause());this.input.keyboard!.on('keydown-ESC',()=>this.togglePause());
    this.input.keyboard!.addCapture(['SPACE','UP','DOWN','LEFT','RIGHT']);
    this.bindTouch();
    this.physics.pause();
    $('#loading').classList.add('hidden');
    $<HTMLButtonElement>('#start').disabled=false;
    this.events.once('shutdown',()=>{this.input.keyboard?.removeAllListeners();});
    if(this.debugMode)(window as unknown as {__morti:House}).__morti=this;
  }
  makeCharacters(){
    if(this.textures.exists('morti')) return;
    const source=this.textures.get('characters').getSourceImage() as HTMLImageElement;
    const names=['morti','canelo','chris','bomboniel'];
    names.forEach((name,i)=>{
      const split=Math.floor(source.width*0.4765625),sx=i%2?split:0,w=i%2?source.width-split:split,h=Math.floor(source.height/2),c=document.createElement('canvas');c.width=w;c.height=h;
      const cx=c.getContext('2d')!;cx.drawImage(source,sx,Math.floor(i/2)*h,w,h,0,0,w,h);
      const pixels=cx.getImageData(0,0,w,h).data;let minX=w,minY=h,maxX=0,maxY=0;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[(y*w+x)*4+3]>30){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
      if(maxX<=minX){minX=0;minY=0;maxX=w-1;maxY=h-1;}
      const out=document.createElement('canvas'),cw=maxX-minX+1,ch=maxY-minY+1,scale=Math.min(1,320/Math.max(cw,ch));out.width=Math.ceil(cw*scale)+16;out.height=Math.ceil(ch*scale)+16;out.getContext('2d')!.drawImage(c,minX,minY,cw,ch,8,8,cw*scale,ch*scale);
      this.textures.addCanvas(name,out);
      const url=out.toDataURL();if(name==='morti')$('#hero-art').setAttribute('src',url);
      document.querySelector(`#portrait-${name}`)?.setAttribute('src',url);
      // A small reusable atlas supplies distinct squash/stretch poses for every character.
      const atlas=this.textures.createCanvas(`${name}-poses`,out.width*6,out.height)!;
      const ctx=atlas.context;
      for(let f=0;f<6;f++){const sy=1+Math.sin(f*Math.PI/3)*.035;ctx.save();ctx.translate(f*out.width+out.width/2,out.height-4);ctx.scale(2-sy,sy);ctx.drawImage(out,-out.width/2,-out.height+4);ctx.restore();atlas.add(f,0,f*out.width,0,out.width,out.height);}
      atlas.refresh();this.anims.create({key:`${name}-run`,frames:Array.from({length:6},(_,i)=>({key:`${name}-poses`,frame:i})),frameRate:name==='bomboniel'?16:12,repeat:-1});
    });
  }
  makeTextures(){
    if(this.textures.exists('jamon'))return;
    const g=this.make.graphics({x:0,y:0});
    g.lineStyle(2.5,0x623b31);g.fillStyle(0xc87765);g.fillRoundedRect(5,5,32,23,5);g.strokeRoundedRect(5,5,32,23,5);g.fillStyle(0xf4c4a4);g.fillRoundedRect(9,9,23,14,3);g.lineStyle(2,0xffe2bf);g.beginPath();g.moveTo(11,12);g.lineTo(18,20);g.lineTo(24,11);g.lineTo(30,18);g.strokePath();g.generateTexture('jamon',42,34);g.clear();
    g.fillStyle(0xffffff);g.fillRect(0,0,8,8);g.generateTexture('solid',8,8);g.destroy();
  }
  addPlatform(x:number,y:number,w:number,h:number){const p=this.platforms.create(x+w/2,y+h/2,'solid') as Phaser.Physics.Arcade.Image;p.setDisplaySize(w,h).setVisible(false).refreshBody();return p;}
  drawHouse(){
    const g=this.add.graphics().setDepth(-10);
    g.fillStyle(0xeddfc6);g.fillRect(0,0,WORLD,720);
    for(let r=0;r<3;r++){
      const zone=r*4800,key=['room','hallway','kitchen'][r];
      for(let x=zone;x<zone+4800;x+=1200)this.add.image(x,0,key).setOrigin(0).setDisplaySize(1200,720).setDepth(-9);
      if(r>0){g.fillStyle(0x95724f);g.fillRoundedRect(zone-20,60,40,560,5);}
    }
    // Real descending treads, risers, side walls and a handrail identify every gap.
    const stairs=this.add.graphics().setDepth(3);
    for(const [a,b] of gaps){
      stairs.fillStyle(0x43392e);stairs.fillRect(a,610,b-a,110);
      for(let i=0;i<5;i++){
        const x=a+i*(b-a)/5,y=620+i*18,w=b-x;
        stairs.fillStyle(i%2?0xd6b58b:0xe8cba6);stairs.fillRect(x,y,w,10);
        stairs.lineStyle(2,0x604832);stairs.strokeRect(x,y,w,10);
        stairs.fillStyle(0x9b724f);stairs.fillRect(x,y+10,w,8);
      }
      stairs.lineStyle(5,0x695139);stairs.lineBetween(a+8,582,b-8,659);
      for(let i=0;i<4;i++){const x=a+8+i*(b-a-16)/3,y=582+i*77/3;stairs.lineBetween(x,y,x,y+37);}
      for(const x of [a-9,b+2]){stairs.fillStyle(0xd9a84e);stairs.fillRect(x,610,7,12);}
      this.roundedLabel((a+b)/2,551,'STAIRS ↓',16,9,6);
    }
    for(const [x,t] of [[180,'LIVING ROOM'],[4870,'HALLWAY'],[9660,'KITCHEN']] as const){this.roundedLabel(x,170,t,25,18,10,0,0);}
    this.roundedLabel(270,580,'← → move    ·    SPACE jump',15,8,5);
  }
  drawTextCard(panel:Phaser.GameObjects.Graphics,x:number,y:number,width:number,height:number){
    panel.clear().fillStyle(0xfff8e9,.92).fillRoundedRect(x,y,width,height,Math.min(14,height/2));
    panel.lineStyle(1,0xbea788,.7).strokeRoundedRect(x,y,width,height,Math.min(14,height/2));
  }
  roundedLabel(x:number,y:number,value:string,size:number,padX:number,padY:number,originX=.5,originY=.5){
    const panel=this.add.graphics(),text=this.add.text(0,0,value,{fontFamily:'Georgia',fontSize:`${size}px`,color:'#111111',padding:{x:padX,y:padY}});
    this.drawTextCard(panel,0,0,text.width,text.height);
    return this.add.container(x-text.width*originX,y-text.height*originY,[panel,text]).setDepth(4);
  }
  staticDraw(draw:()=>void){const start=this.children.list.length;draw();this.staticObjects.push(...this.children.list.slice(start).filter(o=>!(o as unknown as {body?:unknown}).body));}
  prepareStaticArtwork(){
    // Explicitly skip offscreen artwork in Canvas as well as WebGL.
    for(const object of this.staticObjects){
      const item=object as Phaser.GameObjects.Image;
      const bounds=item.getData('cullBounds')??(typeof item.getBounds==='function'?item.getBounds():{left:-Infinity,right:Infinity});
      this.staticItems.push({object:item,left:bounds.left,right:bounds.right});
    }
    this.staticObjects=[];this.cullStaticArtwork();this.events.on(Phaser.Scenes.Events.PRE_RENDER,this.cullStaticArtwork,this);
  }
  cullStaticArtwork(){
    const x=this.cameras.main.scrollX,target=this.morti?.x??x+640,left=Math.min(x,target-640)-80,right=Math.max(x+1280,target+640)+80;
    for(const item of this.staticItems)item.object.setVisible(item.right>=left&&item.left<=right);
    if(this.pickups)for(const item of this.pickups.getChildren() as Phaser.Physics.Arcade.Image[])if(item.active)item.setVisible(item.x>=left&&item.x<=right);
  }
  makeCanelos(){
    for(const patrol of CANELO_PATROLS){
      const sprite=this.physics.add.sprite((patrol.min+patrol.max)/2,552,'canelo').setDisplaySize(210,138).setDepth(8).setImmovable(true);
      const body=sprite.body as Phaser.Physics.Arcade.Body;body.setAllowGravity(false);body.setSize(sprite.width*.78,sprite.height*.6);body.setOffset(sprite.width*.14,sprite.height*.375);body.setFriction(1,0);
      sprite.setVelocityX(60);sprite.play('canelo-run');this.canelos.push({sprite,...patrol});
    }
  }
  updateCanelos(){for(const {sprite,min,max} of this.canelos){const body=sprite.body as Phaser.Physics.Arcade.Body;if(sprite.x>=max&&body.velocity.x>0)sprite.setVelocityX(-60);else if(sprite.x<=min&&body.velocity.x<0)sprite.setVelocityX(60);sprite.setFlipX(body.velocity.x<0);}}
  drawFurniture(f:Furniture){const {x,y,w,h,kind}=f,g=this.add.graphics().setDepth(2).setData('cullBounds',{left:x-30,right:x+w+30});g.lineStyle(3,0x66513b);
    g.fillStyle(0x725b3e,.12);g.fillEllipse(x+w/2,FLOOR+4,w+30,16);
    if(kind==='sofa'){
      g.fillStyle(0x82967d);g.fillRoundedRect(x+8,y+12,w-16,h-16,15);g.strokeRoundedRect(x+8,y+12,w-16,h-16,15);
      g.fillStyle(0x9eae8d);g.fillRoundedRect(x+7,y,w-14,40,12);g.strokeRoundedRect(x+7,y,w-14,40,12);
      g.fillStyle(0x75886d);g.fillRoundedRect(x,y+14,27,h-23,10);g.strokeRoundedRect(x,y+14,27,h-23,10);g.fillRoundedRect(x+w-27,y+14,27,h-23,10);g.strokeRoundedRect(x+w-27,y+14,27,h-23,10);
      g.lineStyle(2,0x697c60);g.lineBetween(x+w/2,y+4,x+w/2,y+35);g.fillStyle(0xc8a477);g.fillRoundedRect(x+45,y+7,43,27,7);
    }else if(kind==='counter'){
      g.fillStyle(0xb0b99b);g.fillRoundedRect(x,y+12,w,h-12,4);g.strokeRoundedRect(x,y+12,w,h-12,4);for(let k=x+10;k<x+w-30;k+=90){g.lineStyle(2,0x778568);g.strokeRoundedRect(k,y+27,75,h-42,3);g.fillStyle(0x72654c);g.fillCircle(k+62,y+50,3);}
      g.fillStyle(0xf0e7d5);g.fillRoundedRect(x-5,y,w+10,18,5);g.lineStyle(3,0x66513b);g.strokeRoundedRect(x-5,y,w+10,18,5);
    }else if(kind==='box'){
      g.fillStyle(0xc69b6e);g.fillRoundedRect(x,y,w,h,5);g.strokeRoundedRect(x,y,w,h,5);g.fillStyle(0xdebd8a);g.fillRect(x+w*.42,y,w*.16,h);g.lineStyle(2,0x9b754e);g.lineBetween(x,y+15,x+w,y+15);g.strokeCircle(x+w*.26,y+h*.6,12);
    }else{
      const shelf=kind==='shelf';g.fillStyle(shelf?0xa47e54:0xb68f63);g.fillRoundedRect(x,y,w,shelf?22:18,5);g.strokeRoundedRect(x,y,w,shelf?22:18,5);
      if(!shelf){g.fillStyle(0x99704c);g.fillRect(x+12,y+18,12,h-18);g.fillRect(x+w-24,y+18,12,h-18);}else{g.fillStyle(0x92704e);g.fillTriangle(x+20,y+22,x+45,y+22,x+20,y+48);g.fillTriangle(x+w-20,y+22,x+w-45,y+22,x+w-20,y+48);}
    }
  }
  placeJamon(){
    const put=(x:number,y:number)=>{const p=this.pickups.create(x,y,'jamon') as Phaser.Physics.Arcade.Image;p.setDepth(6).setData('id',this.jamonId++).setData('baseY',y);};
    for(let x=300;x<12300;x+=260){if(!gaps.some(([a,b])=>x>a-40&&x<b+40)&&!furniture.some(f=>x>f.x-30&&x<f.x+f.w+30))put(x,575);}
    for(const f of furniture){for(let j=35;j<f.w-10;j+=65)put(f.x+j,f.y-38);}
    put(1630,490);put(1710,490);
  }
  makeHUD(){
    const panel=this.add.graphics().setScrollFactor(0).setDepth(50);panel.fillStyle(0xfff8e9,.92);panel.fillRoundedRect(24,22,162,60,14);panel.lineStyle(1,0xbea788,.7);panel.strokeRoundedRect(24,22,162,60,14);
    this.add.image(49,53,'jamon').setScrollFactor(0).setDepth(51).setScale(.85);
    this.scoreText=this.add.text(78,32,'0',{fontFamily:'Georgia',fontSize:'27px',color:'#694c34'}).setScrollFactor(0).setDepth(51);
    this.add.text(79,62,'JAMÓN POINTS',{fontFamily:'DM Sans',fontSize:'8px',color:'#9a8162',letterSpacing:1}).setScrollFactor(0).setDepth(51);
    this.scorePopup=this.add.text(0,0,'+10',{fontFamily:'Arial',fontSize:'18px',fontStyle:'bold',color:'#a95839',stroke:'#fff0d8',strokeThickness:3}).setDepth(20).setVisible(false);
    this.progress=this.add.graphics().setScrollFactor(0).setDepth(50);
    this.encounterPanel=this.add.graphics().setScrollFactor(0).setDepth(50).setVisible(false);
    this.encounterText=this.add.text(640,37,'',{fontFamily:'Georgia',fontSize:'14px',color:'#111111',align:'center',padding:{x:18,y:12}}).setOrigin(.5,0).setScrollFactor(0).setDepth(51).setVisible(false);
    this.add.text(1250,60,'A HOUSE FULL OF TROUBLE',{fontFamily:'DM Sans',fontSize:'8px',color:'#8e795d',letterSpacing:1}).setOrigin(1,0).setScrollFactor(0).setDepth(51);
  }
  drawArena(){
    const g=this.add.graphics().setDepth(4);
    for(const x of STOOLS){this.addPlatform(x-35,531,70,89);g.fillStyle(0xa0ac8c);g.fillRoundedRect(x-35,531,70,47,14);g.lineStyle(3,0x66513b);g.strokeRoundedRect(x-35,531,70,47,14);g.fillStyle(0x9c7950);g.fillRect(x-27,578,10,42);g.fillRect(x+17,578,10,42);this.add.text(x,514,'↓',{fontSize:'23px',color:'#b76d4d'}).setOrigin(.5).setAlpha(.65);}
    this.roundedLabel(13190,250,'STAND BETWEEN THE STOOLS · JUMP THE DASH',18,12,9);
    const table: Furniture={x:13940,y:510,w:330,h:110,kind:'table'};this.drawFurniture(table);this.addPlatform(table.x,table.y,table.w,table.h);
    g.fillStyle(0xf8edda);g.fillEllipse(14100,505,190,20);g.lineStyle(3,0xa3805c);g.strokeEllipse(14100,505,190,20);
    for(let i=0;i<6;i++)this.add.image(14040+i*24,490-i%2*8,'jamon').setScale(1.1).setDepth(5);
    this.add.text(14100,432,'THE FEAST',{fontFamily:'Georgia',fontSize:'23px',color:'#9d593e',letterSpacing:2}).setOrigin(.5);
  }
  bindTouch(){
    document.querySelectorAll<HTMLButtonElement>('[data-control]').forEach(b=>{const key=b.dataset.control as keyof typeof this.touch;const down=(e:PointerEvent)=>{e.preventDefault();b.setPointerCapture(e.pointerId);this.touch[key]=true;};const up=()=>this.touch[key]=false;b.onpointerdown=down;b.onpointerup=up;b.onpointercancel=up;b.onlostpointercapture=up;});
    window.onblur=()=>{this.touch={left:false,right:false,jump:false};if(this.started&&!this.finished&&!this.paused)this.togglePause();};
  }
  start(){if(this.started)return;this.started=true;$('#start-screen').classList.add('hidden');this.physics.resume();tone(620);$('#game').focus();}
  togglePause(){if(!this.started||this.finished)return;this.paused=!this.paused;$('#pause-screen').classList.toggle('hidden',!this.paused);if(this.paused){this.physics.pause();this.tweens.pauseAll();}else{this.physics.resume();this.tweens.resumeAll();$('#game').focus();}$('#pause').innerHTML=this.paused?'▶ <span>Resume</span>':'Ⅱ <span>Pause</span>';$('#pause').setAttribute('aria-label',this.paused?'Resume game':'Pause game');}
  eat(j:Phaser.Physics.Arcade.Image){if(!j.active)return;const gained=collect(j.getData('id'),this.collected);if(!gained)return;this.score+=gained;j.disableBody(true,true);this.scoreText.setText(String(this.score));tone(780+this.score%150,.065);
    this.tweens.killTweensOf(this.scorePopup);this.scorePopup.setPosition(j.x,j.y-20).setAlpha(1).setVisible(true);this.tweens.add({targets:this.scorePopup,y:j.y-55,alpha:0,duration:450,onComplete:()=>this.scorePopup.setVisible(false)});
  }
  respawn(){this.morti.setPosition(this.checkpoint.x,this.checkpoint.y).setVelocity(0,0);this.invulnerable=this.playTime+1600;this.hitUntil=0;this.skidUntil=0;this.morti.setFlipY(false).setRotation(0);this.puddles.forEach(p=>p.art.destroy());this.puddles=[];if(this.cp===3){Object.assign(this,resetEncounter());this.stateUntil=this.playTime+1000;this.bomb.setVisible(true).setPosition(13230,577).setVelocity(0,0);this.updateBossHUD();}this.cameras.main.flash(180,248,234,208);}
  updateBossHUD(){this.encounterText.setVisible(true).setText(this.crashes===3?'BOMBONIEL: OFFICIALLY BAMBOOZLED':'BOMBONIEL  '+Array.from({length:3},(_,i)=>i<this.crashes?'★':'☆').join('  ')+'\nBait from the floor between stools · jump the dash');this.encounterPanel.setVisible(true);this.drawTextCard(this.encounterPanel,this.encounterText.x-this.encounterText.width/2,this.encounterText.y,this.encounterText.width,this.encounterText.height);}
  bombHit(){
    if(this.chase==='hidden'||this.chase==='defeated'||this.chase==='dizzy')return;
    // Contact invalidates this charge even during the player's invulnerability.
    if(this.chase==='pounce')this.chargeHitPlayer=true;
    if(this.playTime<this.invulnerable)return;
    this.invulnerable=this.playTime+1700;this.hitUntil=this.playTime+320;this.skidUntil=0;this.morti.setFlipY(false);const dir=this.morti.x<this.bomb.x?-1:1;this.morti.setVelocity(dir*300,-250);this.cameras.main.shake(100,.003);tone(180,.15,'triangle');
  }
  eligibleForCharge(){const body=this.morti.body as Phaser.Physics.Arcade.Body;return canChargeAt(this.morti.x,body.bottom,body.blocked.down);}
  updateBomb(now:number){
    if(this.chase==='hidden')return;
    if(this.chase==='defeated'){this.bomb.setVelocityX(0);this.bomb.rotation=Math.sin(now*.003)*.15;return;}
    const dx=this.morti.x-this.bomb.x;
    if(this.chase==='chase'){
      const vx=Math.sign(dx)*215;this.bomb.setVelocityX(this.bomb.x<=STOOLS[0]+105&&vx<0||this.bomb.x>=STOOLS[1]-105&&vx>0?0:vx);this.bomb.setFlipX(dx<0);
      if(now>this.stateUntil&&Math.abs(dx)<620&&this.eligibleForCharge()){
        this.chase='windup';this.stateUntil=now+550;this.bomb.setVelocityX(0);this.pounceDir=dx>=0?1:-1;this.bomb.stop().setTexture('bomboniel');tone(260,.12);
      }else if(!this.bomb.anims.isPlaying)this.bomb.play('bomboniel-run');
    }else if(this.chase==='windup'){
      this.bomb.setScale(this.bossBase.x*(1+Math.sin(now*.055)*.045),this.bossBase.y*.82);
      if(now>=this.stateUntil){
        this.bomb.setScale(this.bossBase.x,this.bossBase.y);
        if(!this.eligibleForCharge()){this.chase='chase';this.stateUntil=now+200;return;}
        this.chase='pounce';this.stateUntil=now+1000;this.chargeStartX=this.bomb.x;this.chargeHitPlayer=false;this.bomb.setVelocityX(this.pounceDir*CHARGE_SPEED);tone(430,.1,'triangle');
      }
    }else if(this.chase==='pounce'){
      // Directional plane checks cannot miss a stool during a fast/slow frame.
      const collision=Math.abs(this.bomb.x-this.chargeStartX)>=80&&(this.pounceDir>0?this.bomb.x>=STOOLS[1]-58:this.bomb.x<=STOOLS[0]+58);
      if(collision){
        if(!this.chargeHitPlayer){const result=resolveCrash(this.crashes);this.crashes=result.count;this.chase=result.state;this.updateBossHUD();}
        else this.chase='dizzy';
        this.stateUntil=now+1500;this.bomb.setVelocityX(0);this.bomb.stop().setTexture('bomboniel').setAngle(this.pounceDir*15);this.cameras.main.shake(100,.003);tone(120,.16,'triangle');
      }else if(now>=this.stateUntil||this.bomb.x<ARENA+20||this.bomb.x>13840){this.chase='dizzy';this.stateUntil=now+800;this.bomb.setVelocityX(0);}
    }else if(this.chase==='dizzy'&&now>=this.stateUntil){
      this.chase='chase';this.stateUntil=now+450;this.bomb.setAngle(0).setScale(this.bossBase.x,this.bossBase.y);this.bomb.x=Phaser.Math.Clamp(this.bomb.x,STOOLS[0]+115,STOOLS[1]-115);
    }
    this.bomb.x=Phaser.Math.Clamp(this.bomb.x,ARENA+20,13850);
  }
  launchFromPuddle(now:number){
    const body=this.morti.body as Phaser.Physics.Arcade.Body;
    if(now<this.skidUntil||now<this.hitUntil||!body.blocked.down||body.bottom<FLOOR-8)return;
    for(const puddle of this.puddles){
      if(Math.abs(this.morti.x-puddle.x)>100)puddle.armed=true;
      if(puddle.armed&&Math.abs(this.morti.x-puddle.x)<75){
        puddle.armed=false;this.skidDirection=Math.sign(body.velocity.x)||(this.morti.flipX?-1:1);this.skidUntil=now+1000;this.jumpBuffered=0;this.morti.stop().setTexture('morti').setFlipY(true).setVelocity(this.skidDirection*650,-180);tone(340,.12,'triangle');break;
      }
    }
  }
  updateChris(now:number,dt:number){
    // Chris relocates to the room Morti is exploring, staying out of the finale.
    const base=this.morti.x<4800?3000:this.morti.x<9600?7600:11400;
    if(Math.abs(this.chrisX-base)>2000){this.chrisX=base;this.nextPee=now+3000;}
    const peeing=now<this.peeUntil;
    if(!peeing){const direction=Math.sin(now*.00065)>0?1:-1;this.chrisX=Phaser.Math.Clamp(this.chrisX+direction*135*dt,base-440,base+440);this.chris.setFlipX(direction<0);if(!this.chris.anims.isPlaying)this.chris.play('chris-run');}
    else this.chris.stop().setTexture('chris').setRotation(Math.sin(now*.03)*.035);
    this.chris.setPosition(this.chrisX,585);
    if(now>this.nextPee-950&&now<this.nextPee&&!this.warned){this.warned=true;this.chris.setTint(0xffe1a3);}
    if(now>=this.nextPee){this.chris.clearTint();this.warned=false;this.peeUntil=now+1100;this.nextPee=now+5500;const x=this.chrisX;const art=this.add.container(x,615).setDepth(7);const pool=this.add.ellipse(0,0,125,13,0xd3b254,.64);pool.setStrokeStyle(2,0xa99045,.5);art.add(pool);art.add(this.add.ellipse(24,-2,29,3,0xf7e6a2,.7));this.puddles.push({x,until:now+7000,art,armed:true});}
    this.puddles=this.puddles.filter(p=>{if(now>p.until){p.art.destroy();return false;}p.art.setAlpha(Math.min(1,(p.until-now)/1000));return true;});
  }
  update(_now:number,delta:number){
    if(!this.started||this.paused||this.finished)return;
    const now=(this.playTime+=Math.min(delta,40));
    const dt=Math.min(delta,40)/1000,b=this.morti.body as Phaser.Physics.Arcade.Body;
    const left=this.cursors.left.isDown||this.keys.A.isDown||this.touch.left,right=this.cursors.right.isDown||this.keys.D.isDown||this.touch.right;
    const jumping=this.cursors.space.isDown||this.cursors.up.isDown||this.keys.W.isDown||this.touch.jump;
    if(jumping&&!this.lastJump)this.jumpBuffered=now+140;this.lastJump=jumping;
    if(b.blocked.down)this.lastGround=now;
    this.launchFromPuddle(now);const skidding=now<this.skidUntil;
    if(skidding&&now>this.hitUntil)this.morti.setVelocityX(this.skidDirection*650);
    if(!skidding&&now>this.hitUntil){const target=(Number(right)-Number(left))*290;this.morti.setVelocityX(Phaser.Math.Linear(b.velocity.x,target,1-Math.exp(-17*dt)));
      if(this.jumpBuffered>now&&now-this.lastGround<110){this.morti.setVelocityY(-610);this.jumpBuffered=0;this.lastGround=-1000;tone(420,.08,'triangle');}
    }
    if(this.morti.x<40)this.morti.x=40;
    if(this.chase!=='hidden'&&this.chase!=='defeated'&&this.morti.x<ARENA+60)this.morti.x=ARENA+60;
    if(this.chase!=='defeated'&&this.morti.x>13860){this.morti.x=13860;}
    if(Math.abs(b.velocity.x)>20){this.morti.setFlipX(b.velocity.x<0);if(!skidding&&b.blocked.down&&!this.morti.anims.isPlaying)this.morti.play('morti-run');}
    if(skidding||!b.blocked.down||Math.abs(b.velocity.x)<20){this.morti.stop().setTexture('morti');}
    this.morti.setFlipY(skidding);this.morti.setRotation(skidding?Math.sin(now*.018)*.08:!b.blocked.down?Phaser.Math.Clamp(b.velocity.y*.00012,-.09,.09):0);
    if(!this.morti.anims.isPlaying&&b.blocked.down)this.morti.setScale(this.heroBase.x,this.heroBase.y*(1+Math.sin(now*.003)*.014));
    this.morti.setAlpha(now<this.invulnerable?(Math.sin(now*.035)>0?.4:1):1);
    this.updateCanelos();
    if(this.morti.y>820)this.respawn();
    if(this.morti.x>4800&&this.cp<1){this.cp=1;this.checkpoint={x:4840,y:540};}
    if(this.morti.x>9600&&this.cp<2){this.cp=2;this.checkpoint={x:9660,y:540};}
    if(this.morti.x>ARENA&&this.chase==='hidden'){
      this.cp=3;this.checkpoint={x:ARENA+100,y:540};this.chase='chase';this.stateUntil=now+1200;this.bomb.setVisible(true);this.updateBossHUD();tone(190,.25,'sawtooth');
    }
    this.updateChris(now,dt);this.updateBomb(now);
    const room=roomAt(this.morti.x);if(room!==this.room){this.room=room;$('#room-label').textContent=room;}
    const progressStep=Math.floor(this.morti.x/60);
    if(progressStep!==this.lastProgress){this.lastProgress=progressStep;this.progress.clear();this.progress.fillStyle(0xc9b99e,.6);this.progress.fillRoundedRect(1050,30,200,4,2);this.progress.fillStyle(0xb86b48);this.progress.fillRoundedRect(1050,30,200*Math.min(1,this.morti.x/(WORLD-300)),4,2);this.progress.fillCircle(1050+200*Math.min(1,this.morti.x/(WORLD-300)),32,4);}
    if(this.chase==='defeated'&&this.morti.x>14020&&this.morti.y<530)this.finish();
    this.lastY=this.morti.y;
  }
  finish(){this.finished=true;this.physics.pause();this.score+=100;this.scoreText.setText(String(this.score));$('#final-score').textContent=String(this.score);$('#best-score').textContent=`Personal best: ${bestScore(this.score)} points · Feast bonus: +100`;
    $('#finish-screen').classList.remove('hidden');tone(900,.3);this.morti.stop().setTexture('morti');}
}
function restart(){clearTimeout(toastTimer);$('#toast').classList.remove('visible');for(const id of ['#pause-screen','#finish-screen'])$(id).classList.add('hidden');$('#start-screen').classList.remove('hidden');$('#pause').innerHTML='Ⅱ <span>Pause</span>';game.scene.stop('House');game.scene.remove('House');game.scene.add('House',House,true);}
$('#start').onclick=()=>active.start();$('#pause').onclick=()=>active.togglePause();$('#resume').onclick=()=>active.togglePause();$('#restart').onclick=restart;$('#again').onclick=()=>{restart();setTimeout(()=>active.start(),150);};
$('#mute').onclick=()=>{muted=!muted;$('#mute').innerHTML=muted?'♫ <span>Sound off</span>':'♪ <span>Sound on</span>';$('#mute').setAttribute('aria-pressed',String(muted));$('#mute').setAttribute('aria-label',muted?'Unmute sound':'Mute sound');};
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('.game-shell').requestFullscreen();}catch{toast('Full screen is unavailable in this browser.');}};
game=new Phaser.Game({type:Phaser.AUTO,parent:'game',width:1280,height:720,backgroundColor:'#eadbc2',physics:{default:'arcade',arcade:{gravity:{x:0,y:1300},debug:false}},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},render:{antialias:true,roundPixels:true},scene:[House],audio:{noAudio:true}});
