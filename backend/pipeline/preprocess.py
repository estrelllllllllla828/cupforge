"""
图像预处理与特征提取管道 (OpenCV)。
"""

import cv2
import numpy as np
from sklearn.cluster import KMeans

import config
from pipeline.expressions import generate_all_expressions
from pipeline.industrial_recognize import recognize_industrial_subject


def load_and_resize(image_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("无法解码图像")
    h, w = img.shape[:2]
    max_dim = max(h, w)
    if max_dim > config.IMAGE_MAX_SIZE:
        scale = config.IMAGE_MAX_SIZE / max_dim
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return img


def center_crop(img: np.ndarray) -> np.ndarray:
    if config.CROP_RATIO >= 1.0:
        return img
    h, w = img.shape[:2]
    ch, cw = int(h * config.CROP_RATIO), int(w * config.CROP_RATIO)
    y0, x0 = (h - ch) // 2, (w - cw) // 2
    return img[y0 : y0 + ch, x0 : x0 + cw]


def denoise_and_enhance(img: np.ndarray) -> np.ndarray:
    filtered = cv2.bilateralFilter(
        img,
        config.BILATERAL_D,
        config.BILATERAL_SIGMA_COLOR,
        config.BILATERAL_SIGMA_SPACE,
    )
    lab = cv2.cvtColor(filtered, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(
        clipLimit=config.CLAHE_CLIP_LIMIT,
        tileGridSize=config.CLAHE_TILE_GRID_SIZE,
    )
    l = clahe.apply(l)
    enhanced = cv2.merge([l, a, b])
    return cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)


def detect_edges(gray: np.ndarray, threshold1: int, threshold2: int) -> np.ndarray:
    return cv2.Canny(gray, threshold1, threshold2)


def clean_contours(edge_img: np.ndarray) -> np.ndarray:
    contours, _ = cv2.findContours(edge_img, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    cleaned = np.zeros_like(edge_img)
    for cnt in contours:
        if cv2.contourArea(cnt) >= config.CONTOUR_MIN_AREA:
            cv2.drawContours(cleaned, [cnt], -1, 255, 1)
    return cleaned


def extract_palette(img: np.ndarray, n_clusters: int | None = None) -> list[dict]:
    n = n_clusters or config.KMEANS_N_CLUSTERS
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    pixels = rgb.reshape(-1, 3).astype(np.float32)

    brightness = pixels.mean(axis=1)
    mask = brightness < config.BACKGROUND_BRIGHTNESS_THRESHOLD
    filtered = pixels[mask]
    if len(filtered) < n:
        filtered = pixels

    kmeans = KMeans(
        n_clusters=n,
        n_init=config.KMEANS_N_INIT,
        max_iter=config.KMEANS_MAX_ITER,
        random_state=42,
    )
    labels = kmeans.fit_predict(filtered)
    centers = kmeans.cluster_centers_.astype(int)
    counts = np.bincount(labels, minlength=n)
    total = counts.sum()

    palette = []
    for i in range(n):
        r, g, b = centers[i]
        palette.append({
            "rgb": [int(r), int(g), int(b)],
            "hex": f"#{r:02x}{g:02x}{b:02x}",
            "ratio": round(counts[i] / total, 3),
        })
    palette.sort(key=lambda c: c["ratio"], reverse=True)
    return palette


def compute_expressions(
    cropped: np.ndarray,
    enhanced: np.ndarray,
    gray: np.ndarray,
    cleaned_edges: np.ndarray,
    palette: list[dict],
    pixel_factor: int | None = None,
) -> dict[str, np.ndarray]:
    return generate_all_expressions(
        cropped, gray, cleaned_edges, palette, pixel_factor
    )


def run_pipeline(
    image_bytes: bytes,
    canny_t1: int | None = None,
    canny_t2: int | None = None,
    pixel_factor: int | None = None,
) -> dict:
    t1 = canny_t1 if canny_t1 is not None else config.CANNY_THRESHOLD1_DEFAULT
    t2 = canny_t2 if canny_t2 is not None else config.CANNY_THRESHOLD2_DEFAULT
    pf = pixel_factor if pixel_factor is not None else config.PIXEL_DOWNSCALE_DEFAULT

    original = load_and_resize(image_bytes)
    cropped = center_crop(original)
    enhanced = denoise_and_enhance(cropped)
    gray = cv2.cvtColor(enhanced, cv2.COLOR_BGR2GRAY)
    edges = detect_edges(gray, t1, t2)
    cleaned = clean_contours(edges)
    palette = extract_palette(cropped)
    expressions = compute_expressions(cropped, enhanced, gray, cleaned, palette, pf)
    detected_subject = recognize_industrial_subject(cropped)

    return {
        "original": cropped,
        "enhanced": enhanced,
        "gray": gray,
        "edges": edges,
        "cleaned_edges": cleaned,
        "palette": palette,
        "expressions": expressions,
        "image_bytes": image_bytes,
        "pixel_factor": pf,
        "detected_subject": detected_subject,
    }


def reprocess_session(
    session: dict,
    canny_t1: int,
    canny_t2: int,
    pixel_factor: int | None = None,
) -> dict:
    """基于已有会话数据，用新参数重算全部形态。"""
    enhanced = session["enhanced"]
    cropped = session["original"]
    gray = cv2.cvtColor(enhanced, cv2.COLOR_BGR2GRAY)
    edges = detect_edges(gray, canny_t1, canny_t2)
    cleaned = clean_contours(edges)
    palette = session["palette"]
    pf = pixel_factor if pixel_factor is not None else session.get("pixel_factor", config.PIXEL_DOWNSCALE_DEFAULT)
    expressions = compute_expressions(cropped, enhanced, gray, cleaned, palette, pf)

    session["gray"] = gray
    session["edges"] = edges
    session["cleaned_edges"] = cleaned
    session["expressions"] = expressions
    session["pixel_factor"] = pf
    return session
