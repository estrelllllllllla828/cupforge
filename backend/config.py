"""
CupForge 全局配置 — 所有算法阈值与默认参数集中管理。
"""

IMAGE_MAX_SIZE = 1024
CROP_RATIO = 1.0

BILATERAL_D = 9
BILATERAL_SIGMA_COLOR = 75
BILATERAL_SIGMA_SPACE = 75

CLAHE_CLIP_LIMIT = 2.0
CLAHE_TILE_GRID_SIZE = (8, 8)

CANNY_THRESHOLD1_DEFAULT = 50
CANNY_THRESHOLD2_DEFAULT = 150
CANNY_THRESHOLD1_MIN = 10
CANNY_THRESHOLD1_MAX = 200
CANNY_THRESHOLD2_MIN = 50
CANNY_THRESHOLD2_MAX = 400
CANNY_DETAIL_DEFAULT = 25
CANNY_DETAIL_MIN = 0
CANNY_DETAIL_MAX = 100

CONTOUR_MIN_AREA = 30

KMEANS_N_CLUSTERS = 5
KMEANS_N_INIT = 10
KMEANS_MAX_ITER = 300
BACKGROUND_BRIGHTNESS_THRESHOLD = 240

# 工业建筑自动识别（顺序不影响算法，仅用于初始化分数字典）
INDUSTRIAL_SUBJECTS = (
    "厂房",
    "大桥",
    "高楼",
    "起重机",
    "吊车",
    "烟囱",
    "管道",
    "钢架",
    "塔吊",
    "脚手架",
)
# 识别置信度过低时前端可回退的通用标签
INDUSTRIAL_SUBJECT_FALLBACK = "工业建筑"
# 主标签置信度低于此值且与次优差距过小时视为不确定
INDUSTRIAL_RECOGNIZE_MIN_CONFIDENCE = 0.14

# 视觉表现形态
EXPRESSION_FORMS = ("original", "outline", "pixel", "halftone", "silhouette")
EXPRESSION_FORM_DEFAULT = "outline"

EXPRESSION_FORM_LABELS = {
    "original": "原图模式",
    "outline": "纯粹线稿",
    "pixel": "复古像素化",
    "halftone": "报纸半调",
    "silhouette": "高反差剪影",
}

PIXEL_DOWNSCALE_DEFAULT = 8
PIXEL_DOWNSCALE_MIN = 2
PIXEL_DOWNSCALE_MAX = 32

HALFTONE_DOT_SPACING = 6
HALFTONE_MAX_RADIUS = 4
HALFTONE_BG_BGR = (245, 245, 240)
HALFTONE_INK_BGR = (40, 40, 40)

SOLID_SILHOUETTE_MORPH_KERNEL_SIZE = 7
SOLID_SILHOUETTE_BG_BGR = (245, 245, 240)
SOLID_SILHOUETTE_FILL_BGR = (0, 0, 0)

OUTLINE_LINE_THICKNESS_DEFAULT = 2
OUTLINE_LINE_THICKNESS_MIN = 1
OUTLINE_LINE_THICKNESS_MAX = 8

SAMPLE_MIN_SIZE = 20
SAMPLE_SHAPES = ("rect", "circle", "triangle", "diamond", "trapezoid")
SAMPLE_SHAPE_LABELS = {
    "rect": "矩形",
    "circle": "圆形",
    "triangle": "三角形",
    "diamond": "菱形",
    "trapezoid": "梯形",
}

TILE_MODES = (
    "grid", "mirror_h", "mirror_v", "kaleidoscope", "offset_brick",
    "glide_reflection", "radial_4way", "scale_gradient",
)
TILE_MODE_LABELS = {
    "grid": "普通平铺",
    "mirror_h": "水平镜像",
    "mirror_v": "垂直镜像",
    "kaleidoscope": "旋转万花筒",
    "offset_brick": "错位砖墙",
    "glide_reflection": "移步互换",
    "radial_4way": "四轴中心对称",
    "scale_gradient": "比例渐变",
}

KALEIDOSCOPE_ANGLES = (60, 90, 120)
OFFSET_BRICK_RATIO = 0.5
SCALE_GRADIENT_MIN = 0.35
SCALE_GRADIENT_DIRECTIONS = ("vertical", "horizontal")
SCALE_GRADIENT_DIRECTION_LABELS = {
    "vertical": "垂直方向（上→下）",
    "horizontal": "水平方向（左→右）",
}
SCALE_GRADIENT_DIRECTION_DEFAULT = "vertical"
SAMPLE_BOX_RATIO_DEFAULT = 0.25

# 杯型捏制（回转体网格）
CUP_CENTER_X = 280.0
CUP_BASE_HEIGHT = 350.0
CUP_WALL_THICKNESS_DEFAULT = 12
CUP_WALL_THICKNESS_MIN = 4
CUP_WALL_THICKNESS_MAX = 40
CUP_HEIGHT_DEFAULT = 350
CUP_HEIGHT_MIN = 220
CUP_HEIGHT_MAX = 750
CUP_REVOLVE_SEGMENTS = 120
CUP_PROFILE_SAMPLES = 180

CUP_SHAPE_PRESETS = {
    "straight": {
        "label": "直杯",
        # 微收口的直筒饮杯：杯口略宽，杯底略窄
        "points": [(200, 80), (203, 190), (206, 300), (209, 410), (212, 510)],
    },
    "mug": {
        "label": "笔筒",
        # 矮一些的竖直圆柱，上下口径几乎一致
        "points": [(198, 80), (198, 150), (198, 230), (199, 300), (200, 360)],
    },
    "tea": {
        "label": "茶杯",
        # 扁圆弧茶碗：敞口宽、杯身呈弧形外鼓、收成小圆底，整体低矮
        "points": [(180, 80), (184, 120), (198, 165), (222, 210), (250, 250)],
    },
    "goblet": {
        "label": "酒杯",
        # 高脚酒杯：上部杯肚 + 细杯脚 + 圆盘底座
        "points": [(222, 80), (202, 150), (234, 230), (268, 310), (268, 400), (260, 470), (208, 540)],
    },
    "vase": {
        "label": "花瓶",
        # 花瓶：外扩瓶口、细颈、鼓腹、收窄底
        "points": [(216, 80), (236, 150), (198, 230), (188, 320), (216, 420), (230, 510)],
    },
}
CUP_SHAPE_DEFAULT = "straight"

CUP_MATERIAL_PRESETS = {
    "metal": {"label": "金属", "rgba": [0.78, 0.79, 0.82, 1.0], "roughness": 0.26, "metalness": 0.92},
    "wood": {"label": "木质", "rgba": [0.52, 0.34, 0.2, 1.0], "roughness": 0.82, "metalness": 0.04},
    "glass": {"label": "玻璃", "rgba": [0.72, 0.86, 0.94, 0.42], "roughness": 0.06, "metalness": 0.08},
    "ceramic": {"label": "陶瓷", "rgba": [0.94, 0.93, 0.88, 1.0], "roughness": 0.42, "metalness": 0.06},
    "matte": {"label": "磨砂", "rgba": [0.38, 0.4, 0.44, 1.0], "roughness": 0.94, "metalness": 0.03},
}
CUP_MATERIAL_DEFAULT = "ceramic"

API_HOST = "0.0.0.0"
API_PORT = 8000
UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"
