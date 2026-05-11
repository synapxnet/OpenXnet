"""
OpenXnet Neuro-Symbolic OS Kernel - Forward/Backward Chain Inference

Implements rule-based inference over the symbol graph, with forward chaining
(data-driven) and backward chaining (goal-driven) strategies.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from .symbol_graph import SymbolGraph, Fact
from .pattern_matcher import PatternMatcher, Bindings
from .ast_nodes import (
    RulesetNode,
    RuleNode,
    WhenClauseNode,
    ThenClauseNode,
)


@dataclass
class RuleCondition:
    """A single condition in a rule's 'when' clause."""
    subject: str            # Variable or literal
    predicate: str          # Relation type or property check
    object: str             # Variable or literal
    negated: bool = False   # 'not' prefix


@dataclass
class RuleAction:
    """A single action in a rule's 'then' clause."""
    action_type: str        # "assert", "retract", "emit", "boost", "decay"
    subject: str = ""
    predicate: str = ""
    object: str = ""
    value: Any = None


@dataclass
class Rule:
    """A complete inference rule with conditions and actions."""
    name: str
    priority: float = 1.0               # Higher = fires first in conflicts
    conditions: list[RuleCondition] = field(default_factory=list)
    actions: list[RuleAction] = field(default_factory=list)
    fired_count: int = 0
    enabled: bool = True


@dataclass
class InferenceResult:
    """Result of an inference cycle."""
    rules_fired: list[str] = field(default_factory=list)
    facts_asserted: list[Fact] = field(default_factory=list)
    facts_retracted: list[tuple[str, str, str]] = field(default_factory=list)
    iterations: int = 0


class InferenceEngine:
    """Rule-based inference engine for the neuro-symbolic kernel.

    Supports:
      - Forward chaining: when conditions are met, fire rules and assert conclusions.
      - Backward chaining: given a goal, find rules that could prove it.
      - Conflict resolution: priority-based, most-specific-first.
    """

    def __init__(self, graph: SymbolGraph):
        self._graph = graph
        self._rules: dict[str, Rule] = {}
        self._matcher = PatternMatcher()
        self._fired_history: list[str] = []
        self._max_history: int = 1000

    def add_rule(
        self,
        name: str,
        when_clause: list[RuleCondition],
        then_clause: list[RuleAction],
        priority: float = 1.0,
    ) -> Rule:
        """Add an inference rule programmatically."""
        rule = Rule(
            name=name,
            priority=priority,
            conditions=when_clause,
            actions=then_clause,
        )
        self._rules[name] = rule
        return rule

    def load_rules(self, ruleset_node: RulesetNode) -> int:
        """Load rules from a parsed RulesetNode AST.

        Returns the number of rules loaded.
        """
        count = 0
        for rule_node in ruleset_node.rules:
            conditions = self._parse_when_clause(rule_node.when_clause)
            actions = self._parse_then_clause(rule_node.then_clause)
            self.add_rule(
                name=rule_node.name,
                when_clause=conditions,
                then_clause=actions,
                priority=rule_node.weight,
            )
            count += 1
        return count

    def forward_chain(self, max_iterations: int = 100) -> InferenceResult:
        """Run forward chaining until no more rules fire or max iterations reached.

        Algorithm:
          1. Find all rules whose conditions are satisfied by current facts.
          2. Resolve conflicts (priority, specificity).
          3. Fire the winning rule (execute actions).
          4. Repeat until quiescence or iteration limit.
        """
        result = InferenceResult()

        for iteration in range(max_iterations):
            # Collect candidate rules
            candidates: list[tuple[Rule, Bindings]] = []
            for rule in self._rules.values():
                if not rule.enabled:
                    continue
                bindings = self._evaluate_conditions(rule.conditions)
                if bindings is not None:
                    candidates.append((rule, bindings))

            if not candidates:
                break

            # Conflict resolution
            candidates.sort(key=lambda rb: (-rb[0].priority, -len(rb[0].conditions)))

            # Fire the highest-priority rule
            selected_rule, selected_bindings = candidates[0]
            fired_actions = self._execute_actions(selected_rule.actions, selected_bindings)

            selected_rule.fired_count += 1
            result.rules_fired.append(selected_rule.name)
            result.facts_asserted.extend(fired_actions.get("asserted", []))
            result.facts_retracted.extend(fired_actions.get("retracted", []))
            result.iterations = iteration + 1

            # Track history
            self._fired_history.append(selected_rule.name)
            if len(self._fired_history) > self._max_history:
                self._fired_history = self._fired_history[-self._max_history:]

            # Prevent infinite loops: if the same rule fires without new facts, stop
            if not fired_actions.get("asserted") and not fired_actions.get("retracted"):
                break

        return result

    def backward_chain(self, goal: RuleCondition) -> list[list[str]]:
        """Given a goal condition, find proof paths (sequences of rules).

        Returns a list of proof paths. Each path is a list of rule names
        that, if fired in order, would establish the goal.
        """
        proofs: list[list[str]] = []
        self._backward_search(goal, [], set(), proofs, max_depth=10)
        return proofs

    def query(self, pattern: RuleCondition) -> list[Bindings]:
        """Query the fact base for all matches of a condition pattern.

        Returns a list of bindings (variable assignments) for each match.
        """
        results: list[Bindings] = []
        facts = self._graph.query_facts()

        for fact in facts:
            bindings: Bindings = {}
            if self._match_condition_to_fact(pattern, fact, bindings):
                results.append(bindings)
        return results

    def enable_rule(self, name: str) -> bool:
        """Enable a rule for firing."""
        if name in self._rules:
            self._rules[name].enabled = True
            return True
        return False

    def disable_rule(self, name: str) -> bool:
        """Disable a rule (prevents it from firing)."""
        if name in self._rules:
            self._rules[name].enabled = False
            return True
        return False

    def get_rule(self, name: str) -> Optional[Rule]:
        """Retrieve a rule by name."""
        return self._rules.get(name)

    def list_rules(self) -> list[str]:
        """List all rule names."""
        return list(self._rules.keys())

    def get_fired_history(self) -> list[str]:
        """Get the history of fired rule names."""
        return list(self._fired_history)

    # -------------------------------------------------------------------------
    # Internal: Condition Evaluation
    # -------------------------------------------------------------------------

    def _evaluate_conditions(self, conditions: list[RuleCondition]) -> Optional[Bindings]:
        """Check if all conditions of a rule are satisfied.

        Returns combined bindings if all match, None otherwise.
        """
        combined_bindings: Bindings = {}

        for condition in conditions:
            resolved_condition = self._resolve_condition(condition, combined_bindings)
            match_found = False

            facts = self._graph.query_facts(
                subject=resolved_condition.subject if not self._is_variable(resolved_condition.subject) else None,
                predicate=resolved_condition.predicate if not self._is_variable(resolved_condition.predicate) else None,
                obj=resolved_condition.object if not self._is_variable(resolved_condition.object) else None,
            )

            for fact in facts:
                local_bindings: Bindings = dict(combined_bindings)
                if self._match_condition_to_fact(resolved_condition, fact, local_bindings):
                    if condition.negated:
                        return None  # Negated condition matched => fail
                    combined_bindings = local_bindings
                    match_found = True
                    break

            if not match_found:
                if condition.negated:
                    continue  # Negated condition not matched => OK
                return None

        return combined_bindings

    def _match_condition_to_fact(
        self, condition: RuleCondition, fact: Fact, bindings: Bindings
    ) -> bool:
        """Try to match a condition against a fact, updating bindings."""
        if not self._bind_term(condition.subject, fact.subject, bindings):
            return False
        if not self._bind_term(condition.predicate, fact.predicate, bindings):
            return False
        if not self._bind_term(condition.object, fact.object, bindings):
            return False
        return True

    def _bind_term(self, pattern_term: str, fact_term: str, bindings: Bindings) -> bool:
        """Bind a pattern term to a fact term."""
        if self._is_variable(pattern_term):
            var_name = pattern_term.lstrip("?")
            if var_name in bindings:
                return bindings[var_name] == fact_term
            bindings[var_name] = fact_term
            return True
        return pattern_term == fact_term

    def _is_variable(self, term: str) -> bool:
        """Check if a term is a variable (starts with '?')."""
        return term.startswith("?")

    def _resolve_condition(self, condition: RuleCondition, bindings: Bindings) -> RuleCondition:
        """Substitute known bindings into a condition."""
        return RuleCondition(
            subject=self._resolve_term(condition.subject, bindings),
            predicate=self._resolve_term(condition.predicate, bindings),
            object=self._resolve_term(condition.object, bindings),
            negated=condition.negated,
        )

    def _resolve_term(self, term: str, bindings: Bindings) -> str:
        """Resolve a variable term to its bound value if available."""
        if self._is_variable(term):
            var_name = term.lstrip("?")
            if var_name in bindings:
                return str(bindings[var_name])
        return term

    # -------------------------------------------------------------------------
    # Internal: Action Execution
    # -------------------------------------------------------------------------

    def _execute_actions(
        self, actions: list[RuleAction], bindings: Bindings
    ) -> dict[str, list]:
        """Execute rule actions with the given bindings."""
        result: dict[str, list] = {"asserted": [], "retracted": []}

        for action in actions:
            subject = self._resolve_term(action.subject, bindings)
            predicate = self._resolve_term(action.predicate, bindings)
            obj = self._resolve_term(action.object, bindings)

            if action.action_type == "assert":
                fact = self._graph.assert_fact(subject, predicate, obj)
                result["asserted"].append(fact)

            elif action.action_type == "retract":
                self._graph.retract_fact(subject, predicate, obj)
                result["retracted"].append((subject, predicate, obj))

            elif action.action_type == "boost":
                concept = self._graph.get_concept(subject)
                if concept:
                    boost_val = float(action.value) if action.value else 0.2
                    concept.activation = min(1.0, concept.activation + boost_val)

            elif action.action_type == "decay":
                concept = self._graph.get_concept(subject)
                if concept:
                    decay_val = float(action.value) if action.value else 0.1
                    concept.activation = max(0.0, concept.activation - decay_val)

        return result

    # -------------------------------------------------------------------------
    # Internal: Backward Chaining
    # -------------------------------------------------------------------------

    def _backward_search(
        self,
        goal: RuleCondition,
        path: list[str],
        visited: set[str],
        proofs: list[list[str]],
        max_depth: int,
    ) -> None:
        """Recursive backward search for rules that can prove a goal."""
        if len(path) > max_depth:
            return

        # Check if goal is already a known fact
        facts = self._graph.query_facts(
            subject=goal.subject if not self._is_variable(goal.subject) else None,
            predicate=goal.predicate if not self._is_variable(goal.predicate) else None,
            obj=goal.object if not self._is_variable(goal.object) else None,
        )
        if facts:
            proofs.append(list(path))
            return

        # Find rules whose actions could establish the goal
        for rule in self._rules.values():
            if rule.name in visited:
                continue
            if not rule.enabled:
                continue

            for action in rule.actions:
                if action.action_type != "assert":
                    continue
                if self._action_matches_goal(action, goal):
                    # This rule could prove the goal; now prove its conditions
                    visited.add(rule.name)
                    new_path = path + [rule.name]

                    # Try to prove all conditions of this rule
                    all_provable = True
                    for cond in rule.conditions:
                        sub_proofs: list[list[str]] = []
                        self._backward_search(cond, new_path, visited, sub_proofs, max_depth)
                        if not sub_proofs:
                            all_provable = False
                            break

                    if all_provable:
                        proofs.append(new_path)

                    visited.discard(rule.name)

    def _action_matches_goal(self, action: RuleAction, goal: RuleCondition) -> bool:
        """Check if a rule action could potentially satisfy a goal condition."""
        if self._is_variable(goal.subject) or action.subject == goal.subject:
            if self._is_variable(goal.predicate) or action.predicate == goal.predicate:
                if self._is_variable(goal.object) or action.object == goal.object:
                    return True
        return False

    # -------------------------------------------------------------------------
    # Internal: AST Parsing
    # -------------------------------------------------------------------------

    def _parse_when_clause(self, clause: Optional[WhenClauseNode]) -> list[RuleCondition]:
        """Parse AST WhenClauseNode into RuleConditions."""
        if clause is None:
            return []
        conditions: list[RuleCondition] = []
        for cond_node in clause.conditions:
            # Extract condition from AST expression node
            # Simplified: expect BinaryExpr or similar patterns
            conditions.append(self._ast_to_condition(cond_node))
        return conditions

    def _parse_then_clause(self, clause: Optional[ThenClauseNode]) -> list[RuleAction]:
        """Parse AST ThenClauseNode into RuleActions."""
        if clause is None:
            return []
        actions: list[RuleAction] = []
        for action_node in clause.actions:
            actions.append(self._ast_to_action(action_node))
        return actions

    def _ast_to_condition(self, node: Any) -> RuleCondition:
        """Convert an AST node to a RuleCondition (simplified extraction)."""
        from .ast_nodes import BinaryExpr, IdentExpr, NamespacedIdent, FieldAccessExpr

        if isinstance(node, BinaryExpr):
            subject = self._ast_to_term(node.left)
            predicate = node.op
            obj = self._ast_to_term(node.right)
            return RuleCondition(subject=subject, predicate=predicate, object=obj)

        # Fallback: treat as a simple assertion pattern
        return RuleCondition(subject="?x", predicate="exists", object=self._ast_to_term(node))

    def _ast_to_action(self, node: Any) -> RuleAction:
        """Convert an AST node to a RuleAction (simplified extraction)."""
        from .ast_nodes import EmitStmt, InvokeStmt, IdentExpr, NamespacedIdent

        if isinstance(node, EmitStmt):
            signal_name = self._ast_to_term(node.signal)
            return RuleAction(action_type="emit", subject=signal_name)

        # Default: assert action
        return RuleAction(action_type="assert", subject="?x", predicate="inferred", object="true")

    def _ast_to_term(self, node: Any) -> str:
        """Extract a string term from an AST node."""
        from .ast_nodes import IdentExpr, NamespacedIdent, LiteralExpr, FieldAccessExpr

        if node is None:
            return "?"
        if isinstance(node, IdentExpr):
            name = node.name
            return f"?{name}" if name[0].islower() else name
        if isinstance(node, NamespacedIdent):
            return "::".join(node.parts)
        if isinstance(node, LiteralExpr):
            return str(node.value)
        if isinstance(node, FieldAccessExpr):
            obj_str = self._ast_to_term(node.object)
            return f"{obj_str}.{node.field_name}"
        return str(node)

    # -------------------------------------------------------------------------
    # Ternary Extensions
    # -------------------------------------------------------------------------

    def _evaluate_conditions_ternary(
        self, conditions: list[RuleCondition]
    ) -> tuple[int, Optional[Bindings]]:
        """Evaluate conditions using Kleene three-value logic.

        Returns (truth_value, bindings) where truth_value is:
          +1 = all conditions satisfied (TRUE)
           0 = some conditions unknown (UNKNOWN)
          -1 = at least one condition contradicted (FALSE)
        """
        from .ternary import trit_and

        overall_truth = 1  # start TRUE
        combined_bindings: Bindings = {}

        for condition in conditions:
            resolved = self._resolve_condition(condition, combined_bindings)
            facts = self._graph.query_facts(
                subject=resolved.subject if not self._is_variable(resolved.subject) else None,
                predicate=resolved.predicate if not self._is_variable(resolved.predicate) else None,
                obj=resolved.object if not self._is_variable(resolved.object) else None,
            )

            cond_truth = 0  # default: UNKNOWN (no matching fact)

            for fact in facts:
                local_bindings: Bindings = dict(combined_bindings)
                if self._match_condition_to_fact(resolved, fact, local_bindings):
                    fact_tv = getattr(fact, 'truth_value', 1)
                    if condition.negated:
                        fact_tv = -fact_tv
                    cond_truth = fact_tv
                    if fact_tv >= 0:
                        combined_bindings = local_bindings
                    break

            if condition.negated and cond_truth == 0:
                cond_truth = 0  # negated unknown stays unknown

            overall_truth = trit_and(overall_truth, cond_truth)

            if overall_truth == -1:
                return (-1, None)

        return (overall_truth, combined_bindings if overall_truth >= 0 else None)

    def forward_chain_ternary(self, max_iterations: int = 100) -> InferenceResult:
        """Forward chaining with Kleene three-value logic.

        TRUE (+1) rules fire before UNKNOWN (0) rules.
        FALSE (-1) rules are skipped entirely.
        """
        result = InferenceResult()

        for iteration in range(max_iterations):
            true_candidates: list[tuple[Rule, Bindings]] = []
            unknown_candidates: list[tuple[Rule, Bindings]] = []

            for rule in self._rules.values():
                if not rule.enabled:
                    continue
                truth_val, bindings = self._evaluate_conditions_ternary(rule.conditions)
                if truth_val == 1 and bindings is not None:
                    true_candidates.append((rule, bindings))
                elif truth_val == 0 and bindings is not None:
                    unknown_candidates.append((rule, bindings))

            candidates = true_candidates or unknown_candidates
            if not candidates:
                break

            candidates.sort(key=lambda rb: (-rb[0].priority, -len(rb[0].conditions)))

            selected_rule, selected_bindings = candidates[0]
            fired_actions = self._execute_actions_ternary(
                selected_rule.actions, selected_bindings,
                uncertain=(selected_rule in [r for r, _ in unknown_candidates]),
            )

            selected_rule.fired_count += 1
            result.rules_fired.append(selected_rule.name)
            result.facts_asserted.extend(fired_actions.get("asserted", []))
            result.facts_retracted.extend(fired_actions.get("retracted", []))
            result.iterations = iteration + 1

            self._fired_history.append(selected_rule.name)
            if len(self._fired_history) > self._max_history:
                self._fired_history = self._fired_history[-self._max_history:]

            if not fired_actions.get("asserted") and not fired_actions.get("retracted"):
                break

        return result

    def _execute_actions_ternary(
        self, actions: list[RuleAction], bindings: Bindings, uncertain: bool = False
    ) -> dict[str, list]:
        """Execute actions with ternary extensions (negate, inhibit, ternary_set)."""
        result: dict[str, list] = {"asserted": [], "retracted": []}
        confidence = 0.5 if uncertain else 1.0

        for action in actions:
            subject = self._resolve_term(action.subject, bindings)
            predicate = self._resolve_term(action.predicate, bindings)
            obj = self._resolve_term(action.object, bindings)

            if action.action_type == "assert":
                fact = self._graph.assert_ternary_fact(
                    subject, predicate, obj, truth_value=1, confidence=confidence
                )
                result["asserted"].append(fact)

            elif action.action_type == "retract":
                self._graph.retract_fact(subject, predicate, obj)
                result["retracted"].append((subject, predicate, obj))

            elif action.action_type == "negate":
                fact = self._graph.assert_ternary_fact(
                    subject, predicate, obj, truth_value=-1, confidence=confidence
                )
                result["asserted"].append(fact)

            elif action.action_type == "ternary_set":
                tv = int(action.value) if action.value is not None else 0
                fact = self._graph.assert_ternary_fact(
                    subject, predicate, obj, truth_value=tv, confidence=confidence
                )
                result["asserted"].append(fact)

            elif action.action_type == "inhibit":
                self._graph.spread_activation_ternary(
                    subject, energy=-(float(action.value) if action.value else 0.2)
                )

            elif action.action_type == "boost":
                concept = self._graph.get_concept(subject)
                if concept:
                    boost_val = float(action.value) if action.value else 0.2
                    concept.activation = min(1.0, concept.activation + boost_val)

            elif action.action_type == "decay":
                concept = self._graph.get_concept(subject)
                if concept:
                    decay_val = float(action.value) if action.value else 0.1
                    concept.activation = max(-1.0, concept.activation - decay_val)

            elif action.action_type == "emit":
                pass  # Signal emission handled by runtime

        return result

    @property
    def rule_count(self) -> int:
        return len(self._rules)
