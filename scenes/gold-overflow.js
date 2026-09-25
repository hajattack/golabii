import * as T from 'three';
import {GLTFLoader} from './vendor/gold/loaders/GLTFLoader.js';
import {FLOWER_COUNT,FLOWER_SIZE,smooth,mix,bottleRadius,flowState,edgeShape,puddleHeight,flowerAngle,flowerPose} from './overflow-motion.js';

function liquidGeometry(){
  const n=64,rows=28,p=new Float32Array((n*(rows+1)+2)*3),colors=new Float32Array(p.length),indices=[];
  for(let row=0;row<rows;row++)for(let j=0;j<n;j++){
    const a=row*n+j,b=row*n+(j+1)%n,c=a+n,d=b+n;indices.push(a,c,b,b,c,d);
  }
  const bottom=n*(rows+1),top=bottom+1;
  for(let j=0;j<n;j++){indices.push(bottom,j,(j+1)%n);indices.push(top,rows*n+(j+1)%n,rows*n+j);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(p,3).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute('color',new T.BufferAttribute(colors,3));geometry.setIndex(indices);
  const amber=new T.Color(0xa74903),honey=new T.Color(0xffcd51),color=new T.Color();
  function update(level){
    for(let row=0;row<=rows;row++)for(let j=0;j<n;j++){
      const y=mix(.060,level,row/rows),a=j/n*Math.PI*2,r=bottleRadius(y,a,true),k=(row*n+j)*3;
      p[k]=Math.cos(a)*r;p[k+1]=y;p[k+2]=Math.sin(a)*r;
      color.copy(amber).lerp(honey,smooth(.15,2.4,y));color.toArray(colors,k);
    }
    p[bottom*3+1]=.060;p[top*3+1]=level;
    amber.toArray(colors,bottom*3);honey.toArray(colors,top*3);
    geometry.attributes.position.needsUpdate=true;geometry.attributes.color.needsUpdate=true;
    geometry.computeVertexNormals();geometry.computeBoundingSphere();
  }
  update(1.82);return {geometry,update};
}

function streamGeometry(angle){
  const rows=52,cols=8,p=new Float32Array((rows+1)*(cols+1)*3),indices=[];
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const a=row*(cols+1)+col,b=a+cols+1;indices.push(a,b,a+1,a+1,b,b+1);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(p,3).setUsage(T.DynamicDrawUsage));geometry.setIndex(indices);
  function update(time,strength,direction=angle){
    const reach=smooth(2.3,3.65,time),length=2.39*reach;
    for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
      const f=row/rows,y=2.407-length*f,u=col/cols*2-1;
      const tip=mix(1,Math.sqrt(Math.max(0,1-smooth(.87,1,f))),1-smooth(.95,1,reach));
      const width=(.115+.040*Math.sin(f*7+angle+time*.5))*Math.pow(strength,.6)*tip;
      const a=direction+u*width+.035*Math.sin(f*9-time*.9+angle)*f;
      const r=bottleRadius(y,a)+.010+.010*(1-u*u)+.003*Math.sin(f*30-time*3+angle);
      const k=(row*(cols+1)+col)*3;p[k]=Math.cos(a)*r;p[k+1]=y;p[k+2]=Math.sin(a)*r;
    }
    geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();
  }
  return {geometry,update};
}

function puddleGeometry(){
  const rows=22,n=112,p=new Float32Array((1+rows*n)*3),colors=new Float32Array(p.length),indices=[];
  for(let j=0;j<n;j++)indices.push(0,1+(j+1)%n,1+j);
  for(let row=0;row<rows-1;row++)for(let j=0;j<n;j++){
    const a=1+row*n+j,b=1+row*n+(j+1)%n,c=a+n,d=b+n;indices.push(a,b,c,b,d,c);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(p,3).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute('color',new T.BufferAttribute(colors,3));geometry.setIndex(indices);
  const amber=new T.Color(0x9c5007),gold=new T.Color(0xffcc53),c=new T.Color();
  function update(radius,time){
    p[1]=.030;gold.toArray(colors,0);
    for(let row=0;row<rows;row++)for(let j=0;j<n;j++){
      const f=(row+1)/rows,a=j/n*Math.PI*2,r=radius*f*edgeShape(a);
      const x=Math.cos(a)*r,z=Math.sin(a)*r,k=(1+row*n+j)*3;
      p[k]=x;p[k+1]=mix(puddleHeight(x,z,time),.006,smooth(.94,1,f));p[k+2]=z;
      c.copy(amber).lerp(gold,.48+.32*Math.sin(a*2+r*1.7)+.10*(1-f));c.toArray(colors,k);
    }
    geometry.attributes.position.needsUpdate=true;geometry.attributes.color.needsUpdate=true;geometry.computeVertexNormals();
  }
  return {geometry,update};
}

export async function createGoldOverflow(exhibit){
  const loader=new GLTFLoader();
  const [glassAsset,flowerAsset]=await Promise.all([loader.loadAsync('french-square-bottle.glb'),loader.loadAsync('user-flower.glb')]);
  const bottle=glassAsset.scene;bottle.scale.setScalar(10);bottle.position.y=1.2;
  bottle.name='French square glass bottle';
  bottle.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;o.material.transmission=.99;
    o.material.depthWrite=false;
    o.material.roughness=.055;o.material.envMapIntensity=1.7;o.material.clearcoat=.18;
    if(o.material.normalMap)o.material.normalScale.setScalar(.16);}});
  exhibit.add(bottle);
  const power={value:1};
  const liquidData=liquidGeometry();
  const liquidMaterial=new T.MeshPhysicalMaterial({vertexColors:true,color:0xffffff,metalness:.58,roughness:.19,
    transparent:true,opacity:.62,depthWrite:false,clearcoat:.8,clearcoatRoughness:.12,envMapIntensity:1.5});
  liquidMaterial.onBeforeCompile=shader=>{
    shader.uniforms.lampPower=power;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vGoldLocal;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGoldLocal=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float lampPower;varying vec3 vGoldLocal;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      float core=(1.-smoothstep(.06,.47,min(abs(vGoldLocal.x),abs(vGoldLocal.z))))*exp(-pow((vGoldLocal.y-1.1)*.9,2.));
      vec3 goldLight=mix(vec3(.35,.07,.002),vec3(1.,.48,.085),core);
      totalEmissiveRadiance=goldLight*(1.0+core*.70)*lampPower;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
      'outgoingLight=totalDiffuse*.10+totalSpecular*.26+totalEmissiveRadiance;\n#include <opaque_fragment>');
  };
  const liquid=new T.Mesh(liquidData.geometry,liquidMaterial);liquid.name='Deep gold · rising interior liquid';liquid.renderOrder=4;exhibit.add(liquid);

  const flowMaterial=new T.MeshPhysicalMaterial({color:0xeeb12e,metalness:.88,roughness:.26,clearcoat:1,
    clearcoatRoughness:.16,emissive:0x944303,emissiveIntensity:.35,envMapIntensity:1.75,side:T.DoubleSide});
  const streams=[];
  for(let i=0;i<8;i++){
    const data=streamGeometry(flowerAngle(i)),mesh=new T.Mesh(data.geometry,flowMaterial);
    mesh.name='Gold running down the glass';mesh.visible=false;mesh.frustumCulled=false;mesh.renderOrder=5;
    exhibit.add(mesh);streams.push({...data,mesh});
  }
  const lip=new T.Mesh(new T.TorusGeometry(.298,.018,8,72),flowMaterial);
  lip.rotation.x=Math.PI/2;lip.position.y=2.401;lip.visible=false;lip.renderOrder=5;exhibit.add(lip);
  const puddleData=puddleGeometry(),puddleMaterial=flowMaterial.clone();puddleMaterial.vertexColors=true;puddleMaterial.color.set(0xffffff);puddleMaterial.roughness=.29;puddleMaterial.envMapIntensity=2.0;
  puddleMaterial.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vPoolLocal;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPoolLocal=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vPoolLocal;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
      'float glint=.07+.75*smoothstep(.20,3.2,dot(vPoolLocal.xz,vPoolLocal.xz));vec3 poolLight=totalDiffuse+totalSpecular*glint+totalEmissiveRadiance;outgoingLight=poolLight/(vec3(1.)+poolLight/vec3(2.4,1.6,.70));\n#include <opaque_fragment>');
  };
  const puddle=new T.Mesh(puddleData.geometry,puddleMaterial);puddle.name='Spreading golden puddle';puddle.visible=false;puddle.frustumCulled=false;puddle.receiveShadow=true;exhibit.add(puddle);

  const flowers=[];const materials=new Set();
  flowerAsset.scene.traverse(o=>{if(o.isMesh){for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
  for(const m of materials){
    m.side=T.DoubleSide;m.roughness=.5;m.envMapIntensity=.7;
    // Preserve rose-pink detail near the very bright interior lamp.
    m.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vFlowerWorld;');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFlowerWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vFlowerWorld;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`float away=smoothstep(.6,1.2,length(vFlowerWorld.xz));
        vec3 softPetal=diffuseColor.rgb*(.72+.48*max(0.,normal.y))+totalSpecular*.045;
        outgoingLight=mix(softPetal,outgoingLight,away);\n#include <opaque_fragment>`);
    };m.needsUpdate=true;
  }
  for(let i=0;i<FLOWER_COUNT;i++){
    const flower=flowerAsset.scene.clone(true);flower.name=`User OBJ flower ${i+1} of 8`;flower.scale.setScalar(FLOWER_SIZE);
    flower.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    exhibit.add(flower);flowers.push(flower);
  }
  const source=new T.PointLight(0xffd097,24,8,2);source.position.set(0,.95,0);
  source.castShadow=true;source.shadow.mapSize.set(512,512);source.shadow.camera.near=.12;source.shadow.camera.far=8;
  source.shadow.bias=-.0015;source.shadow.normalBias=.025;source.shadow.radius=3;exhibit.add(source);
  const baseLight=new T.PointLight(0xffcb86,8,7,2);baseLight.position.set(0,.24,0);exhibit.add(baseLight);
  const bounce=new T.PointLight(0xffd093,12,9,2);bounce.position.set(0,.68,0);exhibit.add(bounce);

  function illuminateFabric(mat){
    mat.onBeforeCompile=shader=>{
      shader.uniforms.lampPower=power;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vFabricWorld;');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFabricWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float lampPower;varying vec3 vFabricWorld;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        vec3 offset=vFabricWorld-vec3(0.,.95,0.);
        totalEmissiveRadiance+=diffuseColor.rgb*vec3(1.,.57,.22)*min(4.5,3.4/(.45+dot(offset,offset)))*lampPower;`);
    };mat.needsUpdate=true;
  }
  let flowTime=-1,lastLevel=-1,phase='covered',avoidAngle=null;
  const up=new T.Vector3(0,1,0),axis=new T.Vector3(),tilt=new T.Quaternion(),spin=new T.Quaternion();
  function update(ambientTime,dt,reduced=false){
    if(flowTime>=0&&!reduced)flowTime+=dt;
    const s=flowState(flowTime);phase=s.phase;
    if(Math.abs(s.level-lastLevel)>1e-5){liquidData.update(s.level);lastLevel=s.level;}
    for(let i=0;i<streams.length;i++){const stream=streams[i];stream.mesh.visible=s.stream>.004;if(stream.mesh.visible)stream.update(flowTime,s.stream,flowerAngle(i,avoidAngle));}
    lip.visible=s.stream>.01;
    puddle.visible=s.puddle>0;
    if(puddle.visible)puddleData.update(s.radius,reduced?22:ambientTime);
    for(let i=0;i<flowers.length;i++){
      const pose=flowerPose(i,flowTime,reduced?22:ambientTime,avoidAngle),f=flowers[i];
      f.position.set(pose.x,pose.y,pose.z);
      axis.set(Math.cos(pose.angle)*Math.sin(pose.tilt),Math.cos(pose.tilt),Math.sin(pose.angle)*Math.sin(pose.tilt));
      tilt.setFromUnitVectors(up,axis);spin.setFromAxisAngle(up,pose.angle+i*.73);f.quaternion.copy(tilt).multiply(spin);
    }
  }
  update(0,0);
  return {bottle,flowers,illuminateFabric,update,get phase(){return phase;},get time(){return flowTime;},
    start(reduced=false,clothAngle=null){if(flowTime<0){flowTime=reduced?22:0;avoidAngle=clothAngle;}},
    reset(){flowTime=-1;avoidAngle=null;update(0,0);},
    setPower(value){power.value=value;source.intensity=24*value;baseLight.intensity=8*value;bounce.intensity=12*value;flowMaterial.emissiveIntensity=.35*value;puddleMaterial.emissiveIntensity=.35*value;}};
}
