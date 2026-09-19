#!/usr/bin/env python3
import os
import numpy as np
import trimesh
import random

BASE_DIR = r"C:\NeoGenesis\assets\models"

def ensure_dirs():
    for d in ["trees", "grass", "terrain", "rocks", "vegetation", "ground"]:
        os.makedirs(os.path.join(BASE_DIR, d), exist_ok=True)

def color_mesh(mesh, rgba):
    n = len(mesh.vertices)
    mesh.visual.vertex_colors = np.tile(np.array(rgba, dtype=np.uint8), (n, 1))
    return mesh

def merge(meshes):
    meshes = [m for m in meshes if m is not None and len(m.vertices) > 0]
    if not meshes:
        return trimesh.Trimesh(vertices=np.zeros((0, 3)), faces=np.zeros((0, 3), dtype=np.uint64))
    combined = trimesh.util.concatenate(meshes)
    combined.merge_vertices(merge_tex=True, merge_norm=True)
    return combined

def export(mesh, category, name):
    path = os.path.join(BASE_DIR, category, f"{name}.glb")
    mesh.export(path)
    tri_count = len(mesh.faces)
    print(f"  {name}: {tri_count} tris -> {path}")
    return tri_count

# ---------- Primitive Helpers ----------

def cylinder(r_bot, r_top, h, seg=6):
    angles = np.linspace(0, 2 * np.pi, seg, endpoint=False)
    verts = []
    for i in range(seg):
        verts.append([r_bot * np.cos(angles[i]), r_bot * np.sin(angles[i]), 0])
    for i in range(seg):
        verts.append([r_top * np.cos(angles[i]), r_top * np.sin(angles[i]), h])
    verts.append([0, 0, h])
    verts.append([0, 0, 0])
    verts = np.array(verts, dtype=np.float64)
    tc = 2 * seg
    bc = 2 * seg + 1
    faces = []
    for i in range(seg):
        j = (i + 1) % seg
        faces.append([i + seg, j + seg, tc])
    for i in range(seg):
        j = (i + 1) % seg
        faces.append([bc, j, i])
    for i in range(seg):
        j = (i + 1) % seg
        faces.append([i, j, j + seg])
        faces.append([i, j + seg, i + seg])
    faces = np.array(faces, dtype=np.uint64)
    return trimesh.Trimesh(vertices=verts, faces=faces)

def cone(r, h, seg=6):
    angles = np.linspace(0, 2 * np.pi, seg, endpoint=False)
    verts = []
    for i in range(seg):
        verts.append([r * np.cos(angles[i]), r * np.sin(angles[i]), 0])
    verts.append([0, 0, h])
    verts = np.array(verts, dtype=np.float64)
    tip = len(verts) - 1
    faces = []
    for i in range(seg):
        j = (i + 1) % seg
        faces.append([i, j, tip])
    faces = np.array(faces, dtype=np.uint64)
    return trimesh.Trimesh(vertices=verts, faces=faces)

def low_sphere(r, rings=4, seg=6):
    verts = []
    for ring in range(1, rings):
        phi = np.pi * ring / rings
        for s in range(seg):
            theta = 2 * np.pi * s / seg
            x = r * np.sin(phi) * np.cos(theta)
            y = r * np.sin(phi) * np.sin(theta)
            z = r * np.cos(phi)
            verts.append([x, y, z])
    nv_ring = len(verts)
    verts.append([0, 0, r])
    verts.append([0, 0, -r])
    verts = np.array(verts, dtype=np.float64)
    top = nv_ring
    bot = nv_ring + 1
    faces = []
    for s in range(seg):
        s2 = (s + 1) % seg
        faces.append([s, s2, top])
    for ring in range(rings - 2):
        off = ring * seg
        for s in range(seg):
            s2 = (s + 1) % seg
            a = off + s
            b = off + s2
            c = off + seg + s
            d = off + seg + s2
            faces.append([a, b, d])
            faces.append([a, d, c])
    for s in range(seg):
        s2 = (s + 1) % seg
        a = nv_ring - seg + s
        b = nv_ring - seg + s2
        faces.append([a, b, bot])
    faces = np.array(faces, dtype=np.uint64)
    return trimesh.Trimesh(vertices=verts, faces=faces)

def icosphere(radius=1.0, subdivisions=1):
    t = (1 + np.sqrt(5)) / 2
    verts = [
        [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
        [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
        [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]
    ]
    verts = np.array(verts, dtype=np.float64)
    verts /= np.linalg.norm(verts[0])
    faces = [
        [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
        [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
        [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
        [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
    ]
    faces = np.array(faces, dtype=np.uint64)
    mesh = trimesh.Trimesh(vertices=verts, faces=faces)
    for _ in range(subdivisions):
        mesh = mesh.subdivide()
        v = mesh.vertices
        norms = np.linalg.norm(v, axis=1, keepdims=True)
        mesh.vertices = v / norms * radius
    if abs(radius - 1.0) > 1e-6 and subdivisions == 0:
        mesh.vertices *= radius
    return mesh

def box_mesh(sx, sy, sz):
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    verts = np.array([
        [-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz],
        [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]
    ], dtype=np.float64)
    faces = np.array([
        [0, 3, 1], [1, 3, 2], [4, 5, 7], [4, 7, 6],
        [0, 1, 5], [0, 5, 4], [2, 3, 7], [2, 7, 6],
        [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5]
    ], dtype=np.uint64)
    return trimesh.Trimesh(vertices=verts, faces=faces)

# ---------- Colors ----------

BROWN = [139, 90, 43, 255]
DARK_BROWN = [101, 67, 33, 255]
GREEN = [34, 120, 50, 255]
DARK_GREEN = [20, 80, 30, 255]
LIGHT_GREEN = [50, 160, 60, 255]
WHITE = [220, 220, 220, 255]
BLACK = [30, 30, 30, 255]
RED = [220, 40, 40, 255]
YELLOW = [240, 220, 40, 255]
PURPLE = [140, 40, 200, 255]
ORANGE = [240, 140, 30, 255]
PINK = [240, 120, 180, 255]
GRAY = [150, 150, 150, 255]
DARK_GRAY = [100, 100, 100, 255]
STONE = [140, 140, 140, 255]
TAN = [180, 150, 100, 255]
DARK_RED = [160, 30, 30, 255]
CREAM = [240, 230, 200, 255]
LIGHT_BROWN = [180, 130, 70, 255]
MEDIUM_GREEN = [40, 140, 55, 255]
SAGE = [100, 150, 80, 255]
DARK_STONE = [80, 80, 80, 255]

random.seed(42)

# ---------- Tree Generators ----------

def gen_oak_tree():
    meshes = []
    trunk = cylinder(0.12, 0.18, 2.0, 6)
    meshes.append(color_mesh(trunk, BROWN))
    branch_angles = [0, np.pi / 2, np.pi, 3 * np.pi / 2]
    for i, a in enumerate(branch_angles):
        b = cylinder(0.03, 0.05, 0.8, 4)
        mat = trimesh.transformations.rotation_matrix(np.pi / 3, [0, 1, 0])
        b.apply_transform(mat)
        rot = trimesh.transformations.rotation_matrix(a + 0.3 * (i % 2), [0, 0, 1])
        b.apply_transform(rot)
        b.apply_translation([0, 0, 1.6 + 0.1 * (i % 2)])
        meshes.append(color_mesh(b, BROWN))
    canopy_positions = [
        [0.2, 0, 2.8], [-0.2, 0, 2.9], [0, 0.2, 2.85], [0, -0.2, 2.95]
    ]
    for pos in canopy_positions:
        s = low_sphere(0.55, 3, 5)
        s.apply_translation(pos)
        meshes.append(color_mesh(s, GREEN))
    return merge(meshes)

def gen_oak_low():
    meshes = []
    trunk = cylinder(0.12, 0.18, 2.0, 6)
    meshes.append(color_mesh(trunk, BROWN))
    s = low_sphere(0.55, 3, 5)
    s.apply_translation([0, 0, 2.8])
    meshes.append(color_mesh(s, GREEN))
    return merge(meshes)

def gen_pine_tree():
    meshes = []
    trunk = cylinder(0.06, 0.1, 3.5, 5)
    meshes.append(color_mesh(trunk, DARK_BROWN))
    for i in range(4):
        r = 1.0 - i * 0.18
        c = cone(r, 0.9, 5)
        c.apply_translation([0, 0, 1.0 + i * 0.8])
        meshes.append(color_mesh(c, DARK_GREEN))
    return merge(meshes)

def gen_pine_low():
    meshes = []
    trunk = cylinder(0.06, 0.1, 3.5, 5)
    meshes.append(color_mesh(trunk, DARK_BROWN))
    c = cone(1.0, 2.5, 5)
    c.apply_translation([0, 0, 1.5])
    meshes.append(color_mesh(c, DARK_GREEN))
    return merge(meshes)

def gen_palm_tree():
    meshes = []
    heights = [0.4, 0.35, 0.3, 0.25, 0.2]
    radiuses = [0.15, 0.13, 0.11, 0.09, 0.07]
    z = 0
    for i in range(5):
        t = cylinder(radiuses[i] - 0.02, radiuses[i], heights[i], 6)
        t.apply_translation([0, 0, z])
        meshes.append(color_mesh(t, LIGHT_BROWN))
        z += heights[i]
    for i in range(6):
        a = i * np.pi * 2 / 6
        tri_verts = np.array([
            [0, 0, z + 0.1],
            [0.8 * np.cos(a), 0.8 * np.sin(a), z - 0.3],
            [0.4 * np.cos(a + 0.2), 0.4 * np.sin(a + 0.2), z - 0.15]
        ], dtype=np.float64)
        tri_faces = np.array([[0, 1, 2]], dtype=np.uint64)
        meshes.append(color_mesh(trimesh.Trimesh(vertices=tri_verts, faces=tri_faces), GREEN))
    for i in range(3):
        a = i * np.pi * 2 / 3
        co = low_sphere(0.05, 3, 4)
        co.apply_translation([0.12 * np.cos(a), 0.12 * np.sin(a), z + 0.05])
        meshes.append(color_mesh(co, DARK_BROWN))
    return merge(meshes)

def gen_palm_low():
    meshes = []
    trunk = cylinder(0.13, 0.15, 2.0, 6)
    meshes.append(color_mesh(trunk, LIGHT_BROWN))
    for i in range(4):
        a = i * np.pi * 2 / 4
        tri_verts = np.array([
            [0, 0, 2.1],
            [0.6 * np.cos(a), 0.6 * np.sin(a), 1.7],
            [0.3 * np.cos(a + 0.2), 0.3 * np.sin(a + 0.2), 1.85]
        ], dtype=np.float64)
        tri_faces = np.array([[0, 1, 2]], dtype=np.uint64)
        meshes.append(color_mesh(trimesh.Trimesh(vertices=tri_verts, faces=tri_faces), GREEN))
    return merge(meshes)

def gen_birch_tree():
    meshes = []
    trunk = cylinder(0.04, 0.08, 3.0, 6)
    meshes.append(color_mesh(trunk, WHITE))
    for i in range(4):
        a = i * np.pi * 2 / 4 + 0.3
        mark = cylinder(0.015, 0.02, 0.06, 4)
        mark.apply_translation([0.06 * np.cos(a), 0.06 * np.sin(a), 0.8 + i * 0.5])
        meshes.append(color_mesh(mark, BLACK))
    for i in range(5):
        a = i * np.pi * 2 / 5
        br = cylinder(0.01, 0.02, 0.5, 4)
        mat = trimesh.transformations.rotation_matrix(np.pi / 4, [0, 1, 0])
        br.apply_transform(mat)
        rot = trimesh.transformations.rotation_matrix(a, [0, 0, 1])
        br.apply_transform(rot)
        br.apply_translation([0, 0, 2.2 + 0.15 * (i % 2)])
        meshes.append(color_mesh(br, WHITE))
    for i in range(6):
        a = i * np.pi * 2 / 6
        ls = low_sphere(0.2, 3, 4)
        ls.apply_translation([0.4 * np.cos(a), 0.4 * np.sin(a), 2.8 + 0.1 * (i % 2)])
        meshes.append(color_mesh(ls, LIGHT_GREEN))
    return merge(meshes)

def gen_birch_low():
    meshes = []
    trunk = cylinder(0.04, 0.08, 3.0, 6)
    meshes.append(color_mesh(trunk, WHITE))
    s = low_sphere(0.35, 3, 5)
    s.apply_translation([0, 0, 3.0])
    meshes.append(color_mesh(s, GREEN))
    return merge(meshes)

def gen_willow_tree():
    meshes = []
    trunk = cylinder(0.15, 0.2, 2.2, 6)
    meshes.append(color_mesh(trunk, DARK_BROWN))
    for i in range(5):
        a = i * np.pi * 2 / 5
        br = cylinder(0.03, 0.05, 0.7, 4)
        mat = trimesh.transformations.rotation_matrix(np.pi / 3, [0, 1, 0])
        br.apply_transform(mat)
        rot = trimesh.transformations.rotation_matrix(a, [0, 0, 1])
        br.apply_transform(rot)
        br.apply_translation([0, 0, 2.0])
        meshes.append(color_mesh(br, DARK_BROWN))
    for i in range(12):
        a = i * np.pi * 2 / 12
        x = 0.6 * np.cos(a)
        y = 0.6 * np.sin(a)
        tip = np.array([x * 1.3, y * 1.3, 0.8])
        base1 = np.array([x * 0.5, y * 0.5, 2.2])
        base2 = np.array([x * 0.7, y * 0.7, 2.1])
        tri_verts = np.array([base1, base2, tip], dtype=np.float64)
        tri_faces = np.array([[0, 1, 2]], dtype=np.uint64)
        meshes.append(color_mesh(trimesh.Trimesh(vertices=tri_verts, faces=tri_faces), SAGE))
    return merge(meshes)

def gen_willow_low():
    meshes = []
    trunk = cylinder(0.15, 0.2, 2.2, 6)
    meshes.append(color_mesh(trunk, DARK_BROWN))
    s = low_sphere(0.6, 3, 5)
    s.apply_translation([0, 0, 2.3])
    meshes.append(color_mesh(s, SAGE))
    return merge(meshes)

def gen_dead_tree():
    meshes = []
    trunk = cylinder(0.08, 0.12, 2.5, 5)
    meshes.append(color_mesh(trunk, DARK_BROWN))
    branch_data = [
        (0.4, np.pi / 3, 0.8), (1.2, np.pi / 2.5, 0.6),
        (2.0, np.pi / 4, 0.9), (2.3, np.pi / 3.5, 0.5), (1.5, np.pi / 2.2, 0.7)
    ]
    for i, (z, angle, length) in enumerate(branch_data):
        a = i * np.pi * 2 / 5
        br = cylinder(0.015, 0.03, length, 4)
        mat = trimesh.transformations.rotation_matrix(angle, [0, 1, 0])
        br.apply_transform(mat)
        rot = trimesh.transformations.rotation_matrix(a, [0, 0, 1])
        br.apply_transform(rot)
        br.apply_translation([0, 0, z])
        meshes.append(color_mesh(br, DARK_BROWN))
    return merge(meshes)

def gen_dead_low():
    meshes = []
    trunk = cylinder(0.08, 0.12, 2.5, 5)
    meshes.append(color_mesh(trunk, DARK_BROWN))
    br = cylinder(0.02, 0.03, 0.8, 4)
    mat = trimesh.transformations.rotation_matrix(np.pi / 3, [0, 1, 0])
    br.apply_transform(mat)
    rot = trimesh.transformations.rotation_matrix(0.5, [0, 0, 1])
    br.apply_transform(rot)
    br.apply_translation([0, 0, 1.5])
    meshes.append(color_mesh(br, DARK_BROWN))
    return merge(meshes)

# ---------- Grass Generators ----------

def make_grass_blade(base_x, base_y, base_z, height, color):
    tip_x = base_x + random.uniform(-0.02, 0.02)
    tip_y = base_y + random.uniform(-0.02, 0.02)
    tip_z = base_z + height
    verts = np.array([
        [base_x - 0.008, base_y, base_z],
        [base_x + 0.008, base_y, base_z],
        [tip_x, tip_y, tip_z]
    ], dtype=np.float64)
    faces = np.array([[0, 1, 2]], dtype=np.uint64)
    return color_mesh(trimesh.Trimesh(vertices=verts, faces=faces), color)

def gen_grass_short():
    meshes = [color_mesh(box_mesh(0.3, 0.3, 0.01), [80, 60, 30, 255])]
    for _ in range(20):
        x = random.uniform(-0.14, 0.14)
        y = random.uniform(-0.14, 0.14)
        h = random.uniform(0.05, 0.12)
        meshes.append(make_grass_blade(x, y, 0.005, h, GREEN))
    return merge(meshes)

def gen_grass_medium():
    meshes = [color_mesh(box_mesh(0.3, 0.3, 0.01), [80, 60, 30, 255])]
    for _ in range(30):
        x = random.uniform(-0.14, 0.14)
        y = random.uniform(-0.14, 0.14)
        h = random.uniform(0.1, 0.2)
        meshes.append(make_grass_blade(x, y, 0.005, h, MEDIUM_GREEN))
    return merge(meshes)

def gen_grass_dense():
    meshes = [color_mesh(box_mesh(0.3, 0.3, 0.01), [80, 60, 30, 255])]
    for _ in range(50):
        x = random.uniform(-0.14, 0.14)
        y = random.uniform(-0.14, 0.14)
        h = random.uniform(0.08, 0.18)
        meshes.append(make_grass_blade(x, y, 0.005, h, DARK_GREEN))
    return merge(meshes)

def gen_tall_grass():
    meshes = [color_mesh(box_mesh(0.3, 0.3, 0.01), [80, 60, 30, 255])]
    for _ in range(40):
        x = random.uniform(-0.14, 0.14)
        y = random.uniform(-0.14, 0.14)
        h = random.uniform(0.2, 0.45)
        meshes.append(make_grass_blade(x, y, 0.005, h, LIGHT_GREEN))
    return merge(meshes)

def gen_grass_meadow():
    meshes = [color_mesh(box_mesh(1.0, 1.0, 0.01), [80, 60, 30, 255])]
    for _ in range(120):
        x = random.uniform(-0.48, 0.48)
        y = random.uniform(-0.48, 0.48)
        h = random.uniform(0.05, 0.15)
        c = random.choice([GREEN, MEDIUM_GREEN, DARK_GREEN])
        meshes.append(make_grass_blade(x, y, 0.005, h, c))
    return merge(meshes)

# ---------- Terrain Generators ----------

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
            colors.append(color_fn(z))
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
    return make_terrain_mesh(3, 3, 15, 15,
        lambda x, y: 0,
        lambda z: np.array([50, 120, 40, 255], dtype=np.uint8))

def gen_hilly_terrain():
    def hf(x, y):
        return 0.15 * np.sin(x * 2.5) * np.cos(y * 2.5) + 0.08 * np.sin(x * 5 + 1) * np.cos(y * 3)
    def cf(z):
        v = int(np.clip(60 + z * 200, 40, 140))
        return np.array([v - 10, v + 30, v - 20, 255], dtype=np.uint8)
    return make_terrain_mesh(3, 3, 15, 15, hf, cf)

def gen_rocky_terrain():
    def hf(x, y):
        return 0.1 * np.sin(x * 3) * np.cos(y * 4) + 0.05 * np.sin(x * 7 + 2) * np.cos(y * 8 + 1)
    def cf(z):
        v = int(np.clip(100 + z * 150, 70, 160))
        return np.array([v, v - 10, v - 15, 255], dtype=np.uint8)
    return make_terrain_mesh(3, 3, 15, 15, hf, cf)

def gen_sandy_terrain():
    def hf(x, y):
        return 0.03 * np.sin(x * 4) * np.cos(y * 3) + 0.01 * np.sin(x * 9)
    def cf(z):
        v = int(np.clip(180 + z * 100, 160, 220))
        return np.array([v, v - 20, v - 50, 255], dtype=np.uint8)
    return make_terrain_mesh(3, 3, 15, 15, hf, cf)

# ---------- Rock Generators ----------

def deform_rock(mesh, scale=1.0, noise=0.15):
    verts = mesh.vertices.copy()
    norms = np.linalg.norm(verts, axis=1, keepdims=True)
    norms[norms == 0] = 1
    directions = verts / norms
    noise_offsets = np.random.uniform(-noise, noise, verts.shape)
    verts += directions * noise_offsets * scale * 0.3
    mesh.vertices = verts * scale
    return mesh

def gen_rock_small():
    mesh = icosphere(0.08, 0)
    mesh = deform_rock(mesh, 0.08, 0.15)
    return color_mesh(mesh, GRAY)

def gen_rock_medium():
    mesh = icosphere(0.18, 1)
    mesh = deform_rock(mesh, 0.18, 0.2)
    mesh.vertices[:, 2] *= 0.7
    return color_mesh(mesh, DARK_GRAY)

def gen_boulder():
    mesh = icosphere(0.35, 1)
    mesh = deform_rock(mesh, 0.35, 0.25)
    mesh.vertices[:, 2] *= 0.6
    return color_mesh(mesh, GRAY)

def gen_rock_cluster():
    meshes = []
    offsets = [(0, 0, 0), (0.12, 0.05, 0), (-0.08, 0.1, 0), (0.05, -0.1, 0)]
    for ox, oy, oz in offsets:
        m = icosphere(0.08, 0)
        m = deform_rock(m, 0.08, 0.2)
        m.apply_translation([ox, oy, oz])
        meshes.append(color_mesh(m, random.choice([GRAY, DARK_GRAY, STONE])))
    return merge(meshes)

# ---------- Vegetation Generators ----------

def gen_bush():
    meshes = []
    trunk = cylinder(0.03, 0.04, 0.15, 5)
    meshes.append(color_mesh(trunk, DARK_BROWN))
    for _ in range(5):
        s = icosphere(random.uniform(0.1, 0.18), 1)
        verts = s.vertices.copy()
        verts[:, 2] *= 0.8
        s.vertices = verts
        s.apply_translation([
            random.uniform(-0.12, 0.12),
            random.uniform(-0.12, 0.12),
            0.15 + random.uniform(-0.03, 0.05)
        ])
        c = random.choice([GREEN, DARK_GREEN, MEDIUM_GREEN])
        meshes.append(color_mesh(s, c))
    return merge(meshes)

def gen_flowers():
    meshes = []
    colors = [RED, YELLOW, PURPLE, ORANGE, PINK]
    for i in range(12):
        x = random.uniform(-0.3, 0.3)
        y = random.uniform(-0.3, 0.3)
        stem = cylinder(0.005, 0.005, 0.15, 4)
        stem.apply_translation([x, y, 0.075])
        meshes.append(color_mesh(stem, [40, 120, 40, 255]))
        head = low_sphere(0.025, 3, 4)
        head.apply_translation([x, y, 0.17])
        meshes.append(color_mesh(head, colors[i % len(colors)]))
    base = box_mesh(0.6, 0.6, 0.01)
    meshes.append(color_mesh(base, [80, 60, 30, 255]))
    return merge(meshes)

def gen_tree_stump():
    meshes = []
    stump = cylinder(0.15, 0.18, 0.3, 8)
    meshes.append(color_mesh(stump, BROWN))
    top = cylinder(0.18, 0.18, 0.02, 8)
    top.apply_translation([0, 0, 0.3])
    meshes.append(color_mesh(top, [160, 120, 70, 255]))
    for i in range(3):
        a = i * np.pi * 2 / 3
        ring = cylinder(0.19, 0.19, 0.03, 6)
        ring.apply_translation([0.17 * np.cos(a), 0.17 * np.sin(a), 0.1 + i * 0.08])
        meshes.append(color_mesh(ring, DARK_BROWN))
    return merge(meshes)

def gen_log():
    meshes = []
    log_cyl = cylinder(0.08, 0.08, 1.0, 8)
    mat = trimesh.transformations.rotation_matrix(np.pi / 2, [0, 1, 0])
    log_cyl.apply_transform(mat)
    meshes.append(color_mesh(log_cyl, DARK_BROWN))
    cap1 = cylinder(0.08, 0.08, 0.01, 8)
    cap1.apply_translation([0.5, 0, 0])
    meshes.append(color_mesh(cap1, [160, 120, 70, 255]))
    cap2 = cylinder(0.08, 0.08, 0.01, 8)
    cap2.apply_translation([-0.5, 0, 0])
    meshes.append(color_mesh(cap2, [160, 120, 70, 255]))
    return merge(meshes)

def gen_mushroom():
    meshes = []
    stem = cylinder(0.015, 0.02, 0.08, 5)
    meshes.append(color_mesh(stem, CREAM))
    cap = low_sphere(0.04, 3, 5)
    verts = cap.vertices.copy()
    verts[:, 2] *= 0.5
    cap.vertices = verts
    cap.apply_translation([0, 0, 0.08])
    meshes.append(color_mesh(cap, RED))
    return merge(meshes)

def gen_fence_post():
    meshes = []
    post = cylinder(0.04, 0.04, 0.8, 6)
    meshes.append(color_mesh(post, TAN))
    cap = cone(0.045, 0.06, 6)
    cap.apply_translation([0, 0, 0.8])
    meshes.append(color_mesh(cap, TAN))
    return merge(meshes)

def gen_wooden_bridge():
    meshes = []
    for i in range(5):
        plank = box_mesh(0.5, 0.08, 0.02)
        plank.apply_translation([0, -0.2 + i * 0.1, 0])
        meshes.append(color_mesh(plank, TAN))
    mat = trimesh.transformations.rotation_matrix(np.pi / 2, [0, 1, 0])
    rail1 = cylinder(0.015, 0.015, 0.5, 5)
    rail1.apply_transform(mat)
    rail1.apply_translation([0, -0.2, 0.12])
    meshes.append(color_mesh(rail1, DARK_BROWN))
    rail2 = cylinder(0.015, 0.015, 0.5, 5)
    rail2.apply_transform(mat)
    rail2.apply_translation([0, 0.2, 0.12])
    meshes.append(color_mesh(rail2, DARK_BROWN))
    return merge(meshes)

def gen_campfire():
    meshes = []
    for i in range(6):
        a = i * np.pi * 2 / 6
        s = icosphere(0.06, 0)
        verts = s.vertices.copy()
        verts[:, 2] *= 0.5
        s.vertices = verts
        s.apply_translation([0.15 * np.cos(a), 0.15 * np.sin(a), 0.03])
        meshes.append(color_mesh(s, DARK_STONE))
    for i in range(3):
        a = i * np.pi * 2 / 3
        log = cylinder(0.02, 0.02, 0.25, 5)
        mat = trimesh.transformations.rotation_matrix(np.pi / 3, [0, 1, 0])
        log.apply_transform(mat)
        rot = trimesh.transformations.rotation_matrix(a, [0, 0, 1])
        log.apply_transform(rot)
        log.apply_translation([0, 0, 0.05])
        meshes.append(color_mesh(log, DARK_RED))
    return merge(meshes)

# ---------- Ground Generators ----------

def gen_dirt_ground():
    mesh = box_mesh(1.0, 1.0, 0.1)
    return color_mesh(mesh, [100, 70, 40, 255])

def gen_stone_path():
    meshes = []
    base = box_mesh(1.0, 0.4, 0.05)
    meshes.append(color_mesh(base, [100, 70, 40, 255]))
    for _ in range(8):
        s = icosphere(random.uniform(0.03, 0.05), 0)
        verts = s.vertices.copy()
        verts[:, 2] *= 0.3
        s.vertices = verts
        s.apply_translation([
            random.uniform(-0.4, 0.4),
            random.uniform(-0.15, 0.15),
            0.025
        ])
        c = random.choice([GRAY, DARK_GRAY, STONE])
        meshes.append(color_mesh(s, c))
    return merge(meshes)

# ---------- Main ----------

def main():
    ensure_dirs()
    total_tris = 0
    generators = {
        "trees": [
            ("oak_tree", gen_oak_tree),
            ("oak_tree_low", gen_oak_low),
            ("pine_tree", gen_pine_tree),
            ("pine_tree_low", gen_pine_low),
            ("palm_tree", gen_palm_tree),
            ("palm_tree_low", gen_palm_low),
            ("birch_tree", gen_birch_tree),
            ("birch_tree_low", gen_birch_low),
            ("willow_tree", gen_willow_tree),
            ("willow_tree_low", gen_willow_low),
            ("dead_tree", gen_dead_tree),
            ("dead_tree_low", gen_dead_low),
        ],
        "grass": [
            ("grass_short", gen_grass_short),
            ("grass_medium", gen_grass_medium),
            ("grass_dense", gen_grass_dense),
            ("tall_grass", gen_tall_grass),
            ("grass_meadow", gen_grass_meadow),
        ],
        "terrain": [
            ("flat_terrain", gen_flat_terrain),
            ("hilly_terrain", gen_hilly_terrain),
            ("rocky_terrain", gen_rocky_terrain),
            ("sandy_terrain", gen_sandy_terrain),
        ],
        "rocks": [
            ("rock_small", gen_rock_small),
            ("rock_medium", gen_rock_medium),
            ("boulder", gen_boulder),
            ("rock_cluster", gen_rock_cluster),
        ],
        "vegetation": [
            ("bush", gen_bush),
            ("flowers", gen_flowers),
            ("tree_stump", gen_tree_stump),
            ("log", gen_log),
            ("mushroom", gen_mushroom),
            ("fence_post", gen_fence_post),
            ("wooden_bridge", gen_wooden_bridge),
            ("campfire", gen_campfire),
        ],
        "ground": [
            ("dirt_ground", gen_dirt_ground),
            ("stone_path", gen_stone_path),
        ],
    }
    print("Generating NeoGenesis 3D assets...")
    print("=" * 50)
    for category, models in generators.items():
        print(f"\n[{category.upper()}]")
        for name, gen_fn in models:
            try:
                mesh = gen_fn()
                tris = export(mesh, category, name)
                total_tris += tris
            except Exception as e:
                print(f"  ERROR {name}: {e}")
    print("\n" + "=" * 50)
    print(f"TOTAL: {total_tris} triangles")
    print("Done!")

if __name__ == "__main__":
    main()
