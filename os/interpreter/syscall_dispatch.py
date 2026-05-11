"""
OpenXnet Neuro-Symbolic OS Kernel - System Call Dispatch

Maps system call names to handler functions with parameter validation
and privilege level enforcement.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Optional
import time


# Privilege levels (lower = more privileged)
PRIVILEGE_KERNEL: int = 0
PRIVILEGE_DRIVER: int = 1
PRIVILEGE_SERVICE: int = 2
PRIVILEGE_USER: int = 3


@dataclass
class SyscallEntry:
    """Registry entry for a system call."""
    name: str
    handler: Callable[..., Any]
    privilege_level: int = PRIVILEGE_USER
    param_spec: list[str] = field(default_factory=list)  # Expected parameter names
    description: str = ""


@dataclass
class SyscallResult:
    """Result of a system call invocation."""
    success: bool
    value: Any = None
    error: Optional[str] = None


class SyscallDispatcher:
    """System call dispatch table and invocation engine.

    Provides a registry of named syscalls with privilege-based access control.
    Each syscall is mapped to a handler function that receives validated
    arguments and returns a SyscallResult.
    """

    def __init__(self, memory_manager=None, ipc_bus=None, scheduler=None):
        self._registry: dict[str, SyscallEntry] = {}
        self._memory = memory_manager
        self._ipc = ipc_bus
        self._scheduler = scheduler
        self._process_privileges: dict[int, int] = {}  # pid -> privilege level
        self._call_log: list[dict[str, Any]] = []
        self._register_builtins()

    def register(
        self,
        name: str,
        handler: Callable[..., Any],
        privilege_level: int = PRIVILEGE_USER,
        param_spec: Optional[list[str]] = None,
        description: str = "",
    ) -> None:
        """Register a syscall handler.

        Raises ValueError if the name is already registered.
        """
        if name in self._registry:
            raise ValueError(f"Syscall '{name}' is already registered")
        self._registry[name] = SyscallEntry(
            name=name,
            handler=handler,
            privilege_level=privilege_level,
            param_spec=param_spec or [],
            description=description,
        )

    def dispatch(self, name: str, args: dict[str, Any], caller_pid: int = 0) -> SyscallResult:
        """Dispatch a system call by name.

        Validates privilege level, checks parameters, then invokes the handler.
        """
        entry = self._registry.get(name)
        if entry is None:
            return SyscallResult(success=False, error=f"Unknown syscall: {name}")

        # Privilege check
        caller_privilege = self._process_privileges.get(caller_pid, PRIVILEGE_USER)
        if caller_privilege > entry.privilege_level:
            return SyscallResult(
                success=False,
                error=f"Insufficient privilege for '{name}': requires level {entry.privilege_level}, caller has {caller_privilege}",
            )

        # Parameter validation
        if entry.param_spec:
            missing = [p for p in entry.param_spec if p not in args]
            if missing:
                return SyscallResult(
                    success=False,
                    error=f"Missing parameters for '{name}': {missing}",
                )

        # Invoke
        try:
            result = entry.handler(args, caller_pid)
            self._call_log.append({
                "name": name,
                "caller_pid": caller_pid,
                "success": True,
                "timestamp": time.time(),
            })
            return SyscallResult(success=True, value=result)
        except Exception as exc:
            self._call_log.append({
                "name": name,
                "caller_pid": caller_pid,
                "success": False,
                "error": str(exc),
                "timestamp": time.time(),
            })
            return SyscallResult(success=False, error=str(exc))

    def set_privilege(self, pid: int, level: int) -> None:
        """Set the privilege level of a process."""
        self._process_privileges[pid] = max(0, min(3, level))

    def list_syscalls(self) -> list[dict[str, Any]]:
        """List all registered syscalls with their metadata."""
        return [
            {
                "name": entry.name,
                "privilege_level": entry.privilege_level,
                "params": entry.param_spec,
                "description": entry.description,
            }
            for entry in self._registry.values()
        ]

    def get_call_log(self, limit: int = 50) -> list[dict[str, Any]]:
        """Return recent syscall invocations."""
        return self._call_log[-limit:]

    # -------------------------------------------------------------------------
    # Built-in Syscalls
    # -------------------------------------------------------------------------

    def _register_builtins(self) -> None:
        """Register the built-in kernel syscalls."""
        self.register("mem_alloc", self._syscall_mem_alloc, PRIVILEGE_SERVICE,
                      ["region", "size"], "Allocate memory in a region")
        self.register("mem_free", self._syscall_mem_free, PRIVILEGE_SERVICE,
                      ["address"], "Free a memory allocation")
        self.register("chan_create", self._syscall_chan_create, PRIVILEGE_SERVICE,
                      ["name", "type"], "Create an IPC channel")
        self.register("chan_send", self._syscall_chan_send, PRIVILEGE_USER,
                      ["channel", "payload"], "Send a message on a channel")
        self.register("chan_recv", self._syscall_chan_recv, PRIVILEGE_USER,
                      ["channel"], "Receive from a channel")
        self.register("sched_yield", self._syscall_sched_yield, PRIVILEGE_USER,
                      [], "Yield current time slice")
        self.register("sched_set_priority", self._syscall_sched_set_priority, PRIVILEGE_SERVICE,
                      ["pid", "priority"], "Set process priority")
        self.register("emit_signal", self._syscall_emit_signal, PRIVILEGE_USER,
                      ["signal_name"], "Emit a signal")
        self.register("spawn_process", self._syscall_spawn_process, PRIVILEGE_SERVICE,
                      ["name"], "Spawn a new process")
        self.register("get_time", self._syscall_get_time, PRIVILEGE_USER,
                      [], "Get current tick time")
        self.register("log", self._syscall_log, PRIVILEGE_USER,
                      ["message"], "Log a message")

    def _syscall_mem_alloc(self, args: dict[str, Any], caller_pid: int) -> Any:
        if self._memory is None:
            raise RuntimeError("Memory manager not available")
        from .memory_manager import MemoryRegion
        region_name = args["region"]
        if isinstance(region_name, str):
            region = MemoryRegion[region_name.upper()]
        else:
            region = region_name
        return self._memory.alloc(region, int(args["size"]))

    def _syscall_mem_free(self, args: dict[str, Any], caller_pid: int) -> Any:
        if self._memory is None:
            raise RuntimeError("Memory manager not available")
        return self._memory.free(int(args["address"]))

    def _syscall_chan_create(self, args: dict[str, Any], caller_pid: int) -> Any:
        if self._ipc is None:
            raise RuntimeError("IPC bus not available")
        from .ipc_bus import ChannelType
        chan_type_str = args.get("type", "DUPLEX")
        if isinstance(chan_type_str, str):
            chan_type = ChannelType[chan_type_str.upper()]
        else:
            chan_type = chan_type_str
        capacity = int(args.get("capacity", 64))
        ch = self._ipc.create_channel(args["name"], chan_type, capacity, caller_pid)
        return ch.name

    def _syscall_chan_send(self, args: dict[str, Any], caller_pid: int) -> Any:
        if self._ipc is None:
            raise RuntimeError("IPC bus not available")
        return self._ipc.send(args["channel"], args["payload"], caller_pid)

    def _syscall_chan_recv(self, args: dict[str, Any], caller_pid: int) -> Any:
        if self._ipc is None:
            raise RuntimeError("IPC bus not available")
        msg = self._ipc.recv(args["channel"], caller_pid)
        if msg is None:
            return None
        return {"sender": msg.sender, "payload": msg.payload, "timestamp": msg.timestamp}

    def _syscall_sched_yield(self, args: dict[str, Any], caller_pid: int) -> Any:
        if self._scheduler is None:
            raise RuntimeError("Scheduler not available")
        self._scheduler.yield_current()
        return True

    def _syscall_sched_set_priority(self, args: dict[str, Any], caller_pid: int) -> Any:
        if self._scheduler is None:
            raise RuntimeError("Scheduler not available")
        return self._scheduler.set_priority(int(args["pid"]), int(args["priority"]))

    def _syscall_emit_signal(self, args: dict[str, Any], caller_pid: int) -> Any:
        if self._ipc is None:
            raise RuntimeError("IPC bus not available")
        signal_name = args["signal_name"]
        payload = args.get("data", {})
        return self._ipc.publish(f"signal::{signal_name}", payload, caller_pid)

    def _syscall_spawn_process(self, args: dict[str, Any], caller_pid: int) -> Any:
        if self._scheduler is None:
            raise RuntimeError("Scheduler not available")
        name = args["name"]
        priority = int(args.get("priority", 5))
        entry = args.get("entry_point", None)
        return self._scheduler.spawn(name, entry, priority, parent_pid=caller_pid)

    def _syscall_get_time(self, args: dict[str, Any], caller_pid: int) -> Any:
        if self._scheduler:
            return self._scheduler.current_tick
        return time.time()

    def _syscall_log(self, args: dict[str, Any], caller_pid: int) -> Any:
        message = args["message"]
        level = args.get("level", "info")
        # In a real kernel this would go to a ring buffer / log service
        print(f"[{level.upper()}] pid={caller_pid}: {message}")
        return True
