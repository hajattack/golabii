import bpy, math, json
from pathlib import Path
from mathutils import Vector
OUT=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=str(OUT/'flower-1.obj'),forward_axis='Y',up_axis='Z')
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.object.join();flower=bpy.context.object
flower.name='User flower · normalized original OBJ'
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
verts=flower.data.vertices
lo=Vector(tuple(min(v.co[i] for v in verts) for i in range(3)))
hi=Vector(tuple(max(v.co[i] for v in verts) for i in range(3)))
center=(lo+hi)/2;scale=1/(hi.x-lo.x)
for v in verts:
    p=(v.co-center)*scale
    # This flower was authored facing -Z in garment space; make its blossom +Z.
    v.co=(p.x,-p.y,-p.z)
bottom=min(v.co.z for v in verts)
for v in verts:v.co.z-=bottom
for p in flower.data.polygons:p.use_smooth=True
flower.data.materials.clear()
mat=bpy.data.materials.new('Petals · satin rose pink');mat.use_nodes=True
bs=mat.node_tree.nodes.get('Principled BSDF')
bs.inputs['Base Color'].default_value=(.61,.16,.255,1)
bs.inputs['Roughness'].default_value=.47
bs.inputs['Sheen Weight'].default_value=.3
bs.inputs['Subsurface Weight'].default_value=.07
bs.inputs['Subsurface Radius'].default_value=(.012,.004,.003)
mat.use_backface_culling=False;flower.data.materials.append(mat)
flower['source']='User-provided flower-1.obj; original petal geometry retained'
flower['normalization']='1 metre wide; base Z=0; blossom faces +Z; use scale .030–.036 for the bottle'
bpy.ops.export_scene.gltf(filepath=str(OUT/'user-flower.glb'),export_format='GLB',use_selection=True,
    export_yup=True,export_normals=True,export_texcoords=True,export_materials='EXPORT',export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'user-flower.blend'))
report={'source_vertices':len(verts),'triangles':sum(len(p.vertices)-2 for p in flower.data.polygons),
    'dimensions_normalized':list(flower.dimensions),'material_source':'Original MTL absent; rose-pink material created for this scene'}
(OUT/'flower-report.json').write_text(json.dumps(report,indent=2))
# Inspect both front and reverse so the supplied flower orientation can be checked.
flower.location=(-.65,0,0)
reverse=flower.copy();reverse.data=flower.data;scene=bpy.context.scene;scene.collection.objects.link(reverse)
reverse.location=(.65,0,.70);reverse.rotation_euler.x=math.pi
world=bpy.data.worlds.new('Studio');world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5;scene.world=world
def aim(o,t):o.rotation_euler=(Vector(t)-o.location).to_track_quat('-Z','Y').to_euler()
for x,y,z,power,size in [(-3,-3,5,450,4),(3,1,4,300,3)]:
    data=bpy.data.lights.new('Softbox','AREA');data.energy=power;data.shape='DISK';data.size=size
    ob=bpy.data.objects.new('Softbox',data);scene.collection.objects.link(ob);ob.location=(x,y,z);aim(ob,(0,0,.2))
bpy.ops.object.camera_add(location=(0,-3.7,4.8));camera=bpy.context.object;aim(camera,(0,0,.30))
camera.data.type='ORTHO';camera.data.ortho_scale=2.6;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=1200;scene.render.resolution_y=700;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.filepath=str(OUT/'flower-orientation.png')
bpy.ops.render.render(write_still=True)
print('FLOWER_READY',json.dumps(report))
