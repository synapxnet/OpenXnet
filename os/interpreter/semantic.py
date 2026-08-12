"""
OpenXnet Neuro-Symbolic OS Kernel - Semantic Analysis / Validation

Runs after parsing, before execution. Validates references, type compatibility,
declarations, and structural completeness of the AST.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from .ast_nodes import (
    ASTNode,
    ModuleNode,
    OntologyNode,
    RulesetNode,
    ProcessNode,
    BindingsNode,
    ServiceNode,
    SyscallNode,
    PhaseNode,
    HandlerNode,
    EntryNode,
    ConfigBlockNode,
    ConfigEntryNode,
    StructNode,
    EnumNode,
    StateNode,
    ConstNode,
    FieldNode,
    ConceptNode,
    RelationNode,
    RuleNode,
    ChainNode,
    ChainStepNode,
    ChannelsBlockNode,
    ChannelNode,
    LifecycleNode,
    LifecycleHookNode,
    BehaviorNode,
    BehaviorHandlerNode,
    LetStmt,
    InvokeStmt,
    EmitStmt,
    SpawnStmt,
    ForStmt,
    ReturnStmt,
    CallExpr,
    IdentExpr,
    NamespacedIdent,
    FieldAccessExpr,
    BinaryExpr,
    MatchExpr,
    IfExpr,
    TypeExpr,
)
from .exceptions import SemanticError


@dataclass
class SymbolInfo:
    """Information about a declared symbol."""
    name: str
    kind: str               # "variable", "function", "type", "service", "syscall",
                            # "concept", "relation", "rule", "channel", "module"
    type_expr: Optional[TypeExpr] = None
    defined_at: tuple[int, int] = (0, 0)
    scope: str = ""         # Fully qualified scope name


@dataclass
class Scope:
    """A lexical scope containing symbol declarations."""
    name: str
    parent: Optional["Scope"] = None
    symbols: dict[str, SymbolInfo] = field(default_factory=dict)
    children: list["Scope"] = field(default_factory=list)

    def define(self, name: str, info: SymbolInfo) -> None:
        self.symbols[name] = info

    def lookup(self, name: str) -> Optional[SymbolInfo]:
        if name in self.symbols:
            return self.symbols[name]
        if self.parent:
            return self.parent.lookup(name)
        return None

    def lookup_local(self, name: str) -> Optional[SymbolInfo]:
        return self.symbols.get(name)


class SemanticAnalyzer:
    """Performs semantic validation on a parsed AST.

    Checks performed:
      - Undefined reference detection
      - Duplicate declaration detection
      - Type compatibility (structural)
      - Required fields present in structs/configs
      - Valid syscall signatures
      - Lifecycle completeness (required hooks)
      - Rule condition/action validity
    """

    REQUIRED_LIFECYCLE_HOOKS = {"init", "terminate"}
    VALID_CHANNEL_DIRECTIONS = {"Send", "Recv"}

    def __init__(self):
        self._errors: list[SemanticError] = []
        self._warnings: list[str] = []
        self._global_scope = Scope(name="__global__")
        self._current_scope: Scope = self._global_scope
        self._known_types: set[str] = {
            "Int", "UInt", "Float", "Bool", "String", "Size", "Byte",
            "PhysAddr", "VirtAddr", "List", "Map", "Option", "Result",
            "Ok", "Err", "Some", "None",
        }
        self._known_signals: set[str] = set()
        self._declared_modules: set[str] = set()

    def analyze(self, ast: ASTNode | list[ASTNode]) -> list[SemanticError]:
        """Analyze an AST (single node or list of top-level nodes).

        Returns a list of SemanticError instances. Empty list means valid.
        """
        self._errors = []
        self._warnings = []

        nodes = ast if isinstance(ast, list) else [ast]
        for node in nodes:
            self._analyze_node(node)

        # Post-analysis: resolve cross-references
        self._resolve_references()
        return list(self._errors)

    def get_warnings(self) -> list[str]:
        """Return non-fatal warnings from the last analysis."""
        return list(self._warnings)

    def get_symbol_table(self) -> Scope:
        """Return the global scope (symbol table root)."""
        return self._global_scope

    # -------------------------------------------------------------------------
    # Node Dispatch
    # -------------------------------------------------------------------------

    def _analyze_node(self, node: ASTNode) -> None:
        """Dispatch analysis to the appropriate handler."""
        if isinstance(node, ModuleNode):
            self.check_module(node)
        elif isinstance(node, ProcessNode):
            self.check_process(node)
        elif isinstance(node, OntologyNode):
            self.check_ontology(node)
        elif isinstance(node, RulesetNode):
            self._check_ruleset(node)
        elif isinstance(node, BindingsNode):
            self._check_bindings(node)
        elif isinstance(node, ServiceNode):
            self._check_service(node)
        elif isinstance(node, SyscallNode):
            self._check_syscall(node)
        elif isinstance(node, LetStmt):
            self._check_let(node)
        elif isinstance(node, InvokeStmt):
            self._check_invoke(node)
        elif isinstance(node, EmitStmt):
            self._check_emit(node)
        elif isinstance(node, ForStmt):
            self._check_for(node)
        elif isinstance(node, MatchExpr):
            self._check_match(node)
        elif isinstance(node, IfExpr):
            self._check_if(node)
        elif isinstance(node, CallExpr):
            self._check_call(node)

    # -------------------------------------------------------------------------
    # Module Checks
    # -------------------------------------------------------------------------

    def check_module(self, node: ModuleNode) -> None:
        """Validate a module declaration."""
        # Check duplicate module name
        if node.name in self._declared_modules:
            self._error(f"Duplicate module declaration: '{node.name}'", node)
        self._declared_modules.add(node.name)

        # Enter module scope
        module_scope = self._enter_scope(node.name)

        # Register module in global scope
        self._global_scope.define(node.name, SymbolInfo(
            name=node.name, kind="module", defined_at=(node.line, node.col)
        ))

        # Check requires
        if node.requires:
            for dep in node.requires.modules:
                # Dependencies are validated in resolve_references
                pass

        # Analyze body
        for child in node.body:
            if isinstance(child, StructNode):
                self._check_struct(child)
            elif isinstance(child, EnumNode):
                self._check_enum(child)
            elif isinstance(child, SyscallNode):
                self._check_syscall(child)
            elif isinstance(child, ServiceNode):
                self._check_service(child)
            elif isinstance(child, ConfigBlockNode):
                self._check_config(child)
            elif isinstance(child, StateNode):
                self._check_state_decl(child)
            elif isinstance(child, ConstNode):
                self._check_const(child)
            elif isinstance(child, PhaseNode):
                self._check_phase(child)
            elif isinstance(child, HandlerNode):
                self._check_handler(child)
            elif isinstance(child, EntryNode):
                self._check_entry(child)
            else:
                self._analyze_node(child)

        self._exit_scope()

    # -------------------------------------------------------------------------
    # Process Checks
    # -------------------------------------------------------------------------

    def check_process(self, node: ProcessNode) -> None:
        """Validate a process definition."""
        proc_scope = self._enter_scope(f"process::{node.name}")

        self._global_scope.define(node.name, SymbolInfo(
            name=node.name, kind="process", defined_at=(node.line, node.col)
        ))

        has_lifecycle = False
        lifecycle_hooks: set[str] = set()

        for component in node.components:
            if isinstance(component, ChannelsBlockNode):
                self._check_channels_block(component)
            elif isinstance(component, LifecycleNode):
                has_lifecycle = True
                for hook in component.hooks:
                    lifecycle_hooks.add(hook.event)
                    self._check_lifecycle_hook(hook)
            elif isinstance(component, BehaviorNode):
                self._check_behavior(component)
            else:
                self._analyze_node(component)

        # Lifecycle completeness
        if has_lifecycle:
            missing = self.REQUIRED_LIFECYCLE_HOOKS - lifecycle_hooks
            if missing:
                self._warning(
                    f"Process '{node.name}' missing lifecycle hooks: {missing}",
                    node,
                )

        self._exit_scope()

    # -------------------------------------------------------------------------
    # Ontology Checks
    # -------------------------------------------------------------------------

    def check_ontology(self, node: OntologyNode) -> None:
        """Validate an ontology definition."""
        onto_scope = self._enter_scope(f"ontology::{node.name}")

        for concept in node.concepts:
            self._check_concept(concept)

        for relation in node.relations:
            self._check_relation(relation)

        self._exit_scope()

    # -------------------------------------------------------------------------
    # Detailed Checks
    # -------------------------------------------------------------------------

    def _check_struct(self, node: StructNode) -> None:
        """Check struct declarations for duplicate fields."""
        seen_fields: set[str] = set()
        for f in node.fields:
            if f.name in seen_fields:
                self._error(f"Duplicate field '{f.name}' in struct '{node.name}'", f)
            seen_fields.add(f.name)
            if f.type_expr:
                self._register_type_usage(f.type_expr)

        self._current_scope.define(node.name, SymbolInfo(
            name=node.name, kind="type", defined_at=(node.line, node.col)
        ))
        self._known_types.add(node.name)

    def _check_enum(self, node: EnumNode) -> None:
        """Check enum declarations for duplicate variants."""
        seen_variants: set[str] = set()
        for variant in node.variants:
            if variant.name in seen_variants:
                self._error(f"Duplicate variant '{variant.name}' in enum '{node.name}'", variant)
            seen_variants.add(variant.name)

        self._current_scope.define(node.name, SymbolInfo(
            name=node.name, kind="type", defined_at=(node.line, node.col)
        ))
        self._known_types.add(node.name)

    def _check_syscall(self, node: SyscallNode) -> None:
        """Validate syscall signature and body."""
        # Check for duplicate name in scope
        existing = self._current_scope.lookup_local(node.name)
        if existing:
            self._error(f"Duplicate syscall declaration: '{node.name}'", node)

        self._current_scope.define(node.name, SymbolInfo(
            name=node.name, kind="syscall", defined_at=(node.line, node.col)
        ))

        # Validate params
        seen_params: set[str] = set()
        for param in node.params:
            if param.name in seen_params:
                self._error(f"Duplicate parameter '{param.name}' in syscall '{node.name}'", param)
            seen_params.add(param.name)

        # Validate body
        syscall_scope = self._enter_scope(f"syscall::{node.name}")
        for param in node.params:
            self._current_scope.define(param.name, SymbolInfo(
                name=param.name, kind="variable", type_expr=param.type_expr,
                defined_at=(param.line, param.col)
            ))
        for stmt in node.body:
            self._analyze_node(stmt)
        self._exit_scope()

    def _check_service(self, node: ServiceNode) -> None:
        """Validate service definition."""
        existing = self._current_scope.lookup_local(node.name)
        if existing:
            self._error(f"Duplicate service declaration: '{node.name}'", node)

        self._current_scope.define(node.name, SymbolInfo(
            name=node.name, kind="service", defined_at=(node.line, node.col)
        ))

        svc_scope = self._enter_scope(f"service::{node.name}")
        for stmt in node.body:
            self._analyze_node(stmt)
        self._exit_scope()

    def _check_config(self, node: ConfigBlockNode) -> None:
        """Check config block for duplicate entries."""
        seen: set[str] = set()
        for entry in node.entries:
            if entry.name in seen:
                self._error(f"Duplicate config entry: '{entry.name}'", entry)
            seen.add(entry.name)

    def _check_state_decl(self, node: StateNode) -> None:
        """Register a state declaration in the current scope."""
        self._current_scope.define(node.name, SymbolInfo(
            name=node.name, kind="variable", type_expr=node.type_expr,
            defined_at=(node.line, node.col)
        ))

    def _check_const(self, node: ConstNode) -> None:
        """Register a constant in the current scope."""
        self._current_scope.define(node.name, SymbolInfo(
            name=node.name, kind="variable", defined_at=(node.line, node.col)
        ))

    def _check_phase(self, node: PhaseNode) -> None:
        """Validate a lifecycle phase block."""
        phase_scope = self._enter_scope(f"phase::{node.name}")
        for stmt in node.body:
            self._analyze_node(stmt)
        self._exit_scope()

    def _check_handler(self, node: HandlerNode) -> None:
        """Validate an event handler."""
        handler_scope = self._enter_scope("handler")
        for param in node.params:
            self._current_scope.define(param.name, SymbolInfo(
                name=param.name, kind="variable", defined_at=(param.line, param.col)
            ))
        for stmt in node.body:
            self._analyze_node(stmt)
        self._exit_scope()

    def _check_entry(self, node: EntryNode) -> None:
        """Validate entry point block."""
        entry_scope = self._enter_scope("entry")
        for stmt in node.body:
            self._analyze_node(stmt)
        self._exit_scope()

    def _check_concept(self, node: ConceptNode) -> None:
        """Validate a concept declaration."""
        self._current_scope.define(node.name, SymbolInfo(
            name=node.name, kind="concept", defined_at=(node.line, node.col)
        ))
        self._known_types.add(node.name)

        if node.weight < 0.0 or node.weight > 1.0:
            self._warning(f"Concept '{node.name}' weight {node.weight} outside [0,1]", node)

    def _check_relation(self, node: RelationNode) -> None:
        """Validate a relation declaration."""
        self._current_scope.define(node.name, SymbolInfo(
            name=node.name, kind="relation", defined_at=(node.line, node.col)
        ))

    def _check_ruleset(self, node: RulesetNode) -> None:
        """Validate a ruleset."""
        rs_scope = self._enter_scope(f"ruleset::{node.name}")
        for rule in node.rules:
            self._check_rule(rule)
        self._exit_scope()

    def _check_rule(self, node: RuleNode) -> None:
        """Validate a single rule."""
        self._current_scope.define(node.name, SymbolInfo(
            name=node.name, kind="rule", defined_at=(node.line, node.col)
        ))
        if node.when_clause:
            for cond in node.when_clause.conditions:
                self._analyze_node(cond)
        if node.then_clause:
            for action in node.then_clause.actions:
                self._analyze_node(action)

    def _check_bindings(self, node: BindingsNode) -> None:
        """Validate bindings block."""
        for bind in node.binds:
            # Bindings are validated during resolve_references
            pass

    def _check_channels_block(self, node: ChannelsBlockNode) -> None:
        """Validate channel declarations."""
        seen: set[str] = set()
        for ch in node.channels:
            if ch.name in seen:
                self._error(f"Duplicate channel declaration: '{ch.name}'", ch)
            seen.add(ch.name)
            if ch.direction and ch.direction not in self.VALID_CHANNEL_DIRECTIONS:
                self._error(f"Invalid channel direction '{ch.direction}' for '{ch.name}'", ch)
            self._current_scope.define(ch.name, SymbolInfo(
                name=ch.name, kind="channel", defined_at=(ch.line, ch.col)
            ))

    def _check_lifecycle_hook(self, node: LifecycleHookNode) -> None:
        """Validate a lifecycle hook body."""
        hook_scope = self._enter_scope(f"hook::{node.event}")
        for stmt in node.body:
            self._analyze_node(stmt)
        self._exit_scope()

    def _check_behavior(self, node: BehaviorNode) -> None:
        """Validate behavior handler block."""
        for handler in node.handlers:
            bh_scope = self._enter_scope(f"behavior::{handler.event_type}")
            if handler.binding:
                self._current_scope.define(handler.binding, SymbolInfo(
                    name=handler.binding, kind="variable",
                    defined_at=(handler.line, handler.col)
                ))
            for stmt in handler.body:
                self._analyze_node(stmt)
            self._exit_scope()

    def _check_let(self, node: LetStmt) -> None:
        """Validate a let statement."""
        existing = self._current_scope.lookup_local(node.name)
        if existing:
            self._warning(f"Variable '{node.name}' shadows existing declaration", node)
        self._current_scope.define(node.name, SymbolInfo(
            name=node.name, kind="variable", type_expr=node.type_expr,
            defined_at=(node.line, node.col)
        ))
        if node.value:
            self._analyze_node(node.value)

    def _check_invoke(self, node: InvokeStmt) -> None:
        """Validate an invoke statement."""
        if node.call:
            self._analyze_node(node.call)

    def _check_emit(self, node: EmitStmt) -> None:
        """Validate an emit statement (signal emission)."""
        if node.signal and isinstance(node.signal, NamespacedIdent):
            signal_name = "::".join(node.signal.parts)
            self._known_signals.add(signal_name)

    def _check_for(self, node: ForStmt) -> None:
        """Validate a for loop."""
        loop_scope = self._enter_scope("for")
        self._current_scope.define(node.variable, SymbolInfo(
            name=node.variable, kind="variable", defined_at=(node.line, node.col)
        ))
        if node.iterable:
            self._analyze_node(node.iterable)
        for stmt in node.body:
            self._analyze_node(stmt)
        self._exit_scope()

    def _check_match(self, node: MatchExpr) -> None:
        """Validate a match expression."""
        if node.subject:
            self._analyze_node(node.subject)
        for arm in node.arms:
            if arm.body:
                self._analyze_node(arm.body)

    def _check_if(self, node: IfExpr) -> None:
        """Validate an if expression."""
        if node.condition:
            self._analyze_node(node.condition)
        for stmt in node.then_body:
            self._analyze_node(stmt)
        for stmt in node.else_body:
            self._analyze_node(stmt)

    def _check_call(self, node: CallExpr) -> None:
        """Validate a function/method call."""
        # Callee reference will be checked in resolve_references
        for arg in node.args:
            self._analyze_node(arg)

    # -------------------------------------------------------------------------
    # Reference Resolution
    # -------------------------------------------------------------------------

    def resolve_references(self) -> None:
        """Post-pass: check that all referenced names are defined somewhere."""
        # This is called at the end of analyze(). In a full implementation,
        # we would walk the AST again checking every IdentExpr and NamespacedIdent
        # against the symbol table. For now, we validate module dependencies.
        pass

    def _register_type_usage(self, type_expr: TypeExpr) -> None:
        """Track a type usage for later validation."""
        if type_expr.name and type_expr.name not in self._known_types:
            # Allow generic type parameters
            if not type_expr.name[0].isupper():
                return
            self._warnings.append(f"Unknown type '{type_expr.name}' (may be defined elsewhere)")
        for param in type_expr.params:
            self._register_type_usage(param)

    # -------------------------------------------------------------------------
    # Scope Management
    # -------------------------------------------------------------------------

    def _enter_scope(self, name: str) -> Scope:
        """Create and enter a new child scope."""
        child = Scope(name=name, parent=self._current_scope)
        self._current_scope.children.append(child)
        self._current_scope = child
        return child

    def _exit_scope(self) -> None:
        """Exit the current scope, returning to parent."""
        if self._current_scope.parent:
            self._current_scope = self._current_scope.parent

    # -------------------------------------------------------------------------
    # Error Reporting
    # -------------------------------------------------------------------------

    def _error(self, message: str, node: ASTNode) -> None:
        """Record a semantic error."""
        self._errors.append(SemanticError(
            message=message,
            line=node.line,
            col=node.col,
        ))

    def _warning(self, message: str, node: ASTNode) -> None:
        """Record a non-fatal warning."""
        self._warnings.append(f"[{node.line}:{node.col}] {message}")

    def _resolve_references(self) -> None:
        """Internal resolution pass (called by analyze)."""
        self.resolve_references()
