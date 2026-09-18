"""
NeoGenesis — Blender Scene Builder
Imports all generated GLB models into one organized .blend file.
Run via: blender --background --python create_blend.py
"""
import bpy
import os
import glob

BASE = r"C:\NeoGenesis\assets"
OUTPUT = os.path.join(BASE, "NeoGenesis_Assets.blend")

# ── Clean slate ──────────────────────────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)

scene = bpy.context.scene

# Setup world
if scene.world is None:
    world = bpy.data.worlds.new("NeoGenesis_World")
    scene.world = world
scene.world.color = (0.05, 0.07, 0.1)

# Try EEVEE, fallback to Workbench for background render
try:
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
except:
    try:
        scene.render.engine = 'BLENDER_EEVEE'
    except:
        scene.render.engine = 'BLENDER_WORKBENCH'

# ── Lighting ─────────────────────────────────────────────────
bpy.ops.object.light_add(type='SUN', location=(5, -5, 10))
sun = bpy.context.active_object
sun.data.energy = 3.0
sun.rotation_euler = (0.9, 0.3, -0.5)

bpy.ops.object.light_add(type='AREA', location=(0, 0, 8))
hemi = bpy.context.active_object
hemi.data.energy = 50.0
hemi.data.size = 20

# ── Camera ───────────────────────────────────────────────────
bpy.ops.object.camera_add(location=(8, -8, 6))
cam = bpy.context.active_object
cam.rotation_euler = (1.0, 0.0, 0.8)
cam.data.lens = 35
scene.camera = cam

# ── Import helper ────────────────────────────────────────────
imported_objects = {}

def import_glb(filepath):
    """Import a GLB file and return the imported objects."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=filepath)
    after = set(bpy.data.objects)
    return list(after - before)

# ── Layout categories on a grid ──────────────────────────────
categories = {}
model_dir = os.path.join(BASE, "models")
for cat_name in sorted(os.listdir(model_dir)):
    cat_path = os.path.join(model_dir, cat_name)
    if not os.path.isdir(cat_path):
        continue
    glbs = sorted(glob.glob(os.path.join(cat_path, "*.glb")))
    if not glbs:
        continue
    categories[cat_name] = glbs

# Position each category group
col_x = 0
COL_SPACING = 12  # space between category columns
ROW_SPACING = 3.5  # space between models in a column

for cat_idx, (cat_name, glb_files) in enumerate(categories.items()):
    # Create a collection for this category
    cat_collection = bpy.data.collections.new(cat_name.upper())
    scene.collection.children.link(cat_collection)

    for row_idx, glb_path in enumerate(glb_files):
        name = os.path.splitext(os.path.basename(glb_path))[0]
        loc = (col_x, row_idx * ROW_SPACING, 0)

        try:
            imported = import_glb(glb_path)
            for obj in imported:
                obj.location = loc
                # Move into category collection
                for c in obj.users_collection:
                    c.objects.unlink(obj)
                cat_collection.objects.link(obj)

            print(f"  ✅ {cat_name}/{name} ({len(imported)} objects)")
        except Exception as e:
            print(f"  ❌ {cat_name}/{name}: {e}")

    col_x += COL_SPACING

# ── Set viewport to front perspective ────────────────────────
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        for space in area.spaces:
            if space.type == 'VIEW_3D':
                space.shading.type = 'MATERIAL'
                space.shading.show_shadows = True
        override = bpy.context.copy()
        override['area'] = area
        override['region'] = area.regions[-1]
        with bpy.context.temp_override(**override):
            bpy.ops.view3d.view_all()
        break

# ── Save ─────────────────────────────────────────────────────
bpy.ops.wm.save_as_mainfile(filepath=OUTPUT)
print(f"\n{'='*55}")
print(f"  ✅ Saved: {OUTPUT}")
print(f"  Collections: {len(categories)}")
print(f"  Total objects: {len(bpy.data.objects)}")
print(f"{'='*55}")
