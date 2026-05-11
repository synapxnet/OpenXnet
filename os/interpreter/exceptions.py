"""
OpenXnet Neuro-Symbolic OS Kernel DSL - Exception Hierarchy

Custom exception classes for each compilation/execution phase:
  - Lexing
  - Parsing
  - Semantic analysis
  - Runtime execution
  - Boot sequence
"""

from typing import Optional


class OXKernelError(Exception):
    """Base exception for all OpenXnet kernel DSL errors.

    Attributes:
        message:   Human-readable description of the error.
        file_path: Path to the source file where the error originated.
        line:      1-based line number (or None if not applicable).
        col:       1-based column number (or None if not applicable).
    """

    def __init__(
        self,
        message: str,
        file_path: Optional[str] = None,
        line: Optional[int] = None,
        col: Optional[int] = None,
    ) -> None:
        self.message = message
        self.file_path = file_path
        self.line = line
        self.col = col
        super().__init__(self._format())

    def _format(self) -> str:
        parts: list[str] = []
        if self.file_path:
            parts.append(self.file_path)
        if self.line is not None:
            loc = str(self.line)
            if self.col is not None:
                loc += f":{self.col}"
            parts.append(loc)
        prefix = ":".join(parts)
        if prefix:
            return f"[{prefix}] {self._label}: {self.message}"
        return f"{self._label}: {self.message}"

    @property
    def _label(self) -> str:
        return "OXKernelError"


class LexerError(OXKernelError):
    """Raised when the lexer encounters an invalid character sequence or
    malformed literal (unterminated string, invalid number, etc.)."""

    @property
    def _label(self) -> str:
        return "LexerError"


class ParseError(OXKernelError):
    """Raised when the parser encounters an unexpected token or
    a grammatically invalid construct."""

    @property
    def _label(self) -> str:
        return "ParseError"


class SemanticError(OXKernelError):
    """Raised during semantic analysis for type mismatches, undefined
    references, invalid state transitions, or constraint violations."""

    @property
    def _label(self) -> str:
        return "SemanticError"


class OXRuntimeError(OXKernelError):
    """Raised during kernel interpreter execution for division by zero,
    failed assertions, channel deadlocks, or syscall failures.

    Named OXRuntimeError to avoid shadowing the Python builtin RuntimeError.
    """

    @property
    def _label(self) -> str:
        return "RuntimeError"


class BootError(OXKernelError):
    """Raised when the kernel boot sequence fails -- missing modules,
    circular dependencies, or failed phase initialization."""

    @property
    def _label(self) -> str:
        return "BootError"
