"""
Blender Scene Builder — imports all NeoGenesis GLB assets into one .blend file.
Run: blender --background --python import_to_blend.py
"""
import bpy, os, glob

BASE = r"C:\NeoGenesis\assets"
OUTPUT = os.path.join(BASE, "NeoGenesis_Assets.blend")

# Clean start
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# World
if scene.world is None:
    world = bpy.data.worlds.new("NeoGenesis_World")
    scene.world = world
scene.world.color = (0.06, 0.08, 0.12)

# Render engine
for engine in ['BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'BLENDER_WORKBENCH']:
    try:
        scene.render.engine = engine
        break
    except:
        continue

# Lights
bpy.ops.object.light_add(type='SUN', location=(5, -5, 10))
sun = bpy.context.active_object
sun.data.energy = 3.0
sun.rotation_euler = (0.9, 0.3, -0.5)

bpy.ops.object.light_add(type='AREA', location=(0, 0, 8))
area = bpy.context.active_object
area.data.energy = 50.0
area.data.size = 20

# Camera
bpy.ops.object.camera_add(location=(10, -10, 8))
cam = bpy.context.active_object
cam.rotation_euler = (1.0, 0.0, 0.7)
cam.data.lens = 35
scene.camera = cam

# Floor grid
bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, -0.01))
floor = bpy.context.active_object
floor.name = "Floor"
mat_floor = bpy.data.materials.new("Floor_Mat")
mat_floor.use_nodes = False
mat_floor.diffuse_color = (0.08, 0.12, 0.06, 1.0)
floor.data.materials.append(mat_floor)

# Layout categories on a grid
model_dir = os.path.join(BASE, "models")
categories = {}
for cat_name in sorted(os.listdir(model_dir)):
    cat_path = os.path.join(model_dir, cat_name)
    if not os.path.isdir(cat_path):
        continue
    glbs = sorted(glob.glob(os.path.join(cat_path, "*.glb")))
    if glbs:
        categories[cat_name] = glbs

COL_SPACING = 12
ROW_SPACING = 4
col_x = 0

for cat_name, glb_files in categories.items():
    # Create collection per category
    cat_col = bpy.data.collections.new(cat_name.upper())
    scene.collection.children.link(cat_col)
    print(f"\n--- {cat_name.upper()} ---")

    for row_idx, glb_path in enumerate(glb_files):
        name = os.path.splitext(os.path.basename(glb_path))[0]
        loc = (col_x, row_idx * ROW_SPACING, 0)

        before = set(bpy.data.objects)
        try:
            bpy.ops.import_scene.gltf(filepath=glb_path)
            after = set(bpy.data.objects)
            imported = list(after - before)
            for obj in imported:
                obj.location = loc
                # Move to category collection
                for c in obj.users_collection:
                    c.objects.unlink(obj)
                cat_col.objects.link(obj)
            print(f"  OK  {name} ({len(imported)} objects)")
        except Exception as e:
            print(f"  ERR {name}: {e}")

    col_x += COL_SPACING

# Frame all
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        for space in area.spaces:
            if space.type == 'VIEW_3D':
                space.shading.type = 'MATERIAL'
        try:
            override = bpy.context.copy()
            override['area'] = area
            override['region'] = area.regions[-1]
            with bpy.context.temp_override(**override):
                bpy.ops.view3d.view_all()
        except:
            pass
        break

# Save
bpy.ops.wm.save_as_mainfile(filepath=OUTPUT)
total_objs = len(bpy.data.objects)
total_meshes = len(bpy.data.meshes)
print(f"\n{'='*55}")
print(f"  Saved: {OUTPUT}")
print(f"  Collections: {len(categories)}")
print(f"  Objects: {total_objs}")
print(f"  Meshes: {total_meshes}")
print(f"{'='*55}")
