"""
OpenXnet Neuro-Symbolic OS - API Response Schemas

Pydantic models for the OS API endpoints.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum


class ProcessState(str, Enum):
    READY = "ready"
    RUNNING = "running"
    BLOCKED = "blocked"
    SUSPENDED = "suspended"
    TERMINATED = "terminated"


class OSPhase(str, Enum):
    BOOTING = "booting"
    KERNEL_LOAD = "kernel_load"
    SYMBOL_MOUNT = "symbol_mount"
    PROCESS_SPAWN = "process_spawn"
    READY = "ready"
    SHUTTING_DOWN = "shutting_down"
    ERROR = "error"


class ProcessInfo(BaseModel):
    pid: int
    name: str
    process_type: str
    state: ProcessState
    priority: int = 0
    memory_usage: int = 0
    channels: List[str] = Field(default_factory=list)
    uptime_ticks: int = 0


class MemoryStats(BaseModel):
    heap_used: int = 0
    heap_total: int = 0
    symbol_count: int = 0
    symbol_store_bytes: int = 0
    gc_collections: int = 0


class KernelModuleInfo(BaseModel):
    name: str
    version: str
    loaded: bool = False
    critical: bool = False


class SymbolGraphStats(BaseModel):
    concepts: int = 0
    relations: int = 0
    rules: int = 0
    active_concepts: int = 0


class OSStatus(BaseModel):
    phase: OSPhase
    uptime_ticks: int = 0
    version: str = "0.1.0"
    modules_loaded: int = 0
    modules_total: int = 0
    processes_active: int = 0
    memory: MemoryStats = Field(default_factory=MemoryStats)
    symbol_graph: SymbolGraphStats = Field(default_factory=SymbolGraphStats)
    kernel_modules: List[KernelModuleInfo] = Field(default_factory=list)


class StimulusRequest(BaseModel):
    stimulus_type: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    target_process: Optional[str] = None
    priority: int = 5


class SpawnRequest(BaseModel):
    process_template: str
    name: Optional[str] = None
    args: Dict[str, Any] = Field(default_factory=dict)
    priority: int = 5


class SpawnResponse(BaseModel):
    pid: int
    name: str
    state: ProcessState


class RebootRequest(BaseModel):
    mode: str = "soft"
    preserve_state: bool = False


class OSEvent(BaseModel):
    event_type: str
    source: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    tick: int = 0
