'use strict';
// Server-side Neon SQL-over-HTTPS. DATABASE_URL must be set only in Render secrets.
// This deliberately uses Node.js built-in fetch; no browser-facing database credentials.
const connection=String(process.env.DATABASE_URL||'').trim();
if(!connection)throw Error('DATABASE_URL is required');
const parsed=new URL(connection);
if(!/^postgres(ql)?:$/.test(parsed.protocol)||!parsed.hostname.endsWith('.neon.tech'))throw Error('Expected a Neon PostgreSQL DATABASE_URL');
const host=parsed.hostname.replace(/-pooler(?=\.)/,'');
const endpoint='https://'+host+'/sql';
const QUERY_TIMEOUT_MS=30000;
async function query(text,params=[]){
 const response=await fetch(endpoint,{method:'POST',headers:{
  'Content-Type':'application/json',
  'Neon-Connection-String':connection,
  'Neon-Raw-Text-Output':'true'
 },body:JSON.stringify({query:text,params}),signal:AbortSignal.timeout(QUERY_TIMEOUT_MS)});
 let value;try{value=await response.json()}catch{throw Error('Neon returned an invalid response (HTTP '+response.status+')')}
 if(!response.ok||!Array.isArray(value.rows)){
  const safe=String(value?.message||value?.error||'database query failed').slice(0,220);
  throw Error('Neon SQL error: '+safe+' (HTTP '+response.status+')');
 }
 return value.rows;
}
async function load(){
 const rows=await query('SELECT data::text AS payload FROM game_state WHERE id = 1');
 if(rows.length===0)return null;
 const raw=rows[0].payload;
 if(typeof raw!=='string')throw Error('Expected text payload from database');
 const data=JSON.parse(raw);
 if(!data||!Array.isArray(data.users)||!Array.isArray(data.clubs)||!Array.isArray(data.listings))throw Error('Invalid game database snapshot');
 return data;
}
async function store(snapshot){
 const payload=typeof snapshot==='string'?snapshot:JSON.stringify(snapshot);
 await query('INSERT INTO game_state (id,data,revision,updated_at) VALUES (1,$1::jsonb,1,now()) ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data, revision=game_state.revision+1,updated_at=now()',[payload]);
}
module.exports={load,store};
