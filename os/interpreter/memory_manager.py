"""
OpenXnet Neuro-Symbolic OS Kernel - Symbol Memory Pool

Manages memory regions (HEAP, STACK, SYMBOL_STORE) with reference counting,
symbol activation tracking, and mark-sweep garbage collection.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Optional, TYPE_CHECKING
import time

if TYPE_CHECKING:
    from .trit_memory import TritMemoryStore


class MemoryRegion(Enum):
    """Memory regions managed by the kernel."""
    HEAP = auto()
    STACK = auto()
    SYMBOL_STORE = auto()
    TRIT_STORE = auto()


@dataclass
class Allocation:
    """A single memory allocation record."""
    address: int
    region: MemoryRegion
    size: int
    ref_count: int = 1
    marked: bool = False
    data: Any = None
    created_at: float = field(default_factory=time.time)


@dataclass
class SymbolEntry:
    """An entry in the symbol store with activation level."""
    name: str
    value: Any
    activation: float = 1.0         # 0.0 to 1.0
    ref_count: int = 1
    last_accessed: float = field(default_factory=time.time)


@dataclass
class MemoryStats:
    """Current memory usage statistics."""
    total_allocations: int = 0
    active_allocations: int = 0
    freed_allocations: int = 0
    total_bytes_allocated: int = 0
    active_bytes: int = 0
    symbol_count: int = 0
    gc_runs: int = 0
    gc_freed: int = 0
    trit_store_entries: int = 0
    trit_store_dim: int = 0


class MemoryManager:
    """Symbol memory pool with reference counting and garbage collection.

    Provides three memory regions:
      - HEAP: general-purpose allocations for runtime data
      - STACK: frame-scoped allocations tied to execution
      - SYMBOL_STORE: named symbols with neural activation levels
    """

    def __init__(self, max_heap: int = 1_048_576, max_stack: int = 65_536):
        self._next_addr: int = 0x1000
        self._allocations: dict[int, Allocation] = {}
        self._symbol_store: dict[str, SymbolEntry] = {}
        self._max_heap = max_heap
        self._max_stack = max_stack
        self._heap_used: int = 0
        self._stack_used: int = 0
        self._stats = MemoryStats()
        # Root set for GC -- addresses that are always reachable
        self._roots: set[int] = set()
        # Optional trit-vector memory store
        self._trit_store: Optional["TritMemoryStore"] = None

    def alloc(self, region: MemoryRegion, size: int, data: Any = None) -> int:
        """Allocate memory in the specified region.

        Returns the address of the new allocation.
        Raises MemoryError if the region is full.
        """
        if region == MemoryRegion.HEAP and self._heap_used + size > self._max_heap:
            # Attempt GC before failing
            self.gc_collect()
            if self._heap_used + size > self._max_heap:
                raise MemoryError(f"Heap exhausted: requested {size}, available {self._max_heap - self._heap_used}")
        elif region == MemoryRegion.STACK and self._stack_used + size > self._max_stack:
            raise MemoryError(f"Stack overflow: requested {size}, available {self._max_stack - self._stack_used}")

        addr = self._next_addr
        self._next_addr += size + (8 - size % 8) if size % 8 != 0 else size  # 8-byte alignment

        allocation = Allocation(
            address=addr,
            region=region,
            size=size,
            data=data,
        )
        self._allocations[addr] = allocation

        if region == MemoryRegion.HEAP:
            self._heap_used += size
        elif region == MemoryRegion.STACK:
            self._stack_used += size

        self._stats.total_allocations += 1
        self._stats.active_allocations += 1
        self._stats.total_bytes_allocated += size
        self._stats.active_bytes += size

        return addr

    def free(self, addr: int) -> bool:
        """Free a previously allocated address.

        Returns True if freed successfully, False if address not found.
        """
        if addr not in self._allocations:
            return False

        alloc = self._allocations[addr]
        if alloc.region == MemoryRegion.HEAP:
            self._heap_used -= alloc.size
        elif alloc.region == MemoryRegion.STACK:
            self._stack_used -= alloc.size

        self._stats.active_allocations -= 1
        self._stats.freed_allocations += 1
        self._stats.active_bytes -= alloc.size

        del self._allocations[addr]
        self._roots.discard(addr)
        return True

    def add_ref(self, addr: int) -> bool:
        """Increment the reference count of an allocation."""
        if addr in self._allocations:
            self._allocations[addr].ref_count += 1
            return True
        return False

    def release_ref(self, addr: int) -> bool:
        """Decrement the reference count; free if it reaches zero."""
        if addr not in self._allocations:
            return False
        alloc = self._allocations[addr]
        alloc.ref_count -= 1
        if alloc.ref_count <= 0:
            self.free(addr)
        return True

    def add_root(self, addr: int) -> None:
        """Add an address to the GC root set (always reachable)."""
        self._roots.add(addr)

    def remove_root(self, addr: int) -> None:
        """Remove an address from the GC root set."""
        self._roots.discard(addr)

    def read(self, addr: int) -> Any:
        """Read data stored at the given address."""
        if addr not in self._allocations:
            return None
        return self._allocations[addr].data

    def write(self, addr: int, data: Any) -> bool:
        """Write data to an existing allocation."""
        if addr not in self._allocations:
            return False
        self._allocations[addr].data = data
        return True

    # -------------------------------------------------------------------------
    # Symbol Store
    # -------------------------------------------------------------------------

    def store_symbol(self, name: str, value: Any, activation: float = 1.0) -> None:
        """Store or update a named symbol with an activation level."""
        activation = max(0.0, min(1.0, activation))
        if name in self._symbol_store:
            entry = self._symbol_store[name]
            entry.value = value
            entry.activation = activation
            entry.ref_count += 1
            entry.last_accessed = time.time()
        else:
            self._symbol_store[name] = SymbolEntry(
                name=name,
                value=value,
                activation=activation,
            )
            self._stats.symbol_count += 1

    def lookup_symbol(self, name: str) -> Optional[SymbolEntry]:
        """Look up a symbol by name. Updates access time on hit."""
        entry = self._symbol_store.get(name)
        if entry:
            entry.last_accessed = time.time()
        return entry

    def decay_symbols(self, rate: float = 0.05) -> int:
        """Decay all symbol activations by the given rate. Returns count of decayed symbols."""
        decayed = 0
        for entry in self._symbol_store.values():
            if entry.activation > 0.0:
                entry.activation = max(0.0, entry.activation - rate)
                decayed += 1
        return decayed

    def get_active_symbols(self, threshold: float = 0.1) -> list[SymbolEntry]:
        """Return all symbols with activation above the threshold."""
        return [e for e in self._symbol_store.values() if e.activation >= threshold]

    def remove_symbol(self, name: str) -> bool:
        """Remove a symbol from the store."""
        if name in self._symbol_store:
            del self._symbol_store[name]
            self._stats.symbol_count -= 1
            return True
        return False

    # -------------------------------------------------------------------------
    # Trit Store Integration
    # -------------------------------------------------------------------------

    def init_trit_store(self, dim: int = 256, max_entries: int = 4096) -> "TritMemoryStore":
        """Initialize the trit-vector memory store."""
        from .trit_memory import TritMemoryStore
        self._trit_store = TritMemoryStore(dim=dim, max_entries=max_entries)
        return self._trit_store

    def get_trit_store(self) -> Optional["TritMemoryStore"]:
        """Return the trit store, or None if not initialized."""
        return self._trit_store

    def trit_store_stats(self) -> dict:
        """Return trit store statistics, or empty dict if not initialized."""
        if self._trit_store is None:
            return {}
        return self._trit_store.stats()

    # -------------------------------------------------------------------------
    # Garbage Collection
    # -------------------------------------------------------------------------

    def gc_collect(self) -> int:
        """Run mark-sweep garbage collection on unreferenced allocations.

        Returns the number of allocations freed.
        """
        # Mark phase: clear all marks
        for alloc in self._allocations.values():
            alloc.marked = False

        # Mark reachable: roots and anything with positive ref_count
        for addr in self._roots:
            if addr in self._allocations:
                self._allocations[addr].marked = True

        for alloc in self._allocations.values():
            if alloc.ref_count > 0:
                alloc.marked = True

        # Sweep phase: free unmarked allocations
        to_free = [addr for addr, alloc in self._allocations.items() if not alloc.marked]
        for addr in to_free:
            self.free(addr)

        if self._trit_store is not None:
            evicted = self._trit_store.evict_below(0.01)
            self._stats.gc_freed += evicted

        self._stats.gc_runs += 1
        self._stats.gc_freed += len(to_free)
        return len(to_free)

    # -------------------------------------------------------------------------
    # Stats
    # -------------------------------------------------------------------------

    def get_stats(self) -> MemoryStats:
        """Return current memory usage statistics."""
        trit_entries = 0
        trit_dim = 0
        if self._trit_store is not None:
            trit_entries = len(self._trit_store)
            trit_dim = self._trit_store.dim

        return MemoryStats(
            total_allocations=self._stats.total_allocations,
            active_allocations=self._stats.active_allocations,
            freed_allocations=self._stats.freed_allocations,
            total_bytes_allocated=self._stats.total_bytes_allocated,
            active_bytes=self._stats.active_bytes,
            symbol_count=self._stats.symbol_count,
            gc_runs=self._stats.gc_runs,
            gc_freed=self._stats.gc_freed,
            trit_store_entries=trit_entries,
            trit_store_dim=trit_dim,
        )
