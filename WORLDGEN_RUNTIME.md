# OpenXnet WorldGen Runtime

OpenXnet can already deliver generated GLB scenes to Quest. The WorldGen scene
generation feature is disabled by default so the Quest/VRM mainline remains
quiet and predictable. Real WorldGen generation is optional and should run
outside the normal desktop runtime because it pulls in Torch, FLUX, DA-2,
pytorch3d, and GPU-specific dependencies.

## Modes

- `placeholder`: default. Produces a small GLB so Quest loading remains testable.
- `subprocess`: runs `py/worldgen_worker.py` with a separate Python executable.
- `http`: calls an external WorldGen service at `OPENXNET_WORLDGEN_API_URL`.
- `local`: imports `worldgen` inside the OpenXnet desktop Python process. Use only
  when the desktop env already has all WorldGen dependencies.

## Feature Flag

By default, chat prompts such as "生成一个场景" do not start WorldGen, the
WebSocket does not advertise `scene.generate`, and `POST /v1/vr/worldgen/scenes`
returns `WORLDGEN_FEATURE_DISABLED`.

To enable the scene-generation feature with the lightweight placeholder backend:

```powershell
$env:OPENXNET_WORLDGEN_FEATURE_ENABLED="1"
```

To enable real WorldGen generation, also set:

```powershell
$env:OPENXNET_WORLDGEN_ENABLED="1"
```

## Recommended GPU Setup

```powershell
git clone --recursive https://github.com/ZiYang-xie/WorldGen.git E:\openxnet-source\_references\WorldGen
conda create -n worldgen python=3.11
conda activate worldgen
pip install torch torchvision
pip install E:\openxnet-source\_references\WorldGen
pip install git+https://github.com/EnVision-Research/DA-2.git#subdirectory=src --no-deps
pip install git+https://github.com/facebookresearch/pytorch3d.git --no-build-isolation
huggingface-cli login
```

WorldGen currently depends on Linux-oriented GPU wheels in some paths. If native
Windows installation is painful, run WorldGen in WSL2/Linux or on a GPU server
and use the HTTP mode below.

## Subprocess Mode

```powershell
$env:OPENXNET_WORLDGEN_FEATURE_ENABLED="1"
$env:OPENXNET_WORLDGEN_ENABLED="1"
$env:OPENXNET_WORLDGEN_BACKEND="subprocess"
$env:OPENXNET_WORLDGEN_PYTHON="C:\Users\Administrator\miniconda3\envs\worldgen\python.exe"
$env:OPENXNET_WORLDGEN_REPO="E:\openxnet-source\_references\WorldGen"
$env:OPENXNET_WORLDGEN_TIMEOUT_SECONDS="1200"
$env:OPENXNET_WORLDGEN_DEVICE="cuda"
```

Then start the OpenXnet desktop gateway normally. `GET /v1/vr/status` includes a
`worldgen` block showing the selected backend and whether the worker exists.

## HTTP Mode

Run this in the WorldGen Python environment, on the GPU machine:

```powershell
cd E:\openxnet-source\openxnet-desktop
python scripts\worldgen_service.py --host 0.0.0.0 --port 7869
```

Configure the desktop gateway:

```powershell
$env:OPENXNET_WORLDGEN_FEATURE_ENABLED="1"
$env:OPENXNET_WORLDGEN_ENABLED="1"
$env:OPENXNET_WORLDGEN_BACKEND="http"
$env:OPENXNET_WORLDGEN_API_URL="http://127.0.0.1:7869"
```

The service exposes:

- `GET /health`
- `POST /v1/worldgen/generate`

## Quest Flow

When a user asks VRM/OpenXnet to generate a scene, the desktop gateway creates a
WorldGen job, writes `scene.glb` and `manifest.json`, then sends `scene.generated`
over the Quest WebSocket. Quest downloads the GLB and imports it with UniGLTF.

If Quest pauses before generation finishes, the gateway replays the latest ready
scene on the next `session.ready` event for a short window.
