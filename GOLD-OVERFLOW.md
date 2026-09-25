# Golabii · Gold, in bloom

The first rug scene contains the 240 × 96 × 96 mm French square bottle with a deep golden liquid and exactly eight copies of the user's `flower-1.obj`. The OBJ lacked its MTL, so the petals use a new rose-pink finish. The earlier packed-rose collection is removed from this scene.

## Interaction and timing

The rug is 5.085 scene units wide instead of 5.65: 90% of its previous linear size. Fringe length is reduced by the same factor. Its 2,025-node rest state was regenerated and checked against the bottle and floor.

The under-rug light is restored. Overflow is gated by actual cloth clearance: any cloth point above the floor within the bottle's clearance cylinder blocks the sequence, including a rug held overhead. After 0.75 seconds of continuous clearance, the liquid rises, runs over the rim and down the walls, and forms a spreading puddle. Eight flowers rise sequentially and drift across that surface. The camera eases outward to include the puddle. Their final directions avoid the displaced rug.

**Reveal & pour** uses the existing guided pull. Direct dragging and keyboard grabbing still work. **Replay** repeats the reveal after a completed sequence. **Redrape** resets the rug, fill level, flower positions, puddle, and clearance timer. Light control remains independent. Reduced motion displays the revealed final state without the sequence animation.

## Implementation

- `gold-overflow.js`: render geometry, gradient liquid, eight linked flower models, stream ribbons, puddle surface, lighting, reset, and animation state.
- `overflow-motion.js`: deterministic phase and flower path calculations, puddle boundary, and cloth-clearance test.
- `user-flower.glb`: original OBJ geometry normalized and exported; 6,995 triangles and approximately 164 KiB, reused eight times.
- `gold-drape-small.bin`: new smaller-rug rest state. The unchanged `gold-collision.json` describes the bottle envelope.
- `french-square-bottle.glb`: existing validated web glass LOD. Website units are 10 units per metre.

Liquid motion is a procedural visual simulation for WebGL, not a fluid-solver bake or a physically volume-conserving simulation. PBR reflection, emissive gradients, waves, bloom, actual shadowed lights, and approximate fabric transmission create the appearance. The stream geometry follows the bottle profile. The puddle is animated mesh geometry. Flowers remain on its expanding footprint and separated from one another.

## Preview and integration

Serve the complete website over HTTP and open `/scenes/rug-burgundy.html`, or `/` for the homepage. The local preview is `http://127.0.0.1:8770/scenes/rug-burgundy.html` while its server runs. The saffron-yellow scene is unchanged.

This design branch contains the complete website, based on commit `8ac64e7`. See `HANDOFF.md` for setup and `design/gold-overflow/` for editable Blender sources. Publishing the branch is separate from deploying or merging it into the live website.

## Validation

JavaScript syntax and Git whitespace checks pass. The flower GLB has zero Khronos validation errors or warnings. The regenerated rug has finite coordinates and clears the floor and bottle. Motion checks cover exactly eight flowers, overhead/side cloth blocking, puddle timing, finite paths, flowers staying on the puddle, separation, and avoiding the displaced rug. Browser checks cover the complete reveal, partial grabbing without overflow, lighting, and redrape/replay. Physical phone performance has not been benchmarked.
