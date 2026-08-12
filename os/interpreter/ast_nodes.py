"""
OpenXnet Neuro-Symbolic OS Kernel Interpreter - AST Node Hierarchy

Defines the complete Abstract Syntax Tree for three DSL file types:
  .oxk  - Kernel module definitions
  .nxs  - Symbol graph / ontology definitions
  .oxp  - Process definitions
"""

from dataclasses import dataclass, field
from typing import List, Optional, Any


# =============================================================================
# Base Node
# =============================================================================

@dataclass
class ASTNode:
    """Base class for all AST nodes. Carries source location."""
    line: int = 0
    col: int = 0


# =============================================================================
# Top-Level Nodes
# =============================================================================

@dataclass
class ModuleNode(ASTNode):
    """Top-level .oxk module declaration.

    Example:
        module kernel::memory :microkernel {| ... |}
    """
    name: str = ""
    module_type: str = ""           # :microkernel, :driver, :service, etc.
    version: Optional["VersionNode"] = None
    priority: Optional["PriorityNode"] = None
    requires: Optional["RequiresListNode"] = None
    body: List[ASTNode] = field(default_factory=list)


@dataclass
class OntologyNode(ASTNode):
    """Top-level .nxs ontology block.

    Example:
        ontology system::resources {| ... |}
    """
    name: str = ""
    concepts: List["ConceptNode"] = field(default_factory=list)
    relations: List["RelationNode"] = field(default_factory=list)


@dataclass
class RulesetNode(ASTNode):
    """Top-level .nxs ruleset block.

    Example:
        ruleset memory::management {| ... |}
    """
    name: str = ""
    rules: List["RuleNode"] = field(default_factory=list)
    chains: List["ChainNode"] = field(default_factory=list)


@dataclass
class BindingsNode(ASTNode):
    """Top-level .nxs bindings block.

    Example:
        bindings memory::hooks {| ... |}
    """
    name: str = ""
    binds: List["BindNode"] = field(default_factory=list)


@dataclass
class ProcessNode(ASTNode):
    """Top-level .oxp process definition.

    Example:
        process shell::main :interactive {| ... |}
    """
    name: str = ""
    process_type: str = ""          # :interactive, :daemon, :worker, etc.
    components: List[ASTNode] = field(default_factory=list)


# =============================================================================
# Module Components (.oxk)
# =============================================================================

@dataclass
class VersionNode(ASTNode):
    """Version declaration.

    Example:
        version "1.0.0"
    """
    value: str = ""


@dataclass
class PriorityNode(ASTNode):
    """Priority declaration.

    Example:
        priority 0
    """
    value: int = 0


@dataclass
class RequiresListNode(ASTNode):
    """Module dependency list.

    Example:
        requires [kernel::base, kernel::ipc]
    """
    modules: List[str] = field(default_factory=list)


@dataclass
class ConfigBlockNode(ASTNode):
    """Configuration block containing typed entries.

    Example:
        config {|
            page_size :: Size = 4096
            max_pages :: UInt = 1048576
        |}
    """
    entries: List["ConfigEntryNode"] = field(default_factory=list)


@dataclass
class ConfigEntryNode(ASTNode):
    """A single configuration entry.

    Example:
        page_size :: Size = 4096
    """
    name: str = ""
    type_expr: Optional["TypeExpr"] = None
    value: Optional[ASTNode] = None


@dataclass
class EnumNode(ASTNode):
    """Enum type definition.

    Example:
        enum PageState {|
            Free
            Allocated
            Mapped(VirtAddr)
        |}
    """
    name: str = ""
    variants: List["EnumVariant"] = field(default_factory=list)


@dataclass
class EnumVariant(ASTNode):
    """A single enum variant, optionally with associated data.

    Example:
        Mapped(VirtAddr)
    """
    name: str = ""
    fields: List["TypeExpr"] = field(default_factory=list)


@dataclass
class StructNode(ASTNode):
    """Struct type definition.

    Example:
        struct PageTable {|
            entries :: List<PageEntry>
            level :: UInt [| range(0, 4) |]
        |}
    """
    name: str = ""
    fields: List["FieldNode"] = field(default_factory=list)


@dataclass
class FieldNode(ASTNode):
    """A typed field with optional constraints.

    Example:
        name :: Type [| constraint |]
    """
    name: str = ""
    type_expr: Optional["TypeExpr"] = None
    constraints: Optional["ConstraintExpr"] = None
    default: Optional[ASTNode] = None


@dataclass
class StateNode(ASTNode):
    """Module-level state declaration.

    Example:
        state page_table :: PageTable = PageTable.new()
    """
    name: str = ""
    type_expr: Optional["TypeExpr"] = None
    initial_value: Optional[ASTNode] = None


@dataclass
class ConstNode(ASTNode):
    """Constant declaration.

    Example:
        const MAX_PAGES :: UInt = 1048576
    """
    name: str = ""
    type_expr: Optional["TypeExpr"] = None
    value: Optional[ASTNode] = None


@dataclass
class SyscallNode(ASTNode):
    """System call definition.

    Example:
        syscall alloc_page(size :: Size, flags :: PageFlags) -> Result<PhysAddr> {|
            ...
        |}
    """
    name: str = ""
    params: List["FieldNode"] = field(default_factory=list)
    return_type: Optional["TypeExpr"] = None
    body: List[ASTNode] = field(default_factory=list)


@dataclass
class ServiceNode(ASTNode):
    """Background service definition.

    Example:
        service page_reclaimer() {|
            ...
        |}
    """
    name: str = ""
    params: List["FieldNode"] = field(default_factory=list)
    body: List[ASTNode] = field(default_factory=list)


@dataclass
class PhaseNode(ASTNode):
    """Boot/lifecycle phase block.

    Example:
        phase Init {|
            invoke setup_page_tables()
            invoke map_kernel_space()
        |}
    """
    name: str = ""
    body: List[ASTNode] = field(default_factory=list)


@dataclass
class HandlerNode(ASTNode):
    """Signal or event handler.

    Example:
        on signal::MEMORY_PRESSURE {|
            invoke reclaim_pages()
        |}
    """
    event: Optional[ASTNode] = None     # NamespacedIdent or IdentExpr
    params: List["FieldNode"] = field(default_factory=list)
    body: List[ASTNode] = field(default_factory=list)


@dataclass
class EntryNode(ASTNode):
    """Module entry point.

    Example:
        entry {|
            invoke init_memory_subsystem()
        |}
    """
    body: List[ASTNode] = field(default_factory=list)


# =============================================================================
# Symbol Graph Components (.nxs)
# =============================================================================

@dataclass
class ConceptNode(ASTNode):
    """Ontology concept definition.

    Example:
        concept MemoryRegion <: Resource @0.9 {|
            base_addr :: PhysAddr
            size :: Size
            state :: RegionState
        |}
    """
    name: str = ""
    parent: Optional[str] = None        # Parent concept (after <:)
    weight: float = 1.0                  # Activation weight (@weight)
    fields: List["FieldNode"] = field(default_factory=list)


@dataclass
class RelationNode(ASTNode):
    """Ontology relation definition.

    Example:
        relation owns :: (Process, MemoryRegion) @0.8
    """
    name: str = ""
    source_type: str = ""               # First type in tuple
    target_type: str = ""               # Second type in tuple
    weight: float = 1.0
    properties: List["FieldNode"] = field(default_factory=list)


@dataclass
class RuleNode(ASTNode):
    """Inference rule definition.

    Example:
        rule MemoryPressureResponse @0.85 {|
            when {| ... |}
            then {| ... |}
        |}
    """
    name: str = ""
    weight: float = 1.0
    when_clause: Optional["WhenClauseNode"] = None
    then_clause: Optional["ThenClauseNode"] = None


@dataclass
class WhenClauseNode(ASTNode):
    """Conditions block of a rule.

    Example:
        when {|
            memory.usage > 0.8
            process.priority < 5
        |}
    """
    conditions: List[ASTNode] = field(default_factory=list)


@dataclass
class ThenClauseNode(ASTNode):
    """Actions block of a rule.

    Example:
        then {|
            emit signal::RECLAIM
            transition process -> Suspended
        |}
    """
    actions: List[ASTNode] = field(default_factory=list)


@dataclass
class ChainNode(ASTNode):
    """Inference chain definition (ordered rule steps).

    Example:
        chain MemoryRecovery {|
            step 1: detect_pressure => pressure_level
            step 2: select_victims(pressure_level) => victims
            step 3: reclaim(victims) => freed
        |}
    """
    name: str = ""
    steps: List["ChainStepNode"] = field(default_factory=list)


@dataclass
class ChainStepNode(ASTNode):
    """A single step in an inference chain.

    Example:
        step 1: detect_pressure => pressure_level
    """
    order: int = 0
    expression: Optional[ASTNode] = None    # The invocation expression
    binding: Optional[str] = None           # Variable bound to result


@dataclass
class BindNode(ASTNode):
    """Binding from ontology concepts to kernel services.

    Example:
        bind memory::pressure_detector => kernel::memory::check_pressure
    """
    source: str = ""
    target: str = ""
    options: List[ASTNode] = field(default_factory=list)


# =============================================================================
# Process Components (.oxp)
# =============================================================================

@dataclass
class SingletonNode(ASTNode):
    """Singleton process flag.

    Example:
        singleton true
    """
    value: bool = False


@dataclass
class RestartPolicyNode(ASTNode):
    """Process restart policy.

    Example:
        restart_policy :always
    """
    policy: str = ""                    # :always, :never, :on_failure, etc.


@dataclass
class RequiresBlockNode(ASTNode):
    """Process resource requirements.

    Example:
        requires {|
            capabilities [:ipc, :memory_alloc]
            memory 4096
            priority 5
        |}
    """
    capabilities: List[str] = field(default_factory=list)
    memory: Optional[ASTNode] = None
    priority: Optional[ASTNode] = None
    extra: List[ASTNode] = field(default_factory=list)


@dataclass
class StateBlockNode(ASTNode):
    """Process state declarations block.

    Example:
        state {|
            buffer :: List<Byte> = []
            running :: Bool = true
        |}
    """
    declarations: List["StateNode"] = field(default_factory=list)


@dataclass
class ChannelsBlockNode(ASTNode):
    """Process channels block.

    Example:
        channels {|
            input :: Recv<Command> capacity 16
            output :: Send<Response> capacity 32
        |}
    """
    channels: List["ChannelNode"] = field(default_factory=list)


@dataclass
class ChannelNode(ASTNode):
    """Channel declaration.

    Example:
        input :: Recv<Command> capacity 16
    """
    name: str = ""
    direction: str = ""                 # "Send" or "Recv"
    message_type: Optional["TypeExpr"] = None
    capacity: Optional[int] = None


@dataclass
class LifecycleNode(ASTNode):
    """Process lifecycle hooks block.

    Example:
        lifecycle {|
            on init {| ... |}
            on suspend {| ... |}
            on resume {| ... |}
            on terminate {| ... |}
        |}
    """
    hooks: List["LifecycleHookNode"] = field(default_factory=list)


@dataclass
class LifecycleHookNode(ASTNode):
    """A single lifecycle hook.

    Example:
        on init {|
            invoke setup()
        |}
    """
    event: str = ""                     # "init", "suspend", "resume", "terminate"
    body: List[ASTNode] = field(default_factory=list)


@dataclass
class BehaviorNode(ASTNode):
    """Process behavior handlers block.

    Example:
        behavior {|
            on recv(input) as cmd {| ... |}
            on signal::SHUTDOWN {| ... |}
        |}
    """
    handlers: List["BehaviorHandlerNode"] = field(default_factory=list)


@dataclass
class BehaviorHandlerNode(ASTNode):
    """A single behavior handler.

    Example:
        on recv(input) as cmd {|
            match cmd {| ... |}
        |}
    """
    event_type: str = ""                # "recv", "signal", "timer", etc.
    source: Optional[ASTNode] = None    # Channel or signal expression
    binding: Optional[str] = None       # 'as' binding name
    params: List["FieldNode"] = field(default_factory=list)
    body: List[ASTNode] = field(default_factory=list)


# =============================================================================
# Expressions
# =============================================================================

@dataclass
class LiteralExpr(ASTNode):
    """Literal value expression.

    Supports: int, float, string, symbol (:name), duration (5ms, 1s),
              bool (true/false), None/null.
    """
    value: Any = None
    literal_type: str = ""              # "int", "float", "string", "symbol",
                                        # "duration", "bool", "null"


@dataclass
class IdentExpr(ASTNode):
    """Simple identifier expression.

    Example:
        page_table, count, x
    """
    name: str = ""


@dataclass
class NamespacedIdent(ASTNode):
    """Namespaced identifier using :: separator.

    Example:
        signal::MEMORY_PRESSURE, kernel::memory::alloc
    """
    parts: List[str] = field(default_factory=list)


@dataclass
class BinaryExpr(ASTNode):
    """Binary operation expression.

    Example:
        a + b, x > 0, left && right
    """
    left: Optional[ASTNode] = None
    op: str = ""                        # +, -, *, /, %, ==, !=, <, >, <=, >=,
                                        # &&, ||, &, |, ^, <<, >>, .., |>
    right: Optional[ASTNode] = None


@dataclass
class UnaryExpr(ASTNode):
    """Unary operation expression.

    Example:
        !cond, -value
    """
    op: str = ""                        # !, -, ~
    operand: Optional[ASTNode] = None


@dataclass
class CallExpr(ASTNode):
    """Function/method call expression.

    Example:
        alloc_page(4096, :read_write)
    """
    callee: Optional[ASTNode] = None    # IdentExpr, NamespacedIdent, FieldAccessExpr
    args: List[ASTNode] = field(default_factory=list)


@dataclass
class FieldAccessExpr(ASTNode):
    """Field/member access via dot notation.

    Example:
        process.memory.usage
    """
    object: Optional[ASTNode] = None
    field_name: str = ""


@dataclass
class IndexExpr(ASTNode):
    """Index/subscript access.

    Example:
        pages[idx], table[key]
    """
    object: Optional[ASTNode] = None
    index: Optional[ASTNode] = None


@dataclass
class MatchExpr(ASTNode):
    """Pattern matching expression.

    Example:
        match state {|
            :Free => alloc()
            :Allocated => use()
            _ => error()
        |}
    """
    subject: Optional[ASTNode] = None
    arms: List["MatchArm"] = field(default_factory=list)


@dataclass
class MatchArm(ASTNode):
    """A single arm in a match expression.

    Example:
        :Free => alloc()
    """
    pattern: Optional[ASTNode] = None
    guard: Optional[ASTNode] = None     # Optional 'where' guard
    body: Optional[ASTNode] = None


@dataclass
class IfExpr(ASTNode):
    """Conditional expression.

    Example:
        if usage > threshold {|
            reclaim()
        |} else {|
            continue()
        |}
    """
    condition: Optional[ASTNode] = None
    then_body: List[ASTNode] = field(default_factory=list)
    else_body: List[ASTNode] = field(default_factory=list)


@dataclass
class BlockExpr(ASTNode):
    """Block expression containing a sequence of statements.

    Example:
        {| stmt1; stmt2; expr |}
    """
    statements: List[ASTNode] = field(default_factory=list)


@dataclass
class StructLiteral(ASTNode):
    """Struct instantiation expression.

    Example:
        PageEntry { addr: phys, flags: :read_write, ref_count: 0 }
    """
    type_name: str = ""
    fields: List["StructLiteralField"] = field(default_factory=list)


@dataclass
class StructLiteralField(ASTNode):
    """A field in a struct literal.

    Example:
        addr: phys
    """
    name: str = ""
    value: Optional[ASTNode] = None


@dataclass
class ListLiteral(ASTNode):
    """List literal expression.

    Example:
        [1, 2, 3], [:read, :write, :exec]
    """
    elements: List[ASTNode] = field(default_factory=list)


@dataclass
class MapLiteral(ASTNode):
    """Map literal expression.

    Example:
        { "key1": value1, "key2": value2 }
    """
    entries: List["MapEntry"] = field(default_factory=list)


@dataclass
class MapEntry(ASTNode):
    """A key-value pair in a map literal."""
    key: Optional[ASTNode] = None
    value: Optional[ASTNode] = None


@dataclass
class TypeExpr(ASTNode):
    """Type expression with optional generic parameters.

    Example:
        Result<PhysAddr>, Map<String, List<Page>>, Option<Size>
    """
    name: str = ""
    params: List["TypeExpr"] = field(default_factory=list)
    is_optional: bool = False           # Shorthand ? suffix


@dataclass
class ConstraintExpr(ASTNode):
    """Constraint expression applied to a field or type.

    Example:
        [| range(0, 4096), non_null |]
    """
    constraints: List[ASTNode] = field(default_factory=list)


@dataclass
class LambdaExpr(ASTNode):
    """Lambda/closure expression.

    Example:
        |x, y| x + y
    """
    params: List["FieldNode"] = field(default_factory=list)
    body: Optional[ASTNode] = None


# =============================================================================
# Statements
# =============================================================================

@dataclass
class LetStmt(ASTNode):
    """Variable binding statement.

    Example:
        let page = alloc_page(4096)
        let count :: UInt = 0
    """
    name: str = ""
    type_expr: Optional["TypeExpr"] = None
    value: Optional[ASTNode] = None
    mutable: bool = False               # let mut x = ...


@dataclass
class AssignStmt(ASTNode):
    """Assignment statement.

    Example:
        count = count + 1
        page.flags = :read_only
    """
    target: Optional[ASTNode] = None    # IdentExpr, FieldAccessExpr, IndexExpr
    value: Optional[ASTNode] = None


@dataclass
class InvokeStmt(ASTNode):
    """Explicit action invocation statement.

    Example:
        invoke setup_page_tables()
        invoke kernel::ipc::register(self)
    """
    call: Optional[ASTNode] = None      # CallExpr or NamespacedIdent


@dataclass
class EmitStmt(ASTNode):
    """Signal emission statement.

    Example:
        emit signal::MEMORY_PRESSURE { level: :critical, source: self }
    """
    signal: Optional[ASTNode] = None    # NamespacedIdent
    data: Optional[ASTNode] = None      # StructLiteral or MapLiteral


@dataclass
class SpawnStmt(ASTNode):
    """Process spawn statement.

    Example:
        spawn "system/gc.oxp" as gc_process with { priority: 2 }
    """
    path: str = ""
    alias: Optional[str] = None         # 'as' name
    options: Optional[ASTNode] = None   # StructLiteral or MapLiteral


@dataclass
class SendStmt(ASTNode):
    """Channel send statement.

    Example:
        send output <- Response { status: :ok, data: result }
    """
    channel: Optional[ASTNode] = None   # IdentExpr or FieldAccessExpr
    value: Optional[ASTNode] = None


@dataclass
class RecvExpr(ASTNode):
    """Channel receive expression.

    Example:
        recv(input)
    """
    channel: Optional[ASTNode] = None   # IdentExpr or FieldAccessExpr
    timeout: Optional[ASTNode] = None   # Optional timeout duration


@dataclass
class TransitionStmt(ASTNode):
    """State transition statement.

    Example:
        transition pcb -> Running
        transition self -> Suspended
    """
    target: Optional[ASTNode] = None    # What is being transitioned
    new_state: Optional[ASTNode] = None # Target state (IdentExpr or NamespacedIdent)


@dataclass
class ReturnStmt(ASTNode):
    """Return statement.

    Example:
        return Ok(addr)
        return Err(:out_of_memory)
    """
    value: Optional[ASTNode] = None


@dataclass
class ForStmt(ASTNode):
    """For loop statement.

    Example:
        for page in pages [where page.state == :Free] {|
            reclaim(page)
        |}
    """
    variable: str = ""
    iterable: Optional[ASTNode] = None
    condition: Optional[ASTNode] = None     # Optional 'where' filter
    body: List[ASTNode] = field(default_factory=list)


@dataclass
class WhileStmt(ASTNode):
    """While loop statement (used in retry/polling patterns).

    Example:
        while running {|
            process_next()
        |}
    """
    condition: Optional[ASTNode] = None
    body: List[ASTNode] = field(default_factory=list)


@dataclass
class SignalStmt(ASTNode):
    """Directed signal statement to a specific target.

    Example:
        signal parent ::CHILD_EXITED { code: 0 }
    """
    target: Optional[ASTNode] = None    # Target process/entity
    signal_name: Optional[ASTNode] = None   # NamespacedIdent or IdentExpr
    data: Optional[ASTNode] = None      # Payload


@dataclass
class BreakStmt(ASTNode):
    """Break out of a loop."""
    pass


@dataclass
class ContinueStmt(ASTNode):
    """Continue to next iteration of a loop."""
    pass


@dataclass
class ExprStmt(ASTNode):
    """An expression used as a statement.

    Example:
        log("message")
        counter.increment()
    """
    expression: Optional[ASTNode] = None


# =============================================================================
# Ternary Extensions
# =============================================================================

@dataclass
class TernaryAnnotation(ASTNode):
    """Ternary truth value annotation on a fact or relation.

    Example:
        assert P -> owns -> M @ternary(+1)
        negate P -> owns -> M   -- shorthand for @ternary(-1)
    """
    value: int = 1  # -1, 0, or +1


@dataclass
class TritVectorLiteral(ASTNode):
    """A trit vector literal in DSL source.

    Example:
        trit [+1, 0, -1, +1, 0, 0, -1]
    """
    elements: List[int] = field(default_factory=list)


@dataclass
class InhibitStmt(ASTNode):
    """Inhibition statement (negative activation spreading).

    Example:
        inhibit Process by 0.3
    """
    target: Optional[ASTNode] = None
    value: Optional[ASTNode] = None


@dataclass
class NegateStmt(ASTNode):
    """Negate a fact in the knowledge base.

    Example:
        negate P -> owns -> M
    """
    subject: Optional[ASTNode] = None
    predicate: Optional[ASTNode] = None
    object: Optional[ASTNode] = None
