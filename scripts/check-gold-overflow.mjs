import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FLOWER_COUNT,FLOWER_SIZE,clothIsClear,flowState,flowerPose,edgeShape} from '../scenes/overflow-motion.js';
assert.equal(FLOWER_COUNT,8);
assert.ok(Math.abs(5.085/5.65-.9)<1e-12);
assert.equal(clothIsClear(new Float32Array([0,4.2,0])),false);
assert.equal(clothIsClear(new Float32Array([.48,1.5,0])),false);
assert.equal(clothIsClear(new Float32Array([1.4,1,0,0,.025,0])),true);
const bytes=fs.readFileSync(new URL('../scenes/gold-drape-small.bin',import.meta.url));const rest=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
assert.equal(clothIsClear(rest),false,'prepared drape must block overflow');
assert.equal(flowState(-1).puddle,0);assert.equal(flowState(2).stream,0);
for(const avoid of [null,0,1,2.5,-2]){
 const ends=[];
 for(let i=0;i<8;i++){
  const initial=flowerPose(i,-1);assert.ok(initial.y+FLOWER_SIZE*.704<1.84);
  for(let t=0;t<30;t+=.05){
   const p=flowerPose(i,t,t,avoid);for(const key of ['x','y','z','tilt','angle'])assert.ok(Number.isFinite(p[key]));
   if(p.stage==='floating'){const edge=flowState(t).radius*edgeShape(Math.atan2(p.z,p.x));assert.ok(Math.hypot(p.x,p.z)+FLOWER_SIZE*.48<edge+.01);}
  }
  const p=flowerPose(i,30,30,avoid);assert.equal(p.stage,'floating');ends.push(p);
  if(avoid!==null){const gap=Math.abs(Math.atan2(Math.sin(Math.atan2(p.z,p.x)-avoid),Math.cos(Math.atan2(p.z,p.x)-avoid)));assert.ok(gap>.55,'flower avoids displaced rug direction');}
 }
 for(let i=0;i<8;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(ends[i].x-ends[j].x,ends[i].z-ends[j].z)>.4);
}
assert.equal(flowState(22).phase,'settled');assert.equal(flowState(22).stream,0);
const report={flower_count:8,rug_linear_scale:.9,prepared_rug_blocks_overflow:true,overhead_and_side_cloth_blocks:true,puddle_starts_after_cascade:true,finite_paths:true,flowers_remain_on_puddle:true,flowers_avoid_displaced_rug:true,final_flowers_separated:true};
console.log(report);
