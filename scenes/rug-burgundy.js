(async () => {
  'use strict';
  const root=document.getElementById('golabii-burgundy-velvet');
  if(!root||root.dataset.initialized)return;root.dataset.initialized='true';
  const $=s=>root.querySelector(s),stage=$('.gr-stage'),mount=$('.gr-canvas'),hint=$('.gr-hint');
  // Lossless binary packaging preserves the complete rug and sharper bottle maps.
  function toBase64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
  let bottleData,rugData,envelope,settled;
  try{
    const response=await fetch('rug-model.bin');
    if(!response.ok)throw new Error('Rug asset unavailable');
    const buffer=await response.arrayBuffer();
    const bytes=new Uint8Array(buffer),length=new DataView(buffer).getUint32(0,true),data=JSON.parse(new TextDecoder().decode(bytes.subarray(4,4+length)));
    ({bottleData,rugData,envelope}=data);let offset=4+length;
    const parts=data.lengths.map(n=>{const part=bytes.slice(offset,offset+n);offset+=n;return part;});
    ['positions','uv','indices','texture','normal','roughness'].forEach((key,i)=>{bottleData[key]=(i<3?'':'data:image/webp;base64,')+toBase64(parts[i]);});
    rugData.albedo='data:image/webp;base64,'+toBase64(parts[6]);
    envelope.radii=Float32Array.from(new Uint16Array(parts[7].buffer),v=>v/100000);
    settled=Float32Array.from(new Int16Array(parts[8].buffer),v=>v/10000);
  }catch(error){$('.gr-flat').hidden=false;$('.gr-loading').textContent='The interactive rug is unavailable. Please refresh to try again.';stage.disabled=true;$('.gr-redrape').disabled=true;$('.gr-rotate').disabled=true;return;}
  // Remove the pedestal from both the visible scene and the collision surface.
  const oldBase=envelope.base;envelope.base=0;
  for(let i=1;i<settled.length;i+=3)settled[i]=Math.max(.025,settled[i]-oldBase);
  function createClothPhysics(envelope, initial, options={}) {
  const segments=44, side=segments+1, count=side*side, size=5.65;
  const position=new Float32Array(count*3), previous=new Float32Array(count*3), inverseMass=new Float32Array(count).fill(1);
  const contact=new Float32Array(count*3), rest=size/segments;
  const ca=[],cb=[],cr=[],cc=[];
  function constraint(a,b,length,compliance){ca.push(a);cb.push(b);cr.push(length);cc.push(compliance);}
  for(let j=0;j<side;j++)for(let i=0;i<side;i++){
    const k=j*side+i,o=k*3,x=(i/segments-.5)*size,z=(j/segments-.5)*size;
    position[o]=x+.025;position[o+1]=2.59+.012*Math.sin(i*.71)*Math.sin(j*.57);position[o+2]=z-.018;
    if(i<segments)constraint(k,k+1,rest,0.0000012);
    if(j<segments)constraint(k,k+side,rest,0.0000012);
    if(i<segments&&j<segments){constraint(k,k+side+1,rest*Math.SQRT2,.000009);constraint(k+1,k+side,rest*Math.SQRT2,.000009);}
    if(i<segments-1)constraint(k,k+2,rest*2,.0035);
    if(j<segments-1)constraint(k,k+side*2,rest*2,.0035);
  }
  if(initial)position.set(initial);
  previous.set(position);
  const initialState=new Float32Array(position);
  const A=Uint16Array.from(ca),B=Uint16Array.from(cb),R=Float32Array.from(cr),C=Float32Array.from(cc),lambda=new Float32Array(ca.length);
  let time=0,grabbed=[],handle=null,handleGoal=null;
  const rows=envelope.rows,cols=envelope.columns,he=envelope.height,base=envelope.base,table=envelope.radii,top=base+he;
  function radius(y,angle){
    const yy=Math.max(0,Math.min(rows-1.001,(y-base)/he*rows-.5));
    let aa=((angle/(Math.PI*2))%1+1)%1*cols;
    const y0=Math.floor(yy),y1=Math.min(rows-1,y0+1),a0=Math.floor(aa)%cols,a1=(a0+1)%cols,fy=yy-y0,fa=aa-Math.floor(aa);
    return (table[y0*cols+a0]*(1-fa)+table[y0*cols+a1]*fa)*(1-fy)+(table[y1*cols+a0]*(1-fa)+table[y1*cols+a1]*fa)*fy;
  }
  function collide(k,final=false){
    const o=k*3;
    let x=position[o],y=position[o+1],z=position[o+2];
    const floor=options.flatFloor ? .025 : (x*x+z*z<.78*.78 ? .098 : .025);
    if(y<floor){position[o+1]=floor;contact[o]=0;contact[o+1]=1;contact[o+2]=0;y=floor;}
    if(y>top+.022||y<base-.02||Math.abs(x)>.66||Math.abs(z)>.66)return;
    const r=Math.hypot(x,z),angle=Math.atan2(z,x),shell=radius(y,angle)+.023;
    if(r>=shell)return;
    if(y>top-.065&&r<radius(top,angle)+.025){position[o+1]=top+.023;contact[o]=0;contact[o+1]=1;contact[o+2]=0;return;}
    const ry=(radius(y+.022,angle)-radius(y-.022,angle))/.044;
    const ra=(radius(y,angle+.06)-radius(y,angle-.06))/.12;
    const ux=r>.0001?x/r:1,uz=r>.0001?z/r:0;
    let nx=ux+ra*uz/Math.max(r,.06),ny=-ry,nz=uz-ra*ux/Math.max(r,.06);
    const length=Math.hypot(nx,ny,nz);nx/=length;ny/=length;nz/=length;
    const push=(shell-r)/length+.00015;
    position[o]+=nx*push;position[o+1]+=ny*push;position[o+2]+=nz*push;
    if(final){const rr=Math.hypot(position[o],position[o+2]);const goal=radius(position[o+1],Math.atan2(position[o+2],position[o]))+.022;if(position[o+1]<top-.06&&rr<goal&&rr>.0001){position[o]*=goal/rr;position[o+2]*=goal/rr;}}
    contact[o]=nx;contact[o+1]=ny;contact[o+2]=nz;
  }
  function selfContact(){
    const cell=.075,minD=.048,grid=new Map();
    for(let k=0;k<count;k++){
      const o=k*3,ix=Math.floor(position[o]/cell),iy=Math.floor(position[o+1]/cell),iz=Math.floor(position[o+2]/cell);
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
        const bucket=grid.get((ix+dx)+','+(iy+dy)+','+(iz+dz));if(!bucket)continue;
        for(const other of bucket){if(Math.abs(other%side-k%side)<3&&Math.abs(Math.floor(other/side)-Math.floor(k/side))<3)continue;
          const a=other*3,vx=position[o]-position[a],vy=position[o+1]-position[a+1],vz=position[o+2]-position[a+2],d2=vx*vx+vy*vy+vz*vz;
          if(d2<minD*minD&&d2>1e-10){const d=Math.sqrt(d2),sum=inverseMass[k]+inverseMass[other];if(!sum)continue;const f=(minD-d)/(d*sum)*.65,wa=inverseMass[k]*f,wb=inverseMass[other]*f;position[o]+=vx*wa;position[o+1]+=vy*wa;position[o+2]+=vz*wa;position[a]-=vx*wb;position[a+1]-=vy*wb;position[a+2]-=vz*wb;}
        }
      }
      const key=ix+','+iy+','+iz;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(k);
    }
  }
  function pin(){if(!handle)return;for(const g of grabbed){const o=g.k*3;position[o]=handle[0]+g.offset[0];position[o+1]=handle[1]+g.offset[1];position[o+2]=handle[2]+g.offset[2];}}
  function step(dt=1/90,wind=0){
    time+=dt;contact.fill(0);lambda.fill(0);
    if(handle&&handleGoal){
      if(options.grabSpeed){
        const dx=handleGoal[0]-handle[0],dy=handleGoal[1]-handle[1],dz=handleGoal[2]-handle[2],distance=Math.hypot(dx,dy,dz);
        const fraction=Math.min(1-Math.exp(-28*dt),options.grabSpeed*dt/Math.max(distance,1e-8));
        handle[0]+=dx*fraction;handle[1]+=dy*fraction;handle[2]+=dz*fraction;
      }else for(let i=0;i<3;i++){const difference=handleGoal[i]-handle[i];handle[i]+=Math.max(-.09,Math.min(.09,difference*.27));}
    }
    for(let k=0;k<count;k++){
      const o=k*3,x=position[o],y=position[o+1],z=position[o+2];
      if(inverseMass[k]){
        let vx=(x-previous[o])*.993,vy=(y-previous[o+1])*.993,vz=(z-previous[o+2])*.993;
        const speed=Math.hypot(vx,vy,vz);if(speed>.15){vx*=.15/speed;vy*=.15/speed;vz*=.15/speed;}
        const flutter=wind*(.68+.32*Math.sin(time*1.7+z*.9));
        position[o]+=vx+flutter*2.2*dt*dt;position[o+1]+=vy-9.81*dt*dt;position[o+2]+=vz+flutter*Math.sin(time*.72)*dt*dt;
      }
      previous[o]=x;previous[o+1]=y;previous[o+2]=z;
    }
    pin();
    for(let iteration=0;iteration<(handle?(options.grabIterations||9):9);iteration++){
      const reverse=iteration%2;
      for(let v=0;v<A.length;v++){
        const c=reverse?A.length-v-1:v,a=A[c],b=B[c],ia=a*3,ib=b*3,wa=inverseMass[a],wb=inverseMass[b],sum=wa+wb;
        if(!sum)continue;
        const dx=position[ia]-position[ib],dy=position[ia+1]-position[ib+1],dz=position[ia+2]-position[ib+2],distance=Math.sqrt(dx*dx+dy*dy+dz*dz);
        if(distance<1e-8)continue;
        const alpha=C[c]/(dt*dt),dl=(-(distance-R[c])-alpha*lambda[c])/(sum+alpha);lambda[c]+=dl;
        const f=dl/distance,fa=wa*f,fb=wb*f;
        position[ia]+=dx*fa;position[ia+1]+=dy*fa;position[ia+2]+=dz*fa;position[ib]-=dx*fb;position[ib+1]-=dy*fb;position[ib+2]-=dz*fb;
      }
      for(let k=0;k<count;k++)collide(k);
    }
    if(Math.round(time/dt)%2===0)selfContact();
    for(let k=0;k<count;k++){
      collide(k,true);const o=k*3,nx=contact[o],ny=contact[o+1],nz=contact[o+2];
      if(nx||ny||nz){let vx=position[o]-previous[o],vy=position[o+1]-previous[o+1],vz=position[o+2]-previous[o+2];const vn=vx*nx+vy*ny+vz*nz;
        if(vn<0){vx-=vn*nx;vy-=vn*ny;vz-=vn*nz;}
        const friction=position[o+1]<.03?.74:.88;previous[o]=position[o]-vx*friction;previous[o+1]=position[o+1]-vy*friction;previous[o+2]=position[o+2]-vz*friction;
      }
    }
  }
  function release(){for(const g of grabbed){inverseMass[g.k]=1;if(options.releaseDamping!==undefined){const o=g.k*3;for(let i=0;i<3;i++)previous[o+i]=position[o+i]-(position[o+i]-previous[o+i])*options.releaseDamping;}}grabbed=[];handle=null;handleGoal=null;}
  function grab(k){release();const ox=position[k*3],oy=position[k*3+1],oz=position[k*3+2];handle=[ox,oy,oz];handleGoal=handle.slice();const row=Math.floor(k/side),col=k%side;
    for(let y=Math.max(0,row-1);y<=Math.min(segments,row+1);y++)for(let x=Math.max(0,col-1);x<=Math.min(segments,col+1);x++){const v=y*side+x;inverseMass[v]=0;grabbed.push({k:v,offset:[position[v*3]-ox,position[v*3+1]-oy,position[v*3+2]-oz]});}
  }
  function move(target){if(handleGoal)for(let i=0;i<3;i++)if(Number.isFinite(target[i]))handleGoal[i]=Math.max(i===1?(options.minGrabHeight??.08):-5.5,Math.min(5.5,target[i]));}
  function reset(){release();position.set(initialState);previous.set(initialState);time=0;}
  function saveRest(){initialState.set(position);previous.set(position);}
  return {segments,side,count,size,rest,position,previous,step,grab,move,release,reset,saveRest,radius,hasGrab:()=>!!handle,handle:()=>handle};
}

  function fallback(){const img=$('.gr-flat');img.src=rugData.albedo;img.hidden=false;$('.gr-loading').hidden=true;root.dataset.fallback='true';hint.textContent='3D unavailable · showing the rug flat';stage.disabled=true;$('.gr-redrape').disabled=true;$('.gr-rotate').disabled=true;$('.gr-title').hidden=true;}
  if(typeof THREE==='undefined'){fallback();return;}
  const T=THREE,v3=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state={ready:false,visible:true,simulating:!reduced,drag:null,turning:!reduced,turnSpeed:0,turnDelay:0};
  $('.gr-rotate').textContent=state.turning?'Pause rotation':'Rotate';
  let renderer;
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch(error){fallback();return;}
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();fallback();mount.hidden=true;});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.setClearColor(0x290910);renderer.domElement.setAttribute('aria-hidden','true');mount.appendChild(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color(0x290910);scene.fog=new T.Fog(0x290910,12,32);
  const camera=new T.PerspectiveCamera(35,1,.1,60);
  const physical=createClothPhysics(envelope,settled,{grabSpeed:3.6,grabIterations:12,releaseDamping:.18,minGrabHeight:.025,flatFloor:true});
  // The bottle, both fabric faces, binding and fringe share one rotating frame.
  // Physics stays in this local frame, so rotation cannot fling the fabric.
  const exhibit=new T.Group();exhibit.name='bottle-and-rug';scene.add(exhibit);
  scene.add(new T.HemisphereLight(0xffe9c7,0x624742,1.45));
  const key=new T.DirectionalLight(0xffe7c2,3.3);key.position.set(-3.8,7.0,5.3);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-5;key.shadow.camera.right=5;key.shadow.camera.top=6;key.shadow.camera.bottom=-4;key.shadow.camera.near=.5;key.shadow.camera.far=24;key.shadow.bias=-.00012;key.shadow.normalBias=.013;key.shadow.radius=3;scene.add(key);
  const fill=new T.DirectionalLight(0xe0e6ed,.95);fill.position.set(5,3,2);scene.add(fill);
  const rim=new T.DirectionalLight(0xffc27e,2.5);rim.position.set(1.8,5.8,-4.5);scene.add(rim);
  const studio=new T.Scene();studio.background=new T.Color(0x4b3932);
  for(const p of [[-3,4,4,2,7,0xffe6c1,3],[4,2,-2,1.5,6,0xffdab0,2],[0,7,0,6,4,0xffffff,1.7]]){const m=new T.Mesh(new T.PlaneGeometry(p[3],p[4]),new T.MeshBasicMaterial({color:new T.Color(p[5]).multiplyScalar(p[6]),side:T.DoubleSide}));m.position.set(p[0],p[1],p[2]);m.lookAt(0,1,0);studio.add(m);}
  const pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromScene(studio,.08);scene.environment=environment.texture;pmrem.dispose();studio.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  // Fine unpatterned velvet pile: diffuse burgundy, soft grazing sheen, no motif.
  const pileSize=128,pileBytes=new Uint8Array(pileSize*pileSize*4);
  for(let y=0;y<pileSize;y++)for(let x=0;x<pileSize;x++){const i=(y*pileSize+x)*4,a=Math.sin(x*127.1+y*311.7)*43758.5453,b=Math.sin(x*269.5+y*183.3)*43758.5453;pileBytes[i]=128+Math.round(((a-Math.floor(a))-.5)*8);pileBytes[i+1]=128+Math.round(((b-Math.floor(b))-.5)*15);pileBytes[i+2]=255;pileBytes[i+3]=255;}
  const pile=new T.DataTexture(pileBytes,pileSize,pileSize,T.RGBAFormat);pile.wrapS=pile.wrapT=T.RepeatWrapping;pile.repeat.set(180,180);pile.generateMipmaps=true;pile.minFilter=T.LinearMipmapLinearFilter;pile.magFilter=T.LinearFilter;pile.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());pile.needsUpdate=true;
  const floorMat=new T.MeshPhysicalMaterial({color:0x4c0c1b,roughness:.96,metalness:0,sheen:1,sheenColor:0x963049,sheenRoughness:.82,specularIntensity:.22,envMapIntensity:.45,normalMap:pile,normalScale:new T.Vector2(.4,.4)});
  const floor=new T.Mesh(new T.PlaneGeometry(120,120),floorMat);floor.name='burgundy-velvet-floor';floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
  function decode(b,Type){const str=atob(b),bytes=new Uint8Array(str.length);for(let i=0;i<str.length;i++)bytes[i]=str.charCodeAt(i);return new Type(bytes.buffer);}
  function texture(src,color=false){const tex=new T.Texture();tex.flipY=false;tex.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());if(color)tex.colorSpace=T.SRGBColorSpace;const img=new Image();img.onload=()=>{tex.image=img;tex.needsUpdate=true;if(state.ready)draw();};img.src=src;return tex;}
  const bottleGeo=new T.BufferGeometry();bottleGeo.setAttribute('position',new T.BufferAttribute(Float32Array.from(decode(bottleData.positions,Int16Array),v=>v/bottleData.positionScale),3));bottleGeo.setAttribute('uv',new T.BufferAttribute(Float32Array.from(decode(bottleData.uv,Uint16Array),v=>v/65535),2));bottleGeo.setIndex(new T.BufferAttribute(decode(bottleData.indices,Uint16Array),1));bottleGeo.computeVertexNormals();
  // Keep normals continuous across duplicated vertices at texture-island seams.
  const bp=bottleGeo.attributes.position,bn=bottleGeo.attributes.normal,normalGroups=new Map(),normalKeys=[];
  for(let i=0;i<bp.count;i++){const key=[bp.getX(i),bp.getY(i),bp.getZ(i)].map(v=>Math.round(v*bottleData.positionScale)).join(',');normalKeys.push(key);if(!normalGroups.has(key))normalGroups.set(key,v3());normalGroups.get(key).add(v3(bn.getX(i),bn.getY(i),bn.getZ(i)));}
  for(const value of normalGroups.values())value.normalize();for(let i=0;i<bp.count;i++){const n=normalGroups.get(normalKeys[i]);bn.setXYZ(i,n.x,n.y,n.z);}bn.needsUpdate=true;
  // GLTFLoader flips the normal-map Y axis when deriving tangents from UVs.
  // Maps remain opaque, base color is sRGB, and material data stays linear.
  const bottleMat=new T.MeshStandardMaterial({map:texture(bottleData.texture,true),normalMap:texture(bottleData.normal),roughnessMap:texture(bottleData.roughness),roughness:1,metalness:1,normalScale:new T.Vector2(.65,-.65),envMapIntensity:.82,fog:false});bottleMat.metalnessMap=bottleMat.roughnessMap;
  bottleGeo.computeBoundingBox();const bottle=new T.Mesh(bottleGeo,bottleMat);bottle.scale.setScalar(2.4);bottle.position.y=-bottleGeo.boundingBox.min.y*2.4;bottle.castShadow=true;bottle.receiveShadow=true;exhibit.add(bottle);
  const rugMat=new T.MeshPhysicalMaterial({color:0x851c29,roughness:.48,metalness:.03,sheen:1,sheenColor:0xffd7aa,sheenRoughness:.46,anisotropy:.78,anisotropyRotation:Math.PI/2,clearcoat:0,side:T.FrontSide,envMapIntensity:.82,specularIntensity:.8});
  const reverseMat=new T.MeshPhysicalMaterial({color:0x9b7358,roughness:.84,metalness:.01,sheen:.4,sheenColor:0xe8c392,sheenRoughness:.7,side:T.BackSide});
  // The artwork is a single complete rug, never a repeated wallpaper tile.
  const rugImage=new Image();rugImage.onload=()=>{
    if(!root.isConnected)return;
    const albedo=new T.Texture(rugImage);albedo.flipY=false;albedo.colorSpace=T.SRGBColorSpace;albedo.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());albedo.needsUpdate=true;
    rugMat.color.set(0xffffff);rugMat.map=albedo;reverseMat.map=albedo;
    const c=document.createElement('canvas'),w=rugImage.width,h=rugImage.height;c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.drawImage(rugImage,0,0);const pixels=ctx.getImageData(0,0,w,h).data;
    const height=new Float32Array(w*h),normal=new Uint8Array(w*h*4),orm=new Uint8Array(w*h*4);
    // Color-selective physical material maps: matte crimson pile, lustrous gold brocade.
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=y*w+x,o=k*4,r=pixels[o],g=pixels[o+1],b=pixels[o+2],gold=Math.max(0,Math.min(1,(g-r*.34)/58))*Math.max(0,Math.min(1,(r-65)/100));const hash=Math.sin(x*12.9898+y*78.233)*43758.5453,noise=hash-Math.floor(hash),weave=.017*Math.sin(x*Math.PI*.5)+.023*Math.sin(y*Math.PI*.5+.32*Math.sin(x*Math.PI*.5));height[k]=gold*.085+weave+(noise-.5)*.018;orm[o]=255;orm[o+1]=Math.round(255*(.48-gold*.19+(noise-.5)*.035));orm[o+2]=Math.round(255*(.018+gold*.60));orm[o+3]=255;}
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=y*w+x,o=k*4,dx=height[y*w+Math.min(w-1,x+1)]-height[y*w+Math.max(0,x-1)],dy=height[Math.min(h-1,y+1)*w+x]-height[Math.max(0,y-1)*w+x],z=1/Math.sqrt(dx*dx*5.76+dy*dy*5.76+1);normal[o]=Math.round(127.5*(1-dx*2.4*z));normal[o+1]=Math.round(127.5*(1+dy*2.4*z));normal[o+2]=Math.round(127.5*(1+z));normal[o+3]=255;}
    function dataTexture(bytes){const tex=new T.DataTexture(bytes,w,h,T.RGBAFormat);tex.flipY=false;tex.generateMipmaps=true;tex.minFilter=T.LinearMipmapLinearFilter;tex.magFilter=T.LinearFilter;tex.anisotropy=albedo.anisotropy;tex.needsUpdate=true;return tex;}
    rugMat.normalMap=dataTexture(normal);rugMat.normalScale=new T.Vector2(.72,.72);rugMat.roughnessMap=dataTexture(orm);rugMat.metalnessMap=rugMat.roughnessMap;rugMat.roughness=1;rugMat.metalness=1;rugMat.needsUpdate=true;reverseMat.needsUpdate=true;
    state.ready=true;root.dataset.loaded='true';parent.postMessage({type:'rug-ready'},location.origin);$('.gr-loading').hidden=true;draw();
  };rugImage.onerror=fallback;
  const seg=physical.segments*2,side=seg+1,p=new Float32Array(side*side*3),backP=new Float32Array(p.length),uv=new Float32Array(side*side*2),index=[];
  for(let j=0;j<=seg;j++)for(let i=0;i<=seg;i++){const k=j*side+i;uv[k*2]=i/seg;uv[k*2+1]=j/seg;if(j<seg&&i<seg)index.push(k,k+side,k+1,k+1,k+side,k+side+1);}
  const frontGeo=new T.BufferGeometry();frontGeo.setAttribute('position',new T.BufferAttribute(p,3).setUsage(T.DynamicDrawUsage));frontGeo.setAttribute('uv',new T.BufferAttribute(uv,2));frontGeo.setIndex(index);
  const backGeo=new T.BufferGeometry();backGeo.setAttribute('position',new T.BufferAttribute(backP,3).setUsage(T.DynamicDrawUsage));backGeo.setAttribute('uv',frontGeo.attributes.uv);backGeo.setIndex(index);
  const front=new T.Mesh(frontGeo,rugMat),back=new T.Mesh(backGeo,reverseMat);front.castShadow=back.castShadow=true;front.receiveShadow=back.receiveShadow=true;front.frustumCulled=back.frustumCulled=false;exhibit.add(front,back);
  const edgeIds=[];for(let i=0;i<=seg;i++)edgeIds.push(i);for(let j=1;j<=seg;j++)edgeIds.push(j*side+seg);for(let i=seg-1;i>=0;i--)edgeIds.push(seg*side+i);for(let j=seg-1;j>0;j--)edgeIds.push(j*side);
  const edgeP=new Float32Array(edgeIds.length*6),edgeIndex=[];for(let i=0;i<edgeIds.length;i++){const a=i*2,b=(i+1)%edgeIds.length*2;edgeIndex.push(a,b,a+1,a+1,b,b+1);}
  const edgeGeo=new T.BufferGeometry();edgeGeo.setAttribute('position',new T.BufferAttribute(edgeP,3).setUsage(T.DynamicDrawUsage));edgeGeo.setIndex(edgeIndex);const edging=new T.Mesh(edgeGeo,new T.MeshStandardMaterial({color:0x95633a,roughness:.74,side:T.DoubleSide}));edging.frustumCulled=false;edging.castShadow=true;exhibit.add(edging);
  const cubic=(a,b,c,d,t)=>b+.5*t*(c-a+t*(2*a-5*b+4*c-d+t*(3*(b-c)+d-a)));
  function updateRug(){const source=physical.position;
    for(let j=0;j<=seg;j++)for(let i=0;i<=seg;i++){const x=i/2,z=j/2,x0=Math.min(physical.segments-1,Math.floor(x)),z0=Math.min(physical.segments-1,Math.floor(z)),fx=x-x0,fz=z-z0,k=(j*side+i)*3;
      for(let v=0;v<3;v++){let a=0,b=0,c=0,d=0;for(let row=-1;row<=2;row++){const rr=Math.max(0,Math.min(physical.segments,z0+row))*physical.side,value=cubic(source[(rr+Math.max(0,x0-1))*3+v],source[(rr+x0)*3+v],source[(rr+x0+1)*3+v],source[(rr+Math.min(physical.segments,x0+2))*3+v],fx);if(row===-1)a=value;else if(row===0)b=value;else if(row===1)c=value;else d=value;}p[k+v]=cubic(a,b,c,d,fz);}
      const r=Math.hypot(p[k],p[k+2]),a=Math.atan2(p[k+2],p[k]),top=envelope.base+envelope.height;p[k+1]=Math.max(p[k+1],.025);
      if(p[k+1]<top+.033&&p[k+1]>envelope.base&&r<.65){const shell=physical.radius(p[k+1],a)+.036;if(r<shell){if(p[k+1]>top-.09&&r<physical.radius(top,a)+.036)p[k+1]=top+.034;else if(r>.0001){p[k]*=shell/r;p[k+2]*=shell/r;}}}
    }
    frontGeo.attributes.position.needsUpdate=true;frontGeo.computeVertexNormals();frontGeo.computeBoundingSphere();const n=frontGeo.attributes.normal.array;
    for(let i=0;i<p.length;i++)backP[i]=p[i]-n[i]*.013;backGeo.attributes.position.needsUpdate=true;backGeo.setAttribute('normal',frontGeo.attributes.normal);backGeo.computeBoundingSphere();
    for(let i=0;i<edgeIds.length;i++){const a=edgeIds[i]*3,k=i*6;for(let j=0;j<3;j++){edgeP[k+j]=p[a+j];edgeP[k+3+j]=backP[a+j];}}edgeGeo.attributes.position.needsUpdate=true;edgeGeo.computeVertexNormals();
  }
    // Silk warp fringes: small gravity-driven chains anchored to the rug's two ends.
  function makeFringe(parent=scene){
    const bundles=112,ends=2,nodes=6,strands=3,sides=4,total=bundles*ends,spacing=.032;
    const pos=new Float32Array(total*nodes*3),prev=new Float32Array(pos.length),seed=new Float32Array(total),rootPoint=new T.Vector3(),innerPoint=new T.Vector3();
    const dummyA=new T.Vector3(),dummyB=new T.Vector3(),tangent=new T.Vector3(),normal=new T.Vector3(),binormal=new T.Vector3(),vertical=new T.Vector3(0,1,0);
    const verts=new Float32Array(total*strands*nodes*sides*3),normals=new Float32Array(verts.length),colors=new Float32Array(verts.length),indices=[];
    function sampleEdge(b,inside,out){const x=(b%bundles)/(bundles-1)*physical.segments,i=Math.min(physical.segments-1,Math.floor(x)),f=x-i,row=b<bundles?inside:physical.segments-inside;const a=(row*physical.side+i)*3;return out.set(physical.position[a]*(1-f)+physical.position[a+3]*f,physical.position[a+1]*(1-f)+physical.position[a+4]*f,physical.position[a+2]*(1-f)+physical.position[a+5]*f);}
    function reset(){for(let b=0;b<total;b++){sampleEdge(b,0,rootPoint);sampleEdge(b,1,innerPoint);tangent.copy(rootPoint).sub(innerPoint).normalize();seed[b]=Math.sin(b*17.3)*.5+.5;for(let j=0;j<nodes;j++){const o=(b*nodes+j)*3;pos[o]=rootPoint.x+tangent.x*spacing*j;pos[o+1]=Math.max(.014,rootPoint.y+tangent.y*spacing*j-.002*j*j);pos[o+2]=rootPoint.z+tangent.z*spacing*j;}}prev.set(pos);}
    for(let b=0;b<total;b++)for(let t=0;t<strands;t++)for(let j=0;j<nodes;j++)for(let a=0;a<sides;a++){
      const v=((b*strands+t)*nodes+j)*sides+a,k=v*3;
      const c=new T.Color(b%9===0?0xa47d3c:b%4===0?0xe3c084:0xe9d5ad);colors[k]=c.r;colors[k+1]=c.g;colors[k+2]=c.b;
      if(j<nodes-1){const an=(a+1)%sides,base=((b*strands+t)*nodes+j)*sides;indices.push(base+a,base+sides+a,base+an,base+an,base+sides+a,base+sides+an);}
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(verts,3).setUsage(T.DynamicDrawUsage));g.setAttribute('normal',new T.BufferAttribute(normals,3).setUsage(T.DynamicDrawUsage));g.setAttribute('color',new T.BufferAttribute(colors,3));g.setIndex(indices);
    const m=new T.Mesh(g,new T.MeshPhysicalMaterial({vertexColors:true,roughness:.52,metalness:.035,sheen:1,sheenColor:0xffe2b4,sheenRoughness:.45}));m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;parent.add(m);
    function step(dt){
      for(let b=0;b<total;b++){
        sampleEdge(b,0,rootPoint);const base=b*nodes*3;pos[base]=rootPoint.x;pos[base+1]=rootPoint.y-.003;pos[base+2]=rootPoint.z;
        for(let j=1;j<nodes;j++){const k=base+j*3;for(let a=0;a<3;a++){const value=pos[k+a],velocity=Math.max(-.12,Math.min(.12,(value-prev[k+a])*.97));pos[k+a]+=velocity-(a===1?9.81*dt*dt:0);prev[k+a]=value;}}
        for(let it=0;it<4;it++)for(let j=1;j<nodes;j++){const k=base+j*3,a=k-3,dx=pos[k]-pos[a],dy=pos[k+1]-pos[a+1],dz=pos[k+2]-pos[a+2],d=Math.sqrt(dx*dx+dy*dy+dz*dz)||1;const f=(d-spacing*(.94+.12*seed[b]))/d,wa=j===1?0:.5,wb=1-wa;pos[a]+=dx*f*wa;pos[a+1]+=dy*f*wa;pos[a+2]+=dz*f*wa;pos[k]-=dx*f*wb;pos[k+1]-=dy*f*wb;pos[k+2]-=dz*f*wb;if(pos[k+1]<.013){pos[k+1]=.013;prev[k]+=(pos[k]-prev[k])*.35;prev[k+2]+=(pos[k+2]-prev[k+2])*.35;}}
      }
    }
    function update(){for(let b=0;b<total;b++)for(let j=0;j<nodes;j++){
      const k=(b*nodes+j)*3,k0=(b*nodes+Math.max(0,j-1))*3,k1=(b*nodes+Math.min(nodes-1,j+1))*3;
      dummyA.fromArray(pos,k0);dummyB.fromArray(pos,k1);tangent.copy(dummyB).sub(dummyA).normalize();if(tangent.lengthSq()<.001)tangent.set(0,0,1);normal.crossVectors(tangent,vertical);if(normal.lengthSq()<.001)normal.set(1,0,0);normal.normalize();binormal.crossVectors(tangent,normal).normalize();
      for(let t=0;t<strands;t++)for(let a=0;a<sides;a++){const angle=a/sides*Math.PI*2,braid=t/strands*Math.PI*2+j*.85,offset=.0036*(1-j*.035),r=.0022*(1-j*.06),nx=normal.x*Math.cos(angle)+binormal.x*Math.sin(angle),ny=normal.y*Math.cos(angle)+binormal.y*Math.sin(angle),nz=normal.z*Math.cos(angle)+binormal.z*Math.sin(angle),v=(((b*strands+t)*nodes+j)*sides+a)*3;
        verts[v]=pos[k]+offset*(normal.x*Math.cos(braid)+binormal.x*Math.sin(braid))+nx*r;verts[v+1]=pos[k+1]+offset*(normal.y*Math.cos(braid)+binormal.y*Math.sin(braid))+ny*r;verts[v+2]=pos[k+2]+offset*(normal.z*Math.cos(braid)+binormal.z*Math.sin(braid))+nz*r;normals[v]=nx;normals[v+1]=ny;normals[v+2]=nz;
      }
    }g.attributes.position.needsUpdate=true;g.attributes.normal.needsUpdate=true;}
    reset();update();return {step,update,reset};
  }

  updateRug();const fringe=makeFringe(exhibit);
  function resize(){const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;const narrow=w<560,azimuth=.26,polar=1.17,radius=narrow?11.0:8.5;const target=v3(narrow?0:-.25,narrow?1.15:1.12,0);camera.position.set(target.x+radius*Math.sin(polar)*Math.sin(azimuth),target.y+radius*Math.cos(polar),target.z+radius*Math.sin(polar)*Math.cos(azimuth));camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld();draw();}
  function draw(){if(!root.isConnected)return;renderer.render(scene,camera);const grip=$('.gr-grip');grip.hidden=!state.drag;if(state.drag&&physical.handle()){const h=physical.handle(),point=exhibit.localToWorld(v3(h[0],h[1],h[2]).sub(state.drag.offset)).project(camera);grip.style.transform=`translate(${(point.x*.5+.5)*stage.clientWidth}px,${(-point.y*.5+.5)*stage.clientHeight}px)`;}}
  function redrape(){endGrab();physical.reset();updateRug();fringe.reset();fringe.update();state.simulating=!reduced;state.turnDelay=.75;state.turnSpeed=0;hint.textContent='Hold a point and drag';draw();}
  const raycaster=new T.Raycaster(),pointer=new T.Vector2(),plane=new T.Plane(),hit=v3();
  function ray(e){exhibit.updateMatrixWorld(true);const r=stage.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);}
  function beginGrab(worldPoint,id){const point=exhibit.worldToLocal(worldPoint.clone());let nearest=0,distance=Infinity;for(let i=0;i<physical.count;i++){const k=i*3,d=(physical.position[k]-point.x)**2+(physical.position[k+1]-point.y)**2+(physical.position[k+2]-point.z)**2;if(d<distance){distance=d;nearest=i;}}
    physical.grab(nearest);const offset=v3(...physical.handle()).sub(point);state.drag={id,offset,target:v3(...physical.handle())};plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(v3()),worldPoint);state.simulating=true;state.turnSpeed=0;stage.setAttribute('aria-pressed','true');hint.textContent='Holding · rotation paused';draw();
  }
  function endGrab(){const d=state.drag;if(!d)return;state.drag=null;physical.release();state.turnDelay=.75;stage.setAttribute('aria-pressed','false');if(typeof d.id==='number'&&stage.hasPointerCapture(d.id))stage.releasePointerCapture(d.id);hint.textContent='Hold a point and drag';draw();}
  stage.addEventListener('pointerdown',e=>{if(!state.ready||state.drag||e.button!==0)return;ray(e);const hits=raycaster.intersectObjects([front,back],false);if(!hits.length)return;e.preventDefault();beginGrab(hits[0].point,e.pointerId);stage.setPointerCapture(e.pointerId);});
  stage.addEventListener('pointermove',e=>{const d=state.drag;if(!d||d.id!==e.pointerId)return;e.preventDefault();ray(e);if(raycaster.ray.intersectPlane(plane,hit)){d.target.copy(exhibit.worldToLocal(hit)).add(d.offset);physical.move(d.target.toArray());}});
  function release(e){if(state.drag?.id===e.pointerId)endGrab();}
  stage.addEventListener('pointerup',release);stage.addEventListener('pointercancel',release);stage.addEventListener('lostpointercapture',release);stage.addEventListener('contextmenu',e=>e.preventDefault());
  // A tap never starts choreography, snaps the rug back, or changes the camera.
  stage.addEventListener('click',e=>e.preventDefault());
  stage.addEventListener('keydown',e=>{if(!state.ready)return;if(e.key==='Escape'){e.preventDefault();endGrab();return;}if(e.key==='Enter'||e.key===' '){e.preventDefault();if(e.repeat)return;if(state.drag?.id==='keyboard')endGrab();else if(!state.drag){const k=(28*physical.side+22)*3;beginGrab(exhibit.localToWorld(v3(physical.position[k],physical.position[k+1],physical.position[k+2])),'keyboard');}return;}
    const d=state.drag;if(d?.id!=='keyboard'||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const inverse=exhibit.getWorldQuaternion(new T.Quaternion()).invert(),right=v3(1,0,0).applyQuaternion(camera.quaternion).applyQuaternion(inverse),up=v3(0,1,0).applyQuaternion(camera.quaternion).applyQuaternion(inverse),amount=e.shiftKey?.16:.075;d.target.addScaledVector(e.key==='ArrowLeft'||e.key==='ArrowRight'?right:up,e.key==='ArrowLeft'||e.key==='ArrowDown'?-amount:amount);physical.move(d.target.toArray());
  });
  stage.addEventListener('blur',()=>{if(state.drag?.id==='keyboard')endGrab();});
  $('.gr-redrape').addEventListener('click',()=>{if(state.ready)redrape();});
  $('.gr-rotate').addEventListener('click',()=>{if(!state.ready)return;state.turning=!state.turning;if(!state.turning)state.turnSpeed=0;$('.gr-rotate').textContent=state.turning?'Pause rotation':'Rotate';});
  let hostVisible=true;window.addEventListener('message',e=>{if(e.source===parent&&e.origin===location.origin&&e.data?.type==='scene-visibility'){hostVisible=!!e.data.visible;if(!hostVisible)endGrab();}});
  const onBlur=()=>endGrab(),onHidden=()=>{if(document.hidden)endGrab();};window.addEventListener('blur',onBlur);document.addEventListener('visibilitychange',onHidden);
  const observer=new ResizeObserver(resize);observer.observe(stage);const visibility=new IntersectionObserver(entries=>{state.visible=entries[0].isIntersecting;if(!state.visible)endGrab();},{threshold:.01});visibility.observe(root);
  let last=0,debt=0,disposed=false;
  function dispose(){if(disposed)return;disposed=true;observer.disconnect();visibility.disconnect();window.removeEventListener('blur',onBlur);document.removeEventListener('visibilitychange',onHidden);scene.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const key of ['map','normalMap','roughnessMap','metalnessMap'])m[key]?.dispose();m.dispose();}}});environment.dispose();renderer.dispose();}
  function frame(now){if(!root.isConnected){dispose();return;}requestAnimationFrame(frame);if(!state.ready||!state.visible||!hostVisible||document.hidden){last=now;debt=0;return;}if(now-last<14)return;const dt=Math.min(.05,(now-last)/1000||.016);last=now;
    let changed=false;
    if(state.simulating&&(!reduced||state.drag)){debt+=dt;let count=0;while(debt>=1/90&&count<5){physical.step(1/90,0);fringe.step(1/90);debt-=1/90;count++;}if(count===5)debt=0;updateRug();fringe.update();changed=true;}
    if(!state.drag){state.turnDelay=Math.max(0,state.turnDelay-dt);if(state.turning&&state.turnDelay===0){state.turnSpeed+=(.20-state.turnSpeed)*(1-Math.exp(-2.5*dt));exhibit.rotation.y=(exhibit.rotation.y+state.turnSpeed*dt)%(Math.PI*2);changed=true;}}
    if(changed)draw();
  }
  resize();rugImage.src=rugData.albedo;requestAnimationFrame(frame);
})();

