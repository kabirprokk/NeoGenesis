#!/usr/bin/env python3
import os
import numpy as np
import trimesh

BASE_DIR = r'C:\NeoGenesis\assets\models'

def ensure_dirs():
    for d in ['characters', 'vehicles', 'buildings', 'weapons', 'furniture']:
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
    path = os.path.join(BASE_DIR, category, f'{name}.glb')
    mesh.export(path)
    tri_count = len(mesh.faces)
    print(f'  {name}: {tri_count} tris -> {path}')
    return tri_count

def cylinder(r_bot, r_top, h, seg=24):
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

def cone(r, h, seg=16):
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

def sphere(r, rings=8, seg=16):
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

def icosphere(radius=1.0, subdivisions=2):
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

def torus(R, r, seg_main=16, seg_tube=12):
    verts = []
    faces = []
    for i in range(seg_main):
        theta = 2 * np.pi * i / seg_main
        for j in range(seg_tube):
            phi = 2 * np.pi * j / seg_tube
            x = (R + r * np.cos(phi)) * np.cos(theta)
            y = (R + r * np.cos(phi)) * np.sin(theta)
            z = r * np.sin(phi)
            verts.append([x, y, z])
    for i in range(seg_main):
        i2 = (i + 1) % seg_main
        for j in range(seg_tube):
            j2 = (j + 1) % seg_tube
            a = i * seg_tube + j
            b = i * seg_tube + j2
            c = i2 * seg_tube + j2
            d = i2 * seg_tube + j
            faces.append([a, b, c])
            faces.append([a, c, d])
    verts = np.array(verts, dtype=np.float64)
    faces = np.array(faces, dtype=np.uint64)
    return trimesh.Trimesh(vertices=verts, faces=faces)

SKIN = [220, 185, 155, 255]
HAIR_BROWN = [101, 67, 33, 255]
DARK_BROWN = [80, 50, 25, 255]
BROWN = [139, 90, 43, 255]
LIGHT_BROWN = [180, 130, 70, 255]
METAL = [180, 180, 190, 255]
DARK_METAL = [100, 100, 110, 255]
LIGHT_METAL = [210, 210, 220, 255]
RED = [200, 40, 40, 255]
DARK_RED = [140, 20, 20, 255]
BLUE = [50, 80, 180, 255]
DARK_BLUE = [30, 50, 120, 255]
GREEN = [40, 140, 60, 255]
DARK_GREEN = [20, 80, 30, 255]
YELLOW = [220, 200, 40, 255]
GOLD = [220, 190, 50, 255]
ORANGE = [220, 140, 30, 255]
WHITE = [230, 230, 230, 255]
CREAM = [240, 230, 200, 255]
BLACK = [30, 30, 30, 255]
GRAY = [140, 140, 140, 255]
DARK_GRAY = [80, 80, 80, 255]
STONE = [130, 130, 135, 255]
DARK_STONE = [70, 70, 75, 255]
WOOD = [160, 110, 55, 255]
DARK_WOOD = [110, 70, 30, 255]
LIGHT_WOOD = [195, 155, 100, 255]
PURPLE = [120, 40, 180, 255]

SKIN = [220, 185, 155, 255]
HAIR_BROWN = [101, 67, 33, 255]
DARK_BROWN = [80, 50, 25, 255]
BROWN = [139, 90, 43, 255]
LIGHT_BROWN = [180, 130, 70, 255]
METAL = [180, 180, 190, 255]
DARK_METAL = [100, 100, 110, 255]
LIGHT_METAL = [210, 210, 220, 255]
RED = [200, 40, 40, 255]
DARK_RED = [140, 20, 20, 255]
BLUE = [50, 80, 180, 255]
DARK_BLUE = [30, 50, 120, 255]
GREEN = [40, 140, 60, 255]
DARK_GREEN = [20, 80, 30, 255]
YELLOW = [220, 200, 40, 255]
GOLD = [220, 190, 50, 255]
ORANGE = [220, 140, 30, 255]
WHITE = [230, 230, 230, 255]
CREAM = [240, 230, 200, 255]
BLACK = [30, 30, 30, 255]
GRAY = [140, 140, 140, 255]
DARK_GRAY = [80, 80, 80, 255]
STONE = [130, 130, 135, 255]
DARK_STONE = [70, 70, 75, 255]
WOOD = [160, 110, 55, 255]
DARK_WOOD = [110, 70, 30, 255]
LIGHT_WOOD = [195, 155, 100, 255]
PURPLE = [120, 40, 180, 255]

def gen_humanoid():
    meshes = []
    # Torso (main body)
    torso = box_mesh(0.5, 0.3, 0.7)
    torso.apply_translation([0, 0, 1.15])
    meshes.append(color_mesh(torso, BLUE))
    # Chest plate detail
    chest = box_mesh(0.45, 0.08, 0.35)
    chest.apply_translation([0, -0.16, 1.35])
    meshes.append(color_mesh(chest, DARK_BLUE))
    # Collar
    collar = cylinder(0.12, 0.15, 0.08, 12)
    collar.apply_translation([0, 0, 1.52])
    meshes.append(color_mesh(collar, DARK_BLUE))
    # Neck
    neck = cylinder(0.06, 0.06, 0.1, 12)
    neck.apply_translation([0, 0, 1.55])
    meshes.append(color_mesh(neck, SKIN))
    # Head
    head = sphere(0.18, 10, 16)
    head.apply_translation([0, 0, 1.75])
    meshes.append(color_mesh(head, SKIN))
    # Hair (top)
    hair_top = sphere(0.19, 8, 14)
    verts = hair_top.vertices.copy()
    verts[:, 2] = np.where(verts[:, 2] > 0.05, verts[:, 2] * 1.1, verts[:, 2] * 0.3)
    hair_top.vertices = verts
    hair_top.apply_translation([0, 0.02, 1.8])
    meshes.append(color_mesh(hair_top, HAIR_BROWN))
    # Hair sides
    for sx in [-1, 1]:
        hair_side = box_mesh(0.1, 0.12, 0.2)
        hair_side.apply_translation([sx * 0.14, 0.02, 1.72])
        meshes.append(color_mesh(hair_side, HAIR_BROWN))
    # Eyes
    for sx in [-1, 1]:
        eye_white = sphere(0.035, 6, 8)
        eye_white.apply_translation([sx * 0.07, -0.15, 1.77])
        meshes.append(color_mesh(eye_white, WHITE))
        iris = sphere(0.022, 6, 8)
        iris.apply_translation([sx * 0.07, -0.17, 1.77])
        meshes.append(color_mesh(iris, DARK_BLUE))
        pupil = sphere(0.012, 4, 6)
        pupil.apply_translation([sx * 0.07, -0.185, 1.77])
        meshes.append(color_mesh(pupil, BLACK))
        # Eyelid/brow
        brow = box_mesh(0.06, 0.03, 0.015)
        brow.apply_translation([sx * 0.07, -0.14, 1.81])
        meshes.append(color_mesh(brow, HAIR_BROWN))
    # Nose
    nose = cone(0.025, 0.06, 8)
    nose.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
    nose.apply_translation([0, -0.19, 1.72])
    meshes.append(color_mesh(nose, SKIN))
    # Mouth
    mouth = box_mesh(0.06, 0.02, 0.01)
    mouth.apply_translation([0, -0.185, 1.68])
    meshes.append(color_mesh(mouth, [180, 120, 100, 255]))
    # Ears
    for sx in [-1, 1]:
        ear = sphere(0.03, 5, 6)
        ear.apply_translation([sx * 0.19, 0, 1.75])
        meshes.append(color_mesh(ear, SKIN))
    # Shoulders
    for sx in [-1, 1]:
        shoulder = sphere(0.09, 8, 10)
        shoulder.apply_translation([sx * 0.33, 0, 1.48])
        meshes.append(color_mesh(shoulder, BLUE))
    # Arms
    for sx in [-1, 1]:
        upper = cylinder(0.065, 0.055, 0.42, 14)
        upper.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 14 * sx, [0, 0, 1]))
        upper.apply_translation([sx * 0.34, 0, 1.28])
        meshes.append(color_mesh(upper, BLUE))
        elbow = sphere(0.055, 6, 8)
        elbow.apply_translation([sx * 0.35, 0, 1.05])
        meshes.append(color_mesh(elbow, SKIN))
        lower = cylinder(0.05, 0.045, 0.38, 14)
        lower.apply_translation([sx * 0.35, 0, 0.84])
        meshes.append(color_mesh(lower, SKIN))
        hand = sphere(0.045, 6, 8)
        hand.apply_translation([sx * 0.35, 0, 0.62])
        meshes.append(color_mesh(hand, SKIN))
        # Fingers
        for fi in range(4):
            finger = cylinder(0.01, 0.008, 0.06, 5)
            finger.apply_translation([sx * 0.35 + (fi - 1.5) * 0.018, -0.02, 0.57])
            meshes.append(color_mesh(finger, SKIN))
    # Belt
    belt = cylinder(0.17, 0.17, 0.06, 16)
    belt.apply_translation([0, 0, 0.82])
    meshes.append(color_mesh(belt, DARK_BROWN))
    belt_buckle = box_mesh(0.06, 0.04, 0.06)
    belt_buckle.apply_translation([0, -0.17, 0.82])
    meshes.append(color_mesh(belt_buckle, GOLD))
    # Hips
    hips = box_mesh(0.42, 0.28, 0.15)
    hips.apply_translation([0, 0, 0.77])
    meshes.append(color_mesh(hips, BLUE))
    # Legs
    for sx in [-1, 1]:
        upper = cylinder(0.08, 0.07, 0.45, 14)
        upper.apply_translation([sx * 0.13, 0, 0.53])
        meshes.append(color_mesh(upper, DARK_GRAY))
        knee = sphere(0.06, 6, 8)
        knee.apply_translation([sx * 0.13, 0, 0.3])
        meshes.append(color_mesh(knee, DARK_GRAY))
        lower = cylinder(0.065, 0.055, 0.38, 14)
        lower.apply_translation([sx * 0.13, 0, 0.1])
        meshes.append(color_mesh(lower, DARK_GRAY))
        ankle = sphere(0.04, 5, 6)
        ankle.apply_translation([sx * 0.13, 0, -0.07])
        meshes.append(color_mesh(ankle, DARK_BROWN))
        foot = box_mesh(0.1, 0.18, 0.06)
        foot.apply_translation([sx * 0.13, -0.03, -0.1])
        meshes.append(color_mesh(foot, DARK_BROWN))
    return merge(meshes)

def gen_robot():
    meshes = []
    # Torso core
    body = box_mesh(0.6, 0.4, 0.8)
    body.apply_translation([0, 0, 1.2])
    meshes.append(color_mesh(body, METAL))
    # Chest plate
    chest = box_mesh(0.52, 0.12, 0.45)
    chest.apply_translation([0, -0.22, 1.35])
    meshes.append(color_mesh(chest, LIGHT_METAL))
    # Chest detail lines
    for i in range(3):
        line = box_mesh(0.4, 0.02, 0.02)
        line.apply_translation([0, -0.28, 1.2 + i * 0.12])
        meshes.append(color_mesh(line, DARK_METAL))
    # Chest reactor
    reactor = cylinder(0.06, 0.06, 0.05, 12)
    reactor.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
    reactor.apply_translation([0, -0.29, 1.4])
    meshes.append(color_mesh(reactor, DARK_METAL))
    glow = sphere(0.04, 8, 10)
    glow.apply_translation([0, -0.31, 1.4])
    meshes.append(color_mesh(glow, RED))
    # Neck
    neck = cylinder(0.08, 0.08, 0.1, 12)
    neck.apply_translation([0, 0, 1.65])
    meshes.append(color_mesh(neck, DARK_METAL))
    # Head
    head = box_mesh(0.35, 0.3, 0.3)
    head.apply_translation([0, 0, 1.85])
    meshes.append(color_mesh(head, METAL))
    # Head top
    head_top = box_mesh(0.3, 0.25, 0.05)
    head_top.apply_translation([0, 0, 2.02])
    meshes.append(color_mesh(head_top, LIGHT_METAL))
    # Visor
    visor = box_mesh(0.3, 0.06, 0.12)
    visor.apply_translation([0, -0.18, 1.88])
    meshes.append(color_mesh(visor, DARK_BLUE))
    # Eyes (glowing)
    for sx in [-1, 1]:
        eye = sphere(0.04, 8, 10)
        eye.apply_translation([sx * 0.08, -0.21, 1.88])
        meshes.append(color_mesh(eye, YELLOW))
        eye_glow = sphere(0.025, 6, 8)
        eye_glow.apply_translation([sx * 0.08, -0.23, 1.88])
        meshes.append(color_mesh(eye_glow, WHITE))
    # Jaw
    jaw = box_mesh(0.28, 0.1, 0.08)
    jaw.apply_translation([0, -0.12, 1.72])
    meshes.append(color_mesh(jaw, DARK_METAL))
    # Antenna
    for sx in [-1, 1]:
        ant = cylinder(0.012, 0.008, 0.18, 8)
        ant.apply_translation([sx * 0.15, 0, 2.08])
        meshes.append(color_mesh(ant, DARK_METAL))
        ant_top = sphere(0.025, 6, 8)
        ant_top.apply_translation([sx * 0.15, 0, 2.28])
        meshes.append(color_mesh(ant_top, RED))
    # Arms
    for sx in [-1, 1]:
        shoulder = sphere(0.1, 8, 10)
        shoulder.apply_translation([sx * 0.4, 0, 1.52])
        meshes.append(color_mesh(shoulder, DARK_METAL))
        # Shoulder plate
        splate = box_mesh(0.12, 0.12, 0.06)
        splate.apply_translation([sx * 0.4, 0, 1.58])
        meshes.append(color_mesh(splate, LIGHT_METAL))
        upper = cylinder(0.08, 0.07, 0.38, 14)
        upper.apply_translation([sx * 0.4, 0, 1.25])
        meshes.append(color_mesh(upper, METAL))
        # Upper arm detail ring
        ring = cylinder(0.085, 0.085, 0.04, 10)
        ring.apply_translation([sx * 0.4, 0, 1.18])
        meshes.append(color_mesh(ring, DARK_METAL))
        elbow = sphere(0.07, 8, 10)
        elbow.apply_translation([sx * 0.4, 0, 1.04])
        meshes.append(color_mesh(elbow, DARK_METAL))
        lower = cylinder(0.07, 0.06, 0.32, 14)
        lower.apply_translation([sx * 0.4, 0, 0.86])
        meshes.append(color_mesh(lower, METAL))
        hand = box_mesh(0.1, 0.08, 0.1)
        hand.apply_translation([sx * 0.4, 0, 0.66])
        meshes.append(color_mesh(hand, DARK_METAL))
        for fz in [-1, 0, 1]:
            claw = cone(0.018, 0.07, 6)
            claw.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
            claw.apply_translation([sx * 0.4, -0.05, 0.62 + fz * 0.025])
            meshes.append(color_mesh(claw, DARK_METAL))
    # Legs
    for sx in [-1, 1]:
        hip = sphere(0.08, 8, 10)
        hip.apply_translation([sx * 0.15, 0, 0.78])
        meshes.append(color_mesh(hip, DARK_METAL))
        upper = cylinder(0.09, 0.08, 0.42, 14)
        upper.apply_translation([sx * 0.15, 0, 0.55])
        meshes.append(color_mesh(upper, METAL))
        # Leg detail ring
        ring = cylinder(0.095, 0.095, 0.04, 10)
        ring.apply_translation([sx * 0.15, 0, 0.45])
        meshes.append(color_mesh(ring, DARK_METAL))
        knee = sphere(0.07, 8, 10)
        knee.apply_translation([sx * 0.15, 0, 0.32])
        meshes.append(color_mesh(knee, DARK_METAL))
        lower = cylinder(0.08, 0.07, 0.32, 14)
        lower.apply_translation([sx * 0.15, 0, 0.12])
        meshes.append(color_mesh(lower, METAL))
        foot = box_mesh(0.14, 0.2, 0.08)
        foot.apply_translation([sx * 0.15, -0.03, -0.08])
        meshes.append(color_mesh(foot, DARK_METAL))
        # Foot detail
        fd = box_mesh(0.12, 0.18, 0.04)
        fd.apply_translation([sx * 0.15, -0.03, -0.1])
        meshes.append(color_mesh(fd, DARK_METAL))
    # Back thrusters
    for sx in [-1, 1]:
        thruster = cylinder(0.06, 0.08, 0.18, 10)
        thruster.apply_translation([sx * 0.18, 0.22, 1.1])
        meshes.append(color_mesh(thruster, DARK_METAL))
        glow = sphere(0.05, 6, 8)
        glow.apply_translation([sx * 0.18, 0.32, 1.1])
        meshes.append(color_mesh(glow, ORANGE))
    # Back plate
    back = box_mesh(0.5, 0.08, 0.6)
    back.apply_translation([0, 0.22, 1.2])
    meshes.append(color_mesh(back, DARK_METAL))
    return merge(meshes)

def gen_vehicle():
    meshes = []
    # Main body lower
    body = box_mesh(1.8, 0.8, 0.35)
    body.apply_translation([0, 0, 0.25])
    meshes.append(color_mesh(body, RED))
    # Body side panels
    for sx in [-1, 1]:
        panel = box_mesh(1.7, 0.04, 0.28)
        panel.apply_translation([0, sx * 0.42, 0.25])
        meshes.append(color_mesh(panel, DARK_RED))
    # Cabin
    cabin = box_mesh(1.0, 0.75, 0.35)
    cabin.apply_translation([-0.1, 0, 0.6])
    meshes.append(color_mesh(cabin, RED))
    # Roof
    roof = box_mesh(0.85, 0.7, 0.08)
    roof.apply_translation([-0.1, 0, 0.8])
    meshes.append(color_mesh(roof, RED))
    # Hood
    hood = box_mesh(0.6, 0.75, 0.06)
    hood.apply_translation([0.6, 0, 0.48])
    meshes.append(color_mesh(hood, RED))
    # Hood detail lines
    for i in range(3):
        line = box_mesh(0.4, 0.02, 0.02)
        line.apply_translation([0.6, -0.15 + i * 0.15, 0.52])
        meshes.append(color_mesh(line, DARK_RED))
    # Trunk
    trunk = box_mesh(0.4, 0.75, 0.06)
    trunk.apply_translation([-0.7, 0, 0.48])
    meshes.append(color_mesh(trunk, RED))
    # Windshield
    windshield = box_mesh(0.06, 0.65, 0.3)
    windshield.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 8, [0, 0, 1]))
    windshield.apply_translation([0.38, 0, 0.65])
    meshes.append(color_mesh(windshield, [100, 150, 200, 200]))
    # Rear window
    rear = box_mesh(0.06, 0.65, 0.25)
    rear.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 8, [0, 0, 1]))
    rear.apply_translation([-0.55, 0, 0.65])
    meshes.append(color_mesh(rear, [100, 150, 200, 200]))
    # Side windows
    for sx in [-1, 1]:
        win = box_mesh(0.6, 0.04, 0.22)
        win.apply_translation([-0.1, sx * 0.39, 0.68])
        meshes.append(color_mesh(win, [100, 150, 200, 200]))
        # Window frame
        frame_top = box_mesh(0.62, 0.045, 0.02)
        frame_top.apply_translation([-0.1, sx * 0.39, 0.8])
        meshes.append(color_mesh(frame_top, DARK_GRAY))
    # Headlights
    for sx in [-1, 1]:
        light = box_mesh(0.08, 0.15, 0.1)
        light.apply_translation([0.92, sx * 0.28, 0.3])
        meshes.append(color_mesh(light, YELLOW))
        light_inner = sphere(0.03, 6, 8)
        light_inner.apply_translation([0.94, sx * 0.28, 0.3])
        meshes.append(color_mesh(light_inner, WHITE))
    # Tail lights
    for sx in [-1, 1]:
        light = box_mesh(0.06, 0.12, 0.08)
        light.apply_translation([-0.92, sx * 0.3, 0.3])
        meshes.append(color_mesh(light, DARK_RED))
    # Wheels
    for wx in [-1, 1]:
        for wy in [-1, 1]:
            tire = torus(0.12, 0.04, 16, 12)
            tire.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
            tire.apply_translation([wx * 0.55, wy * 0.45, 0.08])
            meshes.append(color_mesh(tire, BLACK))
            hub = cylinder(0.06, 0.06, 0.06, 12)
            hub.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
            hub.apply_translation([wx * 0.55, wy * 0.45, 0.08])
            meshes.append(color_mesh(hub, GRAY))
            hub_center = cylinder(0.025, 0.025, 0.07, 8)
            hub_center.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
            hub_center.apply_translation([wx * 0.55, wy * 0.45, 0.08])
            meshes.append(color_mesh(hub_center, DARK_GRAY))
            # Spokes
            for sp in range(5):
                a = sp * np.pi * 2 / 5
                spoke = box_mesh(0.04, 0.008, 0.01)
                spoke.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
                spoke.apply_translation([
                    wx * 0.55 + 0.035 * np.cos(a),
                    wy * 0.45 + 0.035 * np.sin(a),
                    0.08
                ])
                meshes.append(color_mesh(spoke, GRAY))
    # Bumpers
    front = box_mesh(0.1, 0.85, 0.12)
    front.apply_translation([0.93, 0, 0.15])
    meshes.append(color_mesh(front, DARK_GRAY))
    rear_b = box_mesh(0.1, 0.85, 0.12)
    rear_b.apply_translation([-0.93, 0, 0.15])
    meshes.append(color_mesh(rear_b, DARK_GRAY))
    # Side mirrors
    for sx in [-1, 1]:
        arm = box_mesh(0.08, 0.02, 0.02)
        arm.apply_translation([0.3, sx * 0.44, 0.6])
        meshes.append(color_mesh(arm, DARK_GRAY))
        mirror = box_mesh(0.06, 0.05, 0.04)
        mirror.apply_translation([0.3, sx * 0.48, 0.6])
        meshes.append(color_mesh(mirror, DARK_GRAY))
    # Door handles
    for sx in [-1, 1]:
        handle = box_mesh(0.1, 0.025, 0.02)
        handle.apply_translation([0.0, sx * 0.42, 0.45])
        meshes.append(color_mesh(handle, LIGHT_METAL))
    # Undercarriage
    under = box_mesh(1.6, 0.7, 0.04)
    under.apply_translation([0, 0, 0.05])
    meshes.append(color_mesh(under, DARK_GRAY))
    return merge(meshes)

def gen_spaceship():
    meshes = []
    # Main hull
    hull = box_mesh(2.0, 0.6, 0.4)
    hull.apply_translation([0, 0, 0])
    meshes.append(color_mesh(hull, LIGHT_METAL))
    # Hull bottom plate
    bottom = box_mesh(1.8, 0.55, 0.05)
    bottom.apply_translation([0, 0, -0.22])
    meshes.append(color_mesh(bottom, DARK_METAL))
    # Nose cone
    nose = cone(0.25, 0.6, 12)
    nose.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, [0, 1, 0]))
    nose.apply_translation([1.3, 0, 0])
    meshes.append(color_mesh(nose, LIGHT_METAL))
    # Cockpit dome
    dome = sphere(0.2, 10, 16)
    verts = dome.vertices.copy()
    verts[:, 2] = np.abs(verts[:, 2]) * 0.6
    dome.vertices = verts
    dome.apply_translation([0.6, 0, 0.25])
    meshes.append(color_mesh(dome, [100, 180, 220, 200]))
    # Cockpit frame
    frame = torus(0.2, 0.015, 10, 8)
    frame.apply_translation([0.6, 0, 0.25])
    meshes.append(color_mesh(frame, DARK_METAL))
    # Wings
    for sx in [-1, 1]:
        wing = box_mesh(0.8, 0.05, 0.35)
        wing.apply_transform(trimesh.transformations.rotation_matrix(sx * np.pi / 12, [0, 0, 1]))
        wing.apply_translation([-0.2, sx * 0.55, -0.05])
        meshes.append(color_mesh(wing, GRAY))
        # Wing tip
        tip = cone(0.08, 0.2, 8)
        tip.apply_translation([-0.2, sx * 0.8, -0.05])
        meshes.append(color_mesh(tip, DARK_METAL))
        # Wing surface detail
        for i in range(4):
            detail = box_mesh(0.15, 0.03, 0.02)
            detail.apply_translation([-0.1 + i * 0.15, sx * 0.6, 0.12])
            meshes.append(color_mesh(detail, DARK_METAL))
    # Engine nacelles
    for sx in [-1, 1]:
        nacelle = cylinder(0.1, 0.12, 0.6, 14)
        nacelle.apply_translation([-0.6, sx * 0.35, 0])
        meshes.append(color_mesh(nacelle, DARK_METAL))
        intake = torus(0.1, 0.02, 10, 8)
        intake.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
        intake.apply_translation([-0.6, sx * 0.35, 0])
        meshes.append(color_mesh(intake, LIGHT_METAL))
        glow = sphere(0.08, 8, 10)
        glow.apply_translation([-0.92, sx * 0.35, 0])
        meshes.append(color_mesh(glow, ORANGE))
        # Exhaust ring
        exhaust = torus(0.08, 0.015, 8, 6)
        exhaust.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
        exhaust.apply_translation([-0.9, sx * 0.35, 0])
        meshes.append(color_mesh(exhaust, DARK_METAL))
    # Tail fin
    tail_fin = box_mesh(0.05, 0.08, 0.5)
    tail_fin.apply_translation([-0.9, 0, 0.2])
    meshes.append(color_mesh(tail_fin, DARK_METAL))
    # Body panels (greebles)
    for i in range(8):
        x = -0.7 + i * 0.25
        panel = box_mesh(0.15, 0.04, 0.08)
        panel.apply_translation([x, 0.32, 0.1])
        meshes.append(color_mesh(panel, DARK_METAL))
        panel2 = box_mesh(0.15, 0.04, 0.08)
        panel2.apply_translation([x, -0.32, 0.1])
        meshes.append(color_mesh(panel2, DARK_METAL))
    # Landing gear
    for sx in [-1, 1]:
        for sy in [-1, 1]:
            leg = cylinder(0.02, 0.02, 0.15, 8)
            leg.apply_translation([sx * 0.4, sy * 0.25, -0.28])
            meshes.append(color_mesh(leg, DARK_METAL))
            pad = cylinder(0.04, 0.04, 0.02, 8)
            pad.apply_translation([sx * 0.4, sy * 0.25, -0.37])
            meshes.append(color_mesh(pad, GRAY))
    # Weapon mounts
    for sx in [-1, 1]:
        mount = cylinder(0.03, 0.03, 0.3, 8)
        mount.apply_translation([0.8, sx * 0.35, -0.1])
        meshes.append(color_mesh(mount, DARK_METAL))
        barrel = cylinder(0.015, 0.015, 0.15, 6)
        barrel.apply_translation([0.95, sx * 0.35, -0.1])
        meshes.append(color_mesh(barrel, DARK_GRAY))
    # Top antenna
    ant = cylinder(0.008, 0.005, 0.15, 6)
    ant.apply_translation([0.2, 0, 0.3])
    meshes.append(color_mesh(ant, DARK_METAL))
    ant_tip = sphere(0.012, 4, 6)
    ant_tip.apply_translation([0.2, 0, 0.38])
    meshes.append(color_mesh(ant_tip, RED))
    return merge(meshes)

def gen_castle():
    meshes = []
    # Foundation
    foundation = box_mesh(3.0, 3.0, 0.3)
    foundation.apply_translation([0, 0, 0.15])
    meshes.append(color_mesh(foundation, DARK_STONE))
    # Foundation detail
    fd = box_mesh(3.1, 3.1, 0.05)
    fd.apply_translation([0, 0, 0.32])
    meshes.append(color_mesh(fd, STONE))
    # Main walls
    wall_h = 1.5
    wall_t = 0.2
    for angle in range(4):
        a = angle * np.pi / 2
        cos_a = np.cos(a)
        sin_a = np.sin(a)
        wall = box_mesh(3.0, wall_t, wall_h)
        wall.apply_transform(trimesh.transformations.rotation_matrix(a, [0, 0, 1]))
        wall.apply_translation([cos_a * 1.4, sin_a * 1.4, 0.3 + wall_h / 2])
        meshes.append(color_mesh(wall, STONE))
        # Wall texture lines
        for wl in range(4):
            wline = box_mesh(3.0, 0.02, 0.02)
            wline.apply_transform(trimesh.transformations.rotation_matrix(a, [0, 0, 1]))
            wline.apply_translation([cos_a * 1.4, sin_a * 1.4, 0.5 + wl * 0.35])
            meshes.append(color_mesh(wline, DARK_STONE))
    # Corner towers
    for tx in [-1, 1]:
        for ty in [-1, 1]:
            tower = cylinder(0.35, 0.35, 2.5, 16)
            tower.apply_translation([tx * 1.4, ty * 1.4, 0.3])
            meshes.append(color_mesh(tower, STONE))
            # Tower ring detail
            ring = cylinder(0.38, 0.38, 0.08, 16)
            ring.apply_translation([tx * 1.4, ty * 1.4, 1.5])
            meshes.append(color_mesh(ring, DARK_STONE))
            ring2 = cylinder(0.38, 0.38, 0.08, 16)
            ring2.apply_translation([tx * 1.4, ty * 1.4, 2.5])
            meshes.append(color_mesh(ring2, DARK_STONE))
            # Top ring
            top_ring = cylinder(0.38, 0.38, 0.1, 16)
            top_ring.apply_translation([tx * 1.4, ty * 1.4, 2.8])
            meshes.append(color_mesh(top_ring, DARK_STONE))
            # Battlements on tower
            for b in range(8):
                ba = b * np.pi * 2 / 8
                merlon = box_mesh(0.12, 0.1, 0.2)
                merlon.apply_translation([
                    tx * 1.4 + 0.4 * np.cos(ba),
                    ty * 1.4 + 0.4 * np.sin(ba),
                    2.95
                ])
                meshes.append(color_mesh(merlon, DARK_STONE))
            # Tower roof (cone)
            roof = cone(0.4, 0.6, 12)
            roof.apply_translation([tx * 1.4, ty * 1.4, 2.85])
            meshes.append(color_mesh(roof, DARK_RED))
            # Tower window
            win = box_mesh(0.12, 0.25, 0.08)
            win.apply_translation([tx * 1.4, ty * 1.4 - 0.36 * ty, 1.5])
            meshes.append(color_mesh(win, [80, 120, 180, 200]))
    # Battlements along walls
    for side in range(4):
        a = side * np.pi / 2
        for b in range(5):
            t = -1.2 + b * 0.6
            cos_a = np.cos(a)
            sin_a = np.sin(a)
            mx = cos_a * t - sin_a * 1.35
            my = sin_a * t + cos_a * 1.35
            merlon = box_mesh(0.12, 0.12, 0.25)
            merlon.apply_translation([mx, my, 2.05])
            meshes.append(color_mesh(merlon, DARK_STONE))
    # Gate (front wall)
    gate_frame = box_mesh(0.5, 0.25, 0.9)
    gate_frame.apply_translation([0, -1.45, 0.75])
    meshes.append(color_mesh(gate_frame, DARK_WOOD))
    # Gate arch
    arch = torus(0.2, 0.04, 10, 8)
    arch.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
    arch.apply_translation([0, -1.45, 1.2])
    meshes.append(color_mesh(arch, DARK_STONE))
    # Gate portcullis bars
    for bx in [-0.15, -0.075, 0, 0.075, 0.15]:
        bar = cylinder(0.015, 0.015, 0.8, 8)
        bar.apply_translation([bx, -1.48, 0.7])
        meshes.append(color_mesh(bar, DARK_GRAY))
    for by in [0.65, 0.75, 0.85, 0.95, 1.05, 1.15]:
        hbar = box_mesh(0.35, 0.015, 0.015)
        hbar.apply_translation([0, -1.48, by])
        meshes.append(color_mesh(hbar, DARK_GRAY))
    # Windows
    for sx in [-1, 1]:
        for sy in [-1, 1]:
            win = box_mesh(0.15, 0.25, 0.08)
            win.apply_translation([sx * 0.6, sy * 1.48, 1.2])
            meshes.append(color_mesh(win, [80, 120, 180, 200]))
            # Window frame
            wf = box_mesh(0.18, 0.28, 0.04)
            wf.apply_translation([sx * 0.6, sy * 1.5, 1.2])
            meshes.append(color_mesh(wf, DARK_STONE))
    # Keep (central tower)
    keep = cylinder(0.5, 0.5, 2.0, 16)
    keep.apply_translation([0, 0, 0.3])
    meshes.append(color_mesh(keep, STONE))
    # Keep ring
    keep_ring = cylinder(0.53, 0.53, 0.08, 16)
    keep_ring.apply_translation([0, 0, 1.8])
    meshes.append(color_mesh(keep_ring, DARK_STONE))
    keep_roof = cone(0.6, 0.8, 14)
    keep_roof.apply_translation([0, 0, 2.35])
    meshes.append(color_mesh(keep_roof, DARK_RED))
    # Flag pole
    pole = cylinder(0.015, 0.015, 0.6, 8)
    pole.apply_translation([0, 0, 3.15])
    meshes.append(color_mesh(pole, DARK_GRAY))
    # Flag
    flag = box_mesh(0.3, 0.02, 0.18)
    flag.apply_translation([0.15, 0, 3.4])
    meshes.append(color_mesh(flag, RED))
    # Courtyard ground
    courtyard = box_mesh(2.5, 2.5, 0.05)
    courtyard.apply_translation([0, 0, 0.33])
    meshes.append(color_mesh(courtyard, [120, 100, 80, 255]))
    return merge(meshes)

def gen_house():
    meshes = []
    # Foundation
    foundation = box_mesh(1.8, 1.5, 0.15)
    foundation.apply_translation([0, 0, 0.075])
    meshes.append(color_mesh(foundation, DARK_STONE))
    # Walls
    walls = box_mesh(1.6, 1.3, 1.0)
    walls.apply_translation([0, 0, 0.65])
    meshes.append(color_mesh(walls, CREAM))
    # Wall texture (horizontal lines)
    for wl in range(3):
        wline = box_mesh(1.62, 1.32, 0.02)
        wline.apply_translation([0, 0, 0.45 + wl * 0.25])
        meshes.append(color_mesh(wline, [220, 210, 180, 255]))
    # Roof (two sloped panels)
    roof_panel = box_mesh(1.8, 0.05, 0.9)
    roof_panel.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 7, [0, 1, 0]))
    roof_panel.apply_translation([0.0, 0.0, 1.35])
    meshes.append(color_mesh(roof_panel, DARK_RED))
    roof_panel2 = box_mesh(1.8, 0.05, 0.9)
    roof_panel2.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 7, [0, 1, 0]))
    roof_panel2.apply_translation([0.0, 0.0, 1.35])
    meshes.append(color_mesh(roof_panel2, DARK_RED))
    # Ridge
    ridge = box_mesh(1.8, 0.08, 0.08)
    ridge.apply_translation([0, 0, 1.65])
    meshes.append(color_mesh(ridge, DARK_RED))
    # Roof eaves
    for sx in [-1, 1]:
        eave = box_mesh(1.82, 0.04, 0.04)
        eave.apply_translation([0, sx * 0.72, 1.18])
        meshes.append(color_mesh(eave, DARK_RED))
    # Chimney
    chimney = box_mesh(0.2, 0.2, 0.6)
    chimney.apply_translation([0.5, 0.3, 1.4])
    meshes.append(color_mesh(chimney, STONE))
    chimney_top = box_mesh(0.24, 0.24, 0.04)
    chimney_top.apply_translation([0.5, 0.3, 1.72])
    meshes.append(color_mesh(chimney_top, DARK_STONE))
    # Door
    door = box_mesh(0.25, 0.05, 0.55)
    door.apply_translation([0, -0.68, 0.425])
    meshes.append(color_mesh(door, DARK_WOOD))
    # Door frame
    door_frame = box_mesh(0.3, 0.06, 0.6)
    door_frame.apply_translation([0, -0.68, 0.43])
    meshes.append(color_mesh(door_frame, LIGHT_WOOD))
    # Door panels
    for dy in [-1, 1]:
        panel = box_mesh(0.08, 0.02, 0.2)
        panel.apply_translation([0, -0.71, 0.35 + dy * 0.1])
        meshes.append(color_mesh(panel, DARK_WOOD))
    # Door knob
    knob = sphere(0.02, 6, 8)
    knob.apply_translation([0.08, -0.71, 0.42])
    meshes.append(color_mesh(knob, YELLOW))
    # Door step
    step = box_mesh(0.4, 0.15, 0.05)
    step.apply_translation([0, -0.78, 0.025])
    meshes.append(color_mesh(step, GRAY))
    step2 = box_mesh(0.35, 0.1, 0.04)
    step2.apply_translation([0, -0.78, 0.05])
    meshes.append(color_mesh(step2, GRAY))
    # Front windows
    for sx in [-1, 1]:
        win = box_mesh(0.25, 0.05, 0.25)
        win.apply_translation([sx * 0.4, -0.68, 0.75])
        meshes.append(color_mesh(win, [100, 150, 200, 200]))
        # Window frame
        frame = box_mesh(0.28, 0.06, 0.28)
        frame.apply_translation([sx * 0.4, -0.68, 0.75])
        meshes.append(color_mesh(frame, WHITE))
        # Window cross
        vc = box_mesh(0.02, 0.07, 0.25)
        vc.apply_translation([sx * 0.4, -0.68, 0.75])
        meshes.append(color_mesh(vc, WHITE))
        hc = box_mesh(0.25, 0.07, 0.02)
        hc.apply_translation([sx * 0.4, -0.68, 0.75])
        meshes.append(color_mesh(hc, WHITE))
        # Window sill
        sill = box_mesh(0.3, 0.08, 0.03)
        sill.apply_translation([sx * 0.4, -0.7, 0.62])
        meshes.append(color_mesh(sill, WHITE))
    # Side windows
    for sx in [-1, 1]:
        win = box_mesh(0.2, 0.05, 0.2)
        win.apply_translation([sx * 0.82, 0, 0.75])
        meshes.append(color_mesh(win, [100, 150, 200, 200]))
        frame = box_mesh(0.23, 0.06, 0.23)
        frame.apply_translation([sx * 0.82, 0, 0.75])
        meshes.append(color_mesh(frame, WHITE))
    # Back window
    win = box_mesh(0.2, 0.05, 0.2)
    win.apply_translation([0, 0.68, 0.75])
    meshes.append(color_mesh(win, [100, 150, 200, 200]))
    frame = box_mesh(0.23, 0.06, 0.23)
    frame.apply_translation([0, 0.68, 0.75])
    meshes.append(color_mesh(frame, WHITE))
    return merge(meshes)

def gen_sword():
    meshes = []
    # Blade main
    blade = box_mesh(0.04, 0.02, 0.9)
    blade.apply_translation([0, 0, 0.85])
    meshes.append(color_mesh(blade, LIGHT_METAL))
    # Blade edge bevel
    edge = box_mesh(0.06, 0.015, 0.85)
    edge.apply_translation([0, 0, 0.87])
    meshes.append(color_mesh(edge, METAL))
    # Blade tip
    tip = cone(0.025, 0.12, 8)
    tip.apply_translation([0, 0, 1.35])
    meshes.append(color_mesh(tip, LIGHT_METAL))
    # Fuller (blood groove)
    fuller = box_mesh(0.015, 0.022, 0.6)
    fuller.apply_translation([0, 0, 0.95])
    meshes.append(color_mesh(fuller, DARK_METAL))
    # Fuller groove detail
    for i in range(8):
        notch = box_mesh(0.018, 0.005, 0.01)
        notch.apply_translation([0, 0, 0.7 + i * 0.08])
        meshes.append(color_mesh(notch, DARK_METAL))
    # Crossguard
    crossguard = box_mesh(0.22, 0.04, 0.05)
    crossguard.apply_translation([0, 0, 0.42])
    meshes.append(color_mesh(crossguard, GOLD))
    # Crossguard decorative ends
    for sx in [-1, 1]:
        end = sphere(0.02, 8, 10)
        end.apply_translation([sx * 0.12, 0, 0.42])
        meshes.append(color_mesh(end, GOLD))
        # Crossguard arm detail
        arm = box_mesh(0.03, 0.035, 0.06)
        arm.apply_translation([sx * 0.08, 0, 0.42])
        meshes.append(color_mesh(arm, GOLD))
    # Grip wrap
    grip = cylinder(0.022, 0.022, 0.2, 12)
    grip.apply_translation([0, 0, 0.3])
    meshes.append(color_mesh(grip, DARK_WOOD))
    # Grip leather wraps
    for i in range(6):
        wrap = cylinder(0.026, 0.026, 0.012, 8)
        wrap.apply_translation([0, 0, 0.22 + i * 0.032])
        meshes.append(color_mesh(wrap, DARK_BROWN))
    # Pommel
    pommel = sphere(0.035, 8, 10)
    pommel.apply_translation([0, 0, 0.18])
    meshes.append(color_mesh(pommel, GOLD))
    # Pommel gem
    gem = sphere(0.018, 6, 8)
    gem.apply_translation([0, 0, 0.22])
    meshes.append(color_mesh(gem, RED))
    # Blade shine detail
    shine = box_mesh(0.01, 0.005, 0.7)
    shine.apply_translation([0.012, 0, 0.95])
    meshes.append(color_mesh(shine, WHITE))
    return merge(meshes)

def gen_shield():
    meshes = []
    # Shield base (back)
    base = cylinder(0.35, 0.35, 0.06, 20)
    base.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
    base.apply_translation([0, 0, 0])
    meshes.append(color_mesh(base, DARK_RED))
    # Shield face (front, slightly smaller radius)
    face = cylinder(0.33, 0.33, 0.02, 20)
    face.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
    face.apply_translation([0, 0, 0.03])
    meshes.append(color_mesh(face, RED))
    # Outer ring
    ring1 = torus(0.3, 0.025, 16, 10)
    ring1.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
    ring1.apply_translation([0, 0, 0])
    meshes.append(color_mesh(ring1, GOLD))
    # Middle ring
    ring2 = torus(0.2, 0.02, 14, 8)
    ring2.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
    ring2.apply_translation([0, 0, 0])
    meshes.append(color_mesh(ring2, GOLD))
    # Inner ring
    ring3 = torus(0.1, 0.015, 10, 8)
    ring3.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
    ring3.apply_translation([0, 0, 0])
    meshes.append(color_mesh(ring3, GOLD))
    # Central boss
    boss = sphere(0.06, 10, 14)
    verts = boss.vertices.copy()
    verts[:, 2] = np.abs(verts[:, 2]) * 0.6
    boss.vertices = verts
    boss.apply_translation([0, 0, 0.05])
    meshes.append(color_mesh(boss, GOLD))
    # Boss rivet
    rivet = sphere(0.02, 6, 8)
    rivet.apply_translation([0, 0, 0.08])
    meshes.append(color_mesh(rivet, DARK_METAL))
    # Radial spokes
    for i in range(8):
        a = i * np.pi / 4
        spoke = box_mesh(0.25, 0.02, 0.02)
        spoke.apply_transform(trimesh.transformations.rotation_matrix(a, [0, 0, 1]))
        spoke.apply_translation([0, 0, 0.04])
        meshes.append(color_mesh(spoke, GOLD))
    # Corner spikes
    for i in range(8):
        a = i * np.pi / 4
        spike = cone(0.02, 0.06, 6)
        spike.apply_translation([0.28 * np.cos(a), 0.28 * np.sin(a), 0.04])
        meshes.append(color_mesh(spike, GOLD))
    # Rim rivets
    for i in range(16):
        a = i * np.pi * 2 / 16
        rivet = sphere(0.012, 4, 6)
        rivet.apply_translation([0.33 * np.cos(a), 0.33 * np.sin(a), 0.04])
        meshes.append(color_mesh(rivet, DARK_METAL))
    # Inner decorative rivets
    for i in range(8):
        a = i * np.pi / 4
        rivet = sphere(0.01, 4, 6)
        rivet.apply_translation([0.15 * np.cos(a), 0.15 * np.sin(a), 0.04])
        meshes.append(color_mesh(rivet, DARK_METAL))
    # Back plate
    back = cylinder(0.33, 0.33, 0.02, 16)
    back.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
    back.apply_translation([0, 0, -0.04])
    meshes.append(color_mesh(back, DARK_WOOD))
    # Back straps
    strap_h = cylinder(0.015, 0.015, 0.3, 8)
    strap_h.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [0, 1, 0]))
    strap_h.apply_translation([0, 0, -0.02])
    meshes.append(color_mesh(strap_h, BROWN))
    strap_v = cylinder(0.015, 0.015, 0.3, 8)
    strap_v.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
    strap_v.apply_translation([0, 0, -0.02])
    meshes.append(color_mesh(strap_v, BROWN))
    # Strap buckle
    buckle = box_mesh(0.04, 0.04, 0.01)
    buckle.apply_translation([0, 0, -0.03])
    meshes.append(color_mesh(buckle, GOLD))
    return merge(meshes)

def gen_chair():
    meshes = []
    # Seat
    seat = box_mesh(0.4, 0.4, 0.05)
    seat.apply_translation([0, 0, 0.45])
    meshes.append(color_mesh(seat, WOOD))
    # Seat cushion
    cushion = box_mesh(0.36, 0.36, 0.03)
    cushion.apply_translation([0, 0, 0.49])
    meshes.append(color_mesh(cushion, DARK_RED))
    # Backrest
    backrest = box_mesh(0.4, 0.04, 0.4)
    backrest.apply_translation([0, -0.18, 0.7])
    meshes.append(color_mesh(backrest, WOOD))
    # Backrest slats
    for i in range(3):
        slat = box_mesh(0.35, 0.025, 0.04)
        slat.apply_translation([0, -0.18, 0.58 + i * 0.12])
        meshes.append(color_mesh(slat, LIGHT_WOOD))
    # Backrest top rail
    rail = box_mesh(0.42, 0.05, 0.04)
    rail.apply_translation([0, -0.18, 0.9])
    meshes.append(color_mesh(rail, DARK_WOOD))
    # Legs
    for sx in [-1, 1]:
        for sy in [-1, 1]:
            leg = cylinder(0.025, 0.025, 0.45, 10)
            leg.apply_translation([sx * 0.15, sy * 0.15, 0.225])
            meshes.append(color_mesh(leg, DARK_WOOD))
    # Extended back legs (to support backrest)
    for sx in [-1, 1]:
        back_leg = cylinder(0.025, 0.025, 0.9, 10)
        back_leg.apply_translation([sx * 0.15, -0.15, 0.45])
        meshes.append(color_mesh(back_leg, DARK_WOOD))
    # Front leg caps
    for sx in [-1, 1]:
        cap = sphere(0.028, 6, 8)
        cap.apply_translation([sx * 0.15, 0.15, 0.0])
        meshes.append(color_mesh(cap, DARK_WOOD))
    # Side stretchers
    for sx in [-1, 1]:
        cross = cylinder(0.012, 0.012, 0.28, 8)
        cross.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [0, 1, 0]))
        cross.apply_translation([sx * 0.15, 0, 0.18])
        meshes.append(color_mesh(cross, DARK_WOOD))
    # Front/back stretchers
    for sy in [-1, 1]:
        cross = cylinder(0.012, 0.012, 0.28, 8)
        cross.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
        cross.apply_translation([0, sy * 0.15, 0.18])
        meshes.append(color_mesh(cross, DARK_WOOD))
    return merge(meshes)

def gen_table():
    meshes = []
    # Table top
    top = box_mesh(0.8, 0.5, 0.05)
    top.apply_translation([0, 0, 0.45])
    meshes.append(color_mesh(top, WOOD))
    # Table top edge detail
    edge_f = box_mesh(0.82, 0.02, 0.03)
    edge_f.apply_translation([0, 0.26, 0.44])
    meshes.append(color_mesh(edge_f, DARK_WOOD))
    edge_b = box_mesh(0.82, 0.02, 0.03)
    edge_b.apply_translation([0, -0.26, 0.44])
    meshes.append(color_mesh(edge_b, DARK_WOOD))
    edge_l = box_mesh(0.02, 0.52, 0.03)
    edge_l.apply_translation([0.41, 0, 0.44])
    meshes.append(color_mesh(edge_l, DARK_WOOD))
    edge_r = box_mesh(0.02, 0.52, 0.03)
    edge_r.apply_translation([-0.41, 0, 0.44])
    meshes.append(color_mesh(edge_r, DARK_WOOD))
    # Legs
    for sx in [-1, 1]:
        for sy in [-1, 1]:
            leg = cylinder(0.03, 0.03, 0.45, 10)
            leg.apply_translation([sx * 0.33, sy * 0.18, 0.225])
            meshes.append(color_mesh(leg, DARK_WOOD))
            # Leg cap
            cap = sphere(0.032, 6, 8)
            cap.apply_translation([sx * 0.33, sy * 0.18, 0.0])
            meshes.append(color_mesh(cap, DARK_WOOD))
    # Long stretchers
    for sx in [-1, 1]:
        cross = cylinder(0.015, 0.015, 0.28, 8)
        cross.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [0, 1, 0]))
        cross.apply_translation([sx * 0.33, 0, 0.15])
        meshes.append(color_mesh(cross, DARK_WOOD))
    # Short stretchers
    for sy in [-1, 1]:
        cross = cylinder(0.015, 0.015, 0.58, 8)
        cross.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
        cross.apply_translation([0, sy * 0.18, 0.15])
        meshes.append(color_mesh(cross, DARK_WOOD))
    return merge(meshes)

def main():
    ensure_dirs()
    total_tris = 0
    generators = {
        'characters': [
            ('humanoid', gen_humanoid),
            ('robot', gen_robot),
        ],
        'vehicles': [
            ('vehicle', gen_vehicle),
            ('spaceship', gen_spaceship),
        ],
        'buildings': [
            ('castle', gen_castle),
            ('house', gen_house),
        ],
        'weapons': [
            ('sword', gen_sword),
            ('shield', gen_shield),
        ],
        'furniture': [
            ('chair', gen_chair),
            ('table', gen_table),
        ],
    }
    print('Generating NeoGenesis extended 3D assets...')
    print('=' * 50)
    for category, models in generators.items():
        print(f'\n[{category.upper()}]')
        for name, gen_fn in models:
            try:
                mesh = gen_fn()
                tris = export(mesh, category, name)
                total_tris += tris
            except Exception as e:
                print(f'  ERROR {name}: {e}')
                import traceback
                traceback.print_exc()
    print('\n' + '=' * 50)
    print(f'TOTAL: {total_tris} triangles')
    print('Done!')

if __name__ == '__main__':
    main()
