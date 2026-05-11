"""
OpenXnet Neuro-Symbolic OS Kernel - In-Memory Symbol Graph

Stores concepts, relations, and assertions in a graph structure.
Supports graph traversal (BFS/DFS) and neural activation spreading.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class Concept:
    """A concept node in the symbol graph."""
    name: str
    parent: Optional[str] = None
    weight: float = 1.0
    activation: float = 0.0
    properties: dict[str, Any] = field(default_factory=dict)


@dataclass
class Relation:
    """A directed edge between two concepts."""
    source: str
    relation_type: str
    target: str
    weight: float = 1.0
    ternary_value: int = 1  # {-1, 0, +1}: negated, unknown, affirmed
    properties: dict[str, Any] = field(default_factory=dict)


@dataclass
class Fact:
    """An asserted fact (triple) in the knowledge base."""
    subject: str
    predicate: str
    object: str
    confidence: float = 1.0
    truth_value: int = 1  # {-1, 0, +1}: false, unknown, true


class SymbolGraph:
    """In-memory symbol graph for the neuro-symbolic reasoning layer.

    Stores:
      - Concepts (nodes) with activation levels
      - Relations (typed, weighted edges)
      - Facts (subject-predicate-object triples)

    Provides BFS/DFS traversal and activation spreading where energy
    propagates from a source concept along weighted relations.
    """

    def __init__(self):
        self._concepts: dict[str, Concept] = {}
        self._relations: list[Relation] = []
        self._adjacency: dict[str, list[Relation]] = {}  # source -> outgoing relations
        self._reverse_adj: dict[str, list[Relation]] = {}  # target -> incoming relations
        self._facts: list[Fact] = []
        self._fact_index: dict[str, list[Fact]] = {}  # subject -> facts

    def add_concept(
        self,
        name: str,
        parent: Optional[str] = None,
        weight: float = 1.0,
        properties: Optional[dict[str, Any]] = None,
    ) -> Concept:
        """Add or update a concept in the graph."""
        if name in self._concepts:
            concept = self._concepts[name]
            concept.parent = parent if parent is not None else concept.parent
            concept.weight = weight
            if properties:
                concept.properties.update(properties)
        else:
            concept = Concept(
                name=name,
                parent=parent,
                weight=weight,
                properties=properties or {},
            )
            self._concepts[name] = concept
            self._adjacency.setdefault(name, [])
            self._reverse_adj.setdefault(name, [])
        return concept

    def add_relation(
        self,
        source: str,
        relation_type: str,
        target: str,
        weight: float = 1.0,
        properties: Optional[dict[str, Any]] = None,
    ) -> Relation:
        """Add a directed, typed relation between two concepts."""
        # Auto-create concepts if they don't exist
        if source not in self._concepts:
            self.add_concept(source)
        if target not in self._concepts:
            self.add_concept(target)

        relation = Relation(
            source=source,
            relation_type=relation_type,
            target=target,
            weight=weight,
            properties=properties or {},
        )
        self._relations.append(relation)
        self._adjacency.setdefault(source, []).append(relation)
        self._reverse_adj.setdefault(target, []).append(relation)
        return relation

    def get_concept(self, name: str) -> Optional[Concept]:
        """Retrieve a concept by name."""
        return self._concepts.get(name)

    def get_relations(self, source: str, relation_type: Optional[str] = None) -> list[Relation]:
        """Get all outgoing relations from a concept, optionally filtered by type."""
        rels = self._adjacency.get(source, [])
        if relation_type:
            return [r for r in rels if r.relation_type == relation_type]
        return list(rels)

    def get_incoming(self, target: str, relation_type: Optional[str] = None) -> list[Relation]:
        """Get all incoming relations to a concept."""
        rels = self._reverse_adj.get(target, [])
        if relation_type:
            return [r for r in rels if r.relation_type == relation_type]
        return list(rels)

    def query(self, concept: str) -> dict[str, Any]:
        """Query full information about a concept: its data, relations, and facts."""
        node = self._concepts.get(concept)
        if node is None:
            return {"exists": False}

        return {
            "exists": True,
            "name": node.name,
            "parent": node.parent,
            "weight": node.weight,
            "activation": node.activation,
            "properties": dict(node.properties),
            "outgoing": [
                {"type": r.relation_type, "target": r.target, "weight": r.weight}
                for r in self._adjacency.get(concept, [])
            ],
            "incoming": [
                {"type": r.relation_type, "source": r.source, "weight": r.weight}
                for r in self._reverse_adj.get(concept, [])
            ],
            "facts": [
                {"predicate": f.predicate, "object": f.object, "confidence": f.confidence}
                for f in self._fact_index.get(concept, [])
            ],
        }

    # -------------------------------------------------------------------------
    # Traversal
    # -------------------------------------------------------------------------

    def bfs(self, start: str, max_depth: int = -1) -> list[str]:
        """Breadth-first traversal from a start concept.

        Returns a list of concept names in BFS order.
        max_depth=-1 means unlimited depth.
        """
        if start not in self._concepts:
            return []

        visited: set[str] = set()
        queue: deque[tuple[str, int]] = deque([(start, 0)])
        result: list[str] = []

        while queue:
            node, depth = queue.popleft()
            if node in visited:
                continue
            if max_depth >= 0 and depth > max_depth:
                continue
            visited.add(node)
            result.append(node)

            for rel in self._adjacency.get(node, []):
                if rel.target not in visited:
                    queue.append((rel.target, depth + 1))

        return result

    def dfs(self, start: str, max_depth: int = -1) -> list[str]:
        """Depth-first traversal from a start concept.

        Returns a list of concept names in DFS order.
        """
        if start not in self._concepts:
            return []

        visited: set[str] = set()
        result: list[str] = []
        self._dfs_recursive(start, visited, result, 0, max_depth)
        return result

    def _dfs_recursive(
        self, node: str, visited: set[str], result: list[str], depth: int, max_depth: int
    ) -> None:
        if node in visited:
            return
        if max_depth >= 0 and depth > max_depth:
            return

        visited.add(node)
        result.append(node)

        for rel in self._adjacency.get(node, []):
            self._dfs_recursive(rel.target, visited, result, depth + 1, max_depth)

    # -------------------------------------------------------------------------
    # Activation Spreading
    # -------------------------------------------------------------------------

    def spread_activation(
        self, source: str, energy: float = 1.0, decay: float = 0.5, max_hops: int = 5
    ) -> dict[str, float]:
        """Spread activation energy from a source concept.

        Energy propagates along outgoing relations, decayed by the relation
        weight and a global decay factor at each hop.

        Returns a map of concept -> final activation level.
        """
        if source not in self._concepts:
            return {}

        # Set source activation
        self._concepts[source].activation = min(
            1.0, self._concepts[source].activation + energy
        )

        # BFS-style spreading
        activations: dict[str, float] = {source: self._concepts[source].activation}
        frontier: deque[tuple[str, float, int]] = deque([(source, energy, 0)])
        visited: set[str] = {source}

        while frontier:
            node, current_energy, hop = frontier.popleft()
            if hop >= max_hops:
                continue

            for rel in self._adjacency.get(node, []):
                target = rel.target
                propagated = current_energy * decay * rel.weight

                if propagated < 0.01:
                    continue

                target_concept = self._concepts.get(target)
                if target_concept is None:
                    continue

                target_concept.activation = min(1.0, target_concept.activation + propagated)
                activations[target] = target_concept.activation

                if target not in visited:
                    visited.add(target)
                    frontier.append((target, propagated, hop + 1))

        return activations

    def decay_all(self, rate: float = 0.1) -> None:
        """Decay activation of all concepts by a fixed rate."""
        for concept in self._concepts.values():
            concept.activation = max(0.0, concept.activation - rate)

    def get_activated(self, threshold: float = 0.1) -> list[Concept]:
        """Return all concepts with activation above the threshold."""
        return [c for c in self._concepts.values() if c.activation >= threshold]

    def reset_activations(self) -> None:
        """Reset all concept activations to zero."""
        for concept in self._concepts.values():
            concept.activation = 0.0

    # -------------------------------------------------------------------------
    # Facts (Assertions)
    # -------------------------------------------------------------------------

    def assert_fact(
        self, subject: str, predicate: str, obj: str, confidence: float = 1.0
    ) -> Fact:
        """Assert a fact (subject-predicate-object triple)."""
        fact = Fact(
            subject=subject,
            predicate=predicate,
            object=obj,
            confidence=confidence,
        )
        self._facts.append(fact)
        self._fact_index.setdefault(subject, []).append(fact)
        return fact

    def query_facts(
        self,
        subject: Optional[str] = None,
        predicate: Optional[str] = None,
        obj: Optional[str] = None,
    ) -> list[Fact]:
        """Query facts matching given subject/predicate/object (None = wildcard)."""
        results = []
        source = self._fact_index.get(subject, self._facts) if subject else self._facts
        for fact in source:
            if subject and fact.subject != subject:
                continue
            if predicate and fact.predicate != predicate:
                continue
            if obj and fact.object != obj:
                continue
            results.append(fact)
        return results

    def retract_fact(self, subject: str, predicate: str, obj: str) -> bool:
        """Retract (remove) a specific fact. Returns True if found and removed."""
        for i, fact in enumerate(self._facts):
            if fact.subject == subject and fact.predicate == predicate and fact.object == obj:
                self._facts.pop(i)
                # Also remove from index
                indexed = self._fact_index.get(subject, [])
                self._fact_index[subject] = [
                    f for f in indexed
                    if not (f.predicate == predicate and f.object == obj)
                ]
                return True
        return False

    # -------------------------------------------------------------------------
    # Utility
    # -------------------------------------------------------------------------

    def concepts_count(self) -> int:
        """Return total number of concepts."""
        return len(self._concepts)

    def relations_count(self) -> int:
        """Return total number of relations."""
        return len(self._relations)

    def facts_count(self) -> int:
        """Return total number of asserted facts."""
        return len(self._facts)

    def get_children(self, parent: str) -> list[str]:
        """Get all concepts that declare the given concept as parent."""
        return [c.name for c in self._concepts.values() if c.parent == parent]

    def is_ancestor(self, ancestor: str, descendant: str) -> bool:
        """Check if one concept is an ancestor of another via the parent chain."""
        current = self._concepts.get(descendant)
        visited: set[str] = set()
        while current and current.parent:
            if current.parent == ancestor:
                return True
            if current.parent in visited:
                return False  # Cycle detected
            visited.add(current.parent)
            current = self._concepts.get(current.parent)
        return False

    # -------------------------------------------------------------------------
    # Ternary Extensions
    # -------------------------------------------------------------------------

    def spread_activation_ternary(
        self, source: str, energy: float = 1.0, decay: float = 0.5, max_hops: int = 5
    ) -> dict[str, float]:
        """Spread activation with ternary semantics.

        Activations range [-1.0, +1.0]. Negated edges (ternary_value=-1) flip
        the sign of propagated energy, turning excitation into inhibition.
        """
        if source not in self._concepts:
            return {}

        src = self._concepts[source]
        src.activation = max(-1.0, min(1.0, src.activation + energy))

        activations: dict[str, float] = {source: src.activation}
        frontier: deque[tuple[str, float, int]] = deque([(source, energy, 0)])
        visited: set[str] = {source}

        while frontier:
            node, current_energy, hop = frontier.popleft()
            if hop >= max_hops:
                continue

            for rel in self._adjacency.get(node, []):
                target = rel.target
                propagated = current_energy * decay * rel.weight * rel.ternary_value

                if abs(propagated) < 0.01:
                    continue

                target_concept = self._concepts.get(target)
                if target_concept is None:
                    continue

                target_concept.activation = max(
                    -1.0, min(1.0, target_concept.activation + propagated)
                )
                activations[target] = target_concept.activation

                if target not in visited:
                    visited.add(target)
                    frontier.append((target, propagated, hop + 1))

        return activations

    def decay_all_ternary(self, rate: float = 0.1) -> None:
        """Decay all activations toward zero from both directions."""
        for concept in self._concepts.values():
            if concept.activation > 0:
                concept.activation = max(0.0, concept.activation - rate)
            elif concept.activation < 0:
                concept.activation = min(0.0, concept.activation + rate)

    def get_inhibited(self, threshold: float = -0.1) -> list[Concept]:
        """Return concepts with activation below threshold (inhibited)."""
        return [c for c in self._concepts.values() if c.activation <= threshold]

    def assert_ternary_fact(
        self, subject: str, predicate: str, obj: str,
        truth_value: int = 1, confidence: float = 1.0
    ) -> Fact:
        """Assert a fact with explicit ternary truth value.

        If a contradicting fact exists (same SPO, opposite truth_value),
        resolve by confidence: higher confidence wins, equal → UNKNOWN.
        """
        for i, existing in enumerate(self._facts):
            if (existing.subject == subject and existing.predicate == predicate
                    and existing.object == obj):
                if existing.truth_value == truth_value:
                    existing.confidence = max(existing.confidence, confidence)
                    return existing
                if confidence > existing.confidence:
                    existing.truth_value = truth_value
                    existing.confidence = confidence
                elif confidence == existing.confidence:
                    existing.truth_value = 0  # conflicted → unknown
                return existing

        fact = Fact(
            subject=subject, predicate=predicate, object=obj,
            confidence=confidence, truth_value=truth_value,
        )
        self._facts.append(fact)
        self._fact_index.setdefault(subject, []).append(fact)
        return fact

    def get_ternary_facts(self, truth_value: int) -> list[Fact]:
        """Return facts filtered by their ternary truth value."""
        return [f for f in self._facts if f.truth_value == truth_value]

    @property
    def concept_count(self) -> int:
        return len(self._concepts)

    @property
    def relation_count(self) -> int:
        return len(self._relations)

    @property
    def active_concept_count(self) -> int:
        return sum(1 for c in self._concepts.values() if abs(c.activation) >= 0.1)

    def add_rule(self, rule) -> None:
        """Store a rule node (delegated to inference engine)."""
        pass

    def add_binding(self, source: str, target: str) -> None:
        """Store a symbol-to-runtime binding."""
        pass
