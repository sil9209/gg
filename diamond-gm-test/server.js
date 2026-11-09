const http=require('http'),fs=require('fs'),crypto=require('crypto');
const PATH='diamond-gm-test-data.json'; let db={users:[],clubs:[],listings:[]};try{db=JSON.parse(fs.readFileSync(PATH,'utf8'))}catch(e){}
const sessions=new Map();let lock=Promise.resolve();const uid=()=>crypto.randomUUID();const rand=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const names1=['김','박','이','최','정','강','조','윤','장','임','한','오','서','신','권','황'],names2=['도현','성준','재원','민수','지훈','태영','현우','주원','준혁','승민','태준','지성','건우','동현','진우','정민'];
function player(owner){const isP=Math.random()<.36,year=rand(2000,2026),pos=isP?['선발','중계','마무리'][rand(0,2)]:['포수','1루수','2루수','3루수','유격수','좌익수','중견수','우익수'][rand(0,7)];return {id:uid(),owner,name:names1[rand(0,names1.length-1)]+names2[rand(0,names2.length-1)],year,pos,isPitcher:isP,grade:'D',power:rand(40,76),contact:rand(40,76),eye:rand(40,76),speed:rand(40,76),defense:rand(40,76),stamina:rand(40,76),games:0,avg:0,hr:0,era:0}}
function club(user,name){const players=Array.from({length:25},()=>player(user.id));return {id:uid(),owner:user.id,name,teamId:user.teamId,cash:500000000,cp:300,players,lineup:players.filter(p=>!p.isPitcher).slice(0,9).map(p=>p.id),pitcher:players.find(p=>p.isPitcher).id,wins:0,losses:0,draws:0,season:1,transactions:[]}}
function fix(c){const bat=c.players.filter(p=>!p.isPitcher),pitch=c.players.filter(p=>p.isPitcher);c.lineup=[...new Set((c.lineup||[]).filter(id=>bat.some(p=>p.id===id)))];for(const p of bat)if(c.lineup.length<9&&!c.lineup.includes(p.id))c.lineup.push(p.id);if(!pitch.some(p=>p.id===c.pitcher))c.pitcher=pitch[0]?.id||null}
function save(){fs.writeFileSync(PATH,JSON.stringify(db))}
function send(res,status,obj,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',...headers});res.end(JSON.stringify(obj))}
function getCookie(req){return (req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('sid='))?.slice(4)}

const TEAMS=[{"id":"twins","name":"서울 쌍둥이즈","city":"서울","symbol":"Ⅱ","color":"#C92845","secondary":"#263B69","mascot":"쌍둥이"},{"id":"bears","name":"서울 불곰즈","city":"서울","symbol":"B","color":"#24385C","secondary":"#BA7246","mascot":"불곰"},{"id":"heroes","name":"서울 번개단","city":"서울","symbol":"⚡","color":"#982D50","secondary":"#E8B6C2","mascot":"번개"},{"id":"landers","name":"인천 항해자들","city":"인천","symbol":"N","color":"#D73545","secondary":"#D7BC83","mascot":"항해"},{"id":"wizards","name":"수원 마법사들","city":"수원","symbol":"W","color":"#292B35","secondary":"#BD3646","mascot":"마법"},{"id":"eagles","name":"대전 독수리단","city":"대전","symbol":"E","color":"#E16F22","secondary":"#1D344E","mascot":"독수리"},{"id":"lions","name":"대구 사자군단","city":"대구","symbol":"L","color":"#2164B4","secondary":"#E4E9F0","mascot":"사자"},{"id":"tigers","name":"광주 호랑이단","city":"광주","symbol":"T","color":"#C82832","secondary":"#152D54","mascot":"호랑이"},{"id":"giants","name":"부산 거인단","city":"부산","symbol":"G","color":"#243E73","secondary":"#D64B48","mascot":"거인"},{"id":"dinos","name":"창원 공룡단","city":"창원","symbol":"D","color":"#2369A8","secondary":"#C49B58","mascot":"공룡"}];
const BOT_NAMES=TEAMS.map(t=>t.name);
function weekStart(now=Date.now()){const d=new Date(now+32400000);const day=d.getUTCDay();return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-day)-32400000}
function seedNum(t){return parseInt(crypto.createHash('sha256').update(String(t)).digest('hex').slice(0,8),16)/4294967295}
function leagueInfo(c,now=Date.now()){
 const start=weekStart(now),teamId=c.teamId||TEAMS[0].id,allOfTeam=db.clubs.filter(x=>(x.teamId||TEAMS[0].id)===teamId),pool=Math.max(0,allOfTeam.findIndex(x=>x.id===c.id));
 const real=TEAMS.map(t=>db.clubs.filter(x=>(x.teamId||TEAMS[0].id)===t.id)[pool]||null);
 const members=TEAMS.map((t,i)=>real[i]?{id:real[i].id,name:t.name,real:true,club:real[i],teamId:t.id}:{id:'bot-'+pool+'-'+i,name:t.name,real:false,teamId:t.id});
 const strength=m=>m.club?Math.round(m.club.players.reduce((s,p)=>s+(p.power+p.contact+p.eye+p.stamina)/4,0)/Math.max(1,m.club.players.length)):52+(parseInt(m.id.slice(-1),10)||0)%15;
 const standings=members.map(m=>({id:m.id,name:m.name,played:0,wins:0,losses:0,draws:0,scored:0,allowed:0,strength:strength(m)}));
 const byId=Object.fromEntries(standings.map(t=>[t.id,t]));let order=[0,1,2,3,4,5,6,7,8,9],games=[],seasonIndex=0;
 for(let r=0;r<144;r++){
   for(let j=0;j<5;j++){let a=order[j],b=order[9-j];if(r%2===1)[a,b]=[b,a];
     games.push({round:r+1,slot:Math.floor(r*120/144),home:members[a].id,away:members[b].id})}
   order=[order[0],order[9],...order.slice(1,9)]
 }
 // 120 hourly slots: Sun-Thu, one to two full rounds per hour, Fri rest.
 function slotTime(slot){return start+Math.floor(slot/24)*86400000+(slot%24)*3600000}
 function score(g){const a=byId[g.home],b=byId[g.away],key=[start,pool,g.round,g.home,g.away].join('|'),base=seedNum(key),base2=seedNum(key+'x'),aRun=Math.max(0,Math.round(3+(a.strength-b.strength)*.06+base*6-2)),bRun=Math.max(0,Math.round(3+(b.strength-a.strength)*.06+base2*6-2));return [aRun,bRun]}
 const completed=games.filter(g=>slotTime(g.slot)<=now);for(const g of completed){let [h,a]=score(g);let t1=byId[g.home],t2=byId[g.away];t1.played++;t2.played++;t1.scored+=h;t1.allowed+=a;t2.scored+=a;t2.allowed+=h;if(h>a){t1.wins++;t2.losses++}else if(h<a){t2.wins++;t1.losses++}else{t1.draws++;t2.draws++}}
 standings.sort((a,b)=>((b.wins+b.draws*.5)/Math.max(1,b.played))-((a.wins+a.draws*.5)/Math.max(1,a.played))||b.wins-a.wins||(b.scored-b.allowed)-(a.scored-a.allowed));
 const next=games.find(g=>slotTime(g.slot)>now);
 const recent=completed.filter(g=>g.home===c.id||g.away===c.id).slice(-8).reverse().map(g=>({...g,homeName:byId[g.home].name,awayName:byId[g.away].name,score:score(g).join(' : '),time:slotTime(g.slot)}));
 const upcoming=games.filter(g=>(g.home===c.id||g.away===c.id)&&slotTime(g.slot)>now).slice(0,6).map(g=>({...g,homeName:byId[g.home].name,awayName:byId[g.away].name,time:slotTime(g.slot)}));
 let postseason=[];
 if(now>=start+6*86400000){
   let top=standings.slice(0,4),semi=[[top[0],top[3]],[top[1],top[2]]].map((x,i)=>({label:'준플레이오프 '+(i+1),home:x[0].name,away:x[1].name,score:null,time:start+6*86400000+(12+i*3)*3600000}));
   postseason=semi;
   if(now>=semi[0].time)semi[0].score='3 : '+(Math.floor(seedNum(start+'semi0')*4));
   if(now>=semi[1].time)semi[1].score='4 : '+(Math.floor(seedNum(start+'semi1')*4));
   if(now>=start+6*86400000+20*3600000)postseason.push({label:'챔피언 결정전',home:top[0].name,away:top[1].name,score:'5 : 3',time:start+6*86400000+20*3600000});
 }
 return {start,end:start+7*86400000,format:'10개 구단 · 일~목 144경기/구단 · 매시간 경기 · 금요일 휴식 · 토요일 가을야구',maxGames:144,completedRounds:completed.length/5,remainingRounds:144-completed.length/5,nextTime:next?slotTime(next.slot):null,standings:standings.map(({strength,...t})=>t),recent,upcoming,postseason,memberCount:real.length,botCount:10-real.length};
}

const view=(u)=>({user:u?{id:u.id,username:u.username,teamId:u.teamId}:null,teams:TEAMS,club:u?db.clubs.find(c=>c.owner===u.id)||null:null,listings:db.listings.map(x=>({...x,sellerName:db.clubs.find(c=>c.owner===x.seller)?.name||'?'})).sort((a,b)=>b.date-a.date).slice(0,200),ranking:db.clubs.map(c=>({name:c.name,wins:c.wins,losses:c.losses})).sort((a,b)=>b.wins-a.wins).slice(0,10),league:u&&db.clubs.find(c=>c.owner===u.id)?leagueInfo(db.clubs.find(c=>c.owner===u.id)):null});
const pwd=(pw,salt)=>crypto.scryptSync(pw,salt,32).toString('hex');
async function act(req,res){let body='';for await(const part of req){body+=part;if(body.length>30000)return send(res,413,{error:'요청 초과'})}let a;try{a=JSON.parse(body)}catch(e){return send(res,400,{error:'잘못된 요청'})}let u=db.users.find(x=>x.id===sessions.get(getCookie(req)));
try{
if(a.type==='checkUsername'){
 const name=String(a.username||'').trim();
 if(!/^[a-zA-Z0-9가-힣_]{3,20}$/.test(name))return send(res,400,{error:'아이디는 한글·영문·숫자·밑줄로 3~20자 입력하세요'});
 return send(res,200,{available:!db.users.some(x=>x.username.toLowerCase()===name.toLowerCase()),username:name});
}
if(a.type==='register'||a.type==='login'){const name=String(a.username||'').trim(),pass=String(a.password||'');const team=TEAMS.find(t=>t.id===a.teamId);if(!team)throw Error('로그인 전에 구단을 선택하세요');if(!/^[a-zA-Z0-9가-힣_]{3,20}$/.test(name))throw Error('아이디는 한글·영문·숫자·밑줄로 3~20자 입력하세요');if(a.type==='register'&&(pass.length<8||!/[^a-zA-Z0-9가-힣]/.test(pass)))throw Error('비밀번호는 특수문자를 포함해 8자 이상 입력하세요');if(a.type==='login'&&!pass)throw Error('비밀번호를 입력하세요');let found=db.users.find(x=>x.username.toLowerCase()===name.toLowerCase());if(a.type==='register'){if(found)throw Error('이미 존재하는 아이디');const salt=crypto.randomBytes(12).toString('hex');found={id:uid(),username:name,salt,hash:pwd(pass,salt),teamId:team.id};db.users.push(found)}else if(!found||found.hash!==pwd(pass,found.salt))throw Error('아이디 또는 비밀번호 오류');if(found.teamId&&found.teamId!==team.id)throw Error('가입 당시 선택한 구단으로 로그인하세요');if(!found.teamId){found.teamId=team.id;const old=db.clubs.find(x=>x.owner===found.id);if(old){old.teamId=team.id;old.name=team.name}}const token=crypto.randomBytes(24).toString('hex');sessions.set(token,found.id);save();return send(res,200,view(found),{'Set-Cookie':'sid='+token+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000'})}
if(a.type==='logout'){sessions.delete(getCookie(req));return send(res,200,{user:null},{'Set-Cookie':'sid=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'})}
if(!u)throw Error('로그인이 필요합니다');let c=db.clubs.find(x=>x.owner===u.id),result=null;
if(a.type==='createClub'){if(c)throw Error('이미 구단 존재');const team=TEAMS.find(t=>t.id===u.teamId);if(!team)throw Error('팀을 먼저 선택하세요');c=club(u,team.name);db.clubs.push(c)}
else{if(!c)throw Error('구단을 먼저 창단하세요');
if(a.type==='upgrade'){const p=c.players.find(x=>x.id===a.id);if(!p)throw Error('선수 없음');const next={D:['C',.5],C:['B',.25],B:['A',.1]}[p.grade];if(!next)throw Error('최고 등급입니다');if(c.cp<1)throw Error('CP 부족');c.cp--;let ok=Math.random()<next[1];if(ok)p.grade=next[0];result={message:ok?'등급 성장 성공! '+p.grade+'등급':'성장 실패 (등급 유지)'}}
else if(a.type==='train'){const p=c.players.find(x=>x.id===a.id),stat=String(a.key);if(!p||!['power','contact','eye','speed','defense','stamina'].includes(stat))throw Error('잘못된 선수/능력치');if(c.cash<1000000)throw Error('게임머니 부족');if(p[stat]>=99)throw Error('최대 능력치');c.cash-=1000000;p[stat]=Math.min(99,p[stat]+rand(1,3));result={message:'훈련 성공! 능력치 '+p[stat]}}
else if(a.type==='scout'){
const contracts={basic:{label:'일반 스카우트',cost:5000000},pitcher:{label:'투수 전문 스카우트',cost:12000000},hitter:{label:'타자 전문 스카우트',cost:12000000},era:{label:'연도 지정 스카우트',cost:18000000},franchise:{label:'연고 구단 스카우트',cost:25000000}};
const kind=String(a.kind||'basic'),contract=contracts[kind];
if(!contract)throw Error('선택할 수 없는 스카우트 유형입니다');
if(c.players.length>=80)throw Error('선수단 최대 80명입니다');
if(c.cash<contract.cost)throw Error('스카우트 비용이 부족합니다');
const p=player(u.id);
if(kind==='pitcher'){p.isPitcher=true;p.pos=['선발','중계','마무리'][rand(0,2)]}
if(kind==='hitter'){p.isPitcher=false;p.pos=['포수','1루수','2루수','3루수','유격수','좌익수','중견수','우익수'][rand(0,7)]}
if(kind==='era'){const ranges={'2000':[2000,2009],'2010':[2010,2019],'2020':[2020,2026]},range=ranges[String(a.era||'')];if(!range)throw Error('스카우트 연도를 선택하세요');p.year=rand(range[0],range[1])}
if(kind==='franchise'){p.originTeam=c.teamId||u.teamId||'twins';for(const stat of ['power','contact','eye','speed','defense','stamina'])p[stat]=Math.min(90,p[stat]+rand(2,8))}
if(!p.originTeam)p.originTeam=TEAMS[rand(0,TEAMS.length-1)].id;
c.cash-=contract.cost;c.players.push(p);
c.scoutHistory=Array.isArray(c.scoutHistory)?c.scoutHistory:[];
c.scoutHistory.unshift({id:uid(),kind,label:contract.label,cost:contract.cost,player:{id:p.id,name:p.name,year:p.year,pos:p.pos,grade:p.grade,originTeam:p.originTeam,isPitcher:p.isPitcher,power:p.power,contact:p.contact,eye:p.eye,speed:p.speed,defense:p.defense,stamina:p.stamina},time:Date.now()});
c.scoutHistory=c.scoutHistory.slice(0,30);
result={message:contract.label+' 성공 · '+p.year+' '+p.name+' 영입 완료',scouted:p};
}
else if(a.type==='list'){const p=c.players.find(x=>x.id===a.id),price=Number(a.price);if(!p)throw Error('선수 없음');if(!Number.isSafeInteger(price)||price<100000||price>100000000000)throw Error('가격은 10만원 이상');if(c.players.length<=15)throw Error('선수단 최소 15명 유지');c.players=c.players.filter(x=>x.id!==p.id);db.listings.push({id:uid(),seller:u.id,player:p,price,date:Date.now()});fix(c);result={message:'판매 등록 완료'}}
else if(a.type==='cancel'){const i=db.listings.findIndex(x=>x.id===a.id&&x.seller===u.id);if(i<0)throw Error('판매글 없음');if(c.players.length>=80)throw Error('선수단이 가득 참');c.players.push(db.listings.splice(i,1)[0].player);fix(c)}
else if(a.type==='buy'){const i=db.listings.findIndex(x=>x.id===a.id);if(i<0)throw Error('이미 판매됨');const l=db.listings[i];if(l.seller===u.id)throw Error('내 선수 구매 불가');if(c.cash<l.price)throw Error('게임머니 부족');if(c.players.length>=80)throw Error('선수단 최대');const s=db.clubs.find(x=>x.owner===l.seller);if(!s)throw Error('판매 구단 없음');c.cash-=l.price;s.cash+=l.price;l.player.owner=u.id;c.players.push(l.player);db.listings.splice(i,1);c.transactions.unshift({type:'구매',name:l.player.name,price:l.price});s.transactions.unshift({type:'판매',name:l.player.name,price:l.price});fix(c);result={message:'구매 완료'}}
else if(a.type==='lineup'){const p=c.players.find(x=>x.id===a.id);if(!p)throw Error('선수 없음');if(a.pitcher){if(!p.isPitcher)throw Error('투수를 선택하세요');c.pitcher=p.id}else{if(p.isPitcher)throw Error('타자를 선택하세요');c.lineup=c.lineup.filter(x=>x!==p.id);c.lineup.splice(Math.max(0,Math.min(8,Number(a.slot)||0)),0,p.id);c.lineup=c.lineup.slice(0,9)}fix(c)}
else if(a.type==='friendly'){fix(c);const bat=c.lineup.map(id=>c.players.find(p=>p.id===id)).filter(Boolean),p=c.players.find(x=>x.id===c.pitcher),off=bat.reduce((s,x)=>s+x.power+x.contact+x.eye,0)/Math.max(1,bat.length*3),def=p?(p.defense+p.stamina)/2:40;const ours=Math.max(0,Math.round(2+off/22+Math.random()*5-2)),theirs=Math.max(0,Math.round(4.5-def/28+Math.random()*5-2));result={message:'친선경기 결과 '+c.name+' '+ours+' : '+theirs+' AI 구단 (리그 전적 미반영)',ours,theirs}}
else if(a.type==='play'){fix(c);const bat=c.lineup.map(id=>c.players.find(p=>p.id===id)).filter(Boolean),p=c.players.find(x=>x.id===c.pitcher),off=bat.reduce((s,x)=>s+x.power+x.contact+x.eye,0)/Math.max(1,bat.length*3),def=p?(p.defense+p.stamina)/2:40;const ours=Math.max(0,Math.round(2+off/22+Math.random()*5-2)),theirs=Math.max(0,Math.round(4.5-def/28+Math.random()*5-2));if(ours>theirs)c.wins++;else if(ours<theirs)c.losses++;else c.draws++;c.cash+=ours>theirs?3500000:ours===theirs?1800000:1000000;c.cp+=ours>theirs?3:1;for(const x of bat){x.games++;if(Math.random()<.18)x.hr++;x.avg=Math.min(.45,Math.max(.15,(x.avg*(x.games-1)+(Math.random()*.25+.18))/x.games))}if(p){p.games++;p.era=Math.round(Math.random()*650)/100}result={message:'경기 결과 '+c.name+' '+ours+' : '+theirs+' AI 구단',ours,theirs}}
else throw Error('알 수 없는 동작');}
save();return send(res,200,{...view(u),result})}catch(e){return send(res,400,{error:e.message})}}
let queue=Promise.resolve();http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname==='/api/state')return send(res,200,view(db.users.find(x=>x.id===sessions.get(getCookie(req)))));if(url.pathname==='/api/action'&&req.method==='POST'){queue=queue.then(()=>act(req,res)).catch(()=>send(res,500,{error:'서버 오류'}));return}if(req.method!=='GET')return send(res,405,{error:'허용되지 않음'});if(url.pathname!=='/'&&url.pathname!=='/index.html')return send(res,404,{error:'페이지 없음'});fs.readFile(__dirname+'/index.html',(err,data)=>{if(err)return send(res,500,{error:'게임 화면 없음'});res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(data)})}).listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Diamond GM test server running'));