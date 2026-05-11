"""
OpenXnet Neuro-Symbolic OS Kernel - Bootloader

Entry point for the entire kernel OS. Executes the boot sequence:
  1. Parse manifest.oxk to discover modules
  2. Initialize interpreter infrastructure
  3. Execute init.oxk boot phases (KernelLoad → SymbolMount → ProcessSpawn)
  4. Emit SYSTEM_READY signal
  5. Enter event loop

Usage:
    from os.boot.bootloader import boot_kernel_os
    kernel = await boot_kernel_os(os_root="os/", mode="shadow")
"""

import asyncio
import logging
import time
from pathlib import Path
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field

logger = logging.getLogger("openxnet.kernel")


@dataclass
class BootConfig:
    os_root: Path
    mode: str = "shadow"
    log_level: str = "INFO"
    max_processes: int = 64
    tick_interval_ms: int = 100


@dataclass
class ProcessHandle:
    pid: int
    name: str
    process_type: str
    state: str = "ready"
    priority: int = 5
    memory_usage: int = 0
    channels: List[str] = field(default_factory=list)
    uptime_ticks: int = 0


class KernelOS:
    """The running kernel OS instance."""

    def __init__(self, config: BootConfig):
        self.config = config
        self.phase = "booting"
        self.version = "0.1.0"
        self.tick_count = 0
        self.total_modules = 0
        self.loaded_modules: Dict[str, Dict[str, Any]] = {}
        self._running = False
        self._tick_task: Optional[asyncio.Task] = None

        self.scheduler = None
        self.memory_manager = None
        self.ipc_bus = None
        self.syscall_dispatcher = None
        self.symbol_graph = None
        self.inference_engine = None
        self.pattern_matcher = None
        self.runtime = None
        self.trit_memory = None

        self._lexer_class = None
        self._parser_class = None
        self._event_bus = None

    async def boot(self) -> "KernelOS":
        logger.info("OpenXnet Kernel OS booting...")
        start = time.time()

        try:
            await self._phase_init_interpreter()
            await self._phase_kernel_load()
            await self._phase_symbol_mount()
            await self._phase_process_spawn()
            await self._phase_ready()
        except Exception as e:
            self.phase = "error"
            logger.error(f"Boot failed at phase '{self.phase}': {e}")
            raise

        elapsed = time.time() - start
        logger.info(f"Kernel OS ready in {elapsed:.2f}s (mode={self.config.mode})")
        return self

    async def _phase_init_interpreter(self):
        self.phase = "booting"
        logger.info("[BOOT] Initializing interpreter infrastructure...")

        from ..interpreter.lexer import Lexer
        from ..interpreter.parser import Parser
        from ..interpreter.runtime import Runtime
        from ..interpreter.scheduler import ProcessScheduler
        from ..interpreter.memory_manager import MemoryManager
        from ..interpreter.ipc_bus import IPCBus
        from ..interpreter.syscall_dispatch import SyscallDispatcher
        from ..interpreter.symbol_graph import SymbolGraph
        from ..interpreter.inference_engine import InferenceEngine
        from ..interpreter.pattern_matcher import PatternMatcher
        from ..interpreter.trit_memory import TritMemoryStore

        self._lexer_class = Lexer
        self._parser_class = Parser

        self.scheduler = ProcessScheduler(max_processes=self.config.max_processes)
        self.memory_manager = MemoryManager()
        self.ipc_bus = IPCBus()
        self.syscall_dispatcher = SyscallDispatcher(
            scheduler=self.scheduler,
            memory=self.memory_manager,
            ipc=self.ipc_bus,
        )
        self.symbol_graph = SymbolGraph()
        self.inference_engine = InferenceEngine(graph=self.symbol_graph)
        self.pattern_matcher = PatternMatcher()

        self.trit_memory = self.memory_manager.init_trit_store(dim=256, max_entries=4096)

        self.runtime = Runtime(
            scheduler=self.scheduler,
            memory=self.memory_manager,
            ipc=self.ipc_bus,
            syscalls=self.syscall_dispatcher,
            symbol_graph=self.symbol_graph,
            trit_memory=self.trit_memory,
        )

        logger.info("[BOOT] Interpreter infrastructure ready (trit memory: dim=%d)", self.trit_memory.dim)

    async def _phase_kernel_load(self):
        self.phase = "kernel_load"
        logger.info("[BOOT] Loading kernel modules...")

        manifest_path = self.config.os_root / "boot" / "manifest.oxk"
        manifest_ast = self._parse_file(manifest_path)

        kernel_dir = self.config.os_root / "kernel"
        stdlib_dir = self.config.os_root / "stdlib"

        kernel_files = sorted(kernel_dir.glob("*.oxk"))
        stdlib_files = sorted(stdlib_dir.glob("*.oxk"))
        all_modules = kernel_files + stdlib_files
        self.total_modules = len(all_modules)

        for module_path in all_modules:
            try:
                ast = self._parse_file(module_path)
                module_name = module_path.stem
                self.runtime.load_module(ast)
                self.loaded_modules[module_name] = {
                    "version": "0.1.0",
                    "path": str(module_path),
                    "critical": module_name in ("scheduler", "memory", "ipc", "syscall", "signals"),
                    "loaded_at_tick": self.tick_count,
                }
                logger.info(f"  Loaded: {module_name}")
            except Exception as e:
                logger.warning(f"  Failed to load {module_path.name}: {e}")

        logger.info(f"[BOOT] Loaded {len(self.loaded_modules)}/{self.total_modules} modules")

    async def _phase_symbol_mount(self):
        self.phase = "symbol_mount"
        logger.info("[BOOT] Mounting symbol graphs...")

        symbols_dir = self.config.os_root / "symbols"
        if not symbols_dir.exists():
            logger.warning("[BOOT] No symbols directory found, skipping")
            return

        nxs_files = sorted(symbols_dir.glob("*.nxs"))
        for nxs_path in nxs_files:
            try:
                ast = self._parse_file(nxs_path)
                self.runtime.mount_symbol_graph(ast, self.symbol_graph)
                logger.info(f"  Mounted: {nxs_path.stem}")
            except Exception as e:
                logger.warning(f"  Failed to mount {nxs_path.name}: {e}")

        logger.info(f"[BOOT] Symbol graph: {self.symbol_graph.concept_count} concepts, "
                    f"{self.symbol_graph.relation_count} relations")

    async def _phase_process_spawn(self):
        self.phase = "process_spawn"
        logger.info("[BOOT] Spawning system processes...")

        processes_dir = self.config.os_root / "processes"
        if not processes_dir.exists():
            logger.warning("[BOOT] No processes directory found, skipping")
            return

        oxp_files = sorted(processes_dir.glob("*.oxp"))
        for oxp_path in oxp_files:
            try:
                ast = self._parse_file(oxp_path)
                proc = self.runtime.spawn_from_definition(ast, self.scheduler)
                logger.info(f"  Spawned: {oxp_path.stem} (pid={proc.pid})")
            except Exception as e:
                logger.warning(f"  Failed to spawn {oxp_path.name}: {e}")

        logger.info(f"[BOOT] {self.scheduler.active_count} processes running")

    async def _phase_ready(self):
        self.phase = "ready"
        self._running = True

        if self._event_bus:
            self._event_bus.emit("SYSTEM_READY", "kernel", {
                "modules": len(self.loaded_modules),
                "processes": self.scheduler.active_count,
                "mode": self.config.mode,
            })

        self._tick_task = asyncio.create_task(self._tick_loop())
        logger.info("[BOOT] === SYSTEM_READY === ")

    async def _tick_loop(self):
        interval = self.config.tick_interval_ms / 1000.0
        while self._running:
            await asyncio.sleep(interval)
            self.tick_count += 1

            if self.scheduler:
                self.scheduler.tick()
            if self._event_bus:
                self._event_bus.advance_tick()
            if self.tick_count % 100 == 0 and self.memory_manager:
                self.memory_manager.gc_collect()

            if self.trit_memory and self.tick_count % 10 == 0:
                self.trit_memory.decay_all(rate=0.02)
                self.trit_memory.apply_trit_decay(probability=0.01)
                if self.symbol_graph:
                    self.symbol_graph.decay_all_ternary(rate=0.02)

            if self.trit_memory and self.tick_count % 50 == 0:
                self._consolidation_pass()

    def _consolidation_pass(self):
        """Bridge bottom-layer trit vectors up to the symbol graph.

        High-activation, frequently accessed entries that haven't been
        consolidated yet get promoted to ternary facts in the symbol graph.
        """
        if not self.trit_memory or not self.symbol_graph:
            return

        candidates = self.trit_memory.get_consolidation_candidates(
            activation_threshold=0.7, access_threshold=3,
        )
        for entry in candidates:
            subj = entry.metadata.get("subject")
            pred = entry.metadata.get("predicate")
            obj = entry.metadata.get("object")
            if subj and pred and obj:
                confidence = entry.activation
                self.symbol_graph.assert_ternary_fact(
                    str(subj), str(pred), str(obj),
                    truth_value=1, confidence=confidence,
                )
                self.trit_memory.mark_consolidated(entry.key)
                logger.debug(f"[CONSOLIDATE] {entry.key} -> fact({subj}, {pred}, {obj})")

    def _parse_file(self, path: Path):
        source = path.read_text(encoding="utf-8")
        lexer = self._lexer_class(source, str(path))
        tokens = lexer.tokenize()
        parser = self._parser_class(tokens, str(path))
        return parser.parse()

    async def inject_stimulus(self, stimulus_type: str, payload: Dict[str, Any],
                              target: Optional[str] = None, priority: int = 5) -> Dict[str, Any]:
        if self._event_bus:
            self._event_bus.emit("stimulus", "external", {
                "type": stimulus_type,
                "payload": payload,
                "target": target,
            })

        if target and self.scheduler:
            proc = self.scheduler.find_by_name(target)
            if proc:
                self.ipc_bus.send(f"{target}_input", {
                    "type": stimulus_type,
                    "data": payload,
                }, sender_pid=0)
                return {"delivered": True, "target_pid": proc.pid}

        return {"delivered": False, "reason": "no_target"}

    async def spawn_process(self, template: str, name: Optional[str] = None,
                            args: Dict[str, Any] = None, priority: int = 5) -> ProcessHandle:
        oxp_path = self.config.os_root / "processes" / f"{template}.oxp"
        if not oxp_path.exists():
            raise FileNotFoundError(f"Process template not found: {template}")

        ast = self._parse_file(oxp_path)
        proc = self.runtime.spawn_from_definition(ast, self.scheduler, name=name, priority=priority)
        return proc

    async def reboot(self, mode: str = "soft", preserve_state: bool = False):
        logger.info(f"[KERNEL] Reboot requested (mode={mode})")
        self._running = False

        if self._tick_task:
            self._tick_task.cancel()
            try:
                await self._tick_task
            except asyncio.CancelledError:
                pass

        if mode == "hard" or not preserve_state:
            self.loaded_modules.clear()
            self.tick_count = 0
            if self.scheduler:
                self.scheduler.terminate_all()
            if self.memory_manager:
                self.memory_manager.reset()

        await self.boot()

    async def shutdown(self):
        logger.info("[KERNEL] Shutting down...")
        self.phase = "shutting_down"
        self._running = False

        if self._tick_task:
            self._tick_task.cancel()
            try:
                await self._tick_task
            except asyncio.CancelledError:
                pass

        if self.scheduler:
            self.scheduler.terminate_all()

        if self._event_bus:
            self._event_bus.emit("SYSTEM_SHUTDOWN", "kernel", {})

        self.phase = "error"
        logger.info("[KERNEL] Shutdown complete")

    def bind_event_bus(self, event_bus):
        self._event_bus = event_bus


async def boot_kernel_os(os_root: str = "os/", mode: str = "shadow",
                         log_level: str = "INFO") -> KernelOS:
    """Boot the kernel OS. Main entry point for integration."""
    logging.basicConfig(level=getattr(logging, log_level))

    config = BootConfig(
        os_root=Path(os_root),
        mode=mode,
        log_level=log_level,
    )

    kernel = KernelOS(config)
    await kernel.boot()
    return kernel
