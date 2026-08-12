"""
OpenXnet Neuro-Symbolic OS Kernel - Process Scheduler

Tick-based process scheduler with priority queue, neural weight modulation,
and round-robin scheduling within the same priority level.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Callable, Optional
import heapq


class ProcessState(Enum):
    """Lifecycle state of a scheduled process."""
    READY = auto()
    RUNNING = auto()
    BLOCKED = auto()
    SUSPENDED = auto()
    TERMINATED = auto()


@dataclass
class ProcessInfo:
    """Complete state record for a scheduled process."""
    pid: int
    name: str
    state: ProcessState = ProcessState.READY
    priority: int = 5                       # 0 = highest, 9 = lowest
    neural_weight: float = 1.0              # Multiplier from neural modulation
    ticks_remaining: int = 10               # Time slice (ticks)
    ticks_consumed: int = 0                 # Total ticks used
    entry_point: Optional[Any] = None       # AST node or callable
    context: dict[str, Any] = field(default_factory=dict)
    parent_pid: Optional[int] = None
    children: list[int] = field(default_factory=list)
    blocked_on: Optional[str] = None        # Resource/channel name
    spawn_tick: int = 0                     # Tick at which process was spawned


class ProcessScheduler:
    """Tick-based process scheduler with priority and neural modulation.

    Scheduling algorithm:
      1. Processes are grouped by effective priority (priority * neural_weight).
      2. Within the same priority level, round-robin scheduling is used.
      3. Each process gets a time slice measured in ticks.
      4. Neural weight modulation allows the inference engine to influence
         scheduling by boosting or decaying process priorities.
    """

    DEFAULT_TIME_SLICE: int = 10

    def __init__(self):
        self._process_table: dict[int, ProcessInfo] = {}
        self._next_pid: int = 1
        self._current_pid: Optional[int] = None
        self._tick: int = 0
        self._ready_queue: list[tuple[float, int, int]] = []  # (eff_priority, order, pid)
        self._insertion_order: int = 0
        self._on_terminate_hooks: list[Callable[[int], None]] = []

    @property
    def current_tick(self) -> int:
        """The current global tick count."""
        return self._tick

    @property
    def current_process(self) -> Optional[ProcessInfo]:
        """The currently running process, if any."""
        if self._current_pid is not None:
            return self._process_table.get(self._current_pid)
        return None

    def spawn(
        self,
        name: str,
        entry_point: Any = None,
        priority: int = 5,
        parent_pid: Optional[int] = None,
        context: Optional[dict[str, Any]] = None,
    ) -> int:
        """Spawn a new process and add it to the ready queue.

        Returns the PID of the new process.
        """
        pid = self._next_pid
        self._next_pid += 1

        proc = ProcessInfo(
            pid=pid,
            name=name,
            state=ProcessState.READY,
            priority=max(0, min(9, priority)),
            entry_point=entry_point,
            parent_pid=parent_pid,
            context=context or {},
            ticks_remaining=self.DEFAULT_TIME_SLICE,
            spawn_tick=self._tick,
        )
        self._process_table[pid] = proc

        # Record in parent's children list
        if parent_pid is not None and parent_pid in self._process_table:
            self._process_table[parent_pid].children.append(pid)

        self._enqueue(proc)
        return pid

    def schedule(self) -> Optional[ProcessInfo]:
        """Select the next process to run.

        Advances the tick counter. If the current process has remaining ticks,
        it continues. Otherwise the next highest-priority ready process runs.
        """
        self._tick += 1

        # Check if current process can continue
        if self._current_pid is not None:
            current = self._process_table.get(self._current_pid)
            if current and current.state == ProcessState.RUNNING:
                current.ticks_remaining -= 1
                current.ticks_consumed += 1
                if current.ticks_remaining > 0:
                    return current
                # Time slice expired -- preempt
                current.state = ProcessState.READY
                current.ticks_remaining = self._compute_time_slice(current)
                self._enqueue(current)
                self._current_pid = None

        # Pick from ready queue
        while self._ready_queue:
            _, _, pid = heapq.heappop(self._ready_queue)
            proc = self._process_table.get(pid)
            if proc is None:
                continue
            if proc.state != ProcessState.READY:
                continue
            # Dispatch
            proc.state = ProcessState.RUNNING
            self._current_pid = pid
            return proc

        self._current_pid = None
        return None

    def yield_current(self) -> None:
        """Voluntarily yield the current process's remaining time slice."""
        if self._current_pid is None:
            return
        proc = self._process_table.get(self._current_pid)
        if proc and proc.state == ProcessState.RUNNING:
            proc.state = ProcessState.READY
            proc.ticks_remaining = self._compute_time_slice(proc)
            self._enqueue(proc)
            self._current_pid = None

    def block(self, pid: int, reason: Optional[str] = None) -> bool:
        """Block a process (e.g., waiting on IPC or I/O).

        Returns True if the process was successfully blocked.
        """
        proc = self._process_table.get(pid)
        if proc is None:
            return False
        if proc.state not in (ProcessState.READY, ProcessState.RUNNING):
            return False

        proc.state = ProcessState.BLOCKED
        proc.blocked_on = reason
        if pid == self._current_pid:
            self._current_pid = None
        return True

    def unblock(self, pid: int) -> bool:
        """Unblock a blocked process, moving it back to READY.

        Returns True if the process was unblocked successfully.
        """
        proc = self._process_table.get(pid)
        if proc is None or proc.state != ProcessState.BLOCKED:
            return False

        proc.state = ProcessState.READY
        proc.blocked_on = None
        proc.ticks_remaining = self._compute_time_slice(proc)
        self._enqueue(proc)
        return True

    def suspend(self, pid: int) -> bool:
        """Suspend a process (does not terminate it).

        Returns True if suspended successfully.
        """
        proc = self._process_table.get(pid)
        if proc is None:
            return False
        if proc.state == ProcessState.TERMINATED:
            return False

        proc.state = ProcessState.SUSPENDED
        if pid == self._current_pid:
            self._current_pid = None
        return True

    def resume(self, pid: int) -> bool:
        """Resume a suspended process.

        Returns True if resumed successfully.
        """
        proc = self._process_table.get(pid)
        if proc is None or proc.state != ProcessState.SUSPENDED:
            return False

        proc.state = ProcessState.READY
        proc.ticks_remaining = self._compute_time_slice(proc)
        self._enqueue(proc)
        return True

    def terminate(self, pid: int) -> bool:
        """Terminate a process permanently.

        Returns True if terminated, False if not found.
        """
        proc = self._process_table.get(pid)
        if proc is None:
            return False

        proc.state = ProcessState.TERMINATED
        if pid == self._current_pid:
            self._current_pid = None

        # Notify hooks
        for hook in self._on_terminate_hooks:
            hook(pid)

        return True

    def get_process(self, pid: int) -> Optional[ProcessInfo]:
        """Retrieve process info by PID."""
        return self._process_table.get(pid)

    def set_priority(self, pid: int, priority: int) -> bool:
        """Change the priority of a process."""
        proc = self._process_table.get(pid)
        if proc is None:
            return False
        proc.priority = max(0, min(9, priority))
        return True

    def modulate_neural_weight(self, pid: int, weight: float) -> bool:
        """Set the neural weight modulation factor for a process.

        The neural weight affects effective priority:
          effective_priority = priority * (1.0 / neural_weight)
        Higher weight = more CPU time.
        """
        proc = self._process_table.get(pid)
        if proc is None:
            return False
        proc.neural_weight = max(0.1, min(10.0, weight))
        return True

    def list_processes(self, state: Optional[ProcessState] = None) -> list[ProcessInfo]:
        """List all processes, optionally filtered by state."""
        if state is None:
            return list(self._process_table.values())
        return [p for p in self._process_table.values() if p.state == state]

    def on_terminate(self, hook: Callable[[int], None]) -> None:
        """Register a callback for when a process terminates."""
        self._on_terminate_hooks.append(hook)

    # -------------------------------------------------------------------------
    # Internal
    # -------------------------------------------------------------------------

    def _enqueue(self, proc: ProcessInfo) -> None:
        """Add a process to the priority-based ready queue."""
        eff_priority = self._effective_priority(proc)
        self._insertion_order += 1
        heapq.heappush(self._ready_queue, (eff_priority, self._insertion_order, proc.pid))

    def _effective_priority(self, proc: ProcessInfo) -> float:
        """Compute effective priority considering neural weight.

        Lower value = higher priority (runs first in the min-heap).
        """
        return proc.priority * (1.0 / max(0.1, proc.neural_weight))

    def _compute_time_slice(self, proc: ProcessInfo) -> int:
        """Compute the time slice for a process based on priority and weight."""
        base = self.DEFAULT_TIME_SLICE
        # Higher priority (lower number) and higher neural weight get more ticks
        weight_bonus = int(proc.neural_weight * 2)
        priority_bonus = max(0, 5 - proc.priority)
        return base + weight_bonus + priority_bonus
