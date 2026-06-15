"""
视觉表现形态 (Visual Expression Forms)。
"""

import cv2
import numpy as np

import config


def _snap_pixels_to_palette(img_bgr: np.ndarray, palette: list[dict]) -> np.ndarray:
    if not palette:
        return img_bgr
    centers = np.array(
        [(c["rgb"][2], c["rgb"][1], c["rgb"][0]) for c in palette],
        dtype=np.float32,
    )
    h, w = img_bgr.shape[:2]
    pixels = img_bgr.reshape(-1, 3).astype(np.float32)
    dists = np.linalg.norm(pixels[:, None, :] - centers[None, :, :], axis=2)
    labels = np.argmin(dists, axis=1)
    snapped = centers[labels].astype(np.uint8).reshape(h, w, 3)
    return snapped


def apply_original(img_bgr: np.ndarray) -> np.ndarray:
    """原图模式：直接使用预处理后的彩色原图。"""
    return img_bgr.copy()


def apply_outline(cleaned_edges: np.ndarray) -> np.ndarray:
    result = np.zeros((*cleaned_edges.shape, 3), dtype=np.uint8)
    result[cleaned_edges > 0] = (255, 255, 255)
    return result


def apply_pixel(img_bgr: np.ndarray, palette: list[dict], factor: int | None = None) -> np.ndarray:
    downscale = factor if factor is not None else config.PIXEL_DOWNSCALE_DEFAULT
    downscale = max(config.PIXEL_DOWNSCALE_MIN, min(config.PIXEL_DOWNSCALE_MAX, downscale))
    h, w = img_bgr.shape[:2]
    small = cv2.resize(img_bgr, (max(1, w // downscale), max(1, h // downscale)), interpolation=cv2.INTER_NEAREST)
    snapped = _snap_pixels_to_palette(small, palette)
    return cv2.resize(snapped, (w, h), interpolation=cv2.INTER_NEAREST)


def apply_halftone(gray: np.ndarray) -> np.ndarray:
    h, w = gray.shape
    result = np.full((h, w, 3), config.HALFTONE_BG_BGR, dtype=np.uint8)
    spacing = config.HALFTONE_DOT_SPACING
    max_r = config.HALFTONE_MAX_RADIUS
    ink = config.HALFTONE_INK_BGR
    for y in range(spacing // 2, h, spacing):
        for x in range(spacing // 2, w, spacing):
            region = gray[max(0, y - spacing):y + spacing, max(0, x - spacing):x + spacing]
            brightness = 255 - int(region.mean())
            radius = max(0, int((brightness / 255.0) * max_r))
            if radius > 0:
                cv2.circle(result, (x, y), radius, ink, -1)
    return result


def apply_solid_silhouette(gray: np.ndarray) -> np.ndarray:
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    ksize = config.SOLID_SILHOUETTE_MORPH_KERNEL_SIZE
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (ksize, ksize))
    closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    result = np.full((*gray.shape, 3), config.SOLID_SILHOUETTE_BG_BGR, dtype=np.uint8)
    result[closed > 0] = config.SOLID_SILHOUETTE_FILL_BGR
    return result


def generate_all_expressions(
    img_bgr: np.ndarray,
    gray: np.ndarray,
    cleaned_edges: np.ndarray,
    palette: list[dict],
    pixel_factor: int | None = None,
) -> dict[str, np.ndarray]:
    return {
        "original": apply_original(img_bgr),
        "outline": apply_outline(cleaned_edges),
        "pixel": apply_pixel(img_bgr, palette, pixel_factor),
        "halftone": apply_halftone(gray),
        "silhouette": apply_solid_silhouette(gray),
    }
