(() => {
  'use strict';
  const root=document.getElementById('golabii-spatial-bloom');if(!root||root.dataset.ready)return;root.dataset.ready='1';
  const $=s=>root.querySelector(s),stage=$('.gs-stage'),mount=$('.gs-canvas'),status=$('.gs-status'),tiltButton=$('.gs-tilt');
  const atlasURL='floral-art.webp';$('.gs-reference').src=atlasURL;
  function fallback(){root.dataset.fallback='true';parent.postMessage({type:'floral-fallback'},location.origin);mount.hidden=true;$('.gs-reference').hidden=false;$('.gs-loading').hidden=true;status.textContent='Original artwork · 3D unavailable';tiltButton.hidden=true;stage.disabled=true;}
  if(typeof THREE==='undefined'){fallback();return;}
  const T=THREE,V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state={ready:false,visible:true,drag:null,tilt:false,orientation:null,disposed:false};
  let renderer;
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch(error){fallback();return;}
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();fallback();});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.setClearColor(0xb8759f);mount.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true');
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(40.27,1,.1,40);camera.position.set(0,0,9);camera.lookAt(0,0,.4);
  scene.add(new T.HemisphereLight(0xfff1ed,0x665044,1.55));
  const key=new T.DirectionalLight(0xffe8d0,3.1);key.position.set(-3.8,5.5,7);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-4.5,right:4.5,top:4.5,bottom:-4.5,near:.5,far:20});key.shadow.bias=-.00015;key.shadow.normalBias=.014;scene.add(key);
  const fill=new T.DirectionalLight(0xdac9ff,.8);fill.position.set(4,1,5);scene.add(fill);
  const rim=new T.DirectionalLight(0xffd0a2,1.3);rim.position.set(1,-2,-.4);scene.add(rim);
  const backdropMaterial=new T.ShaderMaterial({uniforms:{top:{value:new T.Color(0xb877a6)},bottom:{value:new T.Color(0xa85c86)}},vertexShader:'varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 top;uniform vec3 bottom;varying vec2 uv0;void main(){float v=clamp(uv0.y,0.,1.);vec3 c=mix(bottom,top,v);float d=length((uv0-.5)*vec2(1.,.9));c*=1.-.12*smoothstep(.1,.75,d);gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
  const backdrop=new T.Mesh(new T.PlaneGeometry(10,10),backdropMaterial);backdrop.position.z=-1.6;scene.add(backdrop);
  // Lighting catches actual closed petal surfaces. No image displacement/depth map.
  const atlas=new T.Texture();atlas.flipY=false;atlas.colorSpace=T.SRGBColorSpace;atlas.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
  const petalMaterial=new T.MeshPhysicalMaterial({map:atlas,vertexColors:true,roughness:.77,metalness:0,sheen:.4,sheenColor:0xeacadd,sheenRoughness:.65,specularIntensity:.28,emissive:0xffffff,emissiveMap:atlas,emissiveIntensity:.11});
  const leafMaterial=new T.MeshPhysicalMaterial({map:atlas,vertexColors:true,roughness:.88,sheen:.23,sheenColor:0xcbbb88,sheenRoughness:.8,specularIntensity:.22,emissive:0xffffff,emissiveMap:atlas,emissiveIntensity:.075});
  const stemMaterial=new T.MeshStandardMaterial({color:0x657040,roughness:.91}),veinMaterial=new T.MeshStandardMaterial({color:0xb4a265,roughness:.93});
  const seedMaterial=new T.MeshStandardMaterial({color:0xc98742,roughness:.56,metalness:.14});
  const patches={
    lilac:[[486,292,113,138],[655,403,101,138],[464,462,124,123]],
    purple:[[505,958,130,107],[674,1060,129,101],[601,910,94,121]],
    red:[[1090,670,112,102],[1074,795,127,92],[110,35,104,98]],
    peach:[[24,498,88,115],[64,568,76,109],[33,459,86,97]],
    olive:[[887,1058,118,140],[781,72,91,123],[838,1017,85,139]],
    dark:[[949,484,100,128],[242,551,124,96],[90,378,100,105]],
    coral:[[330,540,86,127],[643,753,123,96],[581,695,109,138]],
    rust:[[351,134,91,138],[384,239,105,111],[180,448,99,109]],
    gold:[[339,685,83,147],[294,876,111,96],[234,938,73,106]],
    tulip:[[1135,1080,66,120],[1058,53,87,142],[1169,107,70,150]]
  };
  let rngState=17391;function random(){rngState=(1664525*rngState+1013904223)>>>0;return rngState/4294967296;}
  const mix=(a,b,t)=>a+(b-a)*t,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function rect(kind,i=0){const a=patches[kind];return a[i%a.length];}
  const animated=[],geometries=[],materials=new Set([petalMaterial,leafMaterial,stemMaterial,veinMaterial,seedMaterial,backdropMaterial]);
  function world(x,y,z){const s=(9-z)/9;return V(x*s,y*s,z);}
  function place(group,x,y,z,scale=1){group.position.copy(world(x,y,z));group.scale.setScalar((9-z)/9*scale);scene.add(group);return group;}
  function merge(parts){let count=0;for(const g of parts)count+=g.attributes.position.count;const positions=new Float32Array(count*3),normals=new Float32Array(count*3),uv=new Float32Array(count*2),colors=new Float32Array(count*3),indices=[];let offset=0;
    for(const g of parts){positions.set(g.attributes.position.array,offset*3);normals.set(g.attributes.normal.array,offset*3);uv.set(g.attributes.uv.array,offset*2);colors.set(g.attributes.color.array,offset*3);for(const i of g.index.array)indices.push(i+offset);offset+=g.attributes.position.count;g.dispose();}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));g.setAttribute('normal',new T.BufferAttribute(normals,3));g.setAttribute('uv',new T.BufferAttribute(uv,2));g.setAttribute('color',new T.BufferAttribute(colors,3));g.setIndex(indices);g.computeBoundingSphere();geometries.push(g);return g;
  }
  // Each petal/leaf is a closed shell with a front, reverse and stitched side wall.
  function shell({length=1,width=.4,rise=.22,cup=.15,ruffle=.04,phase=0,kind='petal',patch,tint=1}){
    const nx=12,ny=18,side=nx+1,layer=side*(ny+1),p=[],uv=[],col=[],ix=[];
    const thick=kind==='leaf'?.007:.012;
    for(let face=0;face<2;face++)for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
      const v=j/ny,u=i/nx*2-1,s=Math.sin(Math.PI*v),serrate=kind==='leaf'?1+.13*Math.sin(v*Math.PI*14+phase)*s:1+.07*Math.sin(v*17+phase);
      const w=width*(.035+Math.pow(Math.max(0,s),kind==='leaf'?.69:.45))*serrate;
      const x=w*u,y=length*v;
      let z=rise*Math.sin(v*Math.PI*.88)+cup*u*u*s+ruffle*Math.sin(u*10+phase+v*7)*v*v*Math.abs(u);
      if(kind==='leaf')z+=.047*(1-Math.pow(Math.abs(u),.55))*s;
      z-=face*thick;p.push(x,y,z);
      const tu=clamp(.5+u*.43+.025*Math.sin(v*4+phase),0,1),tv=.035+.93*v;uv.push((patch[0]+tu*patch[2])/1254,(patch[1]+(1-tv)*patch[3])/1254);
      const shade=tint*(face?.77:1)*(.94+.06*s);col.push(shade,shade,shade);
    }
    for(let face=0;face<2;face++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=face*layer+j*side+i,b=a+1,c=a+side,d=c+1;if(!face)ix.push(a,b,c,b,d,c);else ix.push(a,c,b,b,c,d);}
    const border=[];for(let i=0;i<=nx;i++)border.push(i);for(let j=1;j<=ny;j++)border.push(j*side+nx);for(let i=nx-1;i>=0;i--)border.push(ny*side+i);for(let j=ny-1;j>0;j--)border.push(j*side);
    for(let k=0;k<border.length;k++){const a=border[k],b=border[(k+1)%border.length];ix.push(a,a+layer,b,b,a+layer,b+layer);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setIndex(ix);g.computeVertexNormals();return g;
  }
  function mesh(g,m,parent){const o=new T.Mesh(g,m);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  function animateObject(o,weight){animated.push({o,weight,rx:o.rotation.x,ry:o.rotation.y,rz:o.rotation.z,phase:random()*6.28});}
  function blossom({x,y,z,r=1,type='peony',pigment='lilac',lean=0,spin=0}){
    const flower=new T.Group(),parts=[];flower.name=type+'-'+pigment;const isRose=type==='rose',isOpen=type==='open';
    const rings=isRose?[[13,1,.43,.17,-.04],[15,.82,.43,.24,.08],[13,.61,.39,.28,.18],[11,.42,.33,.32,.28],[8,.25,.3,.36,.36]]:isOpen?[[9,1,.46,.15,-.02],[8,.71,.43,.22,.1]]:[[15,1,.42,.19,-.05],[14,.81,.43,.3,.06],[13,.64,.4,.34,.17],[11,.46,.38,.4,.26],[9,.27,.34,.4,.35]];
    let total=0;
    for(let ring=0;ring<rings.length;ring++){const [n,l,w,rise,base]=rings[ring];for(let i=0;i<n;i++){
      const a=i/n*Math.PI*2+ring*.43+(random()-.5)*.16,len=l*(.92+random()*.15),g=shell({length:len,width:w*len,rise:rise*len,cup:(isRose?.28:.19)*len,ruffle:isRose?.025:.065,phase:random()*6.28,patch:rect(pigment,i+ring),tint:.92+random()*.13});
      g.rotateX((random()-.5)*.18+(isRose?-.12:0));g.translate(0,.025,base);g.rotateZ(a);parts.push(g);total++;
    }}
    const petals=mesh(merge(parts),petalMaterial,flower);petals.name=total+'-sculpted-petals';flower.userData.petals=total;
    if(isOpen){const sphere=new T.SphereGeometry(.019,6,5),seeds=new T.InstancedMesh(sphere,seedMaterial,70),dummy=new T.Object3D();geometries.push(sphere);for(let i=0;i<70;i++){const a=i*2.39996,d=.24*Math.sqrt((i+.5)/70);dummy.position.set(Math.cos(a)*d,Math.sin(a)*d,.17+.11*(1-d/.24));dummy.rotation.set(random()*1.2,random()*1.2,random()*6.28);dummy.scale.set(.8,.8,1.9);dummy.updateMatrix();seeds.setMatrixAt(i,dummy.matrix);}seeds.castShadow=true;flower.add(seeds);}
    flower.rotation.set(lean,Math.sin(spin)*.12,spin);place(flower,x,y,z,r);animateObject(flower,.32);return flower;
  }
  function leaf(x,y,z,length,angle,pigment='olive',width=.29){const o=new T.Group();o.name='curved-'+pigment+'-leaf';
    const g=shell({length,width:length*width,rise:length*.13,cup:-length*.08,ruffle:length*.025,phase:random()*6.28,kind:'leaf',patch:rect(pigment,Math.floor(random()*3)),tint:.9+random()*.16});geometries.push(g);mesh(g,leafMaterial,o);
    const curve=new T.CatmullRomCurve3([V(0,0,.013),V(0,length*.33,length*.15),V(0,length*.69,length*.15),V(0,length,.013+Math.sin(Math.PI*.88)*length*.13)]),vein=new T.TubeGeometry(curve,12,.006,4,false);geometries.push(vein);mesh(vein,veinMaterial,o);
    o.rotation.set((random()-.5)*.5,(random()-.5)*.55,angle);place(o,x,y,z);animateObject(o,.6+random()*.4);return o;
  }
  function stem(points,radius=.028){const curve=new T.CatmullRomCurve3(points.map(p=>world(...p))),g=new T.TubeGeometry(curve,28,radius,7,false);geometries.push(g);return mesh(g,stemMaterial,scene);}
  // Reference composition: a central lilac peony and foreground violet flower.
  // The independent botanical forms occupy more than three units of real space.
  stem([[-2.55,-3.6,-.85],[-2.46,-1.4,-.8],[-2.25,1.1,-.65],[-2.4,3.8,-.55]],.036);
  stem([[2.65,-3.8,-.75],[2.04,-1.6,-.6],[2.17,.6,-.65],[1.64,3.8,-.7]],.033);
  stem([[-1.46,-3.6,-.15],[-.43,-1.56,-.12],[.49,-.6,-.03],[1.55,.77,.1]],.032);
  stem([[.24,-3.9,-.55],[.19,-1.6,-.55],[.11,.78,-.32]],.029);
  stem([[-2.45,1.13,-.65],[-1.59,1.86,-.52],[-1.4,3.65,-.4]],.022);
  stem([[2.03,.5,-.6],[2.75,1.65,-.4],[3.3,2.8,-.35]],.022);
  const leaves=[
    [-2.39,2.15,-.6,1.25,-.68,'rust'],[-1.53,2.25,-.45,1.17,-.11,'olive'],[-1.58,2.45,-.25,.92,-1.38,'rust'],[-2.35,1.58,-.4,1.0,.87,'dark'],[-1.66,1.1,-.1,1.3,-.12,'rust'],[-2.76,.6,-.23,1.15,.36,'olive'],[-2.44,.14,-.1,1.25,-.6,'coral'],[-1.92,-.25,.23,1.27,.53,'coral'],[-2.02,-.12,.03,1.19,-.65,'dark'],
    [1.55,2.46,-.55,1.14,.58,'olive'],[1.55,2.43,-.48,1.15,-.71,'olive'],[1.75,1.4,-.38,.95,.17,'dark'],[2.04,.7,-.27,1.17,-.88,'dark'],[2.23,.1,-.16,1.01,-1.03,'gold'],[2.76,.12,.17,1.12,-.34,'gold'],[1.12,-.04,.32,1.26,-.05,'rust'],[1.77,-.14,.1,1.2,-.4,'olive'],
    [-.92,-1.78,.52,1.24,.2,'gold'],[-.79,-2.16,.63,1.28,1.17,'coral'],[-.61,-1.18,.45,1.1,.51,'gold'],[-.21,-1.67,.5,1.13,-.77,'coral'],[.1,-1.02,.64,1.06,-.86,'coral'],[.5,-.66,.5,1.17,-.38,'coral'],[.64,-1.74,.71,1.31,-1.14,'coral'],
    [-2.65,-2.72,.5,1.13,-.27,'gold'],[-2.27,-2.64,.57,1.08,-1.12,'coral'],[-2.7,-1.78,.41,.92,.2,'olive'],[-1.43,-2.65,.63,.9,.91,'gold'],[-1.59,-3.34,.85,1.17,-.7,'olive'],[-2.44,-3.49,.63,1.1,-.1,'olive'],
    [1.8,-2.6,.94,1.55,.1,'olive'],[1.5,-2.59,.9,1.04,-.83,'gold'],[2.25,-2.46,.85,1.15,-.22,'gold'],[2.57,-2.04,.64,1.1,.76,'coral'],[2.49,-3.42,1.05,1.1,.7,'olive'],[1.1,-3.53,1.04,1.14,-1.08,'olive'],
    [-3.36,2.58,-.38,1.1,-.43,'olive'],[-3.13,1.6,-.25,.82,-.45,'dark'],[3.16,2.12,-.23,.83,.53,'olive'],[3.11,.8,-.1,1.0,.61,'coral'],[-3.13,-.48,.25,.91,-.9,'olive'],[3.15,-1.88,.49,1.08,.11,'gold'],[-1.35,3.16,-.45,.81,.53,'olive'],[1.2,3.31,-.71,.79,-.77,'olive']
  ];
  for(const args of leaves)leaf(...args);
  blossom({x:-2.58,y:2.91,z:-.14,r:1.03,type:'rose',pigment:'red',lean:.12,spin:.15});
  blossom({x:-3.06,y:.06,z:.05,r:.91,type:'peony',pigment:'peach',lean:-.12,spin:.5});
  blossom({x:-2.02,y:-1.3,z:.39,r:.72,type:'rose',pigment:'red',lean:.05,spin:.44});
  blossom({x:2.79,y:-.77,z:.65,r:1.01,type:'rose',pigment:'red',lean:-.1,spin:.4});
  const hero=blossom({x:.04,y:.78,z:.29,r:1.08,type:'peony',pigment:'lilac',lean:.02,spin:.18});
  blossom({x:-.04,y:-2.58,z:1.13,r:1.31,type:'open',pigment:'purple',lean:.1,spin:.27});
  blossom({x:-3.18,y:-2.24,z:.63,r:.73,type:'open',pigment:'purple',lean:.08,spin:-.23});
  blossom({x:2.05,y:-1.84,z:.45,r:.46,type:'peony',pigment:'peach',lean:.19,spin:.35});
  function tulip(x,y,z,r,angle){const o=new T.Group(),parts=[];o.name='sculpted-parrot-tulip';for(let i=0;i<7;i++){const g=shell({length:1.3,width:.38,rise:.8,cup:.14,ruffle:.052,phase:i*.93,patch:rect('tulip',i),tint:1});g.rotateX(-.55);g.rotateY(i/7*Math.PI*2);parts.push(g);}mesh(merge(parts),petalMaterial,o);o.rotation.set(.6,0,angle);place(o,x,y,z,r);animateObject(o,.45);}
  tulip(2.62,2.26,-.17,.86,-.28);tulip(3.16,3.01,-.32,.76,.3);tulip(2.95,-3.38,.88,.65,-.35);tulip(1.46,1.94,-.32,.41,.3);
  // Preserve the uploaded lettering exactly, using only its original ink as a mask.
  const inkMat=new T.ShaderMaterial({uniforms:{art:{value:atlas},ink:{value:new T.Color(0x650b28)}},transparent:true,depthWrite:false,vertexShader:'varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform sampler2D art;uniform vec3 ink;varying vec2 uv0;void main(){vec3 c=texture2D(art,uv0).rgb;float a=(1.-smoothstep(.025,.065,c.g))*smoothstep(.028,.08,c.r-c.b)*(1.-smoothstep(.27,.35,c.r));if(a<.02)discard;gl_FragColor=vec4(ink,a);\n#include <colorspace_fragment>\n}'});materials.add(inkMat);
  const inkGeo=new T.PlaneGeometry(1.79,.402),inkUV=inkGeo.attributes.uv;for(let i=0;i<inkUV.count;i++){inkUV.setXY(i,(470+inkUV.getX(i)*325)/1254,(590+(1-inkUV.getY(i))*73)/1254);}geometries.push(inkGeo);
  const wordmark=new T.Mesh(inkGeo,inkMat);wordmark.name='original-golabii-lettering';wordmark.position.copy(world(0,-.012,1.46));wordmark.scale.setScalar((9-1.46)/9);scene.add(wordmark);
  const aim={x:0,y:0},pose={x:0,y:0,vx:0,vy:0};let last=0,raf=0,settle=2,tiltTimer=0;
  function size(){const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();render();}
  function render(){if(!state.disposed&&root.isConnected)renderer.render(scene,camera);}
  function setAim(x,y){aim.x=clamp(x,-1,1);aim.y=clamp(y,-1,1);settle=2;}
  function stopDrag(e){if(!state.drag||(e&&state.drag.id!==e.pointerId))return;const id=state.drag.id;state.drag=null;if(stage.hasPointerCapture(id))stage.releasePointerCapture(id);if(!state.tilt)setAim(0,0);status.textContent=state.tilt?'Tilt gently to explore':'Drag to explore';}
  stage.addEventListener('pointerdown',e=>{if(!state.ready||state.drag||e.button!==0)return;state.drag={id:e.pointerId,x:e.clientX,y:e.clientY,ax:aim.x,ay:aim.y};stage.setPointerCapture(e.pointerId);status.textContent='Looking between the petals';});
  stage.addEventListener('pointermove',e=>{if(!state.ready||state.tilt)return;const r=stage.getBoundingClientRect();if(state.drag?.id===e.pointerId){setAim(state.drag.ax+(e.clientX-state.drag.x)/r.width*3,state.drag.ay+(e.clientY-state.drag.y)/r.height*3);}else if(e.pointerType==='mouse'&&!state.drag&&!reduced){setAim((e.clientX-r.left)/r.width*2-1,(e.clientY-r.top)/r.height*2-1);}});
  stage.addEventListener('pointerup',stopDrag);stage.addEventListener('pointercancel',stopDrag);stage.addEventListener('lostpointercapture',stopDrag);
  stage.addEventListener('pointerleave',()=>{if(!state.drag&&!state.tilt)setAim(0,0);});stage.addEventListener('click',e=>e.preventDefault());
  stage.addEventListener('keydown',e=>{const moves={ArrowLeft:[-.2,0],ArrowRight:[.2,0],ArrowUp:[0,-.2],ArrowDown:[0,.2]};if(moves[e.key]){e.preventDefault();setAim(aim.x+moves[e.key][0],aim.y+moves[e.key][1]);}else if(e.key==='Home'||e.key==='Escape'){e.preventDefault();stopDrag();setAim(0,0);}});
  function orientation(e){if(!state.tilt||!Number.isFinite(e.beta)||!Number.isFinite(e.gamma))return;if(!state.orientation){state.orientation={beta:e.beta,gamma:e.gamma};clearTimeout(tiltTimer);}let dx=e.gamma-state.orientation.gamma,dy=e.beta-state.orientation.beta;const a=(screen.orientation?.angle||0)*Math.PI/180;setAim((dx*Math.cos(a)+dy*Math.sin(a))/18,(dy*Math.cos(a)-dx*Math.sin(a))/18);}
  tiltButton.addEventListener('click',async()=>{if(state.tilt){state.tilt=false;state.orientation=null;clearTimeout(tiltTimer);window.removeEventListener('deviceorientation',orientation);setAim(0,0);tiltButton.textContent='Use phone tilt';status.textContent='Drag to explore';return;}
    if(!window.DeviceOrientationEvent||!window.isSecureContext){status.textContent='Tilt unavailable here · drag instead';return;}
    try{if(typeof DeviceOrientationEvent.requestPermission==='function'){const result=await DeviceOrientationEvent.requestPermission();if(result!=='granted'){status.textContent='Tilt not enabled · drag instead';return;}}state.tilt=true;state.orientation=null;window.addEventListener('deviceorientation',orientation,{passive:true});tiltButton.textContent='Turn tilt off';status.textContent='Tilt gently to explore';tiltTimer=setTimeout(()=>{if(state.tilt&&!state.orientation){state.tilt=false;window.removeEventListener('deviceorientation',orientation);tiltButton.textContent='Use phone tilt';status.textContent='Drag to explore · tilt unavailable';}},2500);}catch(error){status.textContent='Tilt unavailable here · drag instead';}
  });
  const onBlur=()=>{stopDrag();if(!state.tilt)setAim(0,0);},onVisibility=()=>{if(document.hidden)onBlur();};window.addEventListener('blur',onBlur);document.addEventListener('visibilitychange',onVisibility);
  const resizeObserver=new ResizeObserver(size);resizeObserver.observe(stage);const visibilityObserver=new IntersectionObserver(entries=>{state.visible=entries[0].isIntersecting;if(!state.visible)onBlur();},{threshold:.01});visibilityObserver.observe(root);
  function dispose(){if(state.disposed)return;state.disposed=true;cancelAnimationFrame(raf);clearTimeout(tiltTimer);resizeObserver.disconnect();visibilityObserver.disconnect();window.removeEventListener('blur',onBlur);window.removeEventListener('deviceorientation',orientation);document.removeEventListener('visibilitychange',onVisibility);for(const g of geometries)g.dispose();backdrop.geometry.dispose();for(const m of materials)m.dispose();atlas.dispose();renderer.dispose();}
  function frame(now){if(!root.isConnected){dispose();return;}raf=requestAnimationFrame(frame);if(!state.ready||!state.visible||document.hidden){last=now;return;}const dt=Math.min(.033,(now-last)/1000||.016);last=now;
    const spring=reduced?180:95,damping=reduced?28:18;pose.vx+=((aim.x-pose.x)*spring-pose.vx*damping)*dt;pose.vy+=((aim.y-pose.y)*spring-pose.vy*damping)*dt;pose.x+=pose.vx*dt;pose.y+=pose.vy*dt;
    const motion=Math.abs(pose.vx)+Math.abs(pose.vy)+Math.abs(aim.x-pose.x)+Math.abs(aim.y-pose.y);if(motion>.0003)settle=1;else settle-=dt;if(settle<0)return;
    camera.position.set(pose.x*.95,-pose.y*.72,9);camera.lookAt(pose.x*.06,-pose.y*.04,.4);
    if(!reduced)for(const a of animated){const flex=clamp((pose.vx+pose.vy*.45)*.006,-.018,.018)*a.weight;a.o.rotation.x=a.rx+flex*Math.cos(a.phase);a.o.rotation.y=a.ry+flex*Math.sin(a.phase);a.o.rotation.z=a.rz+flex*.24;}
    render();
  }
  const image=new Image();image.onload=()=>{if(state.disposed)return;atlas.image=image;atlas.needsUpdate=true;state.ready=true;root.dataset.loaded='true';parent.postMessage({type:'floral-ready'},location.origin);$('.gs-reference').hidden=true;$('.gs-loading').hidden=true;size();};image.onerror=fallback;image.src=atlasURL;size();raf=requestAnimationFrame(frame);
})();

