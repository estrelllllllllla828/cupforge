"""
杯型回转体网格生成 — 由 thr cup3.py 提炼，用于 Web API 导出。
"""

from __future__ import annotations

import io

import numpy as np
import trimesh
from scipy.interpolate import splprep, splev

import config


def scale_control_points(
    points: list[tuple[float, float]],
    cup_height: float,
    base_height: float = config.CUP_BASE_HEIGHT,
    top_y: float = 80.0,
) -> list[tuple[float, float]]:
    scale = cup_height / base_height
    return [(x, top_y + (y - top_y) * scale) for x, y in points]


def profile_curve(
    control_points: list[tuple[float, float]],
    center_x: float = config.CUP_CENTER_X,
    samples: int = config.CUP_PROFILE_SAMPLES,
) -> tuple[np.ndarray, np.ndarray]:
    pts = np.array(control_points, dtype=np.float64)
    x = pts[:, 0]
    y = pts[:, 1]
    tck, _ = splprep([x, y], s=0)
    unew = np.linspace(0, 1, samples)
    out = splev(unew, tck)
    return np.array(out[0]), np.array(out[1])


def build_cup_mesh(
    control_points: list[tuple[float, float]],
    *,
    center_x: float = config.CUP_CENTER_X,
    wall_thickness: float = config.CUP_WALL_THICKNESS_DEFAULT,
    cup_height: float = config.CUP_HEIGHT_DEFAULT,
    theta_segments: int = config.CUP_REVOLVE_SEGMENTS,
) -> trimesh.Trimesh:
    scaled = scale_control_points(control_points, cup_height)
    x, y = profile_curve(scaled, center_x=center_x)

    outer_r = np.abs(x - center_x)
    inner_r = np.clip(outer_r - wall_thickness, 2, None)
    z = 700 - y

    inner_floor_z = float(z[-1])
    outer_bottom_z = inner_floor_z - wall_thickness

    # endpoint=False：首尾角度不重复，再用取模闭合侧面
    theta = np.linspace(0, 2 * np.pi, theta_segments, endpoint=False)

    verts: list[list[float]] = []
    faces: list[list[int]] = []
    outer_idx: list[list[int]] = []
    inner_idx: list[list[int]] = []

    last = len(z) - 1
    for i in range(len(z)):
        row: list[int] = []
        z_outer = outer_bottom_z if i == last else float(z[i])
        for t in theta:
            verts.append([
                float(outer_r[i] * np.cos(t)),
                float(outer_r[i] * np.sin(t)),
                z_outer,
            ])
            row.append(len(verts) - 1)
        outer_idx.append(row)

    for i in range(len(z)):
        row = []
        z_inner = inner_floor_z if i == last else float(z[i])
        for t in theta:
            verts.append([
                float(inner_r[i] * np.cos(t)),
                float(inner_r[i] * np.sin(t)),
                z_inner,
            ])
            row.append(len(verts) - 1)
        inner_idx.append(row)

    cols = len(theta)

    for i in range(len(z) - 1):
        for j in range(cols):
            j1 = (j + 1) % cols
            a, b, c, d = outer_idx[i][j], outer_idx[i][j1], outer_idx[i + 1][j], outer_idx[i + 1][j1]
            faces.append([a, b, c])
            faces.append([b, d, c])

    for i in range(len(z) - 1):
        for j in range(cols):
            j1 = (j + 1) % cols
            a, b, c, d = inner_idx[i][j], inner_idx[i + 1][j], inner_idx[i][j1], inner_idx[i + 1][j1]
            faces.append([a, b, c])
            faces.append([c, b, d])

    top_outer = outer_idx[0]
    top_inner = inner_idx[0]
    for j in range(cols):
        j1 = (j + 1) % cols
        a, b, c, d = top_outer[j], top_inner[j], top_outer[j1], top_inner[j1]
        faces.append([a, c, b])
        faces.append([c, d, b])

    bottom_outer = outer_idx[-1]
    bottom_inner = inner_idx[-1]
    for j in range(cols):
        j1 = (j + 1) % cols
        a, b = bottom_inner[j], bottom_inner[j1]
        c, d = bottom_outer[j1], bottom_outer[j]
        faces.append([a, b, c])
        faces.append([a, c, d])

    inner_center = len(verts)
    verts.append([0.0, 0.0, inner_floor_z])
    outer_center = len(verts)
    verts.append([0.0, 0.0, outer_bottom_z])

    # 内底面（法线朝 +Z，杯内可见）
    for j in range(cols):
        j1 = (j + 1) % cols
        a, b = bottom_inner[j], bottom_inner[j1]
        faces.append([inner_center, a, b])

    # 外底面（法线朝 -Z，杯外/桌面方向可见）
    for j in range(cols):
        j1 = (j + 1) % cols
        a, b = bottom_outer[j], bottom_outer[j1]
        faces.append([outer_center, b, a])

    mesh = trimesh.Trimesh(
        vertices=np.array(verts, dtype=np.float64),
        faces=np.array(faces, dtype=np.int64),
        process=True,
    )
    return mesh


def mesh_to_obj_bytes(mesh: trimesh.Trimesh) -> bytes:
    buf = io.BytesIO()
    mesh.export(buf, file_type="obj")
    return buf.getvalue()


def mesh_to_stl_bytes(mesh: trimesh.Trimesh) -> bytes:
    buf = io.BytesIO()
    mesh.export(buf, file_type="stl")
    return buf.getvalue()
