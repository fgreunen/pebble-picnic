'use strict';
// Read-only recovery search; fork full production snapshots, then verify printed routes fresh.
const {P,M,fire}=require('./physics-sandbox.cjs');
const level=Number(process.argv[2]||1);
const routeName=process.argv[3];
let sequence=routeName?require('../tests/projectile-routes.test.cjs').routes[routeName].map(s=>({...s,pull:[...s.pull]})):require('../tests/solutions.json')[level].map(s=>({...s,pull:[...s.pull]}));
const deltas=[-2,0,2].flatMap(x=>[-2,0,2].map(y=>[x,y]));
const replay=seq=>deltas.map(([dx,dy])=>{const w=new P.GameWorld(level);for(const s of seq)if(w.state==='ready')fire(w,{...s,pull:[s.pull[0]+dx,s.pull[1]+dy]});return w;});
let bases=replay(sequence);
while(sequence.length<P.levels[level].shots){
 let best;
 const left={...P.levels[level].ammo};sequence.forEach(s=>left[s.type]--);
 for(const type of Object.keys(left).filter(t=>left[t]>0))for(let x=-96;x<=-16;x+=8)for(let y=-24;y<=72;y+=8){
  let wins=0,targets=0,hp=0,nominal=false;
  bases.forEach((b,j)=>{
   let w=b;if(b.state==='ready'){w=Object.create(P.GameWorld.prototype);w.engine=M.Engine.create();w.onEvent=()=>{};w.undoState=b.capture();w.undo();fire(w,{type,pull:[x+deltas[j][0],y+deltas[j][1]],wait:6000});}
   if(w.state==='won')wins++;if(j===4)nominal=w.state==='won';targets+=w.targets().length;hp+=w.targets().reduce((s,b)=>s+b.game.hp,0);
  });
  const score=(nominal?1000000:0)+wins*10000-targets*100-hp;
  if(!best||score>best.score)best={shot:{type,pull:[x,y],wait:6000},wins,score};
 }
 sequence.push(best.shot);console.log(JSON.stringify({level,sequence,...best}));bases=replay(sequence);
 if(best.wins>=7)break;
}
