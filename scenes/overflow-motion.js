export const FLOWER_COUNT=8;
export const FLOWER_SIZE=.38;
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
export const mix=(a,b,t)=>a+(b-a)*t;

export function squareFactor(angle){
  let c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
  if(s>c)[c,s]=[s,c];
  const d=1-14/48;
  if(s/c<=d)return 1/c;
  const b=d*(c+s);return b+Math.sqrt(Math.max(0,b*b-2*d*d+(14/48)**2));
}
const PROFILE=[[0,.43],[.06,.48],[1.82,.48],[1.88,.477],[1.95,.457],[2.02,.414],[2.08,.357],[2.14,.308],[2.19,.295],[2.25,.295],[2.30,.325],[2.385,.325],[2.4,.310]];
export function bottleRadius(y,angle=0,inner=false){
  let r=PROFILE.at(-1)[1];
  for(let i=1;i<PROFILE.length;i++)if(y<=PROFILE[i][0]){
    const a=PROFILE[i-1],b=PROFILE[i];r=mix(a[1],b[1],clamp((y-a[0])/(b[0]-a[0])));break;
  }
  if(inner)r=y>=2.19?.265:r-.034;
  return r*(1+(squareFactor(angle)-1)*(1-smooth(1.82,2.19,y)));
}

// A cloth point above the base and within this vertical cylinder means some
// of the rug is still over or beside the bottle. This also rejects a rug held
// directly overhead, even when it is no longer touching the glass.
export function clothIsClear(position){
  for(let k=0;k<position.length;k+=3)
    if(position[k+1]>.13&&Math.hypot(position[k],position[k+2])<.72)return false;
  return true;
}

export function flowState(t){
  if(t<0)return {phase:'covered',level:1.82,stream:0,puddle:0,radius:0};
  const level=mix(1.82,2.385,smooth(0,2.5,t))-.77*smooth(13,21,t);
  const stream=smooth(2.3,3.5,t)*(1-smooth(13,19,t));
  const puddle=smooth(3.35,4.2,t);
  const radius=mix(.58,2.65,1-Math.exp(-Math.max(0,t-3.5)/5.8));
  return {phase:t<2.5?'rising':t<13?'pouring':t<22?'drifting':'settled',level,stream,puddle,radius};
}
export function edgeShape(a){return 1+.10*Math.sin(3*a+.4)+.057*Math.sin(5*a+1.2)+.025*Math.cos(9*a);}
export function puddleHeight(x,z,time){
  const r=Math.hypot(x,z);
  return .025+.006*Math.sin(r*13-time*1.65)*Math.exp(-r*.28)+.004*Math.sin(x*7+z*5-time*.9);
}
export function flowerAngle(i,avoidAngle=null){return avoidAngle===null?i*Math.PI/4+.25:avoidAngle+.68+i*(Math.PI*2-1.36)/7;}
export function flowerStart(i){
  return {x:(i%2?1:-1)*.185,y:.30+Math.floor(i/2)*.39,z:((i+Math.floor(i/2))%2?1:-1)*.13};
}
export function flowerPose(i,t,ambientTime=0,avoidAngle=null){
  const initial=flowerStart(i),a=flowerAngle(i,avoidAngle),exit=2.7+i*.85;
  if(t<exit){
    const rise=t<0?0:smooth(i*.17,exit,t);
    return {x:mix(initial.x,0,rise),y:mix(initial.y,2.40,rise),z:mix(initial.z,0,rise),
      tilt:mix(.24*(i%2?1:-1),0,rise),angle:a,stage:'inside'};
  }
  const local=t-exit;
  if(local<.8){
    const q=smooth(0,.8,local),r=mix(0,.35,q);
    return {x:Math.cos(a)*r,y:2.40+.085*Math.sin(q*Math.PI),z:Math.sin(a)*r,tilt:q*.48,angle:a,stage:'lip'};
  }
  if(local<2.6){
    const q=smooth(.8,2.6,local),y=mix(2.40,.055,q),r=bottleRadius(y,a)+.023+.025*Math.sin(q*Math.PI)+.23*smooth(.65,1,q);
    return {x:Math.cos(a)*r,y,z:Math.sin(a)*r,tilt:Math.sin(q*Math.PI)*1.30+.30*(1-q),angle:a,stage:'cascade'};
  }
  const drift=smooth(2.6,10.5,local),wantedRadius=mix(.72,[1.68,2.14,1.94,2.25,1.80,2.10,1.88,2.31][i],drift);
  const angle=a+.10*Math.sin(drift*Math.PI)+.018*Math.sin(ambientTime*.35+i)*drift;
  const radius=Math.min(wantedRadius,flowState(t).radius*edgeShape(angle)-.22);
  const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
  return {x,y:puddleHeight(x,z,ambientTime)-.040,z,tilt:.06*Math.sin(ambientTime*.75+i)*drift,angle:angle+.08*Math.sin(ambientTime*.3+i),stage:'floating'};
}
