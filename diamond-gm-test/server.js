const http=require('http'),fs=require('fs'),crypto=require('crypto');
const {simulateGame}=require('./game-engine');
const PATH='diamond-gm-test-data.json'; let db={users:[],clubs:[],listings:[]};try{db=JSON.parse(fs.readFileSync(PATH,'utf8'))}catch(e){}
// Paid rewarded ads require a verified advertiser event; browser events alone never issue currency.
const AD_REWARD_CP=500,AD_DAILY_LIMIT=10;
const GAM_REWARDED_UNIT=String(process.env.GM_REWARDED_AD_UNIT||'').trim();
const AD_WEBHOOK_SECRET=String(process.env.GM_REWARDED_AD_WEBHOOK_SECRET||'');
const AD_REWARDS_ENABLED=process.env.GM_REWARDED_AD_ENABLED==='true'&&
 GAM_REWARDED_UNIT.startsWith('/')&&GAM_REWARDED_UNIT.split('/').length>=3&&AD_WEBHOOK_SECRET.length>=32;
const seoulRewardDay=()=>new Date(Date.now()+32400000).toISOString().slice(0,10);
function rewardUsage(c){
 const day=seoulRewardDay(),current=c?.rewardedAdDaily||{};
 return {day,used:current.day===day?Math.max(0,Number(current.used)||0):0};
}
async function verifiedAdWebhook(req,res){
 if(!AD_REWARDS_ENABLED)return send(res,503,{error:'보상형 광고 미연동'});
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)return send(res,413,{error:'요청 초과'})}
 const supplied=String(req.headers['x-gm-ad-signature']||'');
 const expected=crypto.createHmac('sha256',AD_WEBHOOK_SECRET).update(raw).digest('hex');
 const safe=supplied.length===64&&/^[a-f0-9]+$/i.test(supplied)&&crypto.timingSafeEqual(Buffer.from(supplied,'hex'),Buffer.from(expected,'hex'));
 if(!safe)return send(res,403,{error:'서버 검증 실패'});
 let data;try{data=JSON.parse(raw)}catch{return send(res,400,{error:'잘못된 요청'})}
 const nonce=String(data.nonce||''),eventId=String(data.eventId||''),timestamp=Number(data.timestamp);
 if(nonce.length!==36||eventId.length<8||eventId.length>160||!Number.isFinite(timestamp)||Math.abs(Date.now()-timestamp)>300000)return send(res,400,{error:'유효하지 않은 광고 확인 정보'});
 db.rewardedAdTransactions=db.rewardedAdTransactions||[];
 if(db.rewardedAdTransactions.includes(eventId))return send(res,200,{ok:true,duplicate:true});
 const c=db.clubs.find(x=>x.rewardedAdPending?.nonce===nonce&&Date.now()-x.rewardedAdPending.createdAt<20*60000);
 if(!c)return send(res,404,{error:'승인 대기 광고 기록 없음'});
 const used=rewardUsage(c);
 if(used.used>=AD_DAILY_LIMIT)return send(res,409,{error:'오늘 지급 한도 초과'});
 c.cp=(Number(c.cp)||0)+AD_REWARD_CP;
 c.rewardedAdDaily={day:used.day,used:used.used+1};
 c.rewardedAdPending=null;
 db.rewardedAdTransactions.push(eventId);
 db.rewardedAdTransactions=db.rewardedAdTransactions.slice(-20000);
 save();
 return send(res,200,{ok:true,rewardCP:AD_REWARD_CP});
}
const sessions=new Map();let lock=Promise.resolve();const uid=()=>crypto.randomUUID();const rand=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const names1=['김','박','이','최','정','강','조','윤','장','임','한','오','서','신','권','황'],names2=['도현','성준','재원','민수','지훈','태영','현우','주원','준혁','승민','태준','지성','건우','동현','진우','정민'];
const foreignFirst=['알렉스','데이비드','마이클','카를로스','루이스','호세','윌리엄','제이슨','로버트','타일러','마르코','에릭','다니엘','브랜든','케빈','앤서니'];
const foreignLast=['로드리게스','존슨','윌슨','가르시아','마르티네스','스미스','로페즈','브라운','곤잘레스','리베라','톰슨','밀러','산체스','워커','페레즈'];
function player(owner){const foreign=Math.random()<.22;const isP=Math.random()<.36,year=rand(2000,2026),pos=isP?['선발','중계','마무리'][rand(0,2)]:['포수','1루수','2루수','3루수','유격수','좌익수','중견수','우익수'][rand(0,7)];const p={id:uid(),owner,name:foreign?foreignFirst[rand(0,foreignFirst.length-1)]+' '+foreignLast[rand(0,foreignLast.length-1)]:names1[rand(0,names1.length-1)]+names2[rand(0,names2.length-1)],foreign,avatarSeed:rand(0,999999),year,pos,isPitcher:isP,grade:Math.random()<.45?'E':'D',power:rand(40,76),contact:rand(40,76),eye:rand(40,76),speed:rand(40,76),defense:rand(40,76),stamina:rand(40,76),mental:rand(40,76),age:rand(19,43),condition:3,lastGrowthWeek:weekStart(),games:0,avg:0,hr:0,era:0};assignAvatarDNA(p);return p}


const AVATAR_TRAITS={faceShape:7,skinTone:10,hairStyle:14,hairColor:8,eyeShape:7,eyeSize:6,eyeSpacing:6,eyebrowShape:7,noseShape:8,mouthShape:8,jawShape:6,beardStyle:7,feature:8};
const avatarSignatures=new Set();
function avatarSignature(d){return Object.keys(AVATAR_TRAITS).map(key=>d[key]).join(':')}
function assignAvatarDNA(p){
 if(!p)return;
 if(p.avatarDNA&&p.avatarVersion===1)return;
 // Each candidate is derived from immutable player ID, not a transient random draw.
 // Existing player migration and future recruits use the same collision registry.
 for(let attempt=0;attempt<500;attempt++){
  const digest=crypto.createHash('sha512').update(String(p.id)+':diamond-avatar:v1:'+attempt).digest();
  const dna={};let i=0;
  for(const [key,count] of Object.entries(AVATAR_TRAITS))dna[key]=digest[i++]%count;
  if(p.foreign&&dna.skinTone<2)dna.skinTone=(dna.skinTone+2)%10;
  const signature=avatarSignature(dna);
  if(avatarSignatures.has(signature))continue;
  avatarSignatures.add(signature);
  p.avatarDNA=dna;p.avatarVersion=1;p.avatarSeed=digest.readUInt32BE(24);
  return;
 }
 throw Error('새 선수 얼굴 조합을 생성할 수 없습니다');
}
function initializeAvatarRegistry(){
 const all=[...(db.clubs||[]).flatMap(c=>[...(c.players||[]),...(c.retiredPlayers||[])]),...(db.listings||[]).map(l=>l.player)];
 const seenPlayers=new Set();let changed=false;
 for(const p of all){
  if(!p||seenPlayers.has(p.id))continue;seenPlayers.add(p.id);
  if(p.avatarDNA&&p.avatarVersion===1&&!avatarSignatures.has(avatarSignature(p.avatarDNA))){
   avatarSignatures.add(avatarSignature(p.avatarDNA));continue;
  }
  p.avatarDNA=null;p.avatarVersion=0;assignAvatarDNA(p);changed=true;
 }
 return changed;
}

const BATTER_STAT_KEYS=['contact','power','eye','speed','mental','defense'];
const PITCHER_STAT_KEYS=['velocity','stuff','control','break','mental','stamina'];
const STAT_LABELS={contact:'정확',power:'파워',eye:'선구',speed:'주력',mental:'정신',defense:'수비',velocity:'구속',stuff:'구위',control:'제구',break:'변화',stamina:'체력'};
const statKeys=p=>p.isPitcher?PITCHER_STAT_KEYS:BATTER_STAT_KEYS;

/* Original DIAMOND GM scout-born special abilities.
 * Only the server rolls for slots. This roll is intentionally absent from the UI/API. */
const SPECIAL_ABILITIES=[{"id":"immortal_b","name":"불멸자","type":"batter","source":"scout","when":"age43","boost":{"contact":4,"power":4,"eye":4,"speed":4},"desc":"43세 이상 시 핵심 능력치 +4 (타자)"},{"id":"immortal_p","name":"불멸자","type":"pitcher","source":"scout","when":"age43","boost":{"velocity":4,"stuff":4,"control":4,"break":4},"desc":"43세 이상 시 핵심 능력치 +4 (투수)"},{"id":"undying_b","name":"불사신","type":"batter","source":"scout","when":"age40","boost":{"contact":3,"power":3,"eye":3,"speed":3},"desc":"40세 이상 시 핵심 능력치 +3 (타자)"},{"id":"undying_p","name":"불사신","type":"pitcher","source":"scout","when":"age40","boost":{"velocity":3,"stuff":3,"control":3,"break":3},"desc":"40세 이상 시 핵심 능력치 +3 (투수)"},{"id":"foreign_mercenary_b","name":"외인용병","type":"batter","source":"scout","when":"foreign","boost":{"contact":2,"power":2,"eye":2},"desc":"외국인 선수 핵심 능력치 상승 (타자)"},{"id":"foreign_mercenary_p","name":"외인용병","type":"pitcher","source":"scout","when":"foreign","boost":{"velocity":3,"stuff":3,"control":3,"break":3},"desc":"외국인 선수 핵심 능력치 상승 (투수)"},{"id":"home_mood_b","name":"무드남","type":"batter","source":"scout","when":"home","boost":{"contact":1,"power":1,"eye":1},"desc":"홈구장 경기 핵심 능력치 상승 (타자)"},{"id":"home_mood_p","name":"무드남","type":"pitcher","source":"scout","when":"home","boost":{"velocity":2,"stuff":2,"control":2,"break":2},"desc":"홈구장 경기 핵심 능력치 상승 (투수)"},{"id":"clutch_hitter","name":"클러치 히터","type":"batter","source":"scout","when":"scoring","boost":{"contact":3,"power":3},"desc":"득점권에서 정확·파워 +3"},{"id":"slugger","name":"슬러거","type":"batter","source":"scout","when":"always","boost":{"power":4},"desc":"출전 시 파워 +4"},{"id":"onbase_machine","name":"출루머신","type":"batter","source":"scout","when":"leadoff","boost":{"contact":3,"eye":3},"desc":"1·2번 타순에서 정확·선구 +3"},{"id":"hitting_instinct","name":"타격본능","type":"batter","source":"scout","when":"always","boost":{"contact":4},"desc":"출전 시 정확 +4"},{"id":"rbi_maker","name":"타점 제조기","type":"batter","source":"scout","when":"scoring","boost":{"power":2,"contact":2,"eye":2},"desc":"득점권에서 파워·정확·선구 +2"},{"id":"ace","name":"에이스","type":"pitcher","source":"scout","when":"starter","boost":{"velocity":2,"stuff":2,"control":2,"break":2},"desc":"선발 등판 시 구속·구위·제구·변화 +2"},{"id":"poker_face","name":"포커페이스","type":"pitcher","source":"scout","when":"scoring","boost":{"velocity":2,"stuff":2,"control":2,"break":2},"desc":"득점권에서 구속·구위·제구·변화 +2"},{"id":"catcher_master","name":"안방마님","type":"batter","source":"training","when":"catcher","boost":{"defense":2,"mental":2},"desc":"포수 출장 시 수비·정신 +2"},{"id":"keystone_combo","name":"키스톤 콤비","type":"batter","source":"training","when":"middleInfield","boost":{"defense":2,"mental":2},"desc":"유격수·2루수 출장 시 수비·정신 +2"},{"id":"hot_corner","name":"핫코너","type":"batter","source":"training","when":"thirdbase","boost":{"defense":2,"mental":2},"desc":"3루수 출장 시 수비·정신 +2"},{"id":"flexible_catch","name":"유연한포구","type":"batter","source":"training","when":"firstbase","boost":{"defense":2,"mental":2},"desc":"1루수 출장 시 수비·정신 +2"},{"id":"outfield_ruler","name":"외야의지배자","type":"batter","source":"training","when":"outfield","boost":{"defense":2,"mental":2},"desc":"외야수 출장 시 수비·정신 +2"},{"id":"mental_focus","name":"정신집중","type":"batter","source":"training","when":"starterBatter","boost":{"mental":4},"desc":"선발 타자 출장 시 정신 +4"},{"id":"defense_focus","name":"디펜스","type":"batter","source":"training","when":"starterBatter","boost":{"defense":4},"desc":"선발 타자 출장 시 수비 +4"},{"id":"foreign_power_b","name":"용병파워","type":"batter","source":"training","when":"foreign","boost":{"mental":2,"defense":2},"desc":"외국인 타자 출장 시 정신·수비 +2"},{"id":"phoenix","name":"불사조","type":"batter","source":"training","when":"age40","boost":{"contact":1,"power":1,"eye":1,"speed":1},"desc":"40세 이상 시 정확·파워·선구·주력 +1"},{"id":"ironman_b","name":"아이언맨","type":"batter","source":"training","when":"age43","boost":{"contact":2,"power":2,"eye":2,"speed":2},"desc":"43세 이상 시 정확·파워·선구·주력 +2"},{"id":"late_chance_b","name":"와신상담","type":"batter","source":"training","when":"scoring","boost":{"contact":1,"power":1},"desc":"득점권에서 정확·파워 +1"},{"id":"cleanup_b","name":"클린업","type":"batter","source":"training","when":"cleanup","boost":{"power":1},"desc":"3·4·5번 타자로 출전 시 파워 +1"},{"id":"away_b","name":"타향살이","type":"batter","source":"training","when":"away","boost":{"contact":2,"power":2,"eye":2},"desc":"원정 경기에서 정확·파워·선구 +2"},{"id":"table_setter","name":"테이블세터","type":"batter","source":"training","when":"leadoff","boost":{"contact":1},"desc":"1·2번 타순에서 정확 +1"},{"id":"battle_mode_b","name":"전투모드","type":"batter","source":"training","when":"round99","boost":{"power":2},"desc":"정규시즌 99~119차전에서 파워 +2"},{"id":"iron_body_p","name":"강철체력","type":"pitcher","source":"training","when":"starter","boost":{"stamina":4},"desc":"선발 투수 등판 시 체력 +4"},{"id":"winning_starter","name":"필승선발","type":"pitcher","source":"training","when":"starter","boost":{"mental":2,"stamina":2},"desc":"선발 등판 시 정신·체력 +2"},{"id":"winning_relief","name":"필승계투","type":"pitcher","source":"training","when":"relief","boost":{"mental":2,"stamina":2},"desc":"중계 등판 시 정신·체력 +2"},{"id":"winning_closer","name":"필승마무리","type":"pitcher","source":"training","when":"closer","boost":{"mental":2,"stamina":2},"desc":"마무리 등판 시 정신·체력 +2"},{"id":"foreign_power_p","name":"용병파워","type":"pitcher","source":"training","when":"foreign","boost":{"mental":2,"stamina":2},"desc":"외국인 투수 등판 시 정신·체력 +2"},{"id":"ironman_p","name":"아이언맨","type":"pitcher","source":"training","when":"age43","boost":{"velocity":2,"stuff":2,"control":2,"break":2},"desc":"43세 이상 시 구속·구위·제구·변화 +2"},{"id":"strong_waist","name":"강철허리","type":"pitcher","source":"training","when":"relief","boost":{"control":1,"break":1},"desc":"중계 등판 시 제구·변화 +1"},{"id":"positive_mind_p","name":"긍정적 마인드","type":"pitcher","source":"training","when":"scoring","boost":{"control":2},"desc":"득점권에서 제구 +2"},{"id":"late_chance_p","name":"와신상담","type":"pitcher","source":"training","when":"scoring","boost":{"stuff":1,"break":1,"control":1},"desc":"득점권에서 구위·변화·제구 +1"},{"id":"away_p","name":"타향살이","type":"pitcher","source":"training","when":"away","boost":{"velocity":2,"stuff":2,"control":2,"break":2},"desc":"원정 경기에서 구속·구위·변화·제구 +2"},{"id":"battle_mode_p","name":"전투모드","type":"pitcher","source":"training","when":"round99","boost":{"control":2},"desc":"정규시즌 99~119차전에서 제구 +2"}];

// Requested 145 additional skills are stored separately to keep the original catalog unchanged.
const ADDITIONAL_SPECIALS=require('./additional-specials.json');
SPECIAL_ABILITIES.push(...ADDITIONAL_SPECIALS);
const SPECIAL_BY_ID=new Map(SPECIAL_ABILITIES.map(x=>[x.id,x]));
// Resolve the position actually assigned in the saved batting/defensive lineup.
// Skill ownership is independent of this position; only activation checks it.
function matchFieldPosition(c,p){
 return Object.entries(c?.defensePositions||{}).find(([,playerId])=>playerId===p.id)?.[0]||null;
}
function teamMatchStrength(c,ctx={}){
 const bats=(c.lineup||[]).map(id=>c.players.find(p=>p.id===id&&!p.isPitcher)).filter(Boolean).slice(0,9);
 const pitcher=c.players.find(p=>p.id===c.pitcher)||c.players.find(p=>p.isPitcher);
 const lineup=[...bats,...(pitcher?[pitcher]:[])];
 if(!lineup.length)return c.players.reduce((sum,p)=>sum+playerStrength(p),0)/Math.max(1,c.players.length);
 return lineup.reduce((sum,p,index)=>{
  const role=p.isPitcher?(p.pos==='마무리'?'closer':p.pos==='중계'?'relief':'starter'):null;
  const effect=effectivePlayerStrength(p,{...ctx,battingIndex:p.isPitcher?null:index,pitcherRole:role,fieldPosition:p.isPitcher?null:matchFieldPosition(c,p)});
  return sum+effect.strength*(.8+(p.condition||3)*.05);
 },0)/lineup.length;
}

function rollScoutSpecials(p){
 const roll=crypto.randomInt(10000);
 const count=roll<50?3:roll<150?2:roll<450?1:0;
 if(!count)return [];
 const pool=SPECIAL_ABILITIES.filter(x=>x.source==='scout'&&x.type===(p.isPitcher?'pitcher':'batter')).map(x=>x.id);
 const chosen=[];
 for(let i=0;i<count;i++){const index=crypto.randomInt(pool.length);chosen.push(pool.splice(index,1)[0])}
 return chosen;
}
function specialCondition(p,when,ctx={}){
 switch(when){
 case 'always':return true;
 case 'age43':return p.age>=43;
 case 'age40':return p.age>=40;
 case 'foreign':return p.foreign===true;
 case 'home':return ctx.isHome===true;
 case 'away':return ctx.isHome===false;
 case 'scoring':return ctx.scoringChance===true;
 case 'leadoff':return Number.isInteger(ctx.battingIndex)&&ctx.battingIndex<=1;
 case 'cleanup':return Number.isInteger(ctx.battingIndex)&&ctx.battingIndex>=2&&ctx.battingIndex<=4;
 case 'catcher':return ctx.fieldPosition==='C';
 case 'middleInfield':return ctx.fieldPosition==='2B'||ctx.fieldPosition==='SS';
 case 'thirdbase':return ctx.fieldPosition==='3B';
 case 'firstbase':return ctx.fieldPosition==='1B';
 case 'outfield':return ['LF','CF','RF'].includes(ctx.fieldPosition);
 case 'starterBatter':return !p.isPitcher&&Number.isInteger(ctx.battingIndex);
 case 'starter':return ctx.pitcherRole==='starter';
 case 'relief':return ctx.pitcherRole==='relief';
 case 'closer':return ctx.pitcherRole==='closer';
 case 'round99':return Number.isInteger(ctx.round)&&ctx.round>=99&&ctx.round<=119;
 case 'young':return p.age>=21&&p.age<=25;
 case 'postseason':return ctx.postseason===true;
 case 'lowerTeam':return ctx.teamComparison==='lower';
 case 'upperTeam':return ctx.teamComparison==='upper';
 case 'firstTeam':return ctx.opponentRank===1;
 case 'losing3':return ctx.lossStreak>=3;
 case 'winning3':return ctx.winStreak>=3;
 case 'twoOutScoring':return ctx.scoringChance===true&&ctx.outs===2;
 case 'emptyBases':return ctx.basesEmpty===true;
 case 'loaded':return ctx.basesLoaded===true;
 case 'runnerFirst':return ctx.runnerFirst===true;
 case 'hitless3':return ctx.previousHitless>=3;
 case 'strikeout2':return ctx.previousStrikeouts>=2;
 case 'hits2':return ctx.previousHits>=2;
 case 'closerScoring':return ctx.pitcherRole==='closer'&&ctx.scoringChance===true;
 case 'pinch':return ctx.isPinchHitter===true;
 case 'upperScoring':return ctx.teamComparison==='upper'&&ctx.scoringChance===true;
 case 'winning9':return ctx.inning===9&&ctx.teamLeading===true;
 case 'foreignPitcher':case 'foreignBatter':return ctx.opponentForeign===true;
 case 'pitches60':return ctx.pitchCount<=60&&Number.isFinite(ctx.pitchCount);
 case 'pitches80plus':return ctx.pitchCount>=80;
 case 'inning8to9':return ctx.inning>=8&&ctx.inning<=9;
 case 'inning6to8':return ctx.inning>=6&&ctx.inning<=8;
 case 'inning7plus':return ctx.inning>=7;
 case 'inning8plus':return ctx.inning>=8;
 case 'inning9':return ctx.inning===9;
 case 'extraInnings':return ctx.inning>=10;
 case 'lastBatters':return ctx.opponentBattingIndex>=6&&ctx.opponentBattingIndex<=8;
 case 'scoreless5':return ctx.scorelessInnings>=5;
 case 'afterStrikeout':return ctx.afterStrikeout===true;
 case 'teamHr2':return ctx.teamHomeRuns>=2;
 case 'opponentLevel1':return ctx.opponentLevel===1;
 case 'opponentLevel10':return ctx.opponentLevel===10;
 case 'lowerOpponentLevel':return Number.isFinite(ctx.opponentLevel)&&ctx.opponentLevel<Math.max(1,Number(p.level)||1);
 case 'opponentAge38':return ctx.opponentAge>=38;
 case 'opponentPower80':return ctx.opponentPower>=80;
 case 'opponentContact80':return ctx.opponentContact>=80;
 case 'opponentSpeed80':return ctx.opponentSpeed>=80;
 case 'opponentEye80':return ctx.opponentEye>=80;
 case 'opponentVelocity80':return ctx.opponentVelocity>=80;
 case 'opponentStuff80':return ctx.opponentStuff>=80;
 case 'opponentControl80':return ctx.opponentControl>=80;
 case 'opponentBreak80':return ctx.opponentBreak>=80;
 case 'opponentVelocity85':return ctx.opponentVelocity>=85;
 case 'opponentStuff85':return ctx.opponentStuff>=85;
 case 'opponentControl85':return ctx.opponentControl>=85;
 case 'opponentBreak85':return ctx.opponentBreak>=85;
 default:return false;
 }
}
function effectivePlayerStrength(p,ctx={}){
 const values=Object.fromEntries(statKeys(p).map(key=>[key,Number(p[key])||0]));
 const activated=[];
 for(const id of p.specialAbilities||[]){
  const trait=SPECIAL_BY_ID.get(id);
  if(!trait||trait.type!==(p.isPitcher?'pitcher':'batter')||!specialCondition(p,trait.when,ctx))continue;
  for(const [stat,boost] of Object.entries(trait.boost))if(stat in values)values[stat]=Math.min(CAP,values[stat]+boost);
  activated.push({id:trait.id,name:trait.name});
 }
 return {strength:Object.values(values).reduce((a,b)=>a+b,0)/6,values,activated};
}

const playerStrength=p=>statKeys(p).reduce((total,key)=>total+(Number(p[key])||0),0)/6;
const CAP=99.99;
const statValue=n=>Math.min(CAP,Math.max(0,Math.round((Number(n)||0)*100)/100));
function ensurePlayer(p,now=Date.now()){
 if(!p)return p;
 if(!Number.isInteger(p.age)||p.age<17){const h=crypto.createHash('sha256').update(String(p.id||p.name)).digest();p.age=19+h[0]%20}
 if(!Number.isFinite(Number(p.mental)))p.mental=Number(p.stamina)||55;
 if(p.isPitcher){
  // Legacy cards have hitter attributes only. Migrate deterministically, retaining all earlier data.
  for(const [target,source] of [['velocity','speed'],['stuff','power'],['control','contact'],['break','eye']]){
   if(!Number.isFinite(Number(p[target])))p[target]=Number(p[source])||55;
  }
  if(!Number.isFinite(Number(p.stamina)))p.stamina=Number(p.defense)||55;
 }
 for(const stat of statKeys(p))p[stat]=statValue(p[stat]);
 if(!Array.isArray(p.specialAbilities))p.specialAbilities=[];
 p.specialAbilities=[...new Set(p.specialAbilities)].filter(id=>SPECIAL_BY_ID.get(id)?.type===(p.isPitcher?'pitcher':'batter')).slice(0,8);
 if(!['E','D','C','B','A','S'].includes(p.grade))p.grade='E';if(!Number.isInteger(p.condition)||p.condition<1||p.condition>5)p.condition=3;if(typeof p.foreign!=='boolean')p.foreign=/\s/.test(String(p.name));if(!Number.isInteger(p.avatarSeed))p.avatarSeed=parseInt(crypto.createHash('sha256').update(String(p.id)).digest('hex').slice(0,7),16);if(!p.avatarDNA||p.avatarVersion!==1)assignAvatarDNA(p);
 if(!Number.isFinite(p.lastGrowthWeek))p.lastGrowthWeek=weekStart(now);
 if(p.growthFocusSelected!==true){p.growthFocus=null;p.growthFocusSelected=false}else if(!statKeys(p).includes(p.growthFocus)){p.growthFocus=null;p.growthFocusSelected=false}
 if(!Number.isFinite(p.gameGrowthCount))p.gameGrowthCount=0;
 return p;
}
function weeklyGrowth(p,now=Date.now()){
 ensurePlayer(p,now);
 const target=weekStart(now),weeks=Math.min(520,Math.max(0,Math.floor((target-p.lastGrowthWeek)/604800000)));
 if(!weeks)return false;
 p.age=Math.min(45,p.age+weeks);
 p.lastGrowthWeek+=weeks*604800000;
 return true;
}
// Every owned player receives identical, grade-independent basic development
// per team game, including players outside both starting and bench lists.
function applyTeamGameGrowth(c,count=1,activeIds=[]){
 if(!Number.isInteger(count)||count<1)return;
 const active=new Set(activeIds);
 for(const p of c.players){
  ensurePlayer(p);
  if(p.age>=45)continue;
  const isSuper=p.grade==='S';
  const canField=active.has(p.id)&&!(['A','S'].includes(p.grade)&&p.age>=36);
  const ageRate=p.age<=24?1.3:p.age<=29?1:p.age<=35?0.75:0.4;
  const gradeRate={E:0.03,D:0.05,C:0.07,B:0.09,A:0.12,S:0.24}[p.grade]||0.03;
  for(const key of statKeys(p)){
   const focusMultiplier=p.growthFocusSelected?(key===p.growthFocus?5:0.5):1;
   // Quantize the normal-grade component first; S doubles exactly that same component.
   // A-tier and S-tier of equal age/focus therefore advance at a strict 1:2 ratio
   // except when an attribute has hit its 99.99 cap.
   const baseline=statValue(0.02*focusMultiplier*count);
   const activeBonus=canField?statValue((isSuper?gradeRate/2:gradeRate)*ageRate/6*focusMultiplier*count):0;
   const multiplier=isSuper?2:1;
   p[key]=statValue(p[key]+multiplier*(baseline+activeBonus));
  }
  p.gameGrowthCount+=count;
 }
}
function creditLeagueGames(now=Date.now()){
 const week=weekStart(now);
 let changed=false;
 for(const c of db.clubs||[]){
  if(c.growthLeagueWeek!==week){c.growthLeagueWeek=week;c.growthLeagueCredited=0;changed=true}
  const played=Math.max(0,Math.min(144,Math.floor(leagueInfo(c,now).completedRounds||0)));
  const difference=played-(Number(c.growthLeagueCredited)||0);
  if(difference>0){
   const participants=[...(c.lineup||[]),c.pitcher].filter(Boolean);
   applyTeamGameGrowth(c,difference,participants);
   c.growthLeagueCredited=played;
   changed=true;
  }
 }
 if(changed)save();
}
function syncGrowth(now=Date.now()){
 let changed=false;
 const seen=new Set();
 const sync=p=>{if(!p||seen.has(p.id))return;seen.add(p.id);changed=weeklyGrowth(p,now)||changed};
 for(const c of db.clubs||[])for(const p of c.players||[])sync(p);
 for(const l of db.listings||[])sync(l.player);
 for(const c of db.clubs||[]){
  const retired=c.players.filter(p=>p.age>=45);
  if(retired.length){c.retiredPlayers=Array.isArray(c.retiredPlayers)?c.retiredPlayers:[];c.retiredPlayers.unshift(...retired.map(p=>({...p,retiredAt:now})));c.retiredPlayers=c.retiredPlayers.slice(0,100);c.players=c.players.filter(p=>p.age<45);changed=true;fix(c)}
 }
 const oldCount=db.listings.length;db.listings=db.listings.filter(l=>l.player.age<45);if(db.listings.length!==oldCount)changed=true;
 if(changed)save();
}
initializeAvatarRegistry();
for(const c of db.clubs||[])for(const p of c.players||[])ensurePlayer(p);
for(const l of db.listings||[])ensurePlayer(l.player);
if((db.clubs||[]).length||(db.listings||[]).length)save();
function club(user,name){const players=Array.from({length:25},()=>player(user.id));return {id:uid(),owner:user.id,name,teamId:user.teamId,leagueTier:0,lastSettledWeek:weekStart()-604800000,leagueHistory:[],sportsDrinks:0,growthBoosters:0,friendlyDaily:{day:'',used:0},friendlyHistory:[],retiredPlayers:[],cash:500000000,cp:300,players,lineup:players.filter(p=>!p.isPitcher).slice(0,9).map(p=>p.id),pitcher:players.find(p=>p.isPitcher).id,wins:0,losses:0,draws:0,season:1,transactions:[]}}
const DEFENSE_POS=['C','1B','2B','3B','SS','LF','CF','RF','DH'];
const DEFENSE_NATIVE={'포수':'C','1루수':'1B','2루수':'2B','3루수':'3B','유격수':'SS','좌익수':'LF','중견수':'CF','우익수':'RF'};
function fix(c){
 const bats=c.players.filter(p=>!p.isPitcher),pitchers=c.players.filter(p=>p.isPitcher);
 c.lineup=[...new Set((c.lineup||[]).filter(id=>bats.some(p=>p.id===id)))];
 for(const p of bats)if(c.lineup.length<9&&!c.lineup.includes(p.id))c.lineup.push(p.id);
 c.lineup=c.lineup.slice(0,9);
 if(!pitchers.some(p=>p.id===c.pitcher))c.pitcher=pitchers[0]?.id||null;
 const current=c.defensePositions&&typeof c.defensePositions==='object'?c.defensePositions:{};
 const validIds=new Set(c.lineup);
 const next={};const used=new Set();
 for(const pos of DEFENSE_POS){const id=current[pos];if(id&&validIds.has(id)&&!used.has(id)){next[pos]=id;used.add(id)}}
 for(const p of bats){if(!validIds.has(p.id)||used.has(p.id))continue;const pos=DEFENSE_NATIVE[p.pos];if(pos&&!next[pos]){next[pos]=p.id;used.add(p.id)}}
 for(const pos of DEFENSE_POS)if(!next[pos]){const id=c.lineup.find(x=>!used.has(x));if(id){next[pos]=id;used.add(id)}}
 c.defensePositions=next;
 const benchAvailable=bats.filter(p=>!validIds.has(p.id));
 let bench=Array.isArray(c.benchIds)?[...new Set(c.benchIds.filter(id=>benchAvailable.some(p=>p.id===id)))].slice(0,5):[];
 for(const p of benchAvailable)if(bench.length<Math.min(5,benchAvailable.length)&&!bench.includes(p.id))bench.push(p.id);
 c.benchIds=bench;
 const oldPitch=c.pitcherAssignments&&typeof c.pitcherAssignments==='object'?c.pitcherAssignments:{};
 const chosen=new Set();const assignments={};
 for(const role of ['starter','relief','closer']){
  const id=role==='starter'?(pitchers.some(p=>p.id===oldPitch.starter)?oldPitch.starter:c.pitcher):oldPitch[role];
  if(id&&pitchers.some(p=>p.id===id)&&!chosen.has(id)){assignments[role]=id;chosen.add(id)}
 }
 for(const role of ['starter','relief','closer'])if(!assignments[role]){const p=pitchers.find(p=>!chosen.has(p.id));if(p){assignments[role]=p.id;chosen.add(p.id)}}
 c.pitcherAssignments=assignments;
 const rotationRoles=['starter1','starter2','starter3','starter4','starter5','relief1','relief2','relief3','relief4','setup','closer'];
 const rotation=c.pitcherRotation&&typeof c.pitcherRotation==='object'?c.pitcherRotation:{};
 const seenPitchers=new Set(),newRotation={};
 for(const role of rotationRoles){const id=rotation[role]||(role==='starter1'?assignments.starter:role==='relief1'?assignments.relief:role==='closer'?assignments.closer:null);if(id&&pitchers.some(p=>p.id===id)&&!seenPitchers.has(id)){newRotation[role]=id;seenPitchers.add(id)}}
 for(const role of rotationRoles)if(!newRotation[role]){const p=pitchers.find(p=>!seenPitchers.has(p.id));if(p){newRotation[role]=p.id;seenPitchers.add(p.id)}}
 c.pitcherRotation=newRotation;
 c.pitcher=newRotation.starter1||assignments.starter||c.pitcher;
 c.pitcherAssignments={starter:c.pitcher,relief:newRotation.relief1||null,closer:newRotation.closer||null};
}
function save(){fs.writeFileSync(PATH,JSON.stringify(db))}
function send(res,status,obj,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',...headers});res.end(JSON.stringify(obj))}
function getCookie(req){return (req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('sid='))?.slice(4)}

const TEAMS=[{"id":"twins","name":"서울 쌍둥이즈","city":"서울","symbol":"Ⅱ","color":"#C92845","secondary":"#263B69","mascot":"쌍둥이"},{"id":"bears","name":"서울 불곰즈","city":"서울","symbol":"B","color":"#24385C","secondary":"#BA7246","mascot":"불곰"},{"id":"heroes","name":"서울 번개단","city":"서울","symbol":"⚡","color":"#982D50","secondary":"#E8B6C2","mascot":"번개"},{"id":"landers","name":"인천 항해자들","city":"인천","symbol":"N","color":"#D73545","secondary":"#D7BC83","mascot":"항해"},{"id":"wizards","name":"수원 마법사들","city":"수원","symbol":"W","color":"#292B35","secondary":"#BD3646","mascot":"마법"},{"id":"eagles","name":"대전 독수리단","city":"대전","symbol":"E","color":"#E16F22","secondary":"#1D344E","mascot":"독수리"},{"id":"lions","name":"대구 사자군단","city":"대구","symbol":"L","color":"#2164B4","secondary":"#E4E9F0","mascot":"사자"},{"id":"tigers","name":"광주 호랑이단","city":"광주","symbol":"T","color":"#C82832","secondary":"#152D54","mascot":"호랑이"},{"id":"giants","name":"부산 거인단","city":"부산","symbol":"G","color":"#243E73","secondary":"#D64B48","mascot":"거인"},{"id":"dinos","name":"창원 공룡단","city":"창원","symbol":"D","color":"#2369A8","secondary":"#C49B58","mascot":"공룡"}];
const BOT_NAMES=TEAMS.map(t=>t.name);
function weekStart(now=Date.now()){const d=new Date(now+32400000);const day=d.getUTCDay();return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-day)-32400000}
function seedNum(t){return parseInt(crypto.createHash('sha256').update(String(t)).digest('hex').slice(0,8),16)/4294967295}
const LEAGUE_TIERS=[{"key":"rookie","name":"루키리그","average":45},{"key":"amateur","name":"아마추어리그","average":52},{"key":"semi-pro","name":"세미프로리그","average":59},{"key":"pro","name":"프로리그","average":66},{"key":"national","name":"내셔널리그","average":73},{"key":"elite","name":"엘리트리그","average":80},{"key":"master","name":"마스터리그","average":87},{"key":"champion","name":"챔피언리그","average":94}];
const originalCash=[30000000,25000000,20000000,16000000,13000000,10000000,8000000,6000000,4000000,2000000];
const originalCP=[50,40,32,25,20,16,12,9,7,5];
const LEAGUE_REWARDS=LEAGUE_TIERS.map((tier,i)=>Array.from({length:10},(_,rank)=>({cash:Math.round(originalCash[rank]*(1+i*0.6)/1000000)*1000000,cp:Math.round(originalCP[rank]*(1+i*0.5))})));
const tierNum=c=>Math.max(0,Math.min(LEAGUE_TIERS.length-1,Number(c.leagueTier)||0));
function leagueMembers(c){
 const tier=tierNum(c),teamId=c.teamId||TEAMS[0].id;
 const teamMates=db.clubs.filter(x=>tierNum(x)===tier&&(x.teamId||TEAMS[0].id)===teamId);
 const pool=Math.max(0,teamMates.findIndex(x=>x.id===c.id));
 const real=TEAMS.map(t=>db.clubs.filter(x=>tierNum(x)===tier&&(x.teamId||TEAMS[0].id)===t.id)[pool]||null);
 return {tier,pool,real};
}
/* Completed game results stay stable within the current server session. */
const leagueGameCache=new Map();
function gameTeam(c,average,name,seed,round=1){
 if(!c){
  const make=(i,pitcher)=>{const n=seedNum(seed+':'+(pitcher?'p':'b')+i)*12-6;const base=Math.max(20,Math.min(99,average+n));return {id:'AI-'+seed+'-'+(pitcher?'P':'B')+i,name:(pitcher?'AI 투수 ':'AI 타자 ')+(i+1),isPitcher:pitcher,condition:3,contact:base,power:base,eye:base,speed:base,defense:base,stuff:base,velocity:base,control:base,break:base,stamina:base,mental:base}};
  return {name,hitters:Array.from({length:9},(_,i)=>make(i,false)),pitchers:Array.from({length:3},(_,i)=>make(i,true)),defense:average,round};
 }
 const hitters=(c.lineup||[]).map(id=>c.players.find(p=>p.id===id&&!p.isPitcher)).filter(Boolean).slice(0,9);
 const rotation=c.pitcherRotation||{},all=c.players.filter(p=>p.isPitcher);
 const selected=[rotation['starter'+(1+(round-1)%5)]||c.pitcher,rotation.relief1||c.pitcherAssignments?.relief,rotation.closer||c.pitcherAssignments?.closer].map(id=>all.find(p=>p.id===id)).filter(Boolean);
 const pitchers=[...new Map(selected.map(x=>[x.id,x])).values()];if(!pitchers.length&&all[0])pitchers.push(all[0]);
 const defense=hitters.reduce((acc,p)=>{const pos=matchFieldPosition(c,p);return acc+(Number(p.defense)||50)*(pos==='DH'||DEFENSE_NATIVE[p.pos]===pos?1:.84)},0)/Math.max(1,hitters.length);
 const positions=Object.fromEntries(hitters.map(p=>[p.id,matchFieldPosition(c,p)]));
 return {name,hitters,pitchers,defense,positions,round,winStreak:Math.max(0,Number(c.winStreak)||0),lossStreak:Math.max(0,Number(c.lossStreak)||0)};
}
function runGame(home,away,seed){
 return simulateGame({home,away,seed,stats:(p,ctx)=>p.id?.startsWith('AI-')?p:effectivePlayerStrength(p,ctx)});
}
function leagueInfo(c,now=Date.now()){
 const start=weekStart(now),{tier,pool,real}=leagueMembers(c);
 const members=TEAMS.map((t,i)=>real[i]?{id:real[i].id,name:t.name,real:true,club:real[i],teamId:t.id,ownerName:db.users.find(u=>u.id===real[i].owner)?.ownerName||db.users.find(u=>u.id===real[i].owner)?.username||'구단주'}:{id:'bot-'+pool+'-'+i,name:t.name,real:false,teamId:t.id,ownerName:'AI 감독'});
 const standings=members.map(m=>({id:m.id,name:m.name,played:0,wins:0,losses:0,draws:0,scored:0,allowed:0,teamId:m.teamId,ownerName:m.ownerName}));
 const byId=Object.fromEntries(standings.map(t=>[t.id,t]));let order=[0,1,2,3,4,5,6,7,8,9],games=[];
 let newLeagueResults=0;
 for(let r=0;r<144;r++){
  for(let j=0;j<5;j++){let a=order[j],b=order[9-j];if(r%2===1)[a,b]=[b,a];games.push({round:r+1,slot:Math.floor(r*120/144),home:members[a].id,away:members[b].id})}
  order=[order[0],order[9],...order.slice(1,9)];
 }
 function slotTime(slot){return start+Math.floor(slot/24)*86400000+(slot%24)*3600000}
 function result(g){
  const key=[start,tier,pool,g.round,g.home,g.away].join('|');
  if(leagueGameCache.has(key))return leagueGameCache.get(key);
  const stored=db.leagueGames&&db.leagueGames[key];if(stored){leagueGameCache.set(key,stored);return stored}
  const h=members.find(m=>m.id===g.home),a=members.find(m=>m.id===g.away);
  const strength=LEAGUE_TIERS[tier].average;
  const simulated=runGame(gameTeam(h.club,strength,h.name,key+':home',g.round),gameTeam(a.club,strength,a.name,key+':away',g.round),key);
  const box=(h.club||a.club)?simulated:{home:{runs:simulated.home.runs},away:{runs:simulated.away.runs}};
  leagueGameCache.set(key,box);
  if(leagueGameCache.size>12000)leagueGameCache.delete(leagueGameCache.keys().next().value);
  if(start>=weekStart()-604800000){if(!db.leagueGames)db.leagueGames={};db.leagueGames[key]=box;newLeagueResults++}
  return box;
 }
 const completed=games.filter(g=>slotTime(g.slot)<=now);
 for(const g of completed){const box=result(g),h=box.home.runs,a=box.away.runs,t1=byId[g.home],t2=byId[g.away];t1.played++;t2.played++;t1.scored+=h;t1.allowed+=a;t2.scored+=a;t2.allowed+=h;if(h>a){t1.wins++;t2.losses++}else if(h<a){t2.wins++;t1.losses++}else{t1.draws++;t2.draws++}}
 standings.sort((a,b)=>((b.wins+b.draws*.5)/Math.max(1,b.played))-((a.wins+a.draws*.5)/Math.max(1,a.played))||b.wins-a.wins||(b.scored-b.allowed)-(a.scored-a.allowed));
 const next=games.find(g=>slotTime(g.slot)>now);
 const decorate=g=>({...g,homeName:byId[g.home].name,awayName:byId[g.away].name,homeTeamId:byId[g.home].teamId,awayTeamId:byId[g.away].teamId,homeOwnerName:byId[g.home].ownerName,awayOwnerName:byId[g.away].ownerName,time:slotTime(g.slot)});
 const recent=completed.filter(g=>g.home===c.id||g.away===c.id).slice(-8).reverse().map(g=>{const box=result(g);return {...decorate(g),score:box.home.runs+' : '+box.away.runs,detail:box}});
 const upcoming=games.filter(g=>(g.home===c.id||g.away===c.id)&&slotTime(g.slot)>now).slice(0,6).map(decorate);
 let postseason=[];
 if(now>=start+6*86400000){
  let top=standings.slice(0,4),semi=[[top[0],top[3]],[top[1],top[2]]].map((x,i)=>({label:'준플레이오프 '+(i+1),home:x[0].name,away:x[1].name,homeTeamId:x[0].teamId,awayTeamId:x[1].teamId,homeOwnerName:x[0].ownerName,awayOwnerName:x[1].ownerName,score:null,time:start+6*86400000+(12+i*3)*3600000}));
  postseason=semi;
  if(now>=semi[0].time)semi[0].score='3 : '+Math.floor(seedNum(start+'semi0')*4);
  if(now>=semi[1].time)semi[1].score='4 : '+Math.floor(seedNum(start+'semi1')*4);
  if(now>=start+6*86400000+20*3600000)postseason.push({label:'챔피언 결정전',home:top[0].name,away:top[1].name,homeTeamId:top[0].teamId,awayTeamId:top[1].teamId,homeOwnerName:top[0].ownerName,awayOwnerName:top[1].ownerName,score:'5 : 3',time:start+6*86400000+20*3600000});
 }
 if(newLeagueResults){
  const floor=weekStart()-604800000;
  for(const k of Object.keys(db.leagueGames||{}))if(Number(k.split('|')[0])<floor)delete db.leagueGames[k];
  save();
 }
 return {tier,tierName:LEAGUE_TIERS[tier].name,rewards:LEAGUE_REWARDS[tier],promotionPlaces:tier<LEAGUE_TIERS.length-1?2:0,tiers:LEAGUE_TIERS,aiAverage:LEAGUE_TIERS[tier].average,leagueHistory:(c.leagueHistory||[]).slice(0,6),start,end:start+7*86400000,format:'10개 구단 · 일~목 144경기/구단 · 매시간 경기 결과 · 금요일 휴식 · 토요일 가을야구',maxGames:144,completedRounds:completed.length/5,remainingRounds:144-completed.length/5,nextTime:next?slotTime(next.slot):null,standings:standings.map(x=>x),recent,upcoming,postseason,memberCount:real.length,botCount:10-real.length};
}

function settleSeasons(now=Date.now()){
 const activeStart=weekStart(now),previous=activeStart-604800000;
 if(!db.clubs?.length)return;
 for(const c of db.clubs){
  if(!Number.isFinite(c.lastSettledWeek))c.lastSettledWeek=activeStart-604800000;
  if(!Array.isArray(c.leagueHistory))c.leagueHistory=[];
  if(!Number.isFinite(c.leagueTier))c.leagueTier=0;
 }
 // Resolve all weekly standings before applying any promotion; prevents mid-settlement membership changes.
 for(let w=previous;w>=0;w-=604800000){
  const pending=db.clubs.filter(c=>c.lastSettledWeek<w);
  if(!pending.length)break;
  const outcomes=pending.map(c=>{
   const final=leagueInfo(c,w+6*86400000+23*3600000+59*60000);
   const rank=final.standings.findIndex(x=>x.id===c.id)+1;
   const tier=tierNum(c);
   return {c,rank,tier,reward:LEAGUE_REWARDS[tier][rank-1]||LEAGUE_REWARDS[tier][9],promoted:rank>0&&rank<=2&&tier<LEAGUE_TIERS.length-1,week:w};
  });
  for(const o of outcomes){
   const {c,rank,tier,reward,promoted,week}=o;
   c.cash+=reward.cash;c.cp+=reward.cp;
   c.leagueHistory.unshift({week,league:LEAGUE_TIERS[tier].name,rank,cash:reward.cash,cp:reward.cp,promoted,to:promoted?LEAGUE_TIERS[tier+1].name:null});
   c.leagueHistory=c.leagueHistory.slice(0,20);
   if(promoted)c.leagueTier=tier+1;
   c.lastSettledWeek=week;
  }
  if(outcomes.length)save();
  // Initialize any other clubs created during earlier weeks without fabricating rewards.
  if(w<=Math.min(...db.clubs.map(c=>c.lastSettledWeek)))break;
 }
}


const ADMIN_USERNAME=String(process.env.GM_ADMIN_USERNAME||'').trim().toLowerCase();
const ADMIN_PASSWORD=String(process.env.GM_ADMIN_PASSWORD||'');
const ADMIN_CASH=1000000000000,ADMIN_CP=1000000000;
const isAdminUser=u=>!!(u&&u.isAdmin===true&&ADMIN_USERNAME&&ADMIN_PASSWORD&&String(u.username||'').toLowerCase()===ADMIN_USERNAME);
function adminPassMatches(candidate){
 const a=Buffer.from(String(candidate),'utf8'),b=Buffer.from(ADMIN_PASSWORD,'utf8');
 return b.length>=16&&a.length===b.length&&crypto.timingSafeEqual(a,b);
}
function topUpAdminWallet(u,c){
 if(isAdminUser(u)&&c){c.cash=ADMIN_CASH;c.cp=ADMIN_CP}
}


/* Five editable shop slots. Only the server determines the actual purchase reward and price. */
const DEFAULT_SHOP_CATALOG=[
 {id:'slot1',active:true,kind:'sportsDrink',name:'스포츠음료 10개',desc:'선수 컨디션을 한 단계 올리는 회복 아이템',icon:'🥤',quantity:10,price:1000000},
 {id:'slot2',active:true,kind:'sportsDrink',name:'스포츠음료 50개',desc:'선수단 전체 컨디션 관리를 위한 묶음 상품',icon:'📦',quantity:50,price:4000000},
 {id:'slot3',active:true,kind:'growthBooster',name:'성장부스터',desc:'선수 1명의 성장타입을 S로 승급 · A타입 대비 성장 속도 2배',icon:'🚀',quantity:1,price:20},
 {id:'slot4',active:false,kind:'sportsDrink',name:'',desc:'',icon:'',quantity:1,price:1000000},
 {id:'slot5',active:false,kind:'sportsDrink',name:'',desc:'',icon:'',quantity:1,price:1000000}
];
function shopCatalog(){
 if(!Array.isArray(db.shopCatalog)||db.shopCatalog.length!==5){
  db.shopCatalog=DEFAULT_SHOP_CATALOG.map(x=>({...x}));
  db.shopCatalogVersion=2;
 }else if((Number(db.shopCatalogVersion)||0)<2){
  // One-time migration. Never reinstate an item that an administrator subsequently disables.
  if(!db.shopCatalog.some(item=>item.kind==='growthBooster')){
   const empty=db.shopCatalog.findIndex((item,i)=>i>=2&&item.active!==true&&!String(item.name||'').trim());
   if(empty>=0)db.shopCatalog[empty]={...DEFAULT_SHOP_CATALOG[2],id:'slot'+(empty+1)};
  }
  db.shopCatalogVersion=2;
 }
 return db.shopCatalog;
}
function shopPublicCatalog(user){
 return shopCatalog().map(item=>(isAdminUser(user)||item.active)?{...item}:{id:item.id,active:false});
}
function cleanShopText(value,length,required=false){
 const text=String(value??'').trim().replace(/[\u0000-\u001F\u007F]/g,' ');
 if(required&&!text)throw Error('상품명과 아이콘을 입력하세요');
 if([...text].length>length)throw Error('상품 설명이 너무 깁니다');
 return text;
}


const SPECIAL_DRAW_COST_CP=5;
function makeScoutPlayer(owner,kind,currency,era){
 const roll=Math.random(),level=currency==='cash'?(roll<.50?5:roll<.80?6:roll<.95?7:8):(roll<.50?7:roll<.80?8:roll<.95?9:10);
 const p=player(owner);
 if(kind==='pitcher'){p.isPitcher=true;p.pos=['선발','중계','마무리'][rand(0,2)]}
 if(kind==='hitter'){p.isPitcher=false;p.pos=['포수','1루수','2루수','3루수','유격수','좌익수','중견수','우익수'][rand(0,7)]}
 if(kind==='era')p.year=era;
 p.level=level;
 ensurePlayer(p);
 const center=30+level*5.8;
 for(const key of statKeys(p))p[key]=statValue(center+(Math.random()-.5)*13);
 if(!p.originTeam)p.originTeam=TEAMS[rand(0,TEAMS.length-1)].id;
 p.specialAbilities=rollScoutSpecials(p);
 return p;
}

const attendanceDay=()=>new Date(Date.now()+9*60*60*1000).toISOString().slice(0,10);
function attendanceState(c){
 const day=attendanceDay();
 const record=c?.dailyAttendance;
 return {day,claimed:record?.day===day,record:record?.day===day?record:null};
}
const view=(u)=>{syncGrowth();settleSeasons();creditLeagueGames();topUpAdminWallet(u,u?db.clubs.find(c=>c.owner===u.id):null);return ({user:u?{id:u.id,username:u.username,ownerName:u.ownerName||u.username,teamId:u.teamId,isAdmin:isAdminUser(u)}:null,specialAbilityCatalog:SPECIAL_ABILITIES.map(({id,name,type,source,when,desc,tier})=>({id,name,type,source,when,desc,tier:tier||'normal'})),shopItems:shopPublicCatalog(u),dailyAttendance:u&&db.clubs.find(c=>c.owner===u.id)?attendanceState(db.clubs.find(c=>c.owner===u.id)):{day:attendanceDay(),claimed:false,record:null},rewardedAd:{enabled:AD_REWARDS_ENABLED,adUnit:AD_REWARDS_ENABLED?GAM_REWARDED_UNIT:null,rewardCP:AD_REWARD_CP,dailyLimit:AD_DAILY_LIMIT,used:u?rewardUsage(db.clubs.find(c=>c.owner===u.id)).used:0},teams:TEAMS,club:u?db.clubs.find(c=>c.owner===u.id)||null:null,listings:db.listings.map(x=>({...x,sellerName:db.clubs.find(c=>c.owner===x.seller)?.name||'?',sellerTeamId:db.clubs.find(c=>c.owner===x.seller)?.teamId||null})).sort((a,b)=>b.date-a.date).slice(0,200),ranking:db.clubs.map(c=>({name:c.name,wins:c.wins,losses:c.losses})).sort((a,b)=>b.wins-a.wins).slice(0,10),league:u&&db.clubs.find(c=>c.owner===u.id)?leagueInfo(db.clubs.find(c=>c.owner===u.id)):null})};
const pwd=(pw,salt)=>crypto.scryptSync(pw,salt,32).toString('hex');
async function act(req,res){let body='';for await(const part of req){body+=part;if(body.length>30000)return send(res,413,{error:'요청 초과'})}let a;try{a=JSON.parse(body)}catch(e){return send(res,400,{error:'잘못된 요청'})}let u=db.users.find(x=>x.id===sessions.get(getCookie(req)));
try{
if(a.type==='checkUsername'){
 const name=String(a.username||'').trim();
 if(!/^[a-zA-Z0-9가-힣_]{3,20}$/.test(name))return send(res,400,{error:'아이디는 한글·영문·숫자·밑줄로 3~20자 입력하세요'});
 return send(res,200,{available:name.toLowerCase()!==ADMIN_USERNAME&&!db.users.some(x=>x.username.toLowerCase()===name.toLowerCase()),username:name});
}
if(a.type==='register'||a.type==='login'){const name=String(a.username||'').trim(),pass=String(a.password||'');const team=TEAMS.find(t=>t.id===a.teamId);if(!team)throw Error('로그인 전에 구단을 선택하세요');if(!/^[a-zA-Z0-9가-힣_]{3,20}$/.test(name))throw Error('아이디는 한글·영문·숫자·밑줄로 3~20자 입력하세요');if(a.type==='register'&&(pass.length<8||!/[^a-zA-Z0-9가-힣]/.test(pass)))throw Error('비밀번호는 특수문자를 포함해 8자 이상 입력하세요');if(a.type==='login'&&!pass)throw Error('비밀번호를 입력하세요');let found=db.users.find(x=>x.username.toLowerCase()===name.toLowerCase());
 if(ADMIN_USERNAME&&name.toLowerCase()===ADMIN_USERNAME){
  if(a.type==='register')throw Error('관리자 전용 아이디입니다');
  if(!adminPassMatches(pass))throw Error('아이디 또는 비밀번호 오류');
  if(found&&!found.isAdmin)throw Error('관리자 아이디가 이미 사용 중입니다');
  if(!found){
   const salt=crypto.randomBytes(16).toString('hex');
   found={id:uid(),username:ADMIN_USERNAME,salt,hash:pwd(pass,salt),teamId:'bears',ownerName:'게임 관리자',isAdmin:true};
   db.users.push(found);
  }else{found.hash=pwd(pass,found.salt)}
  if(!db.clubs.some(c=>c.owner===found.id))db.clubs.push(club(found,'서울 불곰즈'));
 }
 if(a.type==='register'){if(found)throw Error('이미 존재하는 아이디');const ownerName=String(a.ownerName||'').trim();if(ownerName.length<2||ownerName.length>16||/[<>]/.test(ownerName))throw Error('구단주명은 2~16자로 입력해 주세요');const salt=crypto.randomBytes(12).toString('hex');found={id:uid(),username:name,salt,hash:pwd(pass,salt),teamId:team.id,ownerName};db.users.push(found)}else if(!found||found.hash!==pwd(pass,found.salt))throw Error('아이디 또는 비밀번호 오류');if(found.teamId&&found.teamId!==team.id)throw Error('가입 당시 선택한 구단으로 로그인하세요');if(!found.teamId){found.teamId=team.id;const old=db.clubs.find(x=>x.owner===found.id);if(old){old.teamId=team.id;old.name=team.name}}const token=crypto.randomBytes(24).toString('hex');sessions.set(token,found.id);save();return send(res,200,view(found),{'Set-Cookie':'sid='+token+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000'})}
if(a.type==='logout'){sessions.delete(getCookie(req));return send(res,200,{user:null},{'Set-Cookie':'sid=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'})}
if(!u)throw Error('로그인이 필요합니다');let c=db.clubs.find(x=>x.owner===u.id),result=null;topUpAdminWallet(u,c);
if(a.type==='claimDailyAttendance'){
 if(!c)throw Error('구단을 먼저 생성하세요');
 const today=attendanceDay();
 if(c.dailyAttendance?.day===today)throw Error('오늘의 출석 보상을 이미 받았습니다');
 const currency=crypto.randomInt(2)===0?'cash':'cp';
 // 91 equally likely cash rewards (100m..1b, 10m steps),
 // or 4,991 equally likely CP rewards (10..5000 inclusive).
 const amount=currency==='cash'?100000000+crypto.randomInt(91)*10000000:crypto.randomInt(10,5001);
 if(currency==='cash')c.cash=(Number(c.cash)||0)+amount;
 else c.cp=(Number(c.cp)||0)+amount;
 c.dailyAttendance={day:today,currency,amount,claimedAt:Date.now()};
 result={message:'오늘의 출석 보상 지급 완료',attendanceReward:{currency,amount,day:today}};
}
else if(a.type==='createClub'){if(c)throw Error('이미 구단 존재');const team=TEAMS.find(t=>t.id===u.teamId);if(!team)throw Error('팀을 먼저 선택하세요');c=club(u,team.name);db.clubs.push(c)}
else{if(!c)throw Error('구단을 먼저 창단하세요');
if(a.type==='setGrowthFocus'){
 const p=c.players.find(x=>x.id===a.id);
 if(!p)throw Error('선수를 찾을 수 없습니다');
 const focus=String(a.focus||'balanced');
 if(focus!=='balanced'&&!statKeys(p).includes(focus))throw Error('선택할 수 없는 집중 성장 능력치가 아닙니다');
 p.growthFocusSelected=focus!=='balanced';
 p.growthFocus=p.growthFocusSelected?focus:null;
 result={message:p.name+' 성장 전략: '+(p.growthFocusSelected?(STAT_LABELS[p.growthFocus]+' 집중'):'균형 성장')+' 설정 완료'};
}
else if(a.type==='upgrade'){const p=c.players.find(x=>x.id===a.id);if(!p)throw Error('선수 없음');const next={E:['D',0.65],D:['C',.5],C:['B',.25],B:['A',.1]}[p.grade];if(!next)throw Error('최고 등급입니다');if(c.cp<1)throw Error('CP 부족');c.cp--;let ok=Math.random()<next[1];if(ok)p.grade=next[0];result={message:ok?'등급 성장 성공! '+p.grade+'등급':'성장 실패 (등급 유지)'}}
else if(a.type==='train'){const p=c.players.find(x=>x.id===a.id),stat=String(a.key);if(!p||!statKeys(p).includes(stat))throw Error('잘못된 선수/능력치');if(c.cash<1000000)throw Error('게임머니 부족');if(p[stat]>=CAP)throw Error('최대 능력치');c.cash-=1000000;const ageEffect=p.age<=24?1.25:p.age<=29?1:p.age<=34?.75:.55;const rankEffect={E:.5,D:.7,C:.85,B:1,A:1.2,S:2.4}[p.grade]||.5;p[stat]=statValue(p[stat]+(0.30+Math.random()*1.3)*ageEffect*rankEffect);result={message:'훈련 성공! 능력치 '+p[stat].toFixed(2)}}
else if(a.type==='scout'||a.type==='scoutBatch'){
 const configs={basic:{label:'일반 스카우트',multiplier:1},era:{label:'연도별 스카우트',multiplier:2},hitter:{label:'타자 전용 스카우트',multiplier:2},pitcher:{label:'투수 전용 스카우트',multiplier:2}};
 const kind=String(a.kind||'basic'),currency=String(a.currency||'cash'),config=configs[kind];
 const isBatch=a.type==='scoutBatch',count=isBatch?Number(a.count):1;
 if(!config)throw Error('선택할 수 없는 스카우트 유형입니다');
 if(!['cash','cp'].includes(currency))throw Error('결제 수단을 선택하세요');
 if(!Number.isInteger(count)||!(isBatch?[10,100]:[1]).includes(count))throw Error('연속 스카우트는 10회 또는 100회를 선택하세요');
 if(c.pendingScout?.player||c.pendingScoutBatch?.items?.length)throw Error('기존 스카우트 결과에서 영입 또는 방출을 먼저 결정하세요');
 if(c.players.length>=80)throw Error('선수단 최대 80명입니다. 선수를 정리한 뒤 스카우트를 진행하세요');
 const unit=currency==='cash'?10000000*config.multiplier:5*config.multiplier,total=unit*count;
 if(currency==='cash'&&c.cash<total)throw Error('스카우트 자금이 부족합니다');
 if(currency==='cp'&&c.cp<total)throw Error('스카우트 CP가 부족합니다');
 let era=null;
 if(kind==='era'){era=Number(a.era);if(!Number.isInteger(era)||era<2000||era>2026)throw Error('2000~2026년 중 정확한 연도를 선택하세요')}
 const players=Array.from({length:count},()=>makeScoutPlayer(u.id,kind,currency,era));
 // All draws and their respective special ability rolls are independent.
 if(currency==='cash')c.cash-=total;else c.cp-=total;
 if(isBatch){
  c.pendingScoutBatch={id:uid(),items:players.map(p=>({id:uid(),player:p})),kind,currency,count,cost:total,time:Date.now()};
  result={message:count+'회 스카우트 완료 · 영입할 선수를 선택하세요',scoutBatch:true};
 }else{
  const p=players[0],scoutRecordId=uid();
  c.pendingScout={id:scoutRecordId,player:p,time:Date.now(),kind,currency,cost:total};
  c.scoutHistory=Array.isArray(c.scoutHistory)?c.scoutHistory:[];
  c.scoutHistory.unshift({id:scoutRecordId,status:'pending',kind,label:config.label,currency,cost:total,level:p.level,player:{...p},time:Date.now()});
  c.scoutHistory=c.scoutHistory.slice(0,30);
  result={message:'Lv'+p.level+' '+p.name+' 선수를 발견했습니다',scouted:p};
 }
}
else if(a.type==='scoutBatchDecision'){
 const pending=c.pendingScoutBatch;
 if(!pending?.items?.length)throw Error('결정할 연속 스카우트 결과가 없습니다');
 if(String(a.id)!==pending.id)throw Error('스카우트 결과가 만료되었습니다');
 const accepted=a.recruitIds;
 if(!Array.isArray(accepted)||accepted.length>80||new Set(accepted).size!==accepted.length||accepted.some(x=>typeof x!=='string'))throw Error('선수 선택 정보가 올바르지 않습니다');
 const offered=new Set(pending.items.map(item=>item.id));
 if(accepted.some(id=>!offered.has(id)))throw Error('선택한 선수를 찾을 수 없습니다');
 const chosen=new Set(accepted);
 if(c.players.length+chosen.size>80)throw Error('보유 선수단 80명 한도를 초과합니다. 영입 선수를 줄여주세요');
 const recruited=pending.items.filter(item=>chosen.has(item.id)).map(item=>item.player);
 const released=pending.items.length-recruited.length;
 c.players.push(...recruited);
 c.cash+=released*1000000;
 c.pendingScoutBatch=null;
 fix(c);
 result={message:'연속 스카우트 완료 · '+recruited.length+'명 영입, '+released+'명 방출',scoutBatchDecision:true,recruited:recruited.length,released,reward:released*1000000};
}
else if(a.type==='removeSpecialAbility'){
 const p=c.players.find(x=>x.id===String(a.id||''));
 if(!p)throw Error('소속 선수를 찾을 수 없습니다');
 ensurePlayer(p);
 const skillId=String(a.abilityId||'');
 const index=p.specialAbilities.indexOf(skillId);
 if(index<0)throw Error('해당 선수가 보유하지 않은 특수능력입니다');
 const skill=SPECIAL_BY_ID.get(skillId);
 p.specialAbilities.splice(index,1);
 result={message:p.name+' 선수의 '+(skill?.name||'특수능력')+' 삭제 완료',removedAbility:skillId,playerId:p.id};
}
else if(a.type==='drawSpecialAbility'){
 const p=c.players.find(x=>x.id===String(a.id||''));
 if(!p)throw Error('소속 선수를 찾을 수 없습니다');
 ensurePlayer(p);
 if(p.specialAbilities.length>=8)throw Error('특수능력 8칸이 모두 채워졌습니다');
 if(!Number.isFinite(c.cp)||c.cp<SPECIAL_DRAW_COST_CP)throw Error('특수능력 뽑기에 필요한 CP가 부족합니다');
 const existing=new Set(p.specialAbilities);
 // Every training skill for this batter/pitcher category can be drawn, even if
 // the player's current position or match situation cannot activate it.
 const tierCount=tier=>p.specialAbilities.filter(id=>SPECIAL_BY_ID.get(id)?.tier===tier).length;
 const pool=SPECIAL_ABILITIES.filter(x=>x.type===(p.isPitcher?'pitcher':'batter')&&x.source==='training'&&!existing.has(x.id)&&(!['legend','s'].includes(x.tier)||tierCount(x.tier)<2));
 if(!pool.length)throw Error('새로 배울 수 있는 특수능력이 없습니다');
 const picked=pool[crypto.randomInt(pool.length)];
 c.cp-=SPECIAL_DRAW_COST_CP;
 p.specialAbilities.push(picked.id);
 result={message:p.name+' 선수 특수능력 획득 · '+picked.name,addedAbility:{id:picked.id,name:picked.name,desc:picked.desc},playerId:p.id};
}
else if(a.type==='scoutDecision'){
 const pending=c.pendingScout;
 if(!pending?.player)throw Error('결정할 스카우트 선수가 없습니다');
 if(String(a.id)!==pending.id)throw Error('해당 스카우트 결과가 만료되었습니다');
 const decision=String(a.decision||'');
 if(!['recruit','release'].includes(decision))throw Error('영입하기 또는 방출하기를 선택하세요');
 const p=pending.player;
 if(decision==='recruit'){
  if(c.players.length>=80)throw Error('선수단이 가득 찼습니다');
  c.players.push(p);fix(c);
  result={message:p.name+' 선수를 영입했습니다',scoutDecision:'recruit',player:p};
 }else{
  c.cash+=1000000;
  result={message:p.name+' 선수를 방출하고 100만원을 획득했습니다',scoutDecision:'release',reward:1000000};
 }
 const history=(c.scoutHistory||[]).find(h=>h.id===pending.id);
 if(history)history.status=decision==='recruit'?'recruited':'released';
 c.pendingScout=null;
}
else if(a.type==='list'){const p=c.players.find(x=>x.id===a.id),price=Number(a.price);if(!p)throw Error('선수 없음');if(!Number.isSafeInteger(price)||price<100000||price>100000000000)throw Error('가격은 10만원 이상');if(c.players.length<=15)throw Error('선수단 최소 15명 유지');c.players=c.players.filter(x=>x.id!==p.id);db.listings.push({id:uid(),seller:u.id,player:p,price,date:Date.now()});fix(c);result={message:'판매 등록 완료'}}
else if(a.type==='cancel'){const i=db.listings.findIndex(x=>x.id===a.id&&x.seller===u.id);if(i<0)throw Error('판매글 없음');if(c.players.length>=80)throw Error('선수단이 가득 참');c.players.push(db.listings.splice(i,1)[0].player);fix(c)}
else if(a.type==='buy'){const i=db.listings.findIndex(x=>x.id===a.id);if(i<0)throw Error('이미 판매됨');const l=db.listings[i];if(l.seller===u.id)throw Error('내 선수 구매 불가');if(c.cash<l.price)throw Error('게임머니 부족');if(c.players.length>=80)throw Error('선수단 최대');const s=db.clubs.find(x=>x.owner===l.seller);if(!s)throw Error('판매 구단 없음');c.cash-=l.price;s.cash+=l.price;l.player.owner=u.id;c.players.push(l.player);db.listings.splice(i,1);c.transactions.unshift({type:'구매',name:l.player.name,price:l.price});s.transactions.unshift({type:'판매',name:l.player.name,price:l.price});fix(c);result={message:'구매 완료'}}
else if(a.type==='saveLineup'){
 fix(c);
 const batting=Array.isArray(a.batting)?a.batting:[],defense=a.defense&&typeof a.defense==='object'?a.defense:{};
 const pitcherRoles=['starter1','starter2','starter3','starter4','starter5','relief1','relief2','relief3','relief4','setup','closer'];
 const rotation=a.rotation&&typeof a.rotation==='object'?a.rotation:null;
 const bench=Array.isArray(a.bench)?a.bench:null;
 const batIds=new Set(c.players.filter(p=>!p.isPitcher).map(p=>p.id)),pitchIds=new Set(c.players.filter(p=>p.isPitcher).map(p=>p.id));
 if(batting.length!==9||new Set(batting).size!==9||batting.some(id=>!batIds.has(id)))throw Error('타선은 서로 다른 타자 9명을 지정해야 합니다');
 const selected=DEFENSE_POS.map(pos=>defense[pos]);
 if(selected.some(id=>!batIds.has(id))||new Set(selected).size!==9||selected.some(id=>!batting.includes(id)))throw Error('수비 포지션은 타선의 9명을 중복 없이 지정해야 합니다');
 if(bench!==null){
  const available=[...batIds].filter(id=>!batting.includes(id)),max=Math.min(5,available.length);
  if(bench.length!==max||new Set(bench).size!==max||bench.some(id=>!available.includes(id)))throw Error('교체선수는 선발 외 '+max+'명을 지정하세요');
  c.benchIds=[...bench];
 }
 if(rotation){
  const values=pitcherRoles.map(role=>rotation[role]).filter(Boolean);
  if(values.some(id=>!pitchIds.has(id))||new Set(values).size!==values.length)throw Error('투수 라인업에 같은 선수를 중복 배치할 수 없습니다');
  c.pitcherRotation=Object.fromEntries(pitcherRoles.map(role=>[role,rotation[role]||null]));
  c.pitcher=c.pitcherRotation.starter1||c.pitcher;
  c.pitcherAssignments={starter:c.pitcher,relief:c.pitcherRotation.relief1,closer:c.pitcherRotation.closer};
 }else{
  const pitchers=a.pitchers||{};
  const values=['starter','relief','closer'].map(role=>pitchers[role]);
  if(values.some(id=>!pitchIds.has(id))||new Set(values).size!==3)throw Error('세 명의 투수를 지정하세요');
  c.pitcherAssignments={starter:values[0],relief:values[1],closer:values[2]};c.pitcher=values[0];
 }
 c.lineup=[...batting];c.defensePositions=Object.fromEntries(DEFENSE_POS.map((pos,i)=>[pos,selected[i]]));
 result={message:'타자 및 투수 라인업을 저장했습니다'};
}
else if(a.type==='lineup'){const p=c.players.find(x=>x.id===a.id);if(!p)throw Error('선수 없음');if(a.pitcher){if(!p.isPitcher)throw Error('투수를 선택하세요');c.pitcher=p.id}else{if(p.isPitcher)throw Error('타자를 선택하세요');c.lineup=c.lineup.filter(x=>x!==p.id);c.lineup.splice(Math.max(0,Math.min(8,Number(a.slot)||0)),0,p.id);c.lineup=c.lineup.slice(0,9)}fix(c)}
else if(a.type==='shopSave'){
 if(!isAdminUser(u))throw Error('관리자 계정만 상점 상품을 수정할 수 있습니다');
 const slot=Number(a.slot);
 if(!Number.isInteger(slot)||slot<1||slot>5)throw Error('상품 위치가 올바르지 않습니다');
 const active=a.active===true;
 const current=shopCatalog()[slot-1];
 const reset=a.reset===true;
 if(reset){
  db.shopCatalog[slot-1]={id:current.id,active:false,kind:'sportsDrink',name:'',desc:'',icon:'',quantity:1,price:1000000};
 }else{
  const kind=String(a.kind||current.kind||'sportsDrink');
  if(!['sportsDrink','growthBooster'].includes(kind))throw Error('등록할 수 없는 상품 종류입니다');
  const name=cleanShopText(a.name,40,active),desc=cleanShopText(a.desc,160),icon=cleanShopText(a.icon,5,active);
  const price=Number(a.price),quantity=Number(a.quantity);
  const minPrice=kind==='growthBooster'?1:1000,maxPrice=kind==='growthBooster'?100000:1000000000;
  if(!Number.isSafeInteger(price)||price<minPrice||price>maxPrice)throw Error('가격 범위: 성장부스터 1~100,000 CP / 스포츠음료 1,000~10억원');
  if(!Number.isSafeInteger(quantity)||quantity<1||quantity>10000)throw Error('수량은 1~10,000개 사이의 정수로 입력하세요');
  db.shopCatalog[slot-1]={id:current.id,active,kind,name,desc,icon,quantity,price};
 }
 result={message:slot+'번 상품이 '+(db.shopCatalog[slot-1].active?'판매 중으로 저장':'입고중으로 저장')+'되었습니다'};
}
else if(a.type==='rewardAdStart'){
 if(!AD_REWARDS_ENABLED)throw Error('광고 수익 서비스 연결 후 이용할 수 있습니다');
 if(rewardUsage(c).used>=AD_DAILY_LIMIT)throw Error('오늘의 추가지원 광고 시청 한도를 사용했습니다');
 if(c.rewardedAdPending&&Date.now()-c.rewardedAdPending.createdAt<60000)throw Error('이전 광고 확인이 진행 중입니다');
 c.rewardedAdPending={nonce:uid(),createdAt:Date.now()};
 result={message:'광고 요청 준비 완료',adNonce:c.rewardedAdPending.nonce};
}
else if(a.type==='shopBuy'){
 const offer=shopCatalog().find(x=>x.id===String(a.item||'')&&x.active===true);
 if(!offer||!['sportsDrink','growthBooster'].includes(offer.kind))throw Error('판매 중인 상품이 아닙니다');
 const cpItem=offer.kind==='growthBooster';
 if(!Number.isSafeInteger(offer.price)||offer.price<(cpItem?1:1000))throw Error('상품 가격이 올바르지 않습니다');
 if(!Number.isSafeInteger(offer.quantity)||offer.quantity<1)throw Error('상품 수량이 올바르지 않습니다');
 if(cpItem){
  if(!Number.isFinite(c.cp)||c.cp<offer.price)throw Error('보유 CP가 부족합니다');
  if(!Number.isSafeInteger(c.growthBoosters||0)||c.growthBoosters<0)throw Error('보유 부스터 정보가 올바르지 않습니다');
  if((c.growthBoosters||0)+offer.quantity>999999)throw Error('성장부스터 보관 한도를 초과했습니다');
  c.cp-=offer.price;
  c.growthBoosters=(c.growthBoosters||0)+offer.quantity;
 }else{
  if(!Number.isFinite(c.cash)||c.cash<offer.price)throw Error('보유 게임머니가 부족합니다');
  if(!Number.isSafeInteger(c.sportsDrinks||0)||c.sportsDrinks<0)throw Error('보유 음료 정보가 올바르지 않습니다');
  if((c.sportsDrinks||0)+offer.quantity>999999)throw Error('스포츠음료 보관 한도를 초과했습니다');
  c.cash-=offer.price;
  c.sportsDrinks=(c.sportsDrinks||0)+offer.quantity;
 }
 result={message:offer.name+' 구매 완료',purchasedItem:offer.id,quantity:offer.quantity};
}
else if(a.type==='useGrowthBooster'){
 const p=c.players.find(x=>x.id===String(a.id||''));
 if(!p)throw Error('구단에 소속된 선수가 아닙니다');
 ensurePlayer(p);
 if(p.grade==='S')throw Error('이미 성장타입 S인 선수입니다');
 if(!Number.isSafeInteger(c.growthBoosters||0)||(c.growthBoosters||0)<1)throw Error('성장부스터가 부족합니다');
 c.growthBoosters--;
 p.grade='S';
 result={message:p.name+' 선수 성장타입 S 달성! A타입 대비 2배 성장'};
}
else if(a.type==='useDrink'){
 const p=c.players.find(p=>p.id===a.id);if(!p)throw Error('선수가 없습니다');
 ensurePlayer(p);if((c.sportsDrinks||0)<1)throw Error('스포츠음료가 부족합니다');
 if(p.condition>=5)throw Error('이미 최강 컨디션입니다');
 c.sportsDrinks--;p.condition++;
 result={message:p.name+' 선수의 컨디션이 한 단계 상승했습니다'};
}
else if(a.type==='friendly'){
 fix(c);
 const day=new Date(Date.now()+32400000).toISOString().slice(0,10);
 if(!c.friendlyDaily||c.friendlyDaily.day!==day)c.friendlyDaily={day,used:0};
 if(c.friendlyDaily.used>=10)throw Error('오늘의 친선경기 10회를 모두 사용했습니다');
 const tier=Math.max(0,Math.min(LEAGUE_TIERS.length-1,Math.trunc(Number(a.tier)||0)));
 const rewardType=String(a.reward||'cash');if(!['cash','cp'].includes(rewardType))throw Error('보상 종류가 잘못되었습니다');
 const opponent=LEAGUE_TIERS[tier],enemyStrength=Math.max(20,Math.min(99.99,opponent.average+(Math.random()-.5)*8));
 const time=Date.now(),game=runGame(gameTeam(c,0,c.name,'friendly-home-'+time,1),gameTeam(null,enemyStrength,opponent.name,'friendly-away-'+time,1),'friendly-'+c.id+'-'+time+'-'+c.friendlyDaily.used);
 const ours=game.home.runs,theirs=game.away.runs,outcome=ours>theirs?'win':ours<theirs?'loss':'draw';
 c.friendlyDaily.used++;
 if(outcome==='win'){c.winStreak=(Number(c.winStreak)||0)+1;c.lossStreak=0}
 else if(outcome==='loss'){c.lossStreak=(Number(c.lossStreak)||0)+1;c.winStreak=0}
 else {c.winStreak=0;c.lossStreak=0}
 let cash=0,cp=0,drinks=0;
 // Friendly rewards: +50% to the previous win payouts. Draws now give a 25% consolation
 // reward of the enhanced win payout in the currency the manager chose.
 const standardCash=Math.round((1000000+tier*1200000+enemyStrength*45000)/100000)*100000;
 const standardCP=Math.max(1,Math.round(2+tier*1.6+enemyStrength/25));
 const winCash=Math.round(standardCash*1.5/100000)*100000,winCP=Math.max(1,Math.round(standardCP*1.5));
 if(outcome==='win'||outcome==='draw'){
  if(rewardType==='cash'){
   cash=outcome==='win'?winCash:Math.max(100000,Math.round(winCash*0.25/100000)*100000);
   c.cash+=cash;
  }else{
   cp=outcome==='win'?winCP:Math.max(1,Math.round(winCP*0.25));
   c.cp+=cp;
  }
 }else if(outcome==='loss'){drinks=10;c.sportsDrinks=(c.sportsDrinks||0)+10}
 const participating=[...c.lineup,c.pitcher].map(id=>c.players.find(p=>p.id===id)).filter(Boolean);
 const playerStats=[];
 for(const p of participating){
  const bat=game.home.batters.find(x=>x.id===p.id),pitch=game.home.pitchers.find(x=>x.id===p.id),before=p.condition;
  const good=p.isPitcher?pitch&&pitch.er<=1:bat&&(bat.h>=3||bat.hr>0);
  const poor=p.isPitcher?pitch&&pitch.er>=4:bat&&bat.ab>=3&&bat.h===0;
  // Practice games do not change the player's condition; preserve the pre-game value.
  p.condition=before;
  p.games=(p.games||0)+1;
  if(bat){p.hr=(p.hr||0)+bat.hr;p.avg=((Number(p.avg)||0)*Math.max(0,p.games-1)+(bat.ab?bat.h/bat.ab:0))/p.games}
  if(pitch)p.era=pitch.era;
  playerStats.push({id:p.id,name:p.name,position:p.pos,summary:bat?bat.ab+'타수 '+bat.h+'안타 '+bat.hr+'홈런':pitch?pitch.ip+'이닝 '+pitch.er+'자책 '+pitch.so+'탈삼진':'미출전',before,after:p.condition,delta:p.condition-before,activatedAbilities:(bat||pitch)?.activatedAbilities?.map(name=>({name}))||[]});
 }
 applyTeamGameGrowth(c,1,participating.map(p=>p.id));
 const entry={time,tier,opponent:opponent.name,enemyStrength:Number(enemyStrength.toFixed(2)),ours,theirs,outcome,cash,cp,drinks,playerStats,detail:game};
 c.friendlyHistory=Array.isArray(c.friendlyHistory)?c.friendlyHistory:[];c.friendlyHistory.unshift(entry);c.friendlyHistory=c.friendlyHistory.slice(0,20);
 result={message:'친선경기 '+(outcome==='win'?'승리':outcome==='loss'?'패배':'무승부'),friendly:entry};
}
else if(a.type==='play'){
 fix(c);
 const time=Date.now(),game=runGame(gameTeam(c,0,c.name,'exhibition-home-'+time,1),gameTeam(null,55,'AI 구단','exhibition-away-'+time,1),'exhibition-'+c.id+'-'+time);
 const ours=game.home.runs,theirs=game.away.runs;
 if(ours>theirs)c.wins++;else if(ours<theirs)c.losses++;else c.draws++;
 c.cash+=ours>theirs?3500000:ours===theirs?1800000:1000000;c.cp+=ours>theirs?3:1;
 const active=[...c.lineup,c.pitcher].filter(Boolean);applyTeamGameGrowth(c,1,active); // Exhibition training is retained; condition stays unchanged.
 result={message:'경기 결과 '+c.name+' '+ours+' : '+theirs+' AI 구단',ours,theirs,detail:game};
}
else throw Error('알 수 없는 동작');}
topUpAdminWallet(u,c);save();return send(res,200,{...view(u),result})}catch(e){return send(res,400,{error:e.message})}}
let queue=Promise.resolve();http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname==='/api/state')return send(res,200,view(db.users.find(x=>x.id===sessions.get(getCookie(req)))));if(url.pathname==='/api/action'&&req.method==='POST'){queue=queue.then(()=>act(req,res)).catch(()=>send(res,500,{error:'서버 오류'}));return}if(url.pathname==='/api/rewarded-verify'&&req.method==='POST'){queue=queue.then(()=>verifiedAdWebhook(req,res)).catch(()=>send(res,500,{error:'광고 확인 오류'}));return}if(req.method!=='GET')return send(res,405,{error:'허용되지 않음'});if(url.pathname==='/avatar3d.js')return fs.readFile(__dirname+'/avatar3d.js',(err,data)=>{if(err)return send(res,404,{error:'3D 캐릭터 파일 없음'});res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store, must-revalidate'});res.end(data)});
if(url.pathname!=='/'&&url.pathname!=='/index.html')return send(res,404,{error:'페이지 없음'});fs.readFile(__dirname+'/index.html',(err,data)=>{if(err)return send(res,500,{error:'게임 화면 없음'});res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(data)})}).listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Diamond GM test server running'));