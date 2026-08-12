"""
OpenXnet Neuro-Symbolic OS Kernel - Pattern Matching Engine

Matches values against patterns (struct patterns, list patterns, wildcards, guards).
Used by both the runtime (match expressions) and the inference engine (rule conditions).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from .ast_nodes import (
    ASTNode,
    LiteralExpr,
    IdentExpr,
    StructLiteral,
    StructLiteralField,
    ListLiteral,
    MatchArm,
)


# Type alias for variable bindings produced during a match
Bindings = dict[str, Any]


@dataclass
class PatternVar:
    """A pattern variable that captures a value during matching."""
    name: str


@dataclass
class WildcardPattern:
    """Matches anything, captures nothing."""
    pass


@dataclass
class StructPattern:
    """Pattern that matches a struct by type name and field patterns."""
    type_name: str
    field_patterns: dict[str, Any] = field(default_factory=dict)


@dataclass
class ListPattern:
    """Pattern that matches a list element-by-element."""
    element_patterns: list[Any] = field(default_factory=list)
    rest_var: Optional[str] = None  # e.g., [head, *rest]


@dataclass
class GuardedPattern:
    """A pattern with an additional boolean guard condition."""
    inner_pattern: Any
    guard: Any  # AST expression to evaluate as guard


class PatternMatcher:
    """Engine for matching values against patterns.

    Supports:
      - Literal matching (int, float, string, symbol, bool)
      - Wildcard matching (_)
      - Variable capture
      - Struct matching (by type and field values)
      - List matching (element-wise, with optional rest capture)
      - Unification of two pattern terms
    """

    def match(self, value: Any, pattern: Any) -> Optional[Bindings]:
        """Attempt to match a value against a pattern.

        Returns a bindings dict if the match succeeds, or None if it fails.
        """
        bindings: Bindings = {}
        if self._match_internal(value, pattern, bindings):
            return bindings
        return None

    def _match_internal(self, value: Any, pattern: Any, bindings: Bindings) -> bool:
        """Recursive matching engine."""
        # Wildcard matches everything
        if isinstance(pattern, WildcardPattern):
            return True

        # Variable captures the value
        if isinstance(pattern, PatternVar):
            if pattern.name in bindings:
                # Already bound -- check equality
                return bindings[pattern.name] == value
            bindings[pattern.name] = value
            return True

        # AST identifier node used as pattern
        if isinstance(pattern, IdentExpr):
            if pattern.name == "_":
                return True
            # Treat as a variable capture
            if pattern.name in bindings:
                return bindings[pattern.name] == value
            bindings[pattern.name] = value
            return True

        # AST literal node used as pattern
        if isinstance(pattern, LiteralExpr):
            return value == pattern.value

        # Literal values (raw Python)
        if isinstance(pattern, (int, float, str, bool)):
            return value == pattern

        # None pattern
        if pattern is None:
            return value is None

        # Struct pattern
        if isinstance(pattern, (StructPattern, StructLiteral)):
            return self.match_struct(value, pattern, bindings)

        # List pattern
        if isinstance(pattern, (ListPattern, ListLiteral)):
            return self.match_list(value, pattern, bindings)

        # Guarded pattern
        if isinstance(pattern, GuardedPattern):
            if not self._match_internal(value, pattern.inner_pattern, bindings):
                return False
            # Guard is evaluated externally; store it for the caller
            bindings["__guard__"] = pattern.guard
            return True

        # MatchArm (used when caller passes the arm directly)
        if isinstance(pattern, MatchArm):
            return self._match_internal(value, pattern.pattern, bindings)

        # Fallback: direct equality
        return value == pattern

    def match_struct(self, value: Any, pattern: Any, bindings: Bindings) -> bool:
        """Match a value against a struct pattern.

        The value should be a dict-like object with a '__type__' key or a dict.
        """
        if isinstance(pattern, StructPattern):
            type_name = pattern.type_name
            field_patterns = pattern.field_patterns
        elif isinstance(pattern, StructLiteral):
            type_name = pattern.type_name
            field_patterns = {f.name: f.value for f in pattern.fields}
        else:
            return False

        # Check type name
        if isinstance(value, dict):
            value_type = value.get("__type__", "")
            if type_name and value_type != type_name:
                return False
            # Match each field pattern
            for fname, fpat in field_patterns.items():
                if fname not in value:
                    return False
                if not self._match_internal(value[fname], fpat, bindings):
                    return False
            return True
        return False

    def match_list(self, value: Any, pattern: Any, bindings: Bindings) -> bool:
        """Match a value against a list pattern (element-by-element)."""
        if not isinstance(value, (list, tuple)):
            return False

        if isinstance(pattern, ListPattern):
            element_patterns = pattern.element_patterns
            rest_var = pattern.rest_var
        elif isinstance(pattern, ListLiteral):
            element_patterns = pattern.elements
            rest_var = None
        else:
            return False

        if rest_var is not None:
            # Match prefix, bind rest
            if len(value) < len(element_patterns):
                return False
            for i, epat in enumerate(element_patterns):
                if not self._match_internal(value[i], epat, bindings):
                    return False
            bindings[rest_var] = list(value[len(element_patterns):])
            return True
        else:
            # Exact length match
            if len(value) != len(element_patterns):
                return False
            for i, epat in enumerate(element_patterns):
                if not self._match_internal(value[i], epat, bindings):
                    return False
            return True

    def unify(self, a: Any, b: Any, bindings: Optional[Bindings] = None) -> Optional[Bindings]:
        """Attempt to unify two terms, producing combined bindings.

        This is a simplified unification used by the inference engine to
        match rule conditions against facts in the symbol graph.
        """
        if bindings is None:
            bindings = {}

        if self._unify_internal(a, b, bindings):
            return bindings
        return None

    def _unify_internal(self, a: Any, b: Any, bindings: Bindings) -> bool:
        """Internal unification logic."""
        # Resolve variables
        a = self._resolve(a, bindings)
        b = self._resolve(b, bindings)

        # Both are identical
        if a == b:
            return True

        # a is a variable
        if isinstance(a, PatternVar):
            bindings[a.name] = b
            return True

        # b is a variable
        if isinstance(b, PatternVar):
            bindings[b.name] = a
            return True

        # Both are dicts (struct-like)
        if isinstance(a, dict) and isinstance(b, dict):
            if a.get("__type__") != b.get("__type__"):
                return False
            all_keys = set(a.keys()) | set(b.keys())
            for k in all_keys:
                if k not in a or k not in b:
                    return False
                if not self._unify_internal(a[k], b[k], bindings):
                    return False
            return True

        # Both are lists
        if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
            if len(a) != len(b):
                return False
            for ai, bi in zip(a, b):
                if not self._unify_internal(ai, bi, bindings):
                    return False
            return True

        return False

    def _resolve(self, term: Any, bindings: Bindings) -> Any:
        """Resolve a variable through bindings to its final value."""
        if isinstance(term, PatternVar) and term.name in bindings:
            return self._resolve(bindings[term.name], bindings)
        if isinstance(term, IdentExpr) and term.name in bindings:
            return self._resolve(bindings[term.name], bindings)
        return term
