const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(process.argv[2],'utf8');
const src=html.split('<script>')[1].split('</script>')[0];
const noop=()=>{};
const ctxProxy=new Proxy({}, {get:(t,k)=>{ if(k in t) return t[k]; if(k==='createLinearGradient') return ()=>({addColorStop:noop}); return noop;}, set:(t,k,v)=>{t[k]=v;return true;}});
const mkEl=()=>({getContext:()=>ctxProxy,addEventListener:noop,appendChild:noop,focus:noop,style:{},dataset:{},set className(v){},set textContent(v){},set innerHTML(v){}});
const doc={getElementById:()=>mkEl(),createElement:()=>mkEl(),querySelectorAll:()=>[],querySelector:()=>mkEl(),fonts:{load:()=>Promise.resolve()}};
const win={__SB_TEST__:true};
const sb={window:win,document:doc,addEventListener:noop,performance:{now:()=>Date.now()},requestAnimationFrame:noop,console,Math,setTimeout,Set,Array,Object,String,Float32Array,Uint8Array,Promise};
vm.createContext(sb); vm.runInContext(src,sb);
const S=win.__SB__;
let t=0; const run=(n,keys={})=>{for(let i=0;i<n;i++){Object.assign(S.keys,keys);S.step(1/60);for(const k in S.pressed)S.pressed[k]=false;t+=1/60; if(i%10==0)S.render(t);}};
S.pressed.start=true; run(1); console.log('state',S.state, 'P',S.P.x|0,S.P.y|0);
// walk right firing, jumping periodically, cycle specials
let maxX=0;
for(let i=0;i<9000 && S.state==='play';i++){
  const k={right:true,fire:true,jump:(i%40)<20};
  if(i%300===0) S.pressed.special=true;
  if(i%40===0) S.pressed.jump=true;
  run(1,k);
  if(S.P.alive) maxX=Math.max(maxX,S.P.x/16);
  if(i%1000===0) console.log(i,'col',(S.P.x/16).toFixed(1),'row',(S.P.y/16).toFixed(1),'bro',S.P.bro.id,'lives',S.lives,'kills',S.stats.kills,'resc',S.stats.rescued,'boss',S.boss.hp,'state',S.state);
}
console.log('end state',S.state,'maxcol',maxX.toFixed(1),S.stats);
