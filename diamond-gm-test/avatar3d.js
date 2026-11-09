/* WebGL portrait engine. Each character is built from illuminated 3D meshes. */
(()=>{
let gl,canvas,prog,loc,triangles,failed=false,working=false;
const cache=new Map(),pending=[];
const vs='attribute vec3 a;attribute vec3 n;uniform vec3 center;uniform vec3 scale;uniform float angle;varying vec3 normal;void main(){vec3 p=a*scale;float c=cos(angle),s=sin(angle);p=vec3(c*p.x-s*p.y,s*p.x+c*p.y,p.z)+center;vec3 q=n/scale;normal=normalize(vec3(c*q.x-s*q.y,s*q.x+c*q.y,q.z));gl_Position=vec4(p.x*.90,p.y*.90-.02,-p.z*.42,1.);}';
const fs='precision mediump float;uniform vec3 tint;varying vec3 normal;void main(){vec3 n=normalize(normal);float light=max(0.,dot(n,normalize(vec3(-.55,.8,1.4))));float rim=max(0.,dot(n,normalize(vec3(.9,.0,.8))));gl_FragColor=vec4(min(tint*(.46+.43*light+.18*rim)+vec3(.055),vec3(1.)),1.);}';
function init(){
 if(gl||failed)return !!gl;
 try{
 canvas=document.createElement('canvas');canvas.width=240;canvas.height=264;
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
 gl.enable(gl.DEPTH_TEST);gl.viewport(0,0,canvas.width,canvas.height);return true;
 }catch(e){failed=true;gl=null;console.warn('3D renderer not supported',e);return false}
}
function rgb(hex){let h=String(hex).replace('#','');if(!/^[0-9a-f]{6}$/i.test(h))h='316fa5';return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255)}
function ball(x,y,z,wx,wy,wz,color,angle=0){gl.uniform3f(loc.center,x,y,z);gl.uniform3f(loc.scale,wx,wy,wz);gl.uniform1f(loc.angle,angle);gl.uniform3fv(loc.tint,rgb(color));gl.drawArrays(gl.TRIANGLES,0,triangles)}
const skins=['#f3d4b4','#ecc5a4','#e8ba94','#d9ac85','#cd9e76','#bb8c63','#b28059','#9c6c4c','#835b45','#674433'];
const hairs=['#141b20','#292321','#483329','#68432c','#866245','#a38b71','#b39f80','#37323e'];
function render(d,kit){
 if(!init())return null;
 gl.viewport(0,0,canvas.width,canvas.height);
 gl.clearColor(.875,.934,.98,1);
 gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 const v=k=>Math.abs(Number(d[k]||0));
 const shape=v('faceShape'),style=v('hairStyle'),eyeStyle=v('eyeShape');
 const hair=hairs[v('hairColor')%8],skin=skins[v('skinTone')%10];
 const fw=.422+(shape%7)*.012,fh=.495+(shape%4)*.012,space=.155+v('eyeSpacing')*.013;
 const pupil=.026+v('eyeSize')*.0027,capColors=['#f6f1e7','#ebeff4','#d9e6f2','#f4eadd','#dfe5ea'];
 const cap=capColors[style%capColors.length];kit=kit||'#2863a8';
 // Rounded clay figure, broad jersey shoulders and white neck opening.
 ball(0,-.72,-.10,.19,.25,.18,skin);
 ball(0,-1.055,-.17,.79,.44,.36,kit);
 ball(-.56,-.96,-.12,.315,.28,.33,kit,-.10);
 ball(.56,-.96,-.12,.315,.28,.33,kit,.10);
 ball(0,-.835,.245,.20,.12,.055,'#f0f0ec');
 ball(0,-.925,.278,.105,.145,.027,'#f8f7f2');
 ball(0,-.98,.302,.04,.055,.016,'#e2d2ad');
 // Back hair, ears, large face with soft curved jaw (not primitive stick figure).
 ball(0,.27,-.14,fw+.035,fh+.07,.37,hair);
 ball(-fw-.045,.026,.09,.146,.17,.115,skin);
 ball(fw+.045,.026,.09,.146,.17,.115,skin);
 ball(-fw-.067,.016,.182,.065,.085,.015,'#d6a185');
 ball(fw+.067,.016,.182,.065,.085,.015,'#d6a185');
 ball(0,.135,.12,fw,fh,.385,skin);
 ball(0,-.20,.205,fw*(.91+v('jawShape')*.011),.225,.31,skin);
 ball(-fw*.56,-.072,.388,.135,.124,.075,skin);
 ball(fw*.56,-.072,.388,.135,.124,.075,skin);
 // Short lashes, tiny pupils, rounded brows and a gentle expression.
 for(const side of [-1,1]){
  const x=side*space;
  ball(x,.215,.500,pupil,.024+eyeStyle%4*.003,.025,'#282d31');
  ball(x-.008,.225,.525,.008,.009,.005,'#fffdf5');
  const eyebrow=.34+v('eyebrowShape')%4*.009;
  ball(x,eyebrow,.467,.059+(eyeStyle%3)*.006,.017+(v('eyebrowShape')%3)*.004,.027,hair,side*(eyeStyle-3)*.04);
 }
 const nose=v('noseShape'),mouth=v('mouthShape');
 ball(0,.01,.505,.057+(nose%4)*.008,.06+(nose%3)*.007,.057,skin);
 ball(-.012,.026,.551,.018,.010,.009,'#f4d0ad');
 // Subtle smile or straight mouth, never a large open uncanny mouth.
 ball(0,-.182,.467,.057+(mouth%4)*.008,.009+(mouth%3)*.002,.018,'#996b61',(mouth-3)*.009);
 ball(0,-.200,.455,.052,.012,.011,skin);
 // DNA-specific sideburns, curves and sculpted hair tufts.
 const bangs=4+style%6;
 if(style!==12){
  for(let i=0;i<bangs;i++){
   const x=-fw*.77+(i/Math.max(1,bangs-1))*fw*1.54;
   ball(x,.573-((i+style)%3)*.027,.39,.065+(style%3)*.012,.112+(style%4)*.009,.105,hair,(i-bangs/2)*.11);
  }
  if([6,7,8,10,13].includes(style))for(const side of [-1,1])ball(side*fw*.87,.155,.105,.085,.26,.12,hair);
 }
 // High soft baseball cap, curved panels, back strap and small metal buckle.
 // Remains clearly visible in every profile size.
 ball(0,.691,.006,fw*1.15,.23+(style%3)*.012,.435,cap);
 ball(0,.562,.394,fw*.90,.066,.097,'#c7c9ca');
 ball(0,.585,.449,fw*.80,.043,.061,cap);
 ball(0,.605,.492,.118,.032,.017,'#b8b9b7');
 ball(0,.609,.510,.052,.024,.009,'#f6f5ef');
 for(const side of [-1,1])ball(side*fw*.84,.616,.298,.062,.114,.105,cap);
 ball(0,.517,.45,fw*.38,.022,.026,hair);
 // Small accents respect player DNA while keeping the character cute.
 const beard=v('beardStyle');
 if(beard>=4){
  ball(0,-.332,.395,.14,.035,.045,hair);
  if(beard>=6){ball(-.25,-.17,.373,.035,.10,.035,hair);ball(.25,-.17,.373,.035,.10,.035,hair)}
 }else if(beard===2){ball(0,-.145,.488,.11,.014,.019,hair)}
 if(v('feature')===1)for(let i=0;i<5;i++)ball(-.24+(i%3)*.14,-.095+Math.floor(i/3)*.046,.47,.008,.008,.009,'#b07f67');
 if(v('feature')===2)ball(.26,-.115,.443,.021,.013,.013,'#926753');
 if(v('feature')===3)for(const side of [-1,1]){
  ball(side*space,.225,.523,.097,.058,.01,'#8093a0');
  ball(side*space,.225,.533,.085,.045,.008,'#c6dce4');
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
    const key='cute3|'+el.dataset.avatarDna+'|'+el.dataset.avatarKit;
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