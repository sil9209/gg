// 2010–2025 KBO regular-season Golden Glove and MVP factual award roster.
// Sources: https://www.koreabaseball.com/Player/Awards/GoldenGlove.aspx
//          https://www.koreabaseball.com/Player/Awards/PlayerPrize.aspx
// Real names are private lookup identifiers only. Player-facing game names are pseudonyms.
const AWARD_ROWS=[[2010,"류현진","조인성","최준석","조성환","이대호","강정호","김강민,김현수,이종욱","홍성흔","이대호"],[2011,"윤석민","강민호","이대호","안치홍","최정","이대수","손아섭,이용규,최형우","홍성흔","윤석민"],[2012,"장원삼","강민호","박병호","서건창","최정","강정호","박용택,손아섭,이용규","이승엽","박병호"],[2013,"손승락","강민호","박병호","정근우","최정","강정호","박용택,손아섭,최형우","이병규","박병호"],[2014,"밴헤켄","양의지","박병호","서건창","박석민","강정호","나성범,손아섭,최형우","이승엽","서건창"],[2015,"해커","양의지","테임즈","나바로","박석민","김재호","김현수,나성범,유한준","이승엽","테임즈"],[2016,"니퍼트","양의지","테임즈","서건창","최정","김재호","김재환,김주찬,최형우","김태균","니퍼트"],[2017,"양현종","강민호","이대호","안치홍","최정","김선빈","버나디나,손아섭,최형우","박용택","양현종"],[2018,"린드블럼","양의지","박병호","안치홍","허경민","김하성","김재환,이정후,전준우","이대호","김재환"],[2019,"린드블럼","양의지","박병호","박민우","최정","김하성","로하스,샌즈,이정후","페르난데스","린드블럼"],[2020,"알칸타라","양의지","강백호","박민우","황재균","김하성","김현수,로하스,이정후","최형우","로하스"],[2021,"미란다","강민호","강백호","정은원","최정","김혜성","구자욱,이정후,홍창기","양의지","미란다"],[2022,"안우진","양의지","박병호","김혜성","최정","오지환","나성범,이정후,피렐라","이대호","이정후"],[2023,"페디","양의지","오스틴","김혜성","노시환","오지환","구자욱,박건우,홍창기","손아섭","페디"],[2024,"하트","강민호","오스틴","김혜성","김도영","박찬호","구자욱,레이예스,로하스","최형우","김도영"],[2025,"폰세","양의지","디아즈","신민재","송성문","김주원","구자욱,레이예스,안현민","최형우","폰세"]];
const POSITIONS=["선발","포수","1루수","2루수","3루수","유격수",null,"지명타자"];
const AWARD_POOL=[];
const ALL_REAL_NAMES=new Set();
for(const row of AWARD_ROWS){
 const [year,...cells]=row;
 for(let slot=0;slot<8;slot++){
  const names=cells[slot].split(',');
  for(let i=0;i<names.length;i++){
   const real=names[i];
   ALL_REAL_NAMES.add(real);
   AWARD_POOL.push({year,real,pos:slot===6?['좌익수','중견수','우익수'][i]:POSITIONS[slot],G:true,M:cells[8]===real});
  }
 }
 if(!AWARD_POOL.some(e=>e.year===year&&e.M)){
  ALL_REAL_NAMES.add(cells[8]);
  AWARD_POOL.push({year,real:cells[8],pos:cells[8]===cells[0]?'선발':'외야수',G:false,M:true});
 }
}
const SURNAMES=['강','권','김','남','류','문','민','박','배','백','서','성','손','송','신','안','양','오','유','윤','이','임','장','전','정','조','주','차','채','최','하','한','허','현','홍','황'];
const FIRST=['가온','건우','경민','도겸','도윤','도현','동건','동혁','민건','민규','민석','민재','민혁','범준','서율','서준','성민','성준','승민','승우','시우','시윤','영규','영재','예준','우빈','우성','우진','유건','윤서','재민','재윤','재현','정민','정우','정훈','준성','준서','준혁','지성','지우','지훈','태건','태민','태준','태현','하민','현민','현서','현준','현우','형준','호진','효준'];
const FOREIGN_FIRST=['제이든','레오','에릭','로건','다니엘','루카스','마커스','마틴','벤','브라이언','알렉스','앤드류','제이슨','카일','테오','토마스'];
const FOREIGN_LAST=['가르시아','그랜트','데이비스','로웰','로이드','리베라','마르틴','밀러','브라운','산체스','스콧','스톤','워커','윌슨','카터','페레즈'];
const hash=s=>{let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const map=new Map(),used=new Set();
for(const real of [...ALL_REAL_NAMES].sort()){
 const foreign=/^[가-힣]{2,3}$/.test(real)===false;
 let n='';
 for(let i=0;i<5000;i++){
  const h=hash('diamond-award-alias-v2:'+real+':'+i);
  n=foreign?FOREIGN_FIRST[h%FOREIGN_FIRST.length]+' '+FOREIGN_LAST[(h>>>9)%FOREIGN_LAST.length]:
   SURNAMES[h%SURNAMES.length]+FIRST[(h>>>9)%FIRST.length];
  if(n!==real&&!used.has(n))break;
 }
 used.add(n);map.set(real,n);
}
const awardEntries=AWARD_POOL.map(({real,...row})=>({...row,alias:map.get(real),key:hash('award:'+row.year+':'+real).toString(36)}));
const byYear=new Map();
for(const e of awardEntries){if(!byYear.has(e.year))byYear.set(e.year,[]);byYear.get(e.year).push(e)}
function awardPool(year){return byYear.get(Number(year))||[]}
module.exports={awardPool,awardEntries};
