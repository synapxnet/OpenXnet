"""
OpenXnet Neuro-Symbolic OS - API Layer

Provides FastAPI integration for the kernel OS, exposing process management,
stimulus injection, and event streaming to the Electron frontend.
"""

from .bridge import create_os_router
from .events import EventBus
from .schemas import OSStatus, ProcessInfo, StimulusRequest, SpawnRequest

__all__ = [
    "create_os_router",
    "EventBus",
    "OSStatus",
    "ProcessInfo",
    "StimulusRequest",
    "SpawnRequest",
]
