/* Diamond GM deterministic, stat-driven nine-inning box-score engine. */
function simulateGame({home,away,seed,stats}){
 let h=2166136261;for(const c of String(seed)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}let state=h>>>0;
 const rnd=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296};
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const build=(team,homeFlag)=>{
  const hitters=(team.hitters||[]).slice(0,9).map((p,i)=>({p,i,id:p.id||'bot-b-'+i,name:p.name||'AI 타자 '+(i+1),ab:0,h:0,hr:0,rbi:0,r:0,bb:0,so:0,sb:0}));
  const pitchers=(team.pitchers||[]).slice(0,3).map((p,i)=>({p,id:p.id||'bot-p-'+i,name:p.name||'AI 투수 '+(i+1),outs:0,h:0,r:0,er:0,bb:0,so:0,hr:0,pitches:0}));
  while(hitters.length<9){let i=hitters.length,p={id:'replacement-'+i,name:'대체 타자',contact:40,power:40,eye:40,speed:40,defense:40,condition:3};hitters.push({p,i,id:p.id,name:p.name,ab:0,h:0,hr:0,rbi:0,r:0,bb:0,so:0,sb:0})}
  if(!pitchers.length)pitchers.push({p:{name:'대체 투수',velocity:40,stuff:40,control:40,break:40,stamina:40,condition:3},name:'대체 투수',outs:0,h:0,r:0,er:0,bb:0,so:0,hr:0,pitches:0});
  return {name:team.name,home:homeFlag,hitters,pitchers,pointer:0,runs:0,hits:0,errors:0,walks:0,innings:[],team};
 };
 const H=build(home,true),A=build(away,false),events=[];
 const triggered=new Map();
 const values=(p,ctx)=>{const info=stats(p,ctx)||{},v=info.values||info;if(info.activated?.length){let all=triggered.get(p.id);if(!all){all=new Map();triggered.set(p.id,all)}for(const skill of info.activated)all.set(skill.id,skill.name)}const m=clamp((Number(p.condition)||3)*.05+.8,.85,1.05);const out={};for(const k of ['contact','power','eye','speed','defense','velocity','stuff','control','break','stamina','mental'])out[k]=clamp((Number(v[k]??p[k])||50)*m,10,100);return out};
 let inning=1;
 function half(off,def,upper){
  let outs=0,runs=0,bases=[null,null,null],pa=0;
  const pitcherIndex=inning>=9?Math.min(2,def.pitchers.length-1):inning>=7?Math.min(1,def.pitchers.length-1):0;
  const pitcher=def.pitchers[pitcherIndex],pitcherRole=pitcherIndex===0?'starter':pitcherIndex===1?'relief':'closer';
  const scoreRun=(runner,batter,isError=false)=>{runs++;off.runs++;if(runner)runner.r++;if(batter&&!isError)batter.rbi++;pitcher.r++;if(!isError)pitcher.er++};
  while(outs<3 && pa++<80){
   const batter=off.hitters[off.pointer++%9];
   const scoringChance=bases.some(Boolean);
   const bv=values(batter.p,{isHome:off.home,battingIndex:batter.i,fieldPosition:off.team.positions?.[batter.id],scoringChance,late:inning>=7,round:off.team.round});
   const pv=values(pitcher.p,{isHome:def.home,pitcherRole,scoringChance,late:inning>=7,round:def.team.round});
   const fatigue=clamp((pitcher.pitches-(Number(pv.stamina)||55)*1.1)*.12,0,14);
   const contact=bv.contact, power=bv.power, eye=bv.eye, speed=bv.speed, control=pv.control-fatigue,stuff=pv.stuff-fatigue,velocity=pv.velocity-fatigue,breaking=pv.break-fatigue;
   const walk=clamp(.085+(eye-control)*.0012,.025,.19);
   const strikeout=clamp(.205+(velocity-contact)*.0011+(breaking-eye)*.0007,.06,.36);
   const hr=clamp(.032+(power-stuff)*.0007,.004,.105);
   const hit=clamp(.235+(contact-stuff)*.0015+(speed-55)*.00027,.115,.39);
   const err=clamp(.012+(55-Number(def.team.defense||55))*.0003,.002,.04);
   const roll=rnd();pitcher.pitches+=Math.floor(3+rnd()*4);
   if(roll<walk){batter.bb++;pitcher.bb++;off.walks++;if(bases.every(Boolean))scoreRun(bases[2],batter);for(let j=2;j>=1;j--)if(bases[j-1]&&(!bases[j]||j===2))bases[j]=bases[j-1];bases[0]=batter;continue}
   batter.ab++;
   if(roll<walk+strikeout){batter.so++;pitcher.so++;pitcher.outs++;outs++;continue}
   if(roll<walk+strikeout+hr){batter.h++;batter.hr++;off.hits++;pitcher.h++;pitcher.hr++;for(let j=2;j>=0;j--)if(bases[j])scoreRun(bases[j],batter);scoreRun(batter,batter);bases=[null,null,null];events.push({inning,half:upper?'초':'말',team:off.name,text:batter.name+' 홈런',type:'homeRun'});continue}
   const hitRoll=rnd();
   if(hitRoll<hit){batter.h++;off.hits++;pitcher.h++;const basesTaken=rnd()<clamp(.14+(power-55)*.0015,.06,.25)?2:rnd()<.012?3:1;const next=[null,null,null];for(let j=2;j>=0;j--)if(bases[j]){const advance=basesTaken+(rnd()<clamp(.25+(Number(bases[j].p.speed)||55)*.002,0,.5)?1:0);if(j+advance>=3)scoreRun(bases[j],batter);else next[j+advance]=bases[j]}if(basesTaken===3)next[2]=batter;else next[basesTaken-1]=batter;bases=next;continue}
   if(roll<walk+strikeout+hr+hit+err){def.errors++;if(bases[2]){scoreRun(bases[2],null,true);bases[2]=null}for(let j=1;j>=0;j--)if(bases[j]&&!bases[j+1]){bases[j+1]=bases[j];bases[j]=null}bases[0]=batter;continue}
   if(bases[0]&&outs<2&&rnd()<clamp(.08+(55-speed)*.0005,.03,.13)){outs+=2;pitcher.outs+=2;bases[0]=null}else{outs++;pitcher.outs++}
  }
  if(runs)events.push({inning,half:upper?'초':'말',team:off.name,text:runs+'득점',type:'score'});
  return runs;
 }
 for(inning=1;inning<=12;inning++){
  A.innings.push(half(A,H,true));
  if(inning>=9&&H.runs>A.runs){H.innings.push(null);break}
  H.innings.push(half(H,A,false));
  if(inning>=9&&H.runs!==A.runs)break;
 }
 const box=t=>({name:t.name,runs:t.runs,hits:t.hits,errors:t.errors,walks:t.walks,innings:t.innings,batters:t.hitters.map(({p,i,...b})=>({...b,activatedAbilities:[...(triggered.get(p.id)||new Map()).values()]})),pitchers:t.pitchers.filter(p=>p.pitches>0).map(({p,...x})=>({...x,activatedAbilities:[...(triggered.get(p.id)||new Map()).values()],ip:Math.floor(x.outs/3)+'.'+x.outs%3,era:x.outs?Number((x.er*27/x.outs).toFixed(2)):0}))});
 const result={home:box(H),away:box(A),events,innings:inning,draw:H.runs===A.runs};
 const bat=[...H.hitters,...A.hitters].sort((x,y)=>(y.h*2+y.hr*3+y.rbi)-(x.h*2+x.hr*3+x.rbi))[0];result.mvp=bat?{name:bat.name,team:H.hitters.includes(bat)?H.name:A.name}:null;
 return result;
}
module.exports={simulateGame};
