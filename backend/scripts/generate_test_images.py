"""
生成合成工业测试图片，用于 Demo 功能验证。
运行: python scripts/generate_test_images.py
"""

from pathlib import Path

import cv2
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
TEST_DIR = PROJECT_ROOT / "test_library"


def draw_crane(i: int) -> np.ndarray:
    img = np.full((512, 512, 3), (180, 175, 170), dtype=np.uint8)
    cx = 256 + (i % 5) * 10 - 20
    cv2.line(img, (cx, 450), (cx, 100), (60, 60, 65), 8)
    cv2.line(img, (cx, 150), (cx + 180, 200), (60, 60, 65), 6)
    for y in range(200, 450, 40):
        cv2.line(img, (cx - 30, y), (cx + 30, y), (80, 80, 85), 2)
    cv2.circle(img, (cx + 180, 200), 15, (100, 100, 105), -1)
    return img


def draw_factory(i: int) -> np.ndarray:
    img = np.full((512, 512, 3), (200, 195, 190), dtype=np.uint8)
    base_y = 350 + (i % 3) * 10
    cv2.rectangle(img, (80, base_y), (430, 450), (90, 85, 80), -1)
    cv2.rectangle(img, (100, base_y - 80), (200, base_y), (110, 105, 100), -1)
    cv2.rectangle(img, (250, base_y - 120), (400, base_y), (100, 95, 90), -1)
    for x in range(120, 190, 30):
        cv2.rectangle(img, (x, base_y - 60), (x + 15, base_y - 30), (60, 80, 120), -1)
    cv2.rectangle(img, (380, base_y - 150), (400, base_y - 80), (70, 70, 75), -1)
    return img


def draw_skyscraper(i: int) -> np.ndarray:
    img = np.full((512, 512, 3), (190, 195, 200), dtype=np.uint8)
    w = 80 + (i % 4) * 15
    x0 = 256 - w // 2
    cv2.rectangle(img, (x0, 80), (x0 + w, 450), (70, 75, 80), -1)
    for y in range(100, 430, 25):
        for x in range(x0 + 10, x0 + w - 10, 18):
            cv2.rectangle(img, (x, y), (x + 10, y + 15), (120, 130, 140), -1)
    return img


def draw_bridge(i: int) -> np.ndarray:
    img = np.full((512, 512, 3), (175, 180, 185), dtype=np.uint8)
    offset = (i % 5) * 8
    pts = np.array([[50, 350], [256, 150 + offset], [462, 350]], np.int32)
    cv2.polylines(img, [pts], False, (65, 70, 75), 4)
    for x in range(100, 420, 50):
        t = (x - 50) / 412
        y_top = 150 + offset
        y = int(350 - (350 - y_top) * 4 * t * (1 - t))
        cv2.line(img, (x, y), (x, 350), (80, 85, 90), 2)
    cv2.line(img, (50, 350), (462, 350), (90, 90, 95), 6)
    return img


CATEGORIES = {
    "crane": draw_crane,
    "factory": draw_factory,
    "skyscraper": draw_skyscraper,
    "bridge": draw_bridge,
}


def main():
    for cat, draw_fn in CATEGORIES.items():
        out_dir = TEST_DIR / cat
        out_dir.mkdir(parents=True, exist_ok=True)
        for i in range(1, 11):
            img = draw_fn(i)
            path = out_dir / f"{cat}_{i:02d}.png"
            cv2.imwrite(str(path), img)
            print(f"  生成 {path}")

    print(f"\n完成。共生成 {len(CATEGORIES) * 10} 张测试图片。")


if __name__ == "__main__":
    main()
