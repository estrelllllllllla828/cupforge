"""图像编码/解码工具。"""

import base64
import cv2
import numpy as np


def img_to_base64(img: np.ndarray, fmt: str = ".png") -> str:
    _, buf = cv2.imencode(fmt, img)
    return base64.b64encode(buf).decode("utf-8")


def img_to_data_uri(img: np.ndarray, fmt: str = ".png") -> str:
    mime = "image/png" if fmt == ".png" else "image/jpeg"
    b64 = img_to_base64(img, fmt)
    return f"data:{mime};base64,{b64}"
