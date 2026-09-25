"""Editable initial state. The interactive overflow is defined in the web files."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector,Quaternion
OUT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(OUT/'source-bottle.blend'))
scene=bpy.context.scene
collection=bpy.data.collections.new('05 · GOLD AND EIGHT USER FLOWERS');scene.collection.children.link(collection)
with bpy.data.libraries.load(str(OUT/'user-flower.blend'),link=False) as (source,dest):dest.objects=source.objects
template=next(o for o in dest.objects if o and o.type=='MESH')
flowers=[]
for i in range(8):
    ob=template if i==0 else template.copy()
    if i:ob.data=template.data
    collection.objects.link(ob);ob.name=f'User OBJ rose {i+1} of 8';ob.scale=(.038,)*3
    x=(1 if i%2 else -1)*.185;y=.30+(i//2)*.39;z=(1 if (i+i//2)%2 else -1)*.13
    ob.location=(x/10,-z/10,y/10-.12)
    a=i*math.pi/4+.25;tilt=.24*(1 if i%2 else -1)
    axis=Vector((math.cos(a)*math.sin(tilt),-math.sin(a)*math.sin(tilt),math.cos(tilt)))
    ob.rotation_mode='QUATERNION';ob.rotation_quaternion=Vector((0,0,1)).rotation_difference(axis)@Quaternion((0,0,1),-a-i*.73)
    ob['source']='flower-1.obj supplied by user';flowers.append(ob)

def factor(a):
    c,s=abs(math.cos(a)),abs(math.sin(a))
    if s>c:c,s=s,c
    q=14/48;d=1-q
    if s/c<=d:return 1/c
    b=d*(c+s);return b+math.sqrt(max(0,b*b-2*d*d+q*q))
verts=[];faces=[];colors=[];n=64;rows=28
for row in range(rows+1):
    y=.060+(1.82-.060)*row/rows
    for j in range(n):
        a=j/n*math.tau;r=.446*factor(a)
        verts.append((math.cos(a)*r/10,-math.sin(a)*r/10,y/10-.120))
        t=row/rows;colors.append((.34+.60*t,.07+.43*t,.002+.035*t,1))
for row in range(rows):
    for j in range(n):
        a=row*n+j;b=row*n+(j+1)%n;c=a+n;d=b+n;faces.extend([(a,c,b),(b,c,d)])
bottom=len(verts);verts.append((0,0,.006-.12));colors.append((.34,.07,.002,1))
top=len(verts);verts.append((0,0,.182-.12));colors.append((.94,.50,.037,1))
for j in range(n):faces.extend([(bottom,j,(j+1)%n),(top,rows*n+(j+1)%n,rows*n+j)])
mesh=bpy.data.meshes.new('Golden liquid · closed initial fill');mesh.from_pydata(verts,[],faces);mesh.update()
attribute=mesh.color_attributes.new(name='GoldenGradient',type='FLOAT_COLOR',domain='POINT')
for i,c in enumerate(colors):attribute.data[i].color=c
for p in mesh.polygons:p.use_smooth=True
liquid=bpy.data.objects.new('Golden liquid · before overflow',mesh);collection.objects.link(liquid)
mat=bpy.data.materials.new('Gold · deep amber to molten honey');mat.use_nodes=True
bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Metallic'].default_value=.55;bs.inputs['Roughness'].default_value=.19
bs.inputs['Transmission Weight'].default_value=.32;bs.inputs['Coat Weight'].default_value=.8
bs.inputs['Emission Color'].default_value=(1,.40,.025,1);bs.inputs['Emission Strength'].default_value=.25
node=mat.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name='GoldenGradient';mat.node_tree.links.new(node.outputs['Color'],bs.inputs['Base Color']);mesh.materials.append(mat)
scene['README']='Exactly eight copies of supplied flower-1.obj, editable initial liquid state. See GOLD-OVERFLOW.md for the procedural website animation.'
bpy.ops.object.select_all(action='DESELECT')
for ob in flowers+[liquid]:ob.select_set(True)
bpy.context.view_layer.objects.active=liquid
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'gold-bottle-eight-flowers.blend'))
web=bpy.data.objects['Bottle_LOD1'];web.hide_set(False);web.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'gold-bottle-eight-flowers.glb'),export_format='GLB',use_selection=True,
    export_yup=True,export_normals=True,export_texcoords=True,export_tangents=True,export_materials='EXPORT',
    export_vertex_color='MATERIAL',export_animations=False,export_cameras=False,export_lights=False)
web.hide_set(True)
(OUT/'editable-report.json').write_text(json.dumps({'flowers':8,'source_triangles_each':6995,'initial_liquid_height_mm':182,'flower_width_mm':38,'animation_location':'Website JavaScript; not baked into this editable initial state'},indent=2))
print('EDITABLE_GOLD_BOTTLE_READY')
