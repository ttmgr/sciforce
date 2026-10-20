const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(process.argv[2],'utf8');
const src=html.split('<script>')[1].split('</script>')[0];
const noop=()=>{};
const ctxProxy=new Proxy({}, {get:(t,k)=>{ if(k in t) return t[k]; if(k==='createLinearGradient') return ()=>({addColorStop:noop}); return noop;}, set:(t,k,v)=>{t[k]=v;return true;}});
const mkEl=()=>({getContext:()=>ctxProxy,addEventListener:noop,appendChild:noop,focus:noop,style:{},dataset:{}});
const doc={getElementById:()=>mkEl(),createElement:()=>mkEl(),querySelectorAll:()=>[],querySelector:()=>mkEl(),fonts:{load:()=>Promise.resolve()}};
const win={__SB_TEST__:true};
const sb={window:win,document:doc,addEventListener:noop,performance:{now:()=>Date.now()},requestAnimationFrame:noop,console,Math,setTimeout,Set,Array,Object,String,Float32Array,Uint8Array,Promise};
vm.createContext(sb); vm.runInContext(src,sb);
const S=win.__SB__;
const run=(n,keys={})=>{for(let i=0;i<n;i++){for(const k in S.keys)S.keys[k]=false;Object.assign(S.keys,keys);S.step(1/60);for(const k in S.pressed)S.pressed[k]=false; S.render(i/60);}};
for(let k=0;k<3;k++){S.pressed.start=true; run(1);} // title -> world map -> briefing -> play
// cliff climb test
S.ents.forEach(e=>{if(e.type!=='boss'&&e.type!=='flag'&&e.type!=='cage')e.dead=true});
const P=S.P; P.x=104*16; P.y=15*16-16; P.inv=999;
S.pressed.jump=true; run(1,{right:true,jump:true});
for(let i=0;i<300;i++){ if(i%30==0)S.pressed.jump=true; run(1,{right:true,jump:true}); if(i%30==0)console.log(i,(P.x/16).toFixed(2),((P.y+P.h)/16).toFixed(2),P.onGround,P.vy|0); }
console.log('after climb col',(P.x/16).toFixed(1),'row',((P.y+P.h)/16).toFixed(2),'alive',P.alive);
// boss fight: teleport to arena with tesla-free einstein, fire constantly
S.P.bro = S.BRO.einstein; // a new run starts with a random bro
P.x=S.arenaCol(184)*16; P.y=15*16-16; P.inv=1e9; S.finishObjectives(); // the vats etc. are not what this test is about
let i=0;
for(;i<60*120 && !S.boss.dead;i++){ P.inv=1e9; P.x=Math.min(P.x,S.arenaCol(190)*16); run(1,{fire:true,right:(i%120)<10}); P.face=1;}
console.log('boss dead',S.boss.dead,'after s',(i/60).toFixed(1),'hp',S.boss.hp, 'chopper',!!S.chopper);
for(i=0;i<60*20 && S.state==='play';i++){ P.inv=1e9; run(1,{right:true}); }
console.log('final',S.state,'P col',(P.x/16).toFixed(1), S.chopper&&S.chopper.state);
S.render(0); console.log('level-clear screen drew without errors');
