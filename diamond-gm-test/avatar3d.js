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
 if(!init())return null;
 gl.clearColor(.25,.20,.17,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 const n=(key)=>Math.max(0,Number(d[key])||0);
 const shape=n('faceShape'),h=n('hairStyle'),es=n('eyeShape');
 const fw=.425+(shape%7)*.009,fh=.475+(shape%4)*.015,skin=skins[n('skinTone')%10],hair=hairs[n('hairColor')%8];
 const eyeSpacing=.152+n('eyeSpacing')*.012,eyeW=.028+n('eyeSize')*.0025;
 const cheek=.018+(shape%4)*.005,capStyle=(h+n('feature'))%5;
 kit=kit||'#2c6da0';
 // A toy-like, soft-lit clay character with rounded shoulders and a jersey.
 ball(0,-.70,-.08,.17,.23,.18,skin);
 ball(0,-1.03,-.16,.82,.39,.37,kit);
 ball(-.57,-.96,-.12,.34,.26,.31,kit,-.16);
 ball(.57,-.96,-.12,.34,.26,.31,kit,.16);
 ball(0,-.84,.22,.18,.12,.065,'#f1eadf');
 ball(0,-.91,.29,.085,.12,.037,'#fffaf2');
 // Hair backing and sculpted cheeks.
 ball(0,.26,-.12,fw+.025,fh+.065,.38,hair);
 // Wide, exaggerated sculpted ears characteristic of a cute 3D baseball character.
 ball(-fw-.038,.035,.057,.145,.169,.115,skin);
 ball(fw+.038,.035,.057,.145,.169,.115,skin);
 ball(-fw-.065,.018,.156,.062,.082,.018,'#be8e76');
 ball(fw+.065,.018,.156,.062,.082,.018,'#be8e76');
 ball(0,.17,.12,fw,fh,.39,skin);
 ball(0,-.18,.18,fw*(.91+n('jawShape')*.012),.22,.32,skin);
 ball(-fw*.59,-.045,.375,.14,.13,.095,skin);
 ball(fw*.59,-.045,.375,.14,.13,.095,skin);
 // Tiny glossy black eyes, short expressive dark eyebrow strokes.
 for(const side of [-1,1]){
  const x=side*eyeSpacing;
  ball(x,.22,.478,eyeW*.95,.015+(es%4)*.004,.013,'#302c2a');
  ball(x-.007,.225,.491,.006,.006,.003,'#f4ede6');
  const browY=.335+(n('eyebrowShape')%4)*.009;
  ball(x,browY,.465,.055+(es%3)*.006,.014+n('eyebrowShape')*.003,.022,hair,side*(es-3)*.045);
 }
 // A button-like rounded nose and a subtle friendly mouth.
 const nose=n('noseShape'),mouth=n('mouthShape');
 ball(0,.005,.508,.062+(nose%4)*.009,.066+(nose%3)*.007,.063,skin);
 ball(0,-.172,.466,.064+(mouth%5)*.009,.010+(mouth%3)*.004,.014,'#946a5f',(mouth-3)*.012);
 ball(0,-.192,.452,.054,.015,.012,skin);
 // 14 hairstyle identities, visible curls or layered hair beneath the cap.
 const bangs=4+h%6;
 if(h!==12){
  for(let i=0;i<bangs;i++){
   const x=(i/(bangs-1)-.5)*fw*1.68;
   ball(x,.575-((i+h)%3)*.036,.39,.077+(h%3)*.01,.105+(h%4)*.02,.11,hair,(i-bangs/2)*.09);
  }
  if([7,8,10,13].includes(h))for(let side of [-1,1])ball(side*(fw*.87),.20,.115,.095,.27,.13,hair);
 }
 // Rounded white backward baseball cap, worn high so brows remain readable.
 // Cap hue and panel/strap placement vary by immutable avatarDNA.
 const capColors=['#eee9df','#faf7ed','#d9e4ef','#f4eee5','#dedfdc'];
 const cap=capColors[capStyle];
 ball(0,.665,-.025,fw*1.12,.225+(h%3)*.012,.355,cap);
 ball(0,.562,.313,fw*.89,.049,.095,'#d7cfc2');
 ball(0,.572,.405,fw*.69,.025,.024,cap);
 ball(0,.601,.431,.10,.032,.019,'#695644');
 ball(0,.604,.446,.045,.025,.011,'#eee9df');
 for(let side of [-1,1]){
  ball(side*fw*.8,.61,.24,.058,.12,.105,cap);
 }
 // Hair-fringe shadows visible under the backward opening.
 ball(0,.501,.412,fw*.45,.027,.029,hair);
 // Optional neat beard, dots, freckles or spectacles keep identities varied.
 const beard=n('beardStyle');
 if(beard%7>=3){
  ball(0,-.345,.381,.12+(beard%3)*.02,.045,.053,hair);
  if(beard>=5)for(let side of [-1,1])ball(side*.28,-.15,.36,.035,.12,.045,hair);
 }
 if(beard===1)ball(0,-.137,.48,.095,.019,.026,hair);
 if(n('feature')===1)for(let i=0;i<5;i++)ball(-.23+(i%3)*.13,-.07+Math.floor(i/3)*.039,.455,.008,.009,.01,'#a47c66');
 if(n('feature')===2)ball(.26,-.11,.43,.020,.015,.013,'#865e47');
 if(n('feature')===3)for(let side of [-1,1]){
  ball(side*eyeSpacing,.218,.491,.101,.053,.009,'#72716c');
  ball(side*eyeSpacing,.218,.50,.087,.042,.008,'#b4c8cf');
 }
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