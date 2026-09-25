const fs=require('fs');
const path=require('node:path');
  function createClothPhysics(envelope, initial, options={}) {
  const segments=44, side=segments+1, count=side*side, size=5.085;
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

const envelope=JSON.parse(fs.readFileSync(path.join(__dirname,'../scenes/gold-collision.json')));const p=createClothPhysics(envelope,null,{flatFloor:true});for(let i=0;i<850;i++)p.step(1/90);fs.writeFileSync(path.join(__dirname,'../scenes/gold-drape-small.bin'),Buffer.from(p.position.buffer));console.log('SMALL_RUG_READY',p.count,p.size);
