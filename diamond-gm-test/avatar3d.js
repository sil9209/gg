/* WebGL portrait engine. Each character is built from illuminated 3D meshes. */
(()=>{
let gl,canvas,prog,loc,triangles,failed=false,working=false;
const cache=new Map(),pending=[];
const vs='attribute vec3 a;attribute vec3 n;uniform vec3 center;uniform vec3 scale;uniform float angle;varying vec3 normal;void main(){vec3 p=a*scale;float c=cos(angle),s=sin(angle);p=vec3(c*p.x-s*p.y,s*p.x+c*p.y,p.z)+center;vec3 q=n/scale;normal=normalize(vec3(c*q.x-s*q.y,s*q.x+c*q.y,q.z));gl_Position=vec4(p.x*.90,p.y*.90-.02,-p.z*.42,1.);}';
const fs='precision mediump float;uniform vec3 tint;varying vec3 normal;void main(){vec3 n=normalize(normal);float light=max(0.,dot(n,normalize(vec3(-.55,.8,1.4))));float rim=max(0.,dot(n,normalize(vec3(.9,.0,.8))));gl_FragColor=vec4(min(tint*(.46+.43*light+.18*rim)+vec3(.055),vec3(1.)),1.);}';
function init(){
 if(gl||failed)return !!gl;
 try{
 canvas=document.createElement('canvas');canvas.width=164;canvas.height=182;
 gl=canvas.getContext('webgl',{antialias:true,alpha:false,depth:true,preserveDrawingBuffer:true});if(!gl)throw Error('WebGL unavailable');
 function shader(type,source){let x=gl.createShader(type);gl.shaderSource(x,source);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(x));return x}
 prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,vs));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error('WebGL link failed');gl.useProgram(prog);
 loc={center:gl.getUniformLocation(prog,'center'),scale:gl.getUniformLocation(prog,'scale'),angle:gl.getUniformLocation(prog,'angle'),tint:gl.getUniformLocation(prog,'tint')};
 const arr=[],lat=14,lon=22;
 function pos(i,j){const a=i*Math.PI/lat,b=j*Math.PI*2/lon;return [Math.sin(a)*Math.cos(b),Math.cos(a),Math.sin(a)*Math.sin(b)]}
 function push(p){arr.push(...p,...p)}
 for(let i=0;i<lat;i++)for(let j=0;j<lon;j++){let a=pos(i,j),b=pos(i+1,j),c=pos(i,j+1),d=pos(i+1,j+1);[a,b,c,b,d,c].forEach(push)}
 triangles=arr.length/6;let buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),gl.STATIC_DRAW);
 for(const [name,offset] of [['a',0],['n',12]]){let idx=gl.getAttribLocation(prog,name);gl.enableVertexAttribArray(idx);gl.vertexAttribPointer(idx,3,gl.FLOAT,false,24,offset)}
 gl.enable(gl.DEPTH_TEST);gl.viewport(0,0,164,182);return true;
 }catch(e){failed=true;gl=null;console.warn('3D renderer not supported',e);return false}
}
function rgb(hex){let h=String(hex).replace('#','');if(!/^[0-9a-f]{6}$/i.test(h))h='316fa5';return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255)}
function ball(x,y,z,wx,wy,wz,color,angle=0){gl.uniform3f(loc.center,x,y,z);gl.uniform3f(loc.scale,wx,wy,wz);gl.uniform1f(loc.angle,angle);gl.uniform3fv(loc.tint,rgb(color));gl.drawArrays(gl.TRIANGLES,0,triangles)}
const skins=['#f3d4b4','#ecc5a4','#e8ba94','#d9ac85','#cd9e76','#bb8c63','#b28059','#9c6c4c','#835b45','#674433'];
const hairs=['#141b20','#292321','#483329','#68432c','#866245','#a38b71','#b39f80','#37323e'];
function render(d,kit){
 if(!init())return null;gl.clearColor(.85,.91,.97,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 const shape=+d.faceShape||0,h=+d.hairStyle||0,es=+d.eyeShape||0,fw=.38+shape*.015,fh=.52+(shape%3)*.024,skin=skins[(+d.skinTone||0)%10],hair=hairs[(+d.hairColor||0)%8];
 const space=.17+(+d.eyeSpacing||0)*.012,eye=.034+(+d.eyeSize||0)*.004;kit=kit||'#2c6da0';
 ball(0,-.66,-.07,.17,.23,.20,skin);ball(0,-1.06,-.13,.76,.46,.34,kit);
 ball(-.52,-.95,-.12,.29,.29,.31,kit,.11);ball(.52,-.95,-.12,.29,.29,.31,kit,-.11);
 ball(0,-.86,.23,.14,.15,.06,'#ebeff4');ball(0,-.95,.29,.07,.12,.04,'#ffffff');
 ball(0,.32,-.15,fw+.05,fh+.09,.38,hair);
 ball(-fw,.07,.02,.087,.13,.09,skin);ball(fw,.07,.02,.087,.13,.09,skin);
 ball(0,.16,.1,fw,fh,.39,skin);
 ball(0,-.22,.23,fw*(.84+(+d.jawShape||0)*.02),.21,.28,skin);
 for(let side of [-1,1]){
  ball(side*fw*.67,.02,.37,.14,.17,.09,skin);
  ball(side*space,.24,.446,eye*1.8,eye*.91,.042,'#f4f1e8');
  ball(side*space,.24,.486,eye*.76,eye*.83,.023,['#273d47','#4c3a30','#506967','#3f5274'][es%4]);
  ball(side*space,.24,.508,eye*.32,eye*.4,.011,'#17242b');
  ball(side*space-.010,.255,.521,eye*.2,eye*.18,.008,'#ffffff');
  ball(side*space,.35,.44,eye*2,.017+(+d.eyebrowShape||0)*.003,.028,hair,side*(es-3)*.04);
 }
 let nose=+d.noseShape||0;
 ball(0,.085,.467,.064+(nose%4)*.008,.17,.068,skin);
 ball(0,-.03,.52,.077+(nose%3)*.011,.057,.09,skin);
 let mouth=+d.mouthShape||0;
 ball(0,-.18,.44,.094+(mouth%4)*.014,.014+(mouth%3)*.003,.019,'#a9756c',(mouth-3)*.012);
 ball(0,-.205,.425,.085,.019,.018,skin);
 if(h!==12){
  ball(0,.63,.09,fw*.99,.18+(h%4)*.025,.33,hair);
  let pieces=h%5===0?4:7+(h%3);
  for(let i=0;i<pieces;i++){let x=-fw*.8+i/(pieces-1)*fw*1.6;ball(x,.58-((i+h)%3===0?.11:.02),.34,fw/(pieces*.7),.14+(h%3)*.025,.11,hair,(i-pieces/2)*.1)}
  if([7,8,10].includes(h)){ball(-fw*.9,.14,.05,.10,.42,.15,hair);ball(fw*.9,.14,.05,.10,.42,.15,hair)}
  if([11,13].includes(h))for(let k=0;k<8;k++)ball((k-3.5)*.075,.75+(k%3)*.023,.04,.051,.13,.12,hair,(k-4)*.1);
 }
 let beard=+d.beardStyle||0;
 if(beard){if(beard%2===0)ball(0,-.31,.42,.19,.07,.06,hair);if(beard>=3){ball(-.28,-.16,.33,.055,.15,.06,hair);ball(.28,-.16,.33,.055,.15,.06,hair)}if(beard===1||beard>=4)ball(0,-.14,.48,.13,.027,.032,hair)}
 if(d.feature===1)for(let i=0;i<6;i++)ball(-.23+(i%3)*.14,-.025+Math.floor(i/3)*.035,.46,.01,.01,.012,'#9f6c55');
 if(d.feature===2)ball(.25,-.10,.43,.021,.015,.014,'#885340');
 return canvas.toDataURL('image/png');
}
function scan(){
 for(const el of document.querySelectorAll('.player-portrait[data-avatar-dna]:not([data-avatar-queued])')){el.dataset.avatarQueued='1';pending.push(el)}
 if(working||!pending.length)return;working=true;
 function step(){
  for(const el of pending.splice(0,3)){
   if(!el.isConnected)continue;
   try{
    const key=el.dataset.avatarDna+'|'+el.dataset.avatarKit;
    let url=cache.get(key);
    if(!url){url=render(JSON.parse(decodeURIComponent(el.dataset.avatarDna)),el.dataset.avatarKit);if(url){cache.set(key,url);if(cache.size>250)cache.delete(cache.keys().next().value)}}
    if(url){const img=el.querySelector('img');if(img){img.src=url;el.dataset.avatarReady='1'}}
   }catch(e){el.dataset.avatarReady='error';console.warn(e)}
  }
  if(pending.length)requestAnimationFrame(step);else working=false;
 }
 requestAnimationFrame(step);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan);else scan();
new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
window.DiamondAvatarWebGL={scan,render};
})();