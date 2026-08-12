#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Run only the Quest/VR gateway routes for headset validation."""

from __future__ import annotations

import argparse
import os
import sys
import tempfile
from pathlib import Path

from fastapi import FastAPI


REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

os.environ.setdefault("OPENXNET_USER_DATA_DIR", tempfile.mkdtemp(prefix="openxnet-vr-live-"))
os.environ.setdefault("OPENXNET_WORLDGEN_FEATURE_ENABLED", "0")

from py.routes.vr import router  # noqa: E402


app = FastAPI()
app.include_router(router)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the OpenXnet Quest/VR route gateway.")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=3456)
    args = parser.parse_args()

    import uvicorn

    print(f"REAL_PORT_FOUND:{args.port}", flush=True)
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
