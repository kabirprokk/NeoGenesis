#!/usr/bin/env python3
\"\"\"
NeoGenesis High-Quality 3D Asset Generator v2
Realistic procedural trees, grass, terrain, rocks, vegetation.
Target: ~40k total tris across all models.
\"\"\"
import os
import numpy as np
import trimesh
import random
import sys

BASE_DIR = r\"C:\NeoGenesis\assets\models\"

def ensure_dirs():
    for d in [\"trees\", \"grass\", \"terrain\", \"rocks\", \"vegetation\", \"ground\"]:
        os.makedirs(os.path.join(BASE_DIR, d), exist_ok=True)

# ---- Color palette (natural, muted tones) ----

BARK_OAK       = [92, 64, 38, 255]
BARK_DARK      = [62, 44, 24, 255]
BARK_PINE      = [72, 50, 28, 255]
BARK_BIRCH     = [210, 200, 185, 255]
BARK_BIRCH_MARK= [40, 35, 30, 255]
BARK_PALM      = [155, 120, 70, 255]
BARK_WILLOW    = [75, 52, 30, 255]

CANOPY_OAK     = [45, 105, 40, 255]
CANOPY_OAK_DARK= [30, 80, 28, 255]
CANOPY_OAK_LITE= [65, 130, 55, 255]
CANOPY_PINE    = [25, 72, 32, 255]
CANOPY_PINE_DARK=[18, 55, 22, 255]
CANOPY_BIRCH   = [55, 125, 48, 255]
CANOPY_BIRCH_L = [70, 145, 60, 255]
CANOPY_WILLOW  = [70, 115, 60, 255]
CANOPY_WILLOW_D= [50, 90, 42, 255]
LEAF_PALM      = [40, 110, 38, 255]
LEAF_PALM_DARK = [28, 85, 26, 255]

GRASS_GREEN    = [50, 120, 42, 255]
GRASS_DARK     = [30, 85, 28, 255]
GRASS_LIGHT    = [70, 145, 55, 255]
GRASS_BROWN    = [120, 95, 50, 255]
GRASS_STRAW    = [165, 145, 80, 255]

ROCK_LIGHT     = [160, 155, 148, 255]
ROCK_MID       = [125, 120, 115, 255]
ROCK_DARK      = [85, 80, 75, 255]
ROCK_MOSSY     = [95, 110, 80, 255]

STUMP_WOOD     = [145, 105, 60, 255]
STUMP_RING     = [175, 140, 85, 255]
LOG_WOOD       = [100, 72, 38, 255]
LOG_END        = [165, 130, 75, 255]

FLOWER_STEM    = [45, 110, 40, 255]
FLOWER_COLORS  = [[200,45,40,255],[230,210,45,255],[130,50,180,255],
                  [220,130,35,255],[220,110,160,255],[240,235,225,255],[60,80,180,255]]

MUSHROOM_CAP   = [190, 55, 40, 255]
MUSHROOM_CAP_D = [155, 40, 30, 255]
MUSHROOM_STEM  = [230, 220, 195, 255]

CAMPFIRE_STONE = [75, 72, 68, 255]
CAMPFIRE_EMBER = [180, 55, 20, 255]
CAMPFIRE_LOG   = [90, 55, 25, 255]

TAN_WOOD       = [175, 140, 90, 255]
FENCE_DARK     = [115, 85, 45, 255]

random.seed(42)
np.random.seed(42)

# ---- Primitive Helpers ----

def color_mesh(mesh, rgba):
    n = len(mesh.vertices)
    mesh.visual.vertex_colors = np.tile(np.array(rgba, dtype=np.uint8), (n, 1))
    return mesh

def color_gradient(mesh, z_min, z_max, c_bottom, c_top):
    verts = mesh.vertices
    z = verts[:, 2]
    t = np.clip((z - z_min) / max(z_max - z_min, 1e-6), 0, 1)
    c = np.array([c_bottom[:3], c_top[:3]], dtype=np.float64)
    colors = (c[0] * (1 - t[:, None]) + c[1] * t[:, None]).astype(np.uint8)
    alpha = np.full((len(verts), 1), 255, dtype=np.uint8)
    mesh.visual.vertex_colors = np.hstack([colors, alpha])
    return mesh

def merge(meshes):
    meshes = [m for m in meshes if m is not None and len(m.vertices) > 0]
    if not meshes:
        return trimesh.Trimesh(vertices=np.zeros((0,3)), faces=np.zeros((0,3),dtype=np.uint64))
    combined = trimesh.util.concatenate(meshes)
    combined.merge_vertices(merge_tex=True, merge_norm=True)
    return combined

def export(mesh, category, name):
    path = os.path.join(BASE_DIR, category, f\"{name}.glb\")
    mesh.export(path)
    tc = len(mesh.faces)
    vc = len(mesh.vertices)
    print(f\"  {name}: {vc} verts, {tc} tris -> {path}\")
    return tc

# ---- Advanced Primitives ----

def cylinder_high(r_bot, r_top, h, seg=12, cap_top=True, cap_bot=True):
    angles = np.linspace(0, 2*np.pi, seg, endpoint=False)
    verts = []
    for i in range(seg):
        verts.append([r_bot*np.cos(angles[i]), r_bot*np.sin(angles[i]), 0])
    for i in range(seg):
        verts.append([r_top*np.cos(angles[i]), r_top*np.sin(angles[i]), h])
    tc = len(verts)
    verts.append([0, 0, h])
    bc = len(verts)
    verts.append([0, 0, 0])
    verts = np.array(verts, dtype=np.float64)
    faces = []
    for i in range(seg):
        j = (i+1) % seg
        faces.append([i, j, j+seg])
        faces.append([i, j+seg, i+seg])
    if cap_top:
        for i in range(seg):
            j = (i+1) % seg
            faces.append([tc, i+seg, j+seg])
    if cap_bot:
        for i in range(seg):
            j = (i+1) % seg
            faces.append([bc, j, i])
    return trimesh.Trimesh(vertices=verts, faces=np.array(faces, dtype=np.uint64))

def tapered_cylinder(r_bot, r_top, h, seg=12, segments=1):
    meshes = []
    for s in range(segments):
        t0 = s / segments
        t1 = (s+1) / segments
        r0 = r_bot + (r_top - r_bot) * t0
        r1 = r_bot + (r_top - r_bot) * t1
        cyl = cylinder_high(r0, r1, h/segments, seg,
                           cap_top=(s==segments-1), cap_bot=(s==0))
        cyl.apply_translation([0, 0, t0*h])
        meshes.append(cyl)
    return merge(meshes) if len(meshes) > 1 else meshes[0]

def curved_branch(r_base, r_tip, length, seg=6, segments=5, bend_angle=0.4):
    meshes = []
    for s in range(segments):
        t0 = s / segments
        t1 = (s+1) / segments
        r0 = r_base * (1-t0) + r_tip * t0
        r1 = r_base * (1-t1) + r_tip * t1
        h_seg = length / segments
        cyl = cylinder_high(r0, r1, h_seg, seg,
                           cap_top=(s==segments-1), cap_bot=(s==0))
        bend = bend_angle * t0
        mat = trimesh.transformations.rotation_matrix(bend, [0,1,0])
        cyl.apply_transform(mat)
        z = s * h_seg
        x_off = bend * length * 0.3 * t0
        cyl.apply_translation([x_off, 0, z])
        meshes.append(cyl)
    return merge(meshes)

def sphere_deformed(radius, subdivisions=2, noise=0.15, flatten_z=1.0, seed_offset=0):
    rng = np.random.RandomState(42 + seed_offset)
    mesh = trimesh.creation.icosphere(subdivisions=subdivisions, radius=radius)
    v = mesh.vertices.copy()
    norms = np.linalg.norm(v, axis=1, keepdims=True)
    norms[norms==0] = 1
    directions = v / norms
    noise_off = rng.uniform(-noise, noise, v.shape)
    v += directions * noise_off * radius * 0.3
    v[:, 2] *= flatten_z
    mesh.vertices = v
    return mesh

def leaf_cluster(radius, density=8, seed=0):
    rng = np.random.RandomState(seed)
    meshes = []
    for i in range(density):
        r = radius * rng.uniform(0.4, 0.8)
        subs = 1 if r < radius * 0.5 else 2
        s = sphere_deformed(r, subdivisions=subs, noise=0.2, flatten_z=0.7,
                           seed_offset=seed+i)
        offset = rng.uniform(-radius*0.6, radius*0.6, 3)
        offset[2] = abs(offset[2])*0.5 + radius*0.2
        s.apply_translation(offset)
        meshes.append(s)
    return merge(meshes)

def rock_deformed(radius, subdivisions=2, noise=0.2, flatten=0.65, seed=0):
    rng = np.random.RandomState(seed)
    mesh = trimesh.creation.icosphere(subdivisions=subdivisions, radius=radius)
    v = mesh.vertices.copy()
    norms = np.linalg.norm(v, axis=1, keepdims=True)
    norms[norms==0] = 1
    directions = v / norms
    noise_off = rng.uniform(-noise, noise, v.shape)
    v += directions * noise_off * radius * 0.4
    v[:, 2] *= flatten
    v[:, 2] -= v[:, 2].min()
    scale = rng.uniform(0.8, 1.2, 3)
    v *= scale
    mesh.vertices = v
    return mesh

print(\"Part 1: primitives loaded OK\")
# ---- Tree Generators ----

def gen_oak_tree():
    meshes = []
    trunk = tapered_cylinder(0.14, 0.22, 2.2, seg=10, segments=4)
    trunk = color_gradient(trunk, 0, 2.2, BARK_DARK, BARK_OAK)
    meshes.append(trunk)
    branch_data = [
        (0.0, np.pi/3, 1.5, 0.04, 0.7),
        (np.pi/2+0.2, np.pi/4, 1.8, 0.035, 0.8),
        (np.pi, np.pi/3.5, 1.3, 0.03, 0.65),
        (3*np.pi/2-0.1, np.pi/3, 1.6, 0.04, 0.75),
        (np.pi/4, np.pi/2.5, 1.1, 0.025, 0.55),
    ]
    for i, (az, el, ln, rad, bend) in enumerate(branch_data):
        br = curved_branch(rad, rad*0.3, ln, seg=6, segments=5, bend_angle=bend)
        mat = trimesh.transformations.rotation_matrix(el, [0,1,0])
        br.apply_transform(mat)
        rot = trimesh.transformations.rotation_matrix(az, [0,0,1])
        br.apply_transform(rot)
        br.apply_translation([0, 0, 1.4 + 0.1*(i%2)])
        br = color_gradient(br, 1.4, 1.4+ln, BARK_DARK, BARK_OAK)
        meshes.append(br)
        for j in range(2):
            sub = curved_branch(rad*0.4, rad*0.1, ln*0.4, seg=5, segments=3, bend_angle=bend*0.7)
            sa = (j-0.5)*0.6
            sub.apply_transform(trimesh.transformations.rotation_matrix(sa, [1,0,0]))
            sub.apply_transform(trimesh.transformations.rotation_matrix(sa*0.3, [0,1,0]))
            sub.apply_translation([0, 0, ln*0.6])
            sub.apply_transform(mat)
            sub.apply_transform(rot)
            sub.apply_translation([0, 0, 1.4 + 0.1*(i%2)])
            meshes.append(color_mesh(sub, BARK_OAK))
    canopy_colors = [CANOPY_OAK, CANOPY_OAK_DARK, CANOPY_OAK_LITE]
    canopy_pos = [
        (0.15, 0.1, 3.0, 0.55), (-0.2, 0.15, 3.1, 0.5),
        (0.0, -0.15, 3.05, 0.6), (-0.1, -0.1, 3.2, 0.45),
        (0.25, -0.05, 2.9, 0.4), (-0.15, 0.2, 2.85, 0.42),
    ]
    for i, (x,y,z,r) in enumerate(canopy_pos):
        cl = leaf_cluster(r, density=6, seed=42+i)
        cl.apply_translation([x, y, z])
        meshes.append(color_mesh(cl, canopy_colors[i % len(canopy_colors)]))
    return merge(meshes)

def gen_oak_low():
    meshes = []
    trunk = tapered_cylinder(0.14, 0.22, 2.2, seg=8, segments=2)
    trunk = color_gradient(trunk, 0, 2.2, BARK_DARK, BARK_OAK)
    meshes.append(trunk)
    for az in [0.3, np.pi+0.5]:
        br = cylinder_high(0.03, 0.015, 0.7, seg=5, cap_top=True, cap_bot=False)
        br.apply_transform(trimesh.transformations.rotation_matrix(np.pi/3, [0,1,0]))
        br.apply_transform(trimesh.transformations.rotation_matrix(az, [0,0,1]))
        br.apply_translation([0, 0, 1.5])
        meshes.append(color_mesh(br, BARK_OAK))
    for pos in [(0.15,0,2.9),(-0.15,0.1,3.0),(0,-0.15,2.95)]:
        s = sphere_deformed(0.5, subdivisions=1, noise=0.12, flatten_z=0.75, seed=10)
        s.apply_translation(pos)
        meshes.append(color_mesh(s, CANOPY_OAK))
    return merge(meshes)

def gen_pine_tree():
    meshes = []
    trunk = tapered_cylinder(0.07, 0.12, 3.8, seg=8, segments=3)
    trunk = color_gradient(trunk, 0, 3.8, BARK_PINE, BARK_DARK)
    meshes.append(trunk)
    cone_colors = [CANOPY_PINE, CANOPY_PINE_DARK]*3
    for i in range(5):
        r = 1.1 - i*0.15
        h = 1.0 - i*0.05
        z = 0.8 + i*0.7
        cone = trimesh.creation.cone(radius=r, height=h, sections=8)
        v = cone.vertices
        noise = np.random.RandomState(42+i).uniform(-0.03, 0.03, v.shape)
        v += noise * r
        cone.vertices = v
        cone.apply_translation([0, 0, z])
        meshes.append(color_mesh(cone, cone_colors[i]))
    for i in range(6):
        a = i * np.pi * 2 / 6
        z = 1.0 + i*0.4
        if z > 3.2: break
        br = cylinder_high(0.01, 0.005, 0.3, seg=4, cap_top=True, cap_bot=False)
        br.apply_transform(trimesh.transformations.rotation_matrix(np.pi/3, [0,1,0]))
        br.apply_transform(trimesh.transformations.rotation_matrix(a+i*0.3, [0,0,1]))
        br.apply_translation([0, 0, z])
        meshes.append(color_mesh(br, BARK_PINE))
    return merge(meshes)

def gen_pine_low():
    meshes = []
    trunk = tapered_cylinder(0.07, 0.12, 3.8, seg=6, segments=1)
    meshes.append(color_mesh(trunk, BARK_PINE))
    cone = trimesh.creation.cone(radius=1.1, height=2.5, sections=7)
    cone.apply_translation([0, 0, 1.5])
    meshes.append(color_mesh(cone, CANOPY_PINE))
    return merge(meshes)

def gen_palm_tree():
    meshes = []
    n = 8
    seg_h = np.linspace(0.35, 0.25, n)
    seg_rtop = np.linspace(0.14, 0.06, n)
    seg_rbot = np.concatenate([[0.16], seg_rtop[:-1]])
    z = 0; cx = 0
    for i in range(n):
        cyl = cylinder_high(seg_rbot[i], seg_rtop[i], seg_h[i], seg=8,
                           cap_top=True, cap_bot=(i==0))
        cx += 0.02
        cyl.apply_translation([cx, 0, z])
        cyl = color_gradient(cyl, z, z+seg_h[i], BARK_PALM, BARK_DARK)
        meshes.append(cyl)
        z += seg_h[i]
    for i in range(n-1):
        rz = sum(seg_h[:i+1])
        ring = cylinder_high(seg_rtop[i]+0.005, seg_rtop[i]+0.005, 0.015, seg=8)
        ring.apply_translation([cx*(i+1)/n, 0, rz])
        meshes.append(color_mesh(ring, BARK_DARK))
    for i in range(8):
        a = i * np.pi * 2 / 8
        frond_verts = []
        frond_faces = []
        frond_len = 0.9
        frond_w = 0.08
        pts = 6
        for p in range(pts):
            t = p / (pts-1)
            droop = t * t * 0.35
            px = cx + frond_len * t * np.cos(a)
            py = frond_len * t * np.sin(a)
            pz = z + 0.1 - droop
            w = frond_w * (1 - t * 0.8)
            perp_a = a + np.pi/2
            dx = w * np.cos(perp_a)
            dy = w * np.sin(perp_a)
            frond_verts.append([px-dx, py-dy, pz])
            frond_verts.append([px+dx, py+dy, pz])
        for p in range(pts-1):
            bi = p * 2
            fi = len(frond_faces)
            frond_faces.extend([
                [bi, bi+1, bi+3], [bi, bi+3, bi+2]
            ])
        fv = np.array(frond_verts, dtype=np.float64)
        ff = np.array(frond_faces, dtype=np.uint64)
        frond = trimesh.Trimesh(vertices=fv, faces=ff)
        fc = LEAF_PALM if i % 2 == 0 else LEAF_PALM_DARK
        meshes.append(color_mesh(frond, fc))
    for i in range(3):
        a = i * np.pi * 2 / 3
        co = sphere_deformed(0.06, subdivisions=1, noise=0.15, seed_offset=50+i)
        co.apply_translation([cx + 0.12*np.cos(a), 0.12*np.sin(a), z+0.05])
        meshes.append(color_mesh(co, BARK_DARK))
    return merge(meshes)

def gen_palm_low():
    meshes = []
    trunk = cylinder_high(0.13, 0.08, 2.0, seg=8, cap_top=True, cap_bot=True)
    meshes.append(color_mesh(trunk, BARK_PALM))
    for i in range(5):
        a = i * np.pi * 2 / 5
        frond_verts = []
        frond_faces = []
        flen = 0.65
        fw = 0.06
        pts = 4
        for p in range(pts):
            t = p / (pts-1)
            droop = t*t*0.25
            px = flen*t*np.cos(a)
            py = flen*t*np.sin(a)
            pz = 2.1 - droop
            w = fw*(1-t*0.7)
            perp = a + np.pi/2
            dx = w*np.cos(perp)
            dy = w*np.sin(perp)
            frond_verts.append([px-dx, py-dy, pz])
            frond_verts.append([px+dx, py+dy, pz])
        for p in range(pts-1):
            bi = p*2
            frond_faces.extend([[bi,bi+1,bi+3],[bi,bi+3,bi+2]])
        fv = np.array(frond_verts, dtype=np.float64)
        ff = np.array(frond_faces, dtype=np.uint64)
        frond = trimesh.Trimesh(vertices=fv, faces=ff)
        meshes.append(color_mesh(frond, LEAF_PALM))
    return merge(meshes)

def gen_birch_tree():
    meshes = []
    trunk = tapered_cylinder(0.05, 0.09, 3.2, seg=8, segments=3)
    trunk = color_gradient(trunk, 0, 3.2, BARK_BIRCH, [220,215,205,255])
    meshes.append(trunk)
    for i in range(8):
        a = i * np.pi * 2 / 8 + 0.3
        h = 0.06 + (i%3)*0.02
        mark = cylinder_high(0.018, 0.022, h, seg=4, cap_top=True, cap_bot=True)
        mark.apply_translation([0.065*np.cos(a), 0.065*np.sin(a), 0.6+i*0.32])
        meshes.append(color_mesh(mark, BARK_BIRCH_MARK))
    for i in range(5):
        a = i * np.pi * 2 / 5 + 0.15
        br = curved_branch(0.015, 0.005, 0.6, seg=5, segments=3, bend_angle=0.3)
        br.apply_transform(trimesh.transformations.rotation_matrix(np.pi/4, [0,1,0]))
        br.apply_transform(trimesh.transformations.rotation_matrix(a, [0,0,1]))
        br.apply_translation([0, 0, 2.4 + 0.1*(i%2)])
        meshes.append(color_mesh(br, BARK_BIRCH))
    canopy_colors = [CANOPY_BIRCH, CANOPY_BIRCH_L, CANOPY_BIRCH]
    for i, (x,y,z,r) in enumerate([
        (0.3,0.1,3.1,0.3), (-0.25,0.15,3.2,0.28),
        (0.1,-0.2,3.15,0.32), (-0.15,-0.1,3.3,0.25),
        (0.2,0.2,3.05,0.27),
    ]):
        cl = leaf_cluster(r, density=5, seed=42+i)
        cl.apply_translation([x, y, z])
        meshes.append(color_mesh(cl, canopy_colors[i%3]))
    return merge(meshes)

def gen_birch_low():
    meshes = []
    trunk = tapered_cylinder(0.05, 0.09, 3.2, seg=6, segments=1)
    meshes.append(color_mesh(trunk, BARK_BIRCH))
    for pos in [(0.2,0,3.1),(-0.15,0.15,3.2),(0.1,-0.1,3.15)]:
        s = sphere_deformed(0.3, subdivisions=1, noise=0.12, flatten_z=0.75, seed=10)
        s.apply_translation(pos)
        meshes.append(color_mesh(s, CANOPY_BIRCH))
    return merge(meshes)

def gen_willow_tree():
    meshes = []
    trunk = tapered_cylinder(0.16, 0.24, 2.3, seg=8, segments=3)
    trunk = color_gradient(trunk, 0, 2.3, BARK_WILLOW, BARK_DARK)
    meshes.append(trunk)
    for i in range(5):
        a = i * np.pi * 2 / 5
        br = curved_branch(0.04, 0.015, 0.8, seg=5, segments=4, bend_angle=0.5)
        br.apply_transform(trimesh.transformations.rotation_matrix(np.pi/3, [0,1,0]))
        br.apply_transform(trimesh.transformations.rotation_matrix(a, [0,0,1]))
        br.apply_translation([0, 0, 2.1])
        meshes.append(color_mesh(br, BARK_WILLOW))
    for i in range(16):
        a = i * np.pi * 2 / 16
        length = 0.7 + 0.3 * np.sin(i * 1.5)
        x = 0.5 * np.cos(a)
        y = 0.5 * np.sin(a)
        strand_verts = []
        strand_faces = []
        pts = 8
        for p in range(pts):
            t = p / (pts-1)
            droop = t * t * length
            sx = x * (0.5 + t*0.8)
            sy = y * (0.5 + t*0.8)
            sz = 2.3 - droop
            w = 0.012 * (1 - t*0.3)
            perp = a + np.pi/2
            dx = w * np.cos(perp)
            dy = w * np.sin(perp)
            strand_verts.append([sx-dx, sy-dy, sz])
            strand_verts.append([sx+dx, sy+dy, sz])
        for p in range(pts-1):
            bi = p*2
            strand_faces.extend([[bi,bi+1,bi+3],[bi,bi+3,bi+2]])
        sv = np.array(strand_verts, dtype=np.float64)
        sf = np.array(strand_faces, dtype=np.uint64)
        strand = trimesh.Trimesh(vertices=sv, faces=sf)
        wc = CANOPY_WILLOW if i%2==0 else CANOPY_WILLOW_D
        meshes.append(color_mesh(strand, wc))
    return merge(meshes)

def gen_willow_low():
    meshes = []
    trunk = tapered_cylinder(0.16, 0.24, 2.3, seg=6, segments=2)
    trunk = color_gradient(trunk, 0, 2.3, BARK_WILLOW, BARK_DARK)
    meshes.append(trunk)
    s = sphere_deformed(0.6, subdivisions=1, noise=0.15, flatten_z=0.65, seed=10)
    s.apply_translation([0, 0, 2.3])
    meshes.append(color_mesh(s, CANOPY_WILLOW))
    return merge(meshes)

def gen_dead_tree():
    meshes = []
    trunk = tapered_cylinder(0.09, 0.14, 2.8, seg=7, segments=3)
    trunk = color_gradient(trunk, 0, 2.8, BARK_DARK, [85,55,28,255])
    meshes.append(trunk)
    branch_data = [
        (0.4, np.pi/3, 0.85), (1.2, np.pi/2.5, 0.65),
        (2.0, np.pi/4, 0.95), (2.3, np.pi/3.5, 0.55),
        (1.5, np.pi/2.2, 0.72),
    ]
    for i, (z, angle, length) in enumerate(branch_data):
        a = i * np.pi * 2 / 5
        br = curved_branch(0.025, 0.008, length, seg=4, segments=3, bend_angle=0.3)
        br.apply_transform(trimesh.transformations.rotation_matrix(angle, [0,1,0]))
        br.apply_transform(trimesh.transformations.rotation_matrix(a, [0,0,1]))
        br.apply_translation([0, 0, z])
        meshes.append(color_mesh(br, BARK_DARK))
    return merge(meshes)

def gen_dead_low():
    meshes = []
    trunk = tapered_cylinder(0.09, 0.14, 2.8, seg=5, segments=1)
    meshes.append(color_mesh(trunk, BARK_DARK))
    br = cylinder_high(0.02, 0.008, 0.85, seg=4, cap_top=True, cap_bot=False)
    br.apply_transform(trimesh.transformations.rotation_matrix(np.pi/3, [0,1,0]))
    br.apply_transform(trimesh.transformations.rotation_matrix(0.5, [0,0,1]))
    br.apply_translation([0, 0, 1.5])
    meshes.append(color_mesh(br, BARK_DARK))
    return merge(meshes)

print(\"Part 2: trees loaded OK\")
# ---- Grass Generators ----

def make_grass_patch(num_blades, area_size, min_h, max_h, colors, wind_seed=0):
    \"\"\"Generate a grass patch with curved blades for wind animation.\"\"\"
    meshes = []
    rng = np.random.RandomState(wind_seed)
    # Ground plane
    base = cylinder_high(area_size/2, area_size/2, 0.008, seg=8, cap_top=True, cap_bot=True)
    base.apply_translation([0, 0, 0.004])
    meshes.append(color_mesh(base, [75, 55, 30, 255]))
    
    for _ in range(num_blades):
        bx = rng.uniform(-area_size*0.45, area_size*0.45)
        by = rng.uniform(-area_size*0.45, area_size*0.45)
        h = rng.uniform(min_h, max_h)
        lean = rng.uniform(-0.06, 0.06)
        c = colors[rng.randint(0, len(colors))]
        
        # Build curved blade
        segments = 4
        verts = []
        faces = []
        spine = []
        for s in range(segments+1):
            t = s / segments
            z = 0.008 + t * h
            x = bx + lean * t * t
            y = by + rng.uniform(-0.003, 0.003) * t
            spine.append([x, y, z])
        spine = np.array(spine)
        
        for s in range(segments):
            t = s / segments
            w = 0.009 * (1 - t*0.7)
            p = spine[s]
            pn = spine[s+1]
            d = pn[:2] - p[:2]
            perp = np.array([-d[1], d[0]])
            pn2 = np.linalg.norm(perp)
            if pn2 > 1e-6: perp /= pn2
            else: perp = np.array([1.0, 0.0])
            
            bi = len(verts)
            verts.extend([
                [p[0]-perp[0]*w, p[1]-perp[1]*w, p[2]],
                [p[0]+perp[0]*w, p[1]+perp[1]*w, p[2]],
                [pn[0]+perp[0]*w*0.3, pn[1]+perp[1]*w*0.3, pn[2]],
                [pn[0]-perp[0]*w*0.3, pn[1]-perp[1]*w*0.3, pn[2]],
            ])
            faces.extend([[bi,bi+1,bi+2],[bi,bi+2,bi+3]])
        
        # tip
        ti = len(verts)
        verts.append(spine[-1].tolist())
        lq = len(verts) - 5
        faces.extend([[lq+1,lq+2,ti],[lq,ti,lq+3]])
        
        fv = np.array(verts, dtype=np.float64)
        ff = np.array(faces, dtype=np.uint64)
        blade = trimesh.Trimesh(vertices=fv, faces=ff)
        meshes.append(color_mesh(blade, c))
    
    return merge(meshes)

def gen_grass_short():
    return make_grass_patch(30, 0.35, 0.04, 0.1, [GRASS_GREEN, GRASS_DARK], wind_seed=1)

def gen_grass_medium():
    return make_grass_patch(45, 0.35, 0.08, 0.18, [GRASS_GREEN, GRASS_LIGHT, GRASS_DARK], wind_seed=2)

def gen_grass_dense():
    return make_grass_patch(70, 0.35, 0.06, 0.16, [GRASS_DARK, GRASS_GREEN, GRASS_DARK], wind_seed=3)

def gen_tall_grass():
    return make_grass_patch(55, 0.35, 0.18, 0.4, [GRASS_LIGHT, GRASS_GREEN, GRASS_STRAW], wind_seed=4)

def gen_grass_meadow():
    return make_grass_patch(150, 1.0, 0.04, 0.15,
        [GRASS_GREEN, GRASS_DARK, GRASS_LIGHT, GRASS_STRAW], wind_seed=5)

# ---- Terrain Generators ----

def make_terrain_mesh(size_x, size_y, seg_x, seg_y, height_fn, color_fn):
    sx = size_x / seg_x
    sy = size_y / seg_y
    ox = -size_x / 2
    oy = -size_y / 2
    verts = []
    colors = []
    for iy in range(seg_y + 1):
        for ix in range(seg_x + 1):
            x = ox + ix * sx
            y = oy + iy * sy
            z = height_fn(x, y)
            verts.append([x, y, z])
            colors.append(color_fn(x, y, z))
    verts = np.array(verts, dtype=np.float64)
    colors = np.array(colors, dtype=np.uint8)
    faces = []
    for iy in range(seg_y):
        for ix in range(seg_x):
            a = iy * (seg_x + 1) + ix
            b = a + 1
            c = a + seg_x + 1
            d = c + 1
            faces.append([a, b, d])
            faces.append([a, d, c])
    faces = np.array(faces, dtype=np.uint64)
    mesh = trimesh.Trimesh(vertices=verts, faces=faces)
    mesh.visual.vertex_colors = colors
    return mesh

def gen_flat_terrain():
    return make_terrain_mesh(3, 3, 20, 20,
        lambda x,y: 0,
        lambda x,y,z: np.array([48, 108, 38, 255], dtype=np.uint8))

def gen_hilly_terrain():
    def hf(x, y):
        return (0.18 * np.sin(x*2.5)*np.cos(y*2.5) +
                0.09 * np.sin(x*5+1)*np.cos(y*3) +
                0.04 * np.sin(x*8+2)*np.cos(y*7))
    def cf(x, y, z):
        v = int(np.clip(55 + z*220, 38, 145))
        return np.array([v-12, v+32, v-22, 255], dtype=np.uint8)
    return make_terrain_mesh(3, 3, 24, 24, hf, cf)

def gen_rocky_terrain():
    def hf(x, y):
        return (0.12 * np.sin(x*3)*np.cos(y*4) +
                0.06 * np.sin(x*7+2)*np.cos(y*8+1) +
                0.03 * np.sin(x*12)*np.cos(y*11))
    def cf(x, y, z):
        v = int(np.clip(105 + z*160, 68, 165))
        moss = max(0, 1 - abs(z)*3)
        return np.array([v - 8, v + int(moss*15), v - 12, 255], dtype=np.uint8)
    return make_terrain_mesh(3, 3, 24, 24, hf, cf)

def gen_sandy_terrain():
    def hf(x, y):
        return 0.04*np.sin(x*4)*np.cos(y*3) + 0.015*np.sin(x*9+1)
    def cf(x, y, z):
        v = int(np.clip(185 + z*120, 165, 225))
        return np.array([v, v-22, v-52, 255], dtype=np.uint8)
    return make_terrain_mesh(3, 3, 22, 22, hf, cf)

# ---- Rock Generators ----

def gen_rock_small():
    mesh = rock_deformed(0.1, subdivisions=2, noise=0.2, flatten=0.6, seed=100)
    return color_mesh(mesh, ROCK_LIGHT)

def gen_rock_medium():
    mesh = rock_deformed(0.2, subdivisions=2, noise=0.25, flatten=0.55, seed=200)
    return color_mesh(mesh, ROCK_MID)

def gen_boulder():
    mesh = rock_deformed(0.38, subdivisions=2, noise=0.22, flatten=0.5, seed=300)
    return color_mesh(mesh, ROCK_DARK)

def gen_rock_cluster():
    meshes = []
    offsets = [(0,0,0), (0.14,0.06,0), (-0.09,0.12,0), (0.06,-0.11,0), (-0.13,-0.07,0)]
    colors = [ROCK_LIGHT, ROCK_MID, ROCK_DARK, ROCK_MOSSY, ROCK_LIGHT]
    for i, ((ox,oy,oz), c) in enumerate(zip(offsets, colors)):
        r = 0.06 + 0.04 * (i % 3)
        m = rock_deformed(r, subdivisions=2, noise=0.25, flatten=0.55, seed=400+i)
        m.apply_translation([ox, oy, oz])
        meshes.append(color_mesh(m, c))
    return merge(meshes)

# ---- Vegetation Generators ----

def gen_bush():
    meshes = []
    trunk = cylinder_high(0.035, 0.045, 0.18, seg=6, cap_top=True, cap_bot=True)
    meshes.append(color_mesh(trunk, BARK_DARK))
    rng = np.random.RandomState(42)
    bush_colors = [CANOPY_OAK, CANOPY_OAK_DARK, CANOPY_BIRCH, CANOPY_WILLOW_D]
    for i in range(7):
        r = 0.1 + rng.uniform(0, 0.08)
        s = sphere_deformed(r, subdivisions=1, noise=0.18, flatten_z=0.75,
                           seed_offset=42+i)
        s.apply_translation([
            rng.uniform(-0.14, 0.14),
            rng.uniform(-0.14, 0.14),
            0.18 + rng.uniform(-0.04, 0.06)
        ])
        meshes.append(color_mesh(s, bush_colors[i % len(bush_colors)]))
    return merge(meshes)

def gen_flowers():
    meshes = []
    rng = np.random.RandomState(42)
    base = cylinder_high(0.3, 0.3, 0.008, seg=8, cap_top=True, cap_bot=True)
    base.apply_translation([0, 0, 0.004])
    meshes.append(color_mesh(base, [75, 55, 30, 255]))
    
    for i in range(18):
        x = rng.uniform(-0.28, 0.28)
        y = rng.uniform(-0.28, 0.28)
        h = rng.uniform(0.12, 0.22)
        # Stem (slightly curved)
        stem = cylinder_high(0.004, 0.003, h, seg=4, cap_top=True, cap_bot=False)
        lean = rng.uniform(-0.01, 0.01)
        stem.apply_translation([x+lean, y+lean*0.5, 0.008])
        meshes.append(color_mesh(stem, FLOWER_STEM))
        # Flower head (5 petals)
        fc = FLOWER_COLORS[i % len(FLOWER_COLORS)]
        for p in range(5):
            pa = p * np.pi * 2 / 5 + rng.uniform(-0.1, 0.1)
            pr = 0.018 + rng.uniform(0, 0.005)
            petal = sphere_deformed(pr, subdivisions=1, noise=0.1, flatten_z=0.4,
                                   seed_offset=42+i*10+p)
            petal.apply_translation([
                x + 0.025*np.cos(pa) + lean,
                y + 0.025*np.sin(pa) + lean*0.5,
                0.008 + h + 0.008
            ])
            meshes.append(color_mesh(petal, fc))
        # Center
        center = sphere_deformed(0.01, subdivisions=1, noise=0.05, seed_offset=42+i*10+5)
        center.apply_translation([x+lean, y+lean*0.5, 0.008+h+0.01])
        meshes.append(color_mesh(center, [235, 210, 50, 255]))
    return merge(meshes)

def gen_tree_stump():
    meshes = []
    stump = tapered_cylinder(0.14, 0.19, 0.35, seg=10, segments=2)
    stump = color_gradient(stump, 0, 0.35, STUMP_WOOD, BARK_DARK)
    meshes.append(stump)
    # Top ring (cross-section)
    top = cylinder_high(0.19, 0.19, 0.015, seg=10, cap_top=True, cap_bot=False)
    top.apply_translation([0, 0, 0.35])
    meshes.append(color_mesh(top, STUMP_RING))
    # Bark texture bands
    for i in range(3):
        a = i * np.pi * 2 / 3
        band = cylinder_high(0.20, 0.20, 0.04, seg=6, cap_top=False, cap_bot=False)
        band.apply_translation([0.17*np.cos(a), 0.17*np.sin(a), 0.08+i*0.09])
        meshes.append(color_mesh(band, BARK_DARK))
    # Root flares
    for i in range(4):
        a = i * np.pi * 2 / 4 + 0.2
        root = cylinder_high(0.04, 0.015, 0.12, seg=5, cap_top=False, cap_bot=True)
        root.apply_transform(trimesh.transformations.rotation_matrix(np.pi/4, [0,1,0]))
        root.apply_transform(trimesh.transformations.rotation_matrix(a, [0,0,1]))
        root.apply_translation([0.16*np.cos(a), 0.16*np.sin(a), 0])
        meshes.append(color_mesh(root, BARK_DARK))
    return merge(meshes)

def gen_log():
    meshes = []
    log_cyl = cylinder_high(0.09, 0.08, 1.1, seg=10, cap_top=True, cap_bot=True)
    log_cyl.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [0,1,0]))
    log_cyl = color_gradient(log_cyl, -0.55, 0.55, LOG_WOOD, BARK_DARK)
    meshes.append(log_cyl)
    # End caps with ring detail
    for sign in [1, -1]:
        cap = cylinder_high(0.09, 0.09, 0.015, seg=10, cap_top=True, cap_bot=False)
        cap.apply_translation([sign*0.55, 0, 0])
        meshes.append(color_mesh(cap, LOG_END))
    # Bark ridges
    for i in range(6):
        a = i * np.pi * 2 / 6
        ridge = cylinder_high(0.008, 0.008, 0.9, seg=3, cap_top=False, cap_bot=False)
        ridge.apply_translation([0, 0.09*np.cos(a), 0.09*np.sin(a)])
        ridge.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [0,1,0]))
        meshes.append(color_mesh(ridge, BARK_DARK))
    return merge(meshes)

def gen_mushroom():
    meshes = []
    # Stem
    stem = tapered_cylinder(0.012, 0.022, 0.1, seg=6, segments=2)
    meshes.append(color_mesh(stem, MUSHROOM_STEM))
    # Cap
    cap = sphere_deformed(0.045, subdivisions=2, noise=0.1, flatten_z=0.45, seed_offset=60)
    cap.apply_translation([0, 0, 0.1])
    meshes.append(color_mesh(cap, MUSHROOM_CAP))
    # Spots on cap
    rng = np.random.RandomState(60)
    for i in range(5):
        a = rng.uniform(0, np.pi*2)
        r = rng.uniform(0.015, 0.03)
        spot = sphere_deformed(0.008, subdivisions=1, noise=0.05, seed_offset=60+i)
        spot.apply_translation([r*np.cos(a), r*np.sin(a), 0.12])
        meshes.append(color_mesh(spot, [240, 235, 220, 255]))
    return merge(meshes)

def gen_fence_post():
    meshes = []
    post = tapered_cylinder(0.035, 0.045, 0.85, seg=6, segments=1)
    post = color_gradient(post, 0, 0.85, FENCE_DARK, TAN_WOOD)
    meshes.append(post)
    cap = trimesh.creation.cone(radius=0.05, height=0.06, sections=6)
    cap.apply_translation([0, 0, 0.85])
    meshes.append(color_mesh(cap, TAN_WOOD))
    return merge(meshes)

def gen_wooden_bridge():
    meshes = []
    for i in range(7):
        plank = cylinder_high(0.01, 0.01, 0.55, seg=4, cap_top=True, cap_bot=True)
        plank.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [0,1,0]))
        plank.apply_translation([0, -0.25+i*0.085, 0])
        meshes.append(color_mesh(plank, TAN_WOOD))
    for sign in [-1, 1]:
        rail = cylinder_high(0.018, 0.018, 0.55, seg=5, cap_top=True, cap_bot=True)
        rail.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [0,1,0]))
        rail.apply_translation([0, sign*0.25, 0.12])
        meshes.append(color_mesh(rail, FENCE_DARK))
    for sign in [-1, 1]:
        for j in range(3):
            post = cylinder_high(0.01, 0.01, 0.15, seg=4, cap_top=True, cap_bot=False)
            post.apply_translation([sign*0.22, -0.15+j*0.15, 0.05])
            meshes.append(color_mesh(post, FENCE_DARK))
    return merge(meshes)

def gen_campfire():
    meshes = []
    rng = np.random.RandomState(42)
    # Stone ring
    for i in range(8):
        a = i * np.pi * 2 / 8
        stone = rock_deformed(0.055, subdivisions=1, noise=0.2, flatten=0.5, seed=42+i)
        stone.apply_translation([0.18*np.cos(a), 0.18*np.sin(a), 0.025])
        meshes.append(color_mesh(stone, CAMPFIRE_STONE))
    # Logs
    for i in range(4):
        a = i * np.pi * 2 / 4 + 0.3
        log = cylinder_high(0.025, 0.02, 0.3, seg=5, cap_top=True, cap_bot=True)
        log.apply_transform(trimesh.transformations.rotation_matrix(np.pi/3, [0,1,0]))
        log.apply_transform(trimesh.transformations.rotation_matrix(a, [0,0,1]))
        log.apply_translation([0, 0, 0.06])
        meshes.append(color_mesh(log, CAMPFIRE_LOG))
    # Ember/ash pile
    for i in range(6):
        a = rng.uniform(0, np.pi*2)
        r = rng.uniform(0, 0.1)
        ember = sphere_deformed(0.025, subdivisions=0, noise=0.3, flatten_z=0.3, seed=42+i+10)
        ember.apply_translation([r*np.cos(a), r*np.sin(a), 0.03])
        c = CAMPFIRE_EMBER if i < 3 else [150,145,140,255]
        meshes.append(color_mesh(ember, c))
    return merge(meshes)

# ---- Ground Generators ----

def gen_dirt_ground():
    meshes = []
    base = cylinder_high(0.5, 0.5, 0.08, seg=12, cap_top=True, cap_bot=True)
    base = color_gradient(base, 0, 0.08, [80,55,30,255], [105,75,42,255])
    meshes.append(base)
    rng = np.random.RandomState(42)
    for i in range(6):
        a = rng.uniform(0, np.pi*2)
        r = rng.uniform(0, 0.35)
        pebble = rock_deformed(0.02, subdivisions=1, noise=0.2, flatten=0.4, seed=50+i)
        pebble.apply_translation([r*np.cos(a), r*np.sin(a), 0.08])
        meshes.append(color_mesh(pebble, ROCK_MID))
    return merge(meshes)

def gen_stone_path():
    meshes = []
    base = cylinder_high(0.5, 0.5, 0.04, seg=10, cap_top=True, cap_bot=True)
    base = color_gradient(base, 0, 0.04, [80,55,30,255], [95,68,38,255])
    meshes.append(base)
    rng = np.random.RandomState(42)
    stone_colors = [ROCK_LIGHT, ROCK_MID, ROCK_DARK, ROCK_MOSSY]
    for i in range(12):
        a = rng.uniform(0, np.pi*2)
        r = rng.uniform(0, 0.35)
        s = rng.uniform(0.03, 0.06)
        stone = rock_deformed(s, subdivisions=1, noise=0.15, flatten=0.35, seed=60+i)
        stone.apply_translation([r*np.cos(a), r*np.sin(a), 0.04])
        meshes.append(color_mesh(stone, stone_colors[i%4]))
    return merge(meshes)

# ---- Main ----

def main():
    ensure_dirs()
    total_tris = 0
    generators = {
        \"trees\": [
            (\"oak_tree\", gen_oak_tree),
            (\"oak_tree_low\", gen_oak_low),
            (\"pine_tree\", gen_pine_tree),
            (\"pine_tree_low\", gen_pine_low),
            (\"palm_tree\", gen_palm_tree),
            (\"palm_tree_low\", gen_palm_low),
            (\"birch_tree\", gen_birch_tree),
            (\"birch_tree_low\", gen_birch_low),
            (\"willow_tree\", gen_willow_tree),
            (\"willow_tree_low\", gen_willow_low),
            (\"dead_tree\", gen_dead_tree),
            (\"dead_tree_low\", gen_dead_low),
        ],
        \"grass\": [
            (\"grass_short\", gen_grass_short),
            (\"grass_medium\", gen_grass_medium),
            (\"grass_dense\", gen_grass_dense),
            (\"tall_grass\", gen_tall_grass),
            (\"grass_meadow\", gen_grass_meadow),
        ],
        \"terrain\": [
            (\"flat_terrain\", gen_flat_terrain),
            (\"hilly_terrain\", gen_hilly_terrain),
            (\"rocky_terrain\", gen_rocky_terrain),
            (\"sandy_terrain\", gen_sandy_terrain),
        ],
        \"rocks\": [
            (\"rock_small\", gen_rock_small),
            (\"rock_medium\", gen_rock_medium),
            (\"boulder\", gen_boulder),
            (\"rock_cluster\", gen_rock_cluster),
        ],
        \"vegetation\": [
            (\"bush\", gen_bush),
            (\"flowers\", gen_flowers),
            (\"tree_stump\", gen_tree_stump),
            (\"log\", gen_log),
            (\"mushroom\", gen_mushroom),
            (\"fence_post\", gen_fence_post),
            (\"wooden_bridge\", gen_wooden_bridge),
            (\"campfire\", gen_campfire),
        ],
        \"ground\": [
            (\"dirt_ground\", gen_dirt_ground),
            (\"stone_path\", gen_stone_path),
        ],
    }
    print(\"Generating NeoGenesis 3D assets (v2 - high quality)...\")
    print(\"=\" * 55)
    for category, models in generators.items():
        print(f\"\n[{category.upper()}]\")
        for name, gen_fn in models:
            try:
                mesh = gen_fn()
                tris = export(mesh, category, name)
                total_tris += tris
            except Exception as e:
                print(f\"  ERROR {name}: {e}\")
                import traceback; traceback.print_exc()
    print(\"\\n\" + \"=\" * 55)
    print(f\"TOTAL: {total_tris} triangles\")
    print(\"Done!\")

if __name__ == \"__main__\":
    main()
