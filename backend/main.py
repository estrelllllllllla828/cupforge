"""
CupForge FastAPI 服务入口。
"""

import os
import uuid
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import config
from pipeline.cup_mesh import build_cup_mesh, mesh_to_obj_bytes, mesh_to_stl_bytes
from pipeline.preprocess import run_pipeline, reprocess_session
from utils.encoding import img_to_data_uri

app = FastAPI(title="CupForge API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Path(config.UPLOAD_DIR).mkdir(exist_ok=True)
Path(config.OUTPUT_DIR).mkdir(exist_ok=True)

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

_sessions: dict[str, dict] = {}


class ProcessParams(BaseModel):
    canny_t1: int = Field(default=config.CANNY_THRESHOLD1_DEFAULT, ge=config.CANNY_THRESHOLD1_MIN, le=config.CANNY_THRESHOLD1_MAX)
    canny_t2: int = Field(default=config.CANNY_THRESHOLD2_DEFAULT, ge=config.CANNY_THRESHOLD2_MIN, le=config.CANNY_THRESHOLD2_MAX)
    pixel_downscale_factor: int = Field(
        default=config.PIXEL_DOWNSCALE_DEFAULT,
        ge=config.PIXEL_DOWNSCALE_MIN,
        le=config.PIXEL_DOWNSCALE_MAX,
    )


class CupMeshParams(BaseModel):
    control_points: list[tuple[float, float]] = Field(min_length=3)
    center_x: float = Field(default=config.CUP_CENTER_X)
    wall_thickness: float = Field(
        default=config.CUP_WALL_THICKNESS_DEFAULT,
        ge=config.CUP_WALL_THICKNESS_MIN,
        le=config.CUP_WALL_THICKNESS_MAX,
    )
    cup_height: float = Field(
        default=config.CUP_HEIGHT_DEFAULT,
        ge=config.CUP_HEIGHT_MIN,
        le=config.CUP_HEIGHT_MAX,
    )


def _expressions_to_response(expressions: dict) -> dict[str, str]:
    return {k: img_to_data_uri(v) for k, v in expressions.items()}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/config")
def get_config():
    return {
        "canny": {
            "t1_default": config.CANNY_THRESHOLD1_DEFAULT,
            "t2_default": config.CANNY_THRESHOLD2_DEFAULT,
            "t1_range": [config.CANNY_THRESHOLD1_MIN, config.CANNY_THRESHOLD1_MAX],
            "t2_range": [config.CANNY_THRESHOLD2_MIN, config.CANNY_THRESHOLD2_MAX],
            "detail_default": config.CANNY_DETAIL_DEFAULT,
            "detail_min": config.CANNY_DETAIL_MIN,
            "detail_max": config.CANNY_DETAIL_MAX,
        },
        "expression_forms": list(config.EXPRESSION_FORMS),
        "expression_form_labels": config.EXPRESSION_FORM_LABELS,
        "expression_form_default": config.EXPRESSION_FORM_DEFAULT,
        "tiling_modes": list(config.TILE_MODES),
        "tiling_mode_labels": config.TILE_MODE_LABELS,
        "kaleidoscope_angles": list(config.KALEIDOSCOPE_ANGLES),
        "sample_box_ratio_default": config.SAMPLE_BOX_RATIO_DEFAULT,
        "offset_brick_ratio": config.OFFSET_BRICK_RATIO,
        "scale_gradient_min": config.SCALE_GRADIENT_MIN,
        "scale_gradient_directions": list(config.SCALE_GRADIENT_DIRECTIONS),
        "scale_gradient_direction_labels": config.SCALE_GRADIENT_DIRECTION_LABELS,
        "scale_gradient_direction_default": config.SCALE_GRADIENT_DIRECTION_DEFAULT,
        "outline_line_thickness": {
            "default": config.OUTLINE_LINE_THICKNESS_DEFAULT,
            "min": config.OUTLINE_LINE_THICKNESS_MIN,
            "max": config.OUTLINE_LINE_THICKNESS_MAX,
        },
        "pixel_downscale": {
            "default": config.PIXEL_DOWNSCALE_DEFAULT,
            "min": config.PIXEL_DOWNSCALE_MIN,
            "max": config.PIXEL_DOWNSCALE_MAX,
        },
        "sample_shapes": list(config.SAMPLE_SHAPES),
        "sample_shape_labels": config.SAMPLE_SHAPE_LABELS,
        "sample_min_size": config.SAMPLE_MIN_SIZE,
        "cup": {
            "center_x": config.CUP_CENTER_X,
            "base_height": config.CUP_BASE_HEIGHT,
            "wall_thickness": {
                "default": config.CUP_WALL_THICKNESS_DEFAULT,
                "min": config.CUP_WALL_THICKNESS_MIN,
                "max": config.CUP_WALL_THICKNESS_MAX,
            },
            "height": {
                "default": config.CUP_HEIGHT_DEFAULT,
                "min": config.CUP_HEIGHT_MIN,
                "max": config.CUP_HEIGHT_MAX,
            },
            "shape_presets": {
                k: {"label": v["label"], "points": v["points"]}
                for k, v in config.CUP_SHAPE_PRESETS.items()
            },
            "shape_default": config.CUP_SHAPE_DEFAULT,
            "material_presets": {
                k: {
                    "label": v["label"],
                    "rgba": v["rgba"],
                    "roughness": v.get("roughness", 0.5),
                    "metalness": v.get("metalness", 0.1),
                }
                for k, v in config.CUP_MATERIAL_PRESETS.items()
            },
            "material_default": config.CUP_MATERIAL_DEFAULT,
        },
    }


@app.post("/api/upload")
async def upload_image(
    file: UploadFile = File(...),
    canny_t1: int = config.CANNY_THRESHOLD1_DEFAULT,
    canny_t2: int = config.CANNY_THRESHOLD2_DEFAULT,
    pixel_downscale_factor: int = config.PIXEL_DOWNSCALE_DEFAULT,
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "仅支持图像文件")

    data = await file.read()
    try:
        result = run_pipeline(data, canny_t1, canny_t2, pixel_downscale_factor)
    except ValueError as e:
        raise HTTPException(400, str(e))

    session_id = str(uuid.uuid4())
    _sessions[session_id] = result

    return {
        "session_id": session_id,
        "original": img_to_data_uri(result["original"]),
        "palette": result["palette"],
        "image_size": {"w": result["original"].shape[1], "h": result["original"].shape[0]},
        "expression_forms": _expressions_to_response(result["expressions"]),
        "default_form": config.EXPRESSION_FORM_DEFAULT,
        "detected_subject": result["detected_subject"],
    }


@app.post("/api/reprocess")
async def reprocess(params: ProcessParams, session_id: str):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(404, "会话不存在，请重新上传")

    reprocess_session(
        session,
        params.canny_t1,
        params.canny_t2,
        params.pixel_downscale_factor,
    )

    return {
        "expression_forms": _expressions_to_response(session["expressions"]),
    }


@app.post("/api/cup/export/obj")
def export_cup_obj(params: CupMeshParams):
    try:
        mesh = build_cup_mesh(
            params.control_points,
            center_x=params.center_x,
            wall_thickness=params.wall_thickness,
            cup_height=params.cup_height,
        )
        data = mesh_to_obj_bytes(mesh)
    except Exception as e:
        raise HTTPException(400, f"杯型网格生成失败: {e}") from e
    return Response(content=data, media_type="model/obj", headers={
        "Content-Disposition": 'attachment; filename="cupforge_cup.obj"',
    })


@app.post("/api/cup/export/stl")
def export_cup_stl(params: CupMeshParams):
    try:
        mesh = build_cup_mesh(
            params.control_points,
            center_x=params.center_x,
            wall_thickness=params.wall_thickness,
            cup_height=params.cup_height,
        )
        data = mesh_to_stl_bytes(mesh)
    except Exception as e:
        raise HTTPException(400, f"杯型网格生成失败: {e}") from e
    return Response(content=data, media_type="model/stl", headers={
        "Content-Disposition": 'attachment; filename="cupforge_cup.stl"',
    })


if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", config.API_PORT))
    uvicorn.run("main:app", host=config.API_HOST, port=port, reload=True)
