"""
OpenXnet Neuro-Symbolic OS - FastAPI Bridge

Routes that expose kernel OS functionality to the Electron frontend.
Mount this router on the existing FastAPI app.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional

from .schemas import (
    OSStatus,
    OSPhase,
    ProcessInfo,
    ProcessState,
    MemoryStats,
    KernelModuleInfo,
    SymbolGraphStats,
    StimulusRequest,
    SpawnRequest,
    SpawnResponse,
    RebootRequest,
)
from .events import EventBus

_kernel_os = None
_event_bus: Optional[EventBus] = None


def bind_kernel(kernel_os_instance, event_bus: EventBus):
    global _kernel_os, _event_bus
    _kernel_os = kernel_os_instance
    _event_bus = event_bus


def create_os_router() -> APIRouter:
    router = APIRouter(prefix="/v1/os", tags=["kernel-os"])

    @router.get("/status", response_model=OSStatus)
    async def get_status():
        if _kernel_os is None:
            return OSStatus(phase=OSPhase.ERROR)

        kernel = _kernel_os
        mem_stats = MemoryStats()
        graph_stats = SymbolGraphStats()

        if kernel.memory_manager:
            stats = kernel.memory_manager.get_stats()
            mem_stats = MemoryStats(
                heap_used=stats.get("heap_used", 0),
                heap_total=stats.get("heap_total", 0),
                symbol_count=stats.get("symbol_count", 0),
                symbol_store_bytes=stats.get("symbol_store_bytes", 0),
                gc_collections=stats.get("gc_collections", 0),
            )

        if kernel.symbol_graph:
            graph_stats = SymbolGraphStats(
                concepts=kernel.symbol_graph.concept_count,
                relations=kernel.symbol_graph.relation_count,
                rules=kernel.inference_engine.rule_count if kernel.inference_engine else 0,
                active_concepts=kernel.symbol_graph.active_concept_count,
            )

        modules = []
        for name, mod in kernel.loaded_modules.items():
            modules.append(KernelModuleInfo(
                name=name,
                version=mod.get("version", "0.0.0"),
                loaded=True,
                critical=mod.get("critical", False),
            ))

        return OSStatus(
            phase=OSPhase(kernel.phase),
            uptime_ticks=kernel.tick_count,
            version=kernel.version,
            modules_loaded=len(kernel.loaded_modules),
            modules_total=kernel.total_modules,
            processes_active=kernel.scheduler.active_count if kernel.scheduler else 0,
            memory=mem_stats,
            symbol_graph=graph_stats,
            kernel_modules=modules,
        )

    @router.get("/processes", response_model=list[ProcessInfo])
    async def list_processes():
        if _kernel_os is None or _kernel_os.scheduler is None:
            return []

        processes = []
        for proc in _kernel_os.scheduler.list_processes():
            processes.append(ProcessInfo(
                pid=proc.pid,
                name=proc.name,
                process_type=proc.process_type,
                state=ProcessState(proc.state),
                priority=proc.priority,
                memory_usage=proc.memory_usage,
                channels=proc.channels,
                uptime_ticks=proc.uptime_ticks,
            ))
        return processes

    @router.post("/stimulus")
    async def inject_stimulus(req: StimulusRequest):
        if _kernel_os is None:
            raise HTTPException(status_code=503, detail="Kernel OS not running")

        result = await _kernel_os.inject_stimulus(
            stimulus_type=req.stimulus_type,
            payload=req.payload,
            target=req.target_process,
            priority=req.priority,
        )
        if _event_bus:
            _event_bus.emit("stimulus_injected", "api", {
                "type": req.stimulus_type,
                "target": req.target_process,
            })
        return {"status": "accepted", "result": result}

    @router.post("/spawn", response_model=SpawnResponse)
    async def spawn_process(req: SpawnRequest):
        if _kernel_os is None:
            raise HTTPException(status_code=503, detail="Kernel OS not running")

        proc = await _kernel_os.spawn_process(
            template=req.process_template,
            name=req.name,
            args=req.args,
            priority=req.priority,
        )
        if _event_bus:
            _event_bus.emit("process_spawned", "api", {"pid": proc.pid, "name": proc.name})
        return SpawnResponse(
            pid=proc.pid,
            name=proc.name,
            state=ProcessState(proc.state),
        )

    @router.post("/reboot")
    async def reboot_os(req: RebootRequest):
        if _kernel_os is None:
            raise HTTPException(status_code=503, detail="Kernel OS not running")

        if _event_bus:
            _event_bus.emit("reboot_requested", "api", {"mode": req.mode})

        await _kernel_os.reboot(mode=req.mode, preserve_state=req.preserve_state)
        return {"status": "rebooting", "mode": req.mode}

    @router.get("/events")
    async def event_stream():
        if _event_bus is None:
            raise HTTPException(status_code=503, detail="Event bus not initialized")

        return StreamingResponse(
            _event_bus.stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    @router.get("/events/history")
    async def event_history(limit: int = 50, event_type: Optional[str] = None):
        if _event_bus is None:
            return []

        events = _event_bus.get_history(limit=limit, event_type=event_type)
        return [
            {
                "event": e.event_type,
                "source": e.source,
                "payload": e.payload,
                "tick": e.tick,
                "timestamp": e.timestamp,
            }
            for e in events
        ]

    return router
