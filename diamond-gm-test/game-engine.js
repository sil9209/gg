/* Diamond GM deterministic, stat-driven nine-inning game with up to 12 innings. */
function simulateGame({home,away,seed,stats}){
 let h=2166136261;for(const c of String(seed)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}let state=h>>>0;
 const rnd=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296};
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const build=(team,homeFlag)=>{
  const hitters=(team.hitters||[]).slice(0,9).map((p,i)=>({p,i,id:p.id||'bot-b-'+i,name:p.name||'AI 타자 '+(i+1),ab:0,h:0,h2:0,h3:0,tb:0,hr:0,rbi:0,r:0,bb:0,so:0,sb:0,history:[]}));
  const pitchers=(team.pitchers||[]).slice(0,3).map((p,i)=>({p,id:p.id||'bot-p-'+i,name:p.name||'AI 투수 '+(i+1),outs:0,h:0,r:0,er:0,bb:0,so:0,hr:0,pitches:0,scorelessInnings:0,enteredLeading:false,w:0,l:0,sv:0,hld:0}));
  while(hitters.length<9){let i=hitters.length,p={id:'replacement-'+i,name:'대체 타자',contact:40,power:40,eye:40,speed:40,defense:40,condition:3};hitters.push({p,i,id:p.id,name:p.name,ab:0,h:0,h2:0,h3:0,tb:0,hr:0,rbi:0,r:0,bb:0,so:0,sb:0,history:[]})}
  if(!pitchers.length)pitchers.push({p:{name:'대체 투수',velocity:40,stuff:40,control:40,break:40,stamina:40,condition:3},name:'대체 투수',outs:0,h:0,r:0,er:0,bb:0,so:0,hr:0,pitches:0,scorelessInnings:0,enteredLeading:false,w:0,l:0,sv:0,hld:0});
  return {name:team.name,home:homeFlag,hitters,pitchers,pointer:0,runs:0,hits:0,errors:0,walks:0,innings:[],team};
 };
 const H=build(home,true),A=build(away,false),events=[];
 const triggered=new Map();
 const values=(p,ctx)=>{const info=stats(p,ctx)||{},v=info.values||info;if(info.activated?.length){let all=triggered.get(p.id);if(!all){all=new Map();triggered.set(p.id,all)}for(const skill of info.activated)all.set(skill.id,skill.name)}const m=clamp((Number(p.condition)||3)*.05+.8,.85,1.05);const out={};for(const k of ['contact','power','eye','speed','defense','velocity','stuff','control','break','stamina','mental'])out[k]=clamp((Number(v[k]??p[k])||50)*m,10,100);return out};
 let inning=1;
 function half(off,def,upper){
  let outs=0,runs=0,bases=[null,null,null],pa=0;
  const pitcherIndex=inning>=9?Math.min(2,def.pitchers.length-1):inning>=7?Math.min(1,def.pitchers.length-1):0;
  const pitcher=def.pitchers[pitcherIndex],pitcherRole=pitcherIndex===0?'starter':pitcherIndex===1?'relief':'closer',startingRuns=pitcher.r;
  if(pitcher.pitches===0)pitcher.enteredLeading=def.runs>off.runs;
  const scoreRun=(runner,batter,isError=false)=>{runs++;off.runs++;if(runner)runner.r++;if(batter&&!isError)batter.rbi++;pitcher.r++;if(!isError)pitcher.er++};
  while(outs<3 && pa++<80){
   // Walk-off: end the bottom of the ninth or any extra inning as soon as home leads.
   if(!upper&&inning>=9&&H.runs>A.runs)break;
   const batter=off.hitters[off.pointer++%9];
   const scoringChance=Boolean(bases[1]||bases[2]),basesEmpty=!bases.some(Boolean),basesLoaded=bases.every(Boolean);
   const common={inning,outs,scoringChance,basesEmpty,basesLoaded,runnerFirst:!!bases[0],pitcherRole,late:inning>=7,
    teamLeading:off.runs>def.runs,opponentForeign:false,pitchCount:pitcher.pitches,
    afterStrikeout:!!pitcher.lastStrikeout,scorelessInnings:pitcher.scorelessInnings,
    opponentBattingIndex:batter.i,winStreak:off.team.winStreak||0,lossStreak:off.team.lossStreak||0,
    teamHomeRuns:off.hitters.reduce((n,b)=>n+b.hr,0),teamComparison:null,postseason:false,opponentRank:null};
   const hst=batter.history||[],recent=hst.slice(-3),previousHits=hst.length>=2&&hst.slice(-2).every(x=>x==='hit')?2:0;
   const previousStrikeouts=hst.length>=2&&hst.slice(-2).every(x=>x==='strikeout')?2:0;
   const previousHitless=recent.length===3&&recent.every(x=>x!=='hit')?3:0;
   const bv=values(batter.p,{...common,isHome:off.home,battingIndex:batter.i,fieldPosition:off.team.positions?.[batter.id],
    winStreak:off.team.winStreak||0,lossStreak:off.team.lossStreak||0,previousHits,previousHitless,previousStrikeouts,
    opponentForeign:pitcher.p.foreign===true,opponentAge:pitcher.p.age,opponentLevel:Number(pitcher.p.level)||1,
    opponentVelocity:Number(pitcher.p.velocity)||0,opponentStuff:Number(pitcher.p.stuff)||0,
    opponentControl:Number(pitcher.p.control)||0,opponentBreak:Number(pitcher.p.break)||0});
   const pv=values(pitcher.p,{...common,isHome:def.home,winStreak:def.team.winStreak||0,lossStreak:def.team.lossStreak||0,
    teamLeading:def.runs>off.runs,opponentForeign:batter.p.foreign===true,opponentAge:batter.p.age,
    opponentLevel:Number(batter.p.level)||1,opponentPower:Number(batter.p.power)||0,
    opponentContact:Number(batter.p.contact)||0,opponentSpeed:Number(batter.p.speed)||0,opponentEye:Number(batter.p.eye)||0});
   const fatigue=clamp((pitcher.pitches-(Number(pv.stamina)||55)*1.1)*.12,0,14);
   const contact=bv.contact, power=bv.power, eye=bv.eye, speed=bv.speed, control=pv.control-fatigue,stuff=pv.stuff-fatigue,velocity=pv.velocity-fatigue,breaking=pv.break-fatigue;
   const walk=clamp(.085+(eye-control)*.0012,.025,.19);
   const strikeout=clamp(.205+(velocity-contact)*.0011+(breaking-eye)*.0007,.06,.36);
   const hr=clamp(.032+(power-stuff)*.0007,.004,.105);
   const hit=clamp(.235+(contact-stuff)*.0015+(speed-55)*.00027,.115,.39);
   const err=clamp(.012+(55-Number(def.team.defense||55))*.0003,.002,.04);
   const roll=rnd();pitcher.pitches+=Math.floor(3+rnd()*4);
   if(roll<walk){batter.bb++;pitcher.bb++;off.walks++;batter.history.push('walk');pitcher.lastStrikeout=false;if(bases.every(Boolean))scoreRun(bases[2],batter);for(let j=2;j>=1;j--)if(bases[j-1]&&(!bases[j]||j===2))bases[j]=bases[j-1];bases[0]=batter;continue}
   batter.ab++;
   if(roll<walk+strikeout){batter.so++;pitcher.so++;pitcher.outs++;outs++;batter.history.push('strikeout');pitcher.lastStrikeout=true;continue}
   if(roll<walk+strikeout+hr){batter.h++;batter.hr++;batter.tb+=4;off.hits++;batter.history.push('hit');pitcher.lastStrikeout=false;pitcher.h++;pitcher.hr++;for(let j=2;j>=0;j--)if(bases[j])scoreRun(bases[j],batter);scoreRun(batter,batter);bases=[null,null,null];events.push({inning,half:upper?'초':'말',team:off.name,text:batter.name+' 홈런',type:'homeRun'});continue}
   const hitRoll=rnd();
   if(hitRoll<hit){batter.h++;off.hits++;pitcher.h++;batter.history.push('hit');pitcher.lastStrikeout=false;const basesTaken=rnd()<clamp(.14+(power-55)*.0015,.06,.25)?2:rnd()<.012?3:1;if(basesTaken===2)batter.h2++;else if(basesTaken===3)batter.h3++;
   batter.tb+=basesTaken;
   const next=[null,null,null];for(let j=2;j>=0;j--)if(bases[j]){const advance=basesTaken+(rnd()<clamp(.25+(Number(bases[j].p.speed)||55)*.002,0,.5)?1:0);if(j+advance>=3)scoreRun(bases[j],batter);else next[j+advance]=bases[j]}if(basesTaken===3)next[2]=batter;else next[basesTaken-1]=batter;bases=next;continue}
   if(roll<walk+strikeout+hr+hit+err){def.errors++;batter.history.push('out');pitcher.lastStrikeout=false;if(bases[2]){scoreRun(bases[2],null,true);bases[2]=null}for(let j=1;j>=0;j--)if(bases[j]&&!bases[j+1]){bases[j+1]=bases[j];bases[j]=null}bases[0]=batter;continue}
   batter.history.push('out');pitcher.lastStrikeout=false;if(bases[0]&&outs<2&&rnd()<clamp(.08+(55-speed)*.0005,.03,.13)){outs+=2;pitcher.outs+=2;bases[0]=null}else{outs++;pitcher.outs++}
  }
  if(pitcher.r===startingRuns&&outs>=3)pitcher.scorelessInnings=(pitcher.scorelessInnings||0)+1;
  else if(pitcher.r>startingRuns)pitcher.scorelessInnings=0;
  if(runs)events.push({inning,half:upper?'초':'말',team:off.name,text:runs+'득점',type:'score'});
  return runs;
 }
 let completedInnings=0;
 for(inning=1;inning<=12;inning++){
  A.innings.push(half(A,H,true));
  if(inning>=9&&H.runs>A.runs){H.innings.push(null);completedInnings=inning;break}
  H.innings.push(half(H,A,false));
  completedInnings=inning;
  if(inning>=9&&H.runs!==A.runs)break;
 }
 // Simulator decisions for W/L/SV/HLD in new box scores (not historical backfill).
 if(H.runs!==A.runs){
  const winning=H.runs>A.runs?H:A,losing=H.runs>A.runs?A:H;
  const winUsed=winning.pitchers.filter(p=>p.outs>0),lossUsed=losing.pitchers.filter(p=>p.outs>0);
  const starter=winUsed[0];
  const winningPitcher=starter?.outs>=15?starter:(winUsed.find(p=>p.enteredLeading)||winUsed[winUsed.length-1]||starter);
  if(winningPitcher)winningPitcher.w=1;
  const losingPitcher=lossUsed.find(p=>p.er>0)||lossUsed[0];
  if(losingPitcher)losingPitcher.l=1;
  const savePitcher=winUsed[winUsed.length-1],margin=winning.runs-losing.runs;
  if(savePitcher&&savePitcher!==winningPitcher&&savePitcher.outs>=3&&margin<=3)savePitcher.sv=1;
  for(const pitcher of winUsed){
   if(pitcher!==winningPitcher&&pitcher!==savePitcher&&pitcher.enteredLeading&&pitcher.outs>=3&&pitcher.er===0)pitcher.hld=1;
  }
 }
 const box=t=>({name:t.name,runs:t.runs,hits:t.hits,errors:t.errors,walks:t.walks,innings:t.innings,batters:t.hitters.map(({p,i,history,...b})=>({...b,activatedAbilities:[...(triggered.get(p.id)||new Map()).values()]})),pitchers:t.pitchers.filter(p=>p.pitches>0).map(({p,lastStrikeout,scorelessInnings,enteredLeading,...x})=>({...x,activatedAbilities:[...(triggered.get(p.id)||new Map()).values()],ip:Math.floor(x.outs/3)+'.'+x.outs%3,era:x.outs?Number((x.er*27/x.outs).toFixed(2)):0}))});
 const result={home:box(H),away:box(A),events,innings:completedInnings,draw:H.runs===A.runs};
 const bat=[...H.hitters,...A.hitters].sort((x,y)=>(y.h*2+y.hr*3+y.rbi)-(x.h*2+x.hr*3+x.rbi))[0];result.mvp=bat?{name:bat.name,team:H.hitters.includes(bat)?H.name:A.name}:null;
 return result;
}
module.exports={simulateGame};
