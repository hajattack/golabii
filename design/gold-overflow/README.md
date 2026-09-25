# Golabii · Gold, in bloom

This revision restores the warm light visible under the rug, reduces the rug by 10% in width and length, and replaces the earlier rose collection with exactly eight copies of the supplied `flower-1.obj`.

## The reveal

The liquid has a deep amber-to-gold metallic gradient. When the rug is completely clear of the bottle for 0.75 seconds, the liquid rises to the mouth, overflows in streams along the glass, and spreads into a rippling gold puddle. The eight flowers rise in sequence, travel over the rim and down the sides, then drift on the surface. Their final paths avoid the direction of the displaced carpet.

This is a procedural real-time WebGL flow animation with surface waves and flower paths. It is not a baked fluid solver or a volume-conserving fluid simulation. Cloth motion is simulated by the existing solver. Cloth light transmission and bounced illumination are approximated for the web.

**Reveal & pour** performs the rug pull and begins the sequence when the actual cloth clearance condition is satisfied. Manual dragging also works. **Replay** repeats the reveal. **Redrape** restores the initial liquid and all eight flowers, clears the puddle, and resets the smaller rug. **Light on/off** compares the illumination. Reduced-motion preference uses an immediate final state.

## Your flower

`flower-1.obj` is included unchanged. Its referenced `flower-1.mtl` was not supplied, so a rose-pink material was created. The original petal geometry is retained: 3,895 vertices and 6,995 triangles per copy, or 55,960 flower triangles across eight instances. The web download stores the mesh once. It is about 164 KiB; the eight flowers share its geometry.

`user-flower.glb` and `user-flower.blend` contain the normalized reusable flower: 1 metre wide, blossom facing up, base at zero. The animation uses a uniform scale of 0.038 m, producing 38 mm flower heads.

## Editable files

- `gold-bottle-eight-flowers.blend`: the editable initial bottle, golden fill, eight linked flower objects, original glass LODs/collision, and studio. The website animation is not baked into this file.
- `gold-bottle-eight-flowers.glb`: complete export of the initial bottle, golden fill and eight flowers; the overflow animation remains in the website code.
- `user-flower.blend` / `user-flower.glb`: the supplied flower prepared for reuse.
- `source-bottle.blend`: the prior empty French square bottle used to build the editable scene.
- `prepare_flower.py` / `build_editable_bottle.py`: Blender 4.5 rebuild scripts. They replace the currently open scene.
- Validation reports cover the supplied flower GLB, the reduced rug, and the sequence's clearance and floating-path constraints.

The complete website is in the repository root. See `../../HANDOFF.md` for preview, editing, and validation instructions. This directory contains the editable design sources; the browser uses the optimized files in `../../scenes/`.
