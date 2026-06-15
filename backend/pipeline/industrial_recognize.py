"""
工业建筑主题自动识别 — 基于边缘、线条方向与空间分布的启发式分类。
"""

from __future__ import annotations

import cv2
import numpy as np

import config


def _enhance_gray(gray: np.ndarray) -> np.ndarray:
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    return cv2.bilateralFilter(enhanced, 9, 75, 75)


def _region_edge_density(edges: np.ndarray, y0: float, y1: float) -> float:
    h = edges.shape[0]
    a = int(h * y0)
    b = max(a + 1, int(h * y1))
    region = edges[a:b, :]
    return float(np.count_nonzero(region)) / max(1, region.size)


def _line_orientation_counts(
    lines: np.ndarray | None,
) -> tuple[int, int, int, float, float, int]:
    """返回 (水平, 垂直, 斜线, 最长水平跨度比, 最长垂直跨度比, 长线数量)。"""
    if lines is None:
        return 0, 0, 0, 0.0, 0.0, 0

    horizontal = 0
    vertical = 0
    diagonal = 0
    max_horiz_span = 0.0
    max_vert_span = 0.0
    long_lines = 0

    for x1, y1, x2, y2 in lines[:, 0]:
        dx = abs(x2 - x1)
        dy = abs(y2 - y1)
        length = float(np.hypot(dx, dy))
        angle = abs(np.degrees(np.arctan2(y2 - y1, x2 - x1)))

        if angle < 18 or angle > 162:
            horizontal += 1
            max_horiz_span = max(max_horiz_span, dx)
        elif 72 < angle < 108:
            vertical += 1
            max_vert_span = max(max_vert_span, dy)
        else:
            diagonal += 1

        if length >= 40:
            long_lines += 1

    return horizontal, vertical, diagonal, max_horiz_span, max_vert_span, long_lines


def _horizontal_band_strength(edges: np.ndarray) -> float:
    """检测厂房类横向条带：中间区域行投影的峰值显著性。"""
    h, w = edges.shape[:2]
    mid = edges[int(h * 0.25) : int(h * 0.75), :]
    if mid.size == 0:
        return 0.0
    row_sum = np.sum(mid > 0, axis=1).astype(np.float32)
    if row_sum.max() <= 0:
        return 0.0
    mean = float(row_sum.mean())
    peak = float(row_sum.max())
    return max(0.0, (peak - mean) / max(mean, 1.0))


def _grid_balance(horiz: int, vert: int) -> float:
    """脚手架/钢架类网格：横竖线数量接近。"""
    total = horiz + vert
    if total <= 0:
        return 0.0
    balance = 1.0 - abs(horiz - vert) / total
    return balance * min(1.0, total / 40.0)


def _contour_features(edges: np.ndarray) -> dict[str, float]:
    h, w = edges.shape[:2]
    area_min = h * w * 0.006
    wide_mass = 0.0
    tall_mass = 0.0
    low_wide = 0.0

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < area_min:
            continue
        x, y, cw, ch = cv2.boundingRect(cnt)
        aspect = cw / max(ch, 1)
        cy = (y + ch / 2) / max(h, 1)

        if aspect > 1.35:
            wide_mass += area / (h * w)
            if cy > 0.35:
                low_wide += area / (h * w)
        if aspect < 0.65:
            tall_mass += area / (h * w)

    return {
        "wide_mass": wide_mass,
        "tall_mass": tall_mass,
        "low_wide": low_wide,
    }


def recognize_industrial_subject(img_bgr: np.ndarray) -> dict[str, float | str]:
    """识别工业建筑主题，返回标签、置信度与各主题得分。"""
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape[:2]
    enhanced = _enhance_gray(gray)
    edges = cv2.Canny(enhanced, 40, 120)

    lines = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi / 180,
        threshold=max(35, int(min(h, w) * 0.06)),
        minLineLength=int(max(h, w) * 0.08),
        maxLineGap=16,
    )
    horiz, vert, diag, max_h_span, max_v_span, long_lines = _line_orientation_counts(lines)
    line_total = max(1, horiz + vert + diag)
    horiz_ratio = horiz / line_total
    vert_ratio = vert / line_total
    diag_ratio = diag / line_total

    edge_density = float(np.count_nonzero(edges)) / max(1, h * w)
    upper_edges = _region_edge_density(edges, 0.0, 0.45)
    middle_edges = _region_edge_density(edges, 0.25, 0.75)
    lower_edges = _region_edge_density(edges, 0.55, 1.0)
    lower_vs_upper = lower_edges / max(upper_edges, 1e-4)

    long_horiz_ratio = max_h_span / max(w, 1)
    long_vert_ratio = max_v_span / max(h, 1)
    band_strength = _horizontal_band_strength(edges)
    grid_balance = _grid_balance(horiz, vert)
    contour = _contour_features(edges)

    scores = {label: 0.0 for label in config.INDUSTRIAL_SUBJECTS}

    # ── 厂房：宽扁主体 + 中部横向条带（屋顶/窗带） ──
    scores["厂房"] += (
        band_strength * 3.5
        + contour["wide_mass"] * 4.0
        + contour["low_wide"] * 2.5
        + horiz_ratio * 2.2
        + middle_edges * 1.8
        + (1.0 - vert_ratio) * 1.2
    )
    if contour["wide_mass"] > 0.04 and band_strength > 0.35:
        scores["厂房"] += 2.5

    # ── 大桥：下部结构密 + 长水平跨度 + 桁架斜线 ──
    scores["大桥"] += (
        lower_vs_upper * 2.2
        + long_horiz_ratio * 4.5
        + horiz_ratio * 2.0
        + diag_ratio * 1.6
        + contour["low_wide"] * 2.0
        + lower_edges * 1.5
    )
    if long_horiz_ratio > 0.28 and lower_vs_upper > 1.05:
        scores["大桥"] += 3.0
    if long_horiz_ratio > 0.2 and diag_ratio > 0.22:
        scores["大桥"] += 1.8

    # ── 高楼：竖向线条 + 上部边缘密集 + 细长主体 ──
    scores["高楼"] += (
        vert_ratio * 3.0
        + upper_edges * 2.2
        + contour["tall_mass"] * 3.5
        + long_vert_ratio * 2.0
        + edge_density * 0.6
    )

    # ── 起重机 / 吊车：斜撑 + 竖向桅杆 ──
    scores["起重机"] += diag_ratio * 2.8 + vert_ratio * 1.6 + upper_edges * 1.0
    scores["吊车"] += diag_ratio * 2.4 + horiz_ratio * 1.2 + vert_ratio * 0.9 + long_horiz_ratio * 1.5

    # ── 烟囱：竖向为主 + 上部集中 + 细长轮廓 ──
    scores["烟囱"] += (
        vert_ratio * 2.6
        + upper_edges * 1.4
        + contour["tall_mass"] * 2.8
        + (1.0 - horiz_ratio) * 0.8
    )

    # ── 管道：平行管线（横或竖二选一突出）+ 中等边缘密度 ──
    pipe_axis = max(horiz_ratio, vert_ratio)
    scores["管道"] += (
        pipe_axis * 2.2
        + middle_edges * 1.6
        + long_lines * 0.08
        + (1.0 - diag_ratio) * 1.0
    )
    if pipe_axis > 0.42 and diag_ratio < 0.28:
        scores["管道"] += 1.5

    # ── 钢架：斜线网格 + 高线数 ──
    scores["钢架"] += (
        diag_ratio * 3.2
        + grid_balance * 2.0
        + long_lines * 0.06
        + edge_density * 1.2
    )

    # ── 塔吊：高竖向 + 上部显著水平臂 ──
    scores["塔吊"] += (
        vert_ratio * 2.0
        + long_horiz_ratio * 2.5
        + upper_edges * 1.6
        + diag_ratio * 1.4
    )
    if long_vert_ratio > 0.35 and long_horiz_ratio > 0.15:
        scores["塔吊"] += 2.2

    # ── 脚手架：横竖均衡网格 + 全幅边缘 ──
    scores["脚手架"] += (
        grid_balance * 3.5
        + edge_density * 1.8
        + min(horiz_ratio, vert_ratio) * 2.5
        + long_lines * 0.05
    )

    # 抑制明显冲突：厂房 vs 大桥（都偏横向）
    if scores["大桥"] > scores["厂房"]:
        scores["厂房"] *= 0.82
    elif scores["厂房"] > scores["大桥"]:
        scores["大桥"] *= 0.88

    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    label = ranked[0][0]
    second_score = ranked[1][1] if len(ranked) > 1 else 0.0
    total = sum(scores.values()) or 1.0
    top_score = scores[label]
    confidence = round(float(top_score / total), 3)
    margin = (top_score - second_score) / max(top_score, 1e-6)

    if confidence < config.INDUSTRIAL_RECOGNIZE_MIN_CONFIDENCE or margin < 0.08:
        label = config.INDUSTRIAL_SUBJECT_FALLBACK

    return {
        "label": label,
        "confidence": confidence,
        "scores": {k: round(v / total, 3) for k, v in scores.items()},
    }
