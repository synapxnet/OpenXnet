"""
OpenXnet Neuro-Symbolic OS Kernel Interpreter - Core Runtime Engine

Executes AST nodes produced by the parser. Manages environments (scopes),
module loading, service instantiation, expression evaluation, and
statement execution.
"""

from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
import time
import logging

from .ast_nodes import (
    ASTNode, ModuleNode, OntologyNode, RulesetNode, BindingsNode, ProcessNode,
    ConfigBlockNode, ConfigEntryNode, EnumNode, StructNode, FieldNode,
    StateNode, ConstNode, SyscallNode, ServiceNode, PhaseNode, HandlerNode,
    EntryNode, ConceptNode, RelationNode, RuleNode, BindNode,
    ChannelsBlockNode, LifecycleNode, BehaviorNode,
    LiteralExpr, IdentExpr, NamespacedIdent, BinaryExpr, UnaryExpr,
    CallExpr, FieldAccessExpr, IndexExpr, MatchExpr, MatchArm, IfExpr,
    BlockExpr, StructLiteral, ListLiteral, MapLiteral,
    LetStmt, AssignStmt, InvokeStmt, EmitStmt, SpawnStmt, SendStmt,
    TransitionStmt, ReturnStmt, ForStmt, WhileStmt, SignalStmt, ExprStmt,
    RequiresBlockNode, StateBlockNode, LifecycleHookNode, BehaviorHandlerNode,
    InhibitStmt, NegateStmt,
)
from .exceptions import OXRuntimeError

logger = logging.getLogger("openxnet.runtime")


class ReturnSignal(Exception):
    """Control flow: propagate return value up the call stack."""
    def __init__(self, value: Any = None):
        self.value = value


class BreakSignal(Exception):
    pass


class ContinueSignal(Exception):
    pass


@dataclass
class Environment:
    """Lexical scope with parent chain for variable lookup."""
    bindings: Dict[str, Any] = field(default_factory=dict)
    parent: Optional["Environment"] = None

    def get(self, name: str) -> Any:
        if name in self.bindings:
            return self.bindings[name]
        if self.parent:
            return self.parent.get(name)
        raise OXRuntimeError(f"Undefined variable: {name}")

    def set(self, name: str, value: Any):
        self.bindings[name] = value

    def update(self, name: str, value: Any):
        if name in self.bindings:
            self.bindings[name] = value
            return
        if self.parent:
            self.parent.update(name, value)
            return
        raise OXRuntimeError(f"Cannot assign to undefined variable: {name}")

    def child(self) -> "Environment":
        return Environment(parent=self)


@dataclass
class OXModule:
    """A loaded .oxk module."""
    name: str
    module_type: str
    version: str = "0.0.0"
    structs: Dict[str, StructNode] = field(default_factory=dict)
    enums: Dict[str, EnumNode] = field(default_factory=dict)
    syscalls: Dict[str, SyscallNode] = field(default_factory=dict)
    services: Dict[str, ServiceNode] = field(default_factory=dict)
    phases: Dict[str, PhaseNode] = field(default_factory=dict)
    handlers: Dict[str, HandlerNode] = field(default_factory=dict)
    state: Dict[str, Any] = field(default_factory=dict)
    config: Dict[str, Any] = field(default_factory=dict)
    env: Environment = field(default_factory=Environment)


@dataclass
class OXProcess:
    """A spawned .oxp process."""
    pid: int
    name: str
    process_type: str
    state: str = "ready"
    priority: int = 5
    memory_usage: int = 0
    channels: List[str] = field(default_factory=list)
    uptime_ticks: int = 0
    env: Environment = field(default_factory=Environment)
    lifecycle_hooks: Dict[str, List[ASTNode]] = field(default_factory=dict)
    behavior_handlers: List[BehaviorHandlerNode] = field(default_factory=list)


class Runtime:
    """Core runtime engine for the OpenXnet kernel DSL."""

    def __init__(self, scheduler=None, memory=None, ipc=None,
                 syscalls=None, symbol_graph=None, trit_memory=None):
        self.scheduler = scheduler
        self.memory = memory
        self.ipc = ipc
        self.syscall_dispatcher = syscalls
        self.symbol_graph = symbol_graph
        self.trit_memory = trit_memory

        self.global_env = Environment()
        self.modules: Dict[str, OXModule] = {}
        self.processes: Dict[int, OXProcess] = {}
        self._next_pid = 1
        self._builtins: Dict[str, Callable] = {}
        self._signal_handlers: Dict[str, List[Callable]] = {}

        self._register_builtins()

    def _register_builtins(self):
        self._builtins["len"] = lambda args: len(args[0]) if args else 0
        self._builtins["print"] = lambda args: logger.info(" ".join(str(a) for a in args))
        self._builtins["log"] = lambda args: logger.info(" ".join(str(a) for a in args))
        self._builtins["str"] = lambda args: str(args[0]) if args else ""
        self._builtins["int"] = lambda args: int(args[0]) if args else 0
        self._builtins["float"] = lambda args: float(args[0]) if args else 0.0
        self._builtins["type_of"] = lambda args: type(args[0]).__name__ if args else "None"
        self._builtins["now_ms"] = lambda args: int(time.time() * 1000)
        self._builtins["keys"] = lambda args: list(args[0].keys()) if args and isinstance(args[0], dict) else []
        self._builtins["values"] = lambda args: list(args[0].values()) if args and isinstance(args[0], dict) else []
        self._builtins["push"] = lambda args: args[0].append(args[1]) if len(args) >= 2 and isinstance(args[0], list) else None
        self._builtins["pop"] = lambda args: args[0].pop() if args and isinstance(args[0], list) and args[0] else None
        self._builtins["contains"] = lambda args: args[1] in args[0] if len(args) >= 2 else False
        self._builtins["min"] = lambda args: min(args)
        self._builtins["max"] = lambda args: max(args)
        self._builtins["abs"] = lambda args: abs(args[0]) if args else 0
        self._builtins["range"] = lambda args: list(range(*args))
        self._builtins["expired"] = lambda args: False
        self._builtins["url_scheme"] = lambda args: str(args[0]).split("://")[0] if args else ""
        self._builtins["url_valid"] = lambda args: "://" in str(args[0]) if args else False

        self._builtins["trit_encode"] = lambda args: self._trit_encode(args)
        self._builtins["trit_store"] = lambda args: self._trit_store_builtin(args)
        self._builtins["trit_search"] = lambda args: self._trit_search(args)
        self._builtins["trit_similarity"] = lambda args: self._trit_similarity(args)

    # =========================================================================
    # Module Loading
    # =========================================================================

    def load_module(self, node: ASTNode) -> OXModule:
        if not isinstance(node, ModuleNode):
            raise OXRuntimeError(f"Expected ModuleNode, got {type(node).__name__}")

        mod = OXModule(
            name=node.name,
            module_type=node.module_type,
            env=self.global_env.child(),
        )

        if node.version:
            mod.version = node.version.value

        for item in node.body:
            if isinstance(item, StructNode):
                mod.structs[item.name] = item
                mod.env.set(item.name, {"__struct__": item.name, "__fields__": {f.name: None for f in item.fields}})
            elif isinstance(item, EnumNode):
                mod.enums[item.name] = item
                for variant in item.variants:
                    mod.env.set(variant.name, f":{variant.name}")
            elif isinstance(item, SyscallNode):
                mod.syscalls[item.name] = item
                if self.syscall_dispatcher:
                    self.syscall_dispatcher.register_from_ast(item.name, item, self)
            elif isinstance(item, ServiceNode):
                mod.services[item.name] = item
            elif isinstance(item, PhaseNode):
                mod.phases[item.name] = item
            elif isinstance(item, HandlerNode):
                event_name = self._resolve_handler_event(item)
                mod.handlers[event_name] = item
            elif isinstance(item, EntryNode):
                mod.phases["__entry__"] = PhaseNode(name="__entry__", body=item.body)
            elif isinstance(item, StateNode):
                val = self._eval_expr(item.initial_value, mod.env) if item.initial_value else None
                mod.state[item.name] = val
                mod.env.set(item.name, val)
            elif isinstance(item, ConstNode):
                val = self._eval_expr(item.value, mod.env) if item.value else None
                mod.env.set(item.name, val)
            elif isinstance(item, ConfigBlockNode):
                for entry in item.entries:
                    val = self._eval_expr(entry.value, mod.env) if entry.value else None
                    mod.config[entry.name] = val
                    mod.env.set(entry.name, val)

        self.modules[node.name] = mod
        logger.debug(f"Loaded module: {node.name}")
        return mod

    def _resolve_handler_event(self, handler: HandlerNode) -> str:
        if handler.event:
            if isinstance(handler.event, NamespacedIdent):
                return "::".join(handler.event.parts)
            elif isinstance(handler.event, IdentExpr):
                return handler.event.name
            elif isinstance(handler.event, LiteralExpr) and handler.event.literal_type == "symbol":
                return str(handler.event.value)
        return "__unknown__"

    # =========================================================================
    # Symbol Graph Mounting
    # =========================================================================

    def mount_symbol_graph(self, node: ASTNode, graph):
        if isinstance(node, OntologyNode):
            for concept in node.concepts:
                graph.add_concept(
                    name=concept.name,
                    parent=concept.parent,
                    weight=concept.weight,
                )
                for f in concept.fields:
                    graph.add_relation(concept.name, "has_field", f.name, weight=0.5)

            for rel in node.relations:
                graph.add_relation(
                    source=rel.source_type,
                    relation_type=rel.name,
                    target=rel.target_type,
                    weight=rel.weight,
                )

        elif isinstance(node, RulesetNode):
            for rule in node.rules:
                graph.add_rule(rule)

        elif isinstance(node, BindingsNode):
            for bind in node.binds:
                graph.add_binding(bind.source, bind.target)

    # =========================================================================
    # Process Spawning
    # =========================================================================

    def spawn_from_definition(self, node: ASTNode, scheduler=None,
                              name: Optional[str] = None, priority: int = 5) -> OXProcess:
        if not isinstance(node, ProcessNode):
            raise OXRuntimeError(f"Expected ProcessNode, got {type(node).__name__}")

        pid = self._next_pid
        self._next_pid += 1

        proc = OXProcess(
            pid=pid,
            name=name or node.name,
            process_type=node.process_type,
            priority=priority,
            env=self.global_env.child(),
        )

        for component in node.components:
            if isinstance(component, RequiresBlockNode):
                if component.priority:
                    proc.priority = self._eval_expr(component.priority, proc.env)
                if component.memory:
                    proc.memory_usage = self._eval_expr(component.memory, proc.env)

            elif isinstance(component, StateBlockNode):
                for decl in component.declarations:
                    val = self._eval_expr(decl.initial_value, proc.env) if decl.initial_value else None
                    proc.env.set(decl.name, val)

            elif isinstance(component, ChannelsBlockNode):
                for ch in component.channels:
                    proc.channels.append(ch.name)
                    if self.ipc:
                        self.ipc.create_channel(
                            f"{proc.name}_{ch.name}",
                            ch.direction.lower(),
                        )

            elif isinstance(component, LifecycleNode):
                for hook in component.hooks:
                    proc.lifecycle_hooks[hook.event] = hook.body

            elif isinstance(component, BehaviorNode):
                proc.behavior_handlers = component.handlers

        self.processes[pid] = proc

        if scheduler:
            scheduler.register_process(proc)

        if "init" in proc.lifecycle_hooks:
            self._exec_block(proc.lifecycle_hooks["init"], proc.env)

        proc.state = "ready"
        return proc

    # =========================================================================
    # Expression Evaluation
    # =========================================================================

    def _eval_expr(self, node: Optional[ASTNode], env: Environment) -> Any:
        if node is None:
            return None

        if isinstance(node, LiteralExpr):
            return node.value

        if isinstance(node, IdentExpr):
            try:
                return env.get(node.name)
            except OXRuntimeError:
                return node.name

        if isinstance(node, NamespacedIdent):
            return "::".join(node.parts)

        if isinstance(node, BinaryExpr):
            left = self._eval_expr(node.left, env)
            right = self._eval_expr(node.right, env)
            return self._eval_binary_op(node.op, left, right)

        if isinstance(node, UnaryExpr):
            operand = self._eval_expr(node.operand, env)
            if node.op == "-":
                return -operand
            if node.op == "!" or node.op == "not":
                return not operand
            if node.op == "~":
                return ~operand
            return operand

        if isinstance(node, CallExpr):
            return self._eval_call(node, env)

        if isinstance(node, FieldAccessExpr):
            obj = self._eval_expr(node.object, env)
            if isinstance(obj, dict):
                return obj.get(node.field_name)
            if hasattr(obj, node.field_name):
                return getattr(obj, node.field_name)
            return None

        if isinstance(node, IndexExpr):
            obj = self._eval_expr(node.object, env)
            idx = self._eval_expr(node.index, env)
            if isinstance(obj, (list, dict)):
                try:
                    return obj[idx]
                except (KeyError, IndexError):
                    return None
            return None

        if isinstance(node, MatchExpr):
            return self._eval_match(node, env)

        if isinstance(node, IfExpr):
            cond = self._eval_expr(node.condition, env)
            if cond:
                return self._exec_block(node.then_body, env.child())
            elif node.else_body:
                return self._exec_block(node.else_body, env.child())
            return None

        if isinstance(node, BlockExpr):
            return self._exec_block(node.statements, env.child())

        if isinstance(node, StructLiteral):
            result = {"__struct__": node.type_name}
            for f in node.fields:
                result[f.name] = self._eval_expr(f.value, env)
            return result

        if isinstance(node, ListLiteral):
            return [self._eval_expr(e, env) for e in node.elements]

        if isinstance(node, MapLiteral):
            return {
                self._eval_expr(entry.key, env): self._eval_expr(entry.value, env)
                for entry in node.entries
            }

        return None

    def _eval_binary_op(self, op: str, left: Any, right: Any) -> Any:
        ops = {
            "+": lambda a, b: a + b,
            "-": lambda a, b: a - b,
            "*": lambda a, b: a * b,
            "/": lambda a, b: a / b if b != 0 else 0,
            "%": lambda a, b: a % b if b != 0 else 0,
            "==": lambda a, b: a == b,
            "!=": lambda a, b: a != b,
            "<": lambda a, b: a < b,
            ">": lambda a, b: a > b,
            "<=": lambda a, b: a <= b,
            ">=": lambda a, b: a >= b,
            "and": lambda a, b: a and b,
            "or": lambda a, b: a or b,
            "&&": lambda a, b: a and b,
            "||": lambda a, b: a or b,
            "..": lambda a, b: list(range(int(a), int(b))),
        }
        fn = ops.get(op)
        if fn:
            try:
                return fn(left, right)
            except TypeError:
                return None
        return None

    def _eval_call(self, node: CallExpr, env: Environment) -> Any:
        args = [self._eval_expr(a, env) for a in node.args]

        if isinstance(node.callee, IdentExpr):
            name = node.callee.name
            if name in self._builtins:
                return self._builtins[name](args)

            for mod in self.modules.values():
                if name in mod.syscalls:
                    return self._exec_syscall(mod.syscalls[name], args, env)

            fn = env.get(name) if name else None
            if callable(fn):
                return fn(*args)

        elif isinstance(node.callee, NamespacedIdent):
            parts = node.callee.parts
            full_name = "::".join(parts)

            if len(parts) >= 2:
                mod_name = parts[0]
                func_name = parts[-1]
                if mod_name in self.modules and func_name in self.modules[mod_name].syscalls:
                    return self._exec_syscall(self.modules[mod_name].syscalls[func_name], args, env)

            if self.syscall_dispatcher:
                return self.syscall_dispatcher.dispatch(full_name, args, caller_pid=0)

        elif isinstance(node.callee, FieldAccessExpr):
            obj = self._eval_expr(node.callee.object, env)
            method = node.callee.field_name
            if isinstance(obj, dict) and callable(obj.get(method)):
                return obj[method](*args)
            if isinstance(obj, list):
                list_methods = {
                    "push": lambda: obj.append(args[0]) if args else None,
                    "pop": lambda: obj.pop() if obj else None,
                    "remove": lambda: obj.remove(args[0]) if args else None,
                    "len": lambda: len(obj),
                }
                if method in list_methods:
                    return list_methods[method]()

        return None

    def _exec_syscall(self, syscall: SyscallNode, args: List[Any], env: Environment) -> Any:
        call_env = env.child()
        for i, param in enumerate(syscall.params):
            if i < len(args):
                call_env.set(param.name, args[i])

        try:
            result = self._exec_block(syscall.body, call_env)
            return result
        except ReturnSignal as r:
            return r.value

    def _eval_match(self, node: MatchExpr, env: Environment) -> Any:
        subject = self._eval_expr(node.subject, env)
        for arm in node.arms:
            pattern_val = self._eval_expr(arm.pattern, env)
            if isinstance(arm.pattern, IdentExpr) and arm.pattern.name == "_":
                return self._eval_expr(arm.body, env)
            if pattern_val == subject:
                if arm.guard:
                    guard_env = env.child()
                    if not self._eval_expr(arm.guard, guard_env):
                        continue
                return self._eval_expr(arm.body, env)
        return None

    # =========================================================================
    # Statement Execution
    # =========================================================================

    def _exec_stmt(self, node: ASTNode, env: Environment) -> Any:
        if isinstance(node, LetStmt):
            val = self._eval_expr(node.value, env)
            env.set(node.name, val)
            return val

        if isinstance(node, AssignStmt):
            val = self._eval_expr(node.value, env)
            if isinstance(node.target, IdentExpr):
                env.update(node.target.name, val)
            elif isinstance(node.target, FieldAccessExpr):
                obj = self._eval_expr(node.target.object, env)
                if isinstance(obj, dict):
                    obj[node.target.field_name] = val
            elif isinstance(node.target, IndexExpr):
                obj = self._eval_expr(node.target.object, env)
                idx = self._eval_expr(node.target.index, env)
                if isinstance(obj, (list, dict)):
                    obj[idx] = val
            return val

        if isinstance(node, InvokeStmt):
            return self._eval_expr(node.call, env)

        if isinstance(node, EmitStmt):
            signal_name = self._eval_expr(node.signal, env)
            data = self._eval_expr(node.data, env) if node.data else {}
            self._emit_signal(signal_name, data)
            return None

        if isinstance(node, SpawnStmt):
            logger.info(f"Spawn: {node.path} as {node.alias}")
            return None

        if isinstance(node, SendStmt):
            channel = self._eval_expr(node.channel, env)
            value = self._eval_expr(node.value, env)
            if self.ipc:
                self.ipc.send(str(channel), value, sender_pid=0)
            return None

        if isinstance(node, TransitionStmt):
            target = self._eval_expr(node.target, env)
            new_state = self._eval_expr(node.new_state, env)
            logger.debug(f"Transition: {target} -> {new_state}")
            return new_state

        if isinstance(node, ReturnStmt):
            val = self._eval_expr(node.value, env)
            raise ReturnSignal(val)

        if isinstance(node, ForStmt):
            return self._exec_for(node, env)

        if isinstance(node, WhileStmt):
            return self._exec_while(node, env)

        if isinstance(node, SignalStmt):
            target = self._eval_expr(node.target, env)
            sig = self._eval_expr(node.signal_name, env)
            data = self._eval_expr(node.data, env) if node.data else {}
            self._emit_signal(sig, data, target=str(target))
            return None

        if isinstance(node, InhibitStmt):
            target = self._eval_expr(node.target, env) if node.target else None
            value = self._eval_expr(node.value, env) if node.value else -0.5
            if target and self.symbol_graph:
                concept = self.symbol_graph.get_concept(str(target))
                if concept:
                    concept.activation = max(-1.0, concept.activation + float(value))
            return None

        if isinstance(node, NegateStmt):
            subj = self._eval_expr(node.subject, env) if node.subject else None
            pred = self._eval_expr(node.predicate, env) if node.predicate else None
            obj = self._eval_expr(node.object, env) if node.object else None
            if subj and pred and obj and self.symbol_graph:
                self.symbol_graph.assert_ternary_fact(
                    str(subj), str(pred), str(obj), truth_value=-1, confidence=1.0,
                )
            return None

        if isinstance(node, ExprStmt):
            return self._eval_expr(node.expression, env)

        if isinstance(node, IfExpr):
            return self._eval_expr(node, env)

        if isinstance(node, MatchExpr):
            return self._eval_match(node, env)

        return self._eval_expr(node, env)

    def _exec_block(self, statements: List[ASTNode], env: Environment) -> Any:
        result = None
        for stmt in statements:
            result = self._exec_stmt(stmt, env)
        return result

    def _exec_for(self, node: ForStmt, env: Environment) -> Any:
        iterable = self._eval_expr(node.iterable, env)
        if not hasattr(iterable, '__iter__'):
            return None

        result = None
        for item in iterable:
            loop_env = env.child()
            loop_env.set(node.variable, item)

            if node.condition:
                cond = self._eval_expr(node.condition, loop_env)
                if not cond:
                    continue

            try:
                result = self._exec_block(node.body, loop_env)
            except BreakSignal:
                break
            except ContinueSignal:
                continue

        return result

    def _exec_while(self, node: WhileStmt, env: Environment) -> Any:
        result = None
        iterations = 0
        max_iterations = 100000

        while iterations < max_iterations:
            cond = self._eval_expr(node.condition, env)
            if not cond:
                break
            try:
                result = self._exec_block(node.body, env)
            except BreakSignal:
                break
            except ContinueSignal:
                pass
            iterations += 1

        return result

    # =========================================================================
    # Ternary Builtins
    # =========================================================================

    def _trit_encode(self, args):
        if not self.trit_memory or not args:
            return None
        text = str(args[0])
        return self.trit_memory.encode(text)

    def _trit_store_builtin(self, args):
        if not self.trit_memory or len(args) < 2:
            return None
        key = str(args[0])
        text = str(args[1])
        metadata = args[2] if len(args) > 2 and isinstance(args[2], dict) else {}
        entry = self.trit_memory.store(key, text, metadata)
        return {"key": entry.key, "activation": entry.activation}

    def _trit_search(self, args):
        if not self.trit_memory or not args:
            return []
        query = str(args[0])
        top_k = int(args[1]) if len(args) > 1 else 5
        results = self.trit_memory.search_text(query, top_k=top_k)
        return [{"key": e.key, "score": round(s, 4), "metadata": e.metadata} for e, s in results]

    def _trit_similarity(self, args):
        if not self.trit_memory or len(args) < 2:
            return 0.0
        vec_a = self.trit_memory.encode(str(args[0]))
        vec_b = self.trit_memory.encode(str(args[1]))
        return self.trit_memory._similarity(vec_a, vec_b)

    # =========================================================================
    # Signal Handling
    # =========================================================================

    def _emit_signal(self, name: str, data: Any = None, target: Optional[str] = None):
        logger.debug(f"Signal emitted: {name} -> {target or 'broadcast'}")

        if name in self._signal_handlers:
            for handler in self._signal_handlers[name]:
                try:
                    handler(data)
                except Exception as e:
                    logger.warning(f"Signal handler error for {name}: {e}")

    def register_signal_handler(self, signal_name: str, handler: Callable):
        if signal_name not in self._signal_handlers:
            self._signal_handlers[signal_name] = []
        self._signal_handlers[signal_name].append(handler)

    # =========================================================================
    # Phase Execution
    # =========================================================================

    def execute_phase(self, module_name: str, phase_name: str) -> Any:
        mod = self.modules.get(module_name)
        if not mod:
            raise OXRuntimeError(f"Module not found: {module_name}")

        phase = mod.phases.get(phase_name)
        if not phase:
            raise OXRuntimeError(f"Phase not found: {phase_name} in {module_name}")

        logger.info(f"Executing phase: {module_name}::{phase_name}")
        try:
            return self._exec_block(phase.body, mod.env.child())
        except ReturnSignal as r:
            return r.value
