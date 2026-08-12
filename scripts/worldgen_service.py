#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""Small HTTP wrapper for running WorldGen outside the OpenXnet desktop process.

Run this script inside the Python environment that has ZiYang-xie/WorldGen and
GPU dependencies installed, then set OPENXNET_WORLDGEN_API_URL in the desktop
gateway to this service URL.
"""

from __future__ import annotations

import base64
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any, Dict

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from py.worldgen_worker import generate_worldgen_asset


class WorldGenGenerateRequest(BaseModel):
    prompt: str
    scene_id: str = ""
    mode: str = "t2s"
    return_mesh: bool = True
    use_sharp: bool = False
    inpaint_bg: bool = False
    resolution: int = 1600
    low_vram: bool | None = None
    worldgen_repo: str = ""
    device: str = "cuda"
    lora_path: str = ""
    metadata: Dict[str, Any] = Field(default_factory=dict)


app = FastAPI(title="OpenXnet WorldGen Service", version="0.1.0")


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"success": True, "service": "openxnet-worldgen", "ready": True}


@app.post("/v1/worldgen/generate")
def generate(req: WorldGenGenerateRequest) -> Dict[str, Any]:
    with TemporaryDirectory(prefix="openxnet-worldgen-") as tmp:
        payload = req.dict()
        payload["output_dir"] = tmp
        try:
            result = generate_worldgen_asset(payload)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)[:2000]) from exc

        mesh_path = Path(result.get("mesh_path") or "")
        preview_path = Path(result.get("preview_path") or "")
        if not mesh_path.is_file():
            raise HTTPException(status_code=500, detail="WorldGen did not produce scene.glb")

        response = {
            **result,
            "mesh_glb_base64": base64.b64encode(mesh_path.read_bytes()).decode("ascii"),
        }
        if preview_path.is_file():
            response["preview_png_base64"] = base64.b64encode(preview_path.read_bytes()).decode("ascii")
        return response


if __name__ == "__main__":
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser(description="OpenXnet WorldGen HTTP service")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=7869)
    args = parser.parse_args()
    uvicorn.run(app, host=args.host, port=args.port)
