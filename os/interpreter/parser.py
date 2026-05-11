"""
OpenXnet Neuro-Symbolic OS Kernel DSL - Recursive Descent Parser

Transforms a flat list of Token objects (produced by the Lexer) into a typed
Abstract Syntax Tree. Supports all three DSL file formats:
  .oxk  - Kernel module definitions   -> ModuleNode
  .nxs  - Neuro-symbolic graphs       -> OntologyNode | RulesetNode | BindingsNode
  .oxp  - Process definitions          -> ProcessNode

Usage:
    from .lexer import Lexer
    from .parser import Parser

    tokens = Lexer(source, "memory.oxk").tokenize()
    ast = Parser(tokens, "memory.oxk").parse()
"""

from typing import List, Optional, Union

from .tokens import Token, TokenType
from .ast_nodes import (
    ASTNode,
    ModuleNode,
    OntologyNode,
    RulesetNode,
    BindingsNode,
    ProcessNode,
    VersionNode,
    PriorityNode,
    RequiresListNode,
    ConfigBlockNode,
    ConfigEntryNode,
    EnumNode,
    EnumVariant,
    StructNode,
    FieldNode,
    StateNode,
    ConstNode,
    SyscallNode,
    ServiceNode,
    PhaseNode,
    HandlerNode,
    EntryNode,
    ConceptNode,
    RelationNode,
    RuleNode,
    WhenClauseNode,
    ThenClauseNode,
    ChainNode,
    ChainStepNode,
    BindNode,
    SingletonNode,
    RestartPolicyNode,
    RequiresBlockNode,
    StateBlockNode,
    ChannelsBlockNode,
    ChannelNode,
    LifecycleNode,
    LifecycleHookNode,
    BehaviorNode,
    BehaviorHandlerNode,
    LiteralExpr,
    IdentExpr,
    NamespacedIdent,
    BinaryExpr,
    UnaryExpr,
    CallExpr,
    FieldAccessExpr,
    IndexExpr,
    MatchExpr,
    MatchArm,
    IfExpr,
    BlockExpr,
    StructLiteral,
    StructLiteralField,
    ListLiteral,
    TypeExpr,
    ConstraintExpr,
    LambdaExpr,
    LetStmt,
    AssignStmt,
    InvokeStmt,
    EmitStmt,
    SpawnStmt,
    SendStmt,
    RecvExpr,
    TransitionStmt,
    ReturnStmt,
    ForStmt,
    SignalStmt,
    ExprStmt,
)
from .exceptions import ParseError


class Parser:
    """Recursive descent parser for the OpenXnet kernel DSL.

    Accepts a token list from the Lexer and produces an AST rooted at one of
    the top-level node types (ModuleNode, OntologyNode, RulesetNode,
    BindingsNode, or ProcessNode).
    """

    def __init__(self, tokens: List[Token], source_file: str = "") -> None:
        # Filter out NEWLINE and COMMENT tokens -- the grammar is not
        # whitespace-sensitive at the statement level.
        self._tokens: List[Token] = [
            t for t in tokens if t.type not in (TokenType.NEWLINE, TokenType.COMMENT)
        ]
        self._pos: int = 0
        self._source_file: str = source_file

    # ==================================================================
    # Public API
    # ==================================================================

    def parse(self) -> ASTNode:
        """Main entry point. Detects the file type from the leading keyword
        and dispatches to the appropriate top-level parser."""
        self._skip_newlines()
        tok = self._peek()
        if tok.type == TokenType.KW_MODULE:
            return self.parse_oxk()
        elif tok.type == TokenType.KW_ONTOLOGY:
            return self._parse_ontology()
        elif tok.type == TokenType.KW_RULESET:
            return self._parse_ruleset()
        elif tok.type == TokenType.KW_BINDINGS:
            return self._parse_bindings()
        elif tok.type == TokenType.KW_PROCESS:
            return self.parse_oxp()
        else:
            self._error(f"Expected top-level keyword (module, ontology, ruleset, "
                        f"bindings, process), got {tok.type.name}")

    def parse_oxk(self) -> ModuleNode:
        """Parse a .oxk module file."""
        return self._parse_module()

    def parse_nxs(self) -> Union[OntologyNode, RulesetNode, BindingsNode]:
        """Parse a .nxs neuro-symbolic file (ontology, ruleset, or bindings)."""
        tok = self._peek()
        if tok.type == TokenType.KW_ONTOLOGY:
            return self._parse_ontology()
        elif tok.type == TokenType.KW_RULESET:
            return self._parse_ruleset()
        elif tok.type == TokenType.KW_BINDINGS:
            return self._parse_bindings()
        else:
            self._error(f"Expected 'ontology', 'ruleset', or 'bindings', "
                        f"got {tok.type.name}")

    def parse_oxp(self) -> ProcessNode:
        """Parse a .oxp process file."""
        return self._parse_process()

    # ==================================================================
    # Top-Level Parsers
    # ==================================================================

    def _parse_module(self) -> ModuleNode:
        """module Name :type {| body |}"""
        tok = self._expect(TokenType.KW_MODULE)
        name = self._parse_namespaced_name()
        module_type = ""
        if self._check(TokenType.LIT_SYMBOL):
            module_type = self._advance().value

        node = ModuleNode(line=tok.line, col=tok.col, name=name, module_type=module_type)

        self._expect(TokenType.DELIM_NEURO_OPEN)
        while not self._check(TokenType.DELIM_NEURO_CLOSE) and not self._is_at_end():
            item = self._parse_module_item()
            if item is not None:
                if isinstance(item, VersionNode):
                    node.version = item
                elif isinstance(item, PriorityNode):
                    node.priority = item
                elif isinstance(item, RequiresListNode):
                    node.requires = item
                else:
                    node.body.append(item)
        self._expect(TokenType.DELIM_NEURO_CLOSE)
        return node

    def _parse_module_item(self) -> Optional[ASTNode]:
        """Parse a single item inside a module body."""
        tok = self._peek()
        tt = tok.type

        if tt == TokenType.IDENT and tok.value == "version":
            return self._parse_version()
        elif tt == TokenType.IDENT and tok.value == "priority":
            return self._parse_priority()
        elif tt == TokenType.KW_REQUIRES:
            return self._parse_requires_list()
        elif tt == TokenType.KW_CONFIG:
            return self._parse_config()
        elif tt == TokenType.KW_STRUCT:
            return self._parse_struct()
        elif tt == TokenType.KW_ENUM:
            return self._parse_enum()
        elif tt == TokenType.KW_STATE:
            return self._parse_state()
        elif tt == TokenType.KW_CONST:
            return self._parse_const()
        elif tt == TokenType.KW_SYSCALL:
            return self._parse_syscall()
        elif tt == TokenType.KW_SERVICE:
            return self._parse_service()
        elif tt == TokenType.KW_PHASE:
            return self._parse_phase()
        elif tt == TokenType.KW_ON:
            return self._parse_handler()
        elif tt == TokenType.KW_ENTRY:
            return self._parse_entry()
        else:
            # Treat as a statement
            return self._parse_statement()

    # ------------------------------------------------------------------
    # Module Components
    # ------------------------------------------------------------------

    def _parse_version(self) -> VersionNode:
        """version "1.0.0" """
        tok = self._advance()  # consume 'version' ident
        val = self._expect(TokenType.LIT_STRING)
        return VersionNode(line=tok.line, col=tok.col, value=val.value)

    def _parse_priority(self) -> PriorityNode:
        """priority 0"""
        tok = self._advance()  # consume 'priority' ident
        val = self._expect(TokenType.LIT_INT)
        return PriorityNode(line=tok.line, col=tok.col, value=val.value)

    def _parse_requires_list(self) -> RequiresListNode:
        """requires [kernel::base, kernel::ipc]"""
        tok = self._advance()  # consume 'requires'
        self._expect(TokenType.DELIM_LBRACKET)
        modules: List[str] = []
        while not self._check(TokenType.DELIM_RBRACKET) and not self._is_at_end():
            modules.append(self._parse_namespaced_name())
            if not self._match(TokenType.DELIM_COMMA):
                break
        self._expect(TokenType.DELIM_RBRACKET)
        return RequiresListNode(line=tok.line, col=tok.col, modules=modules)

    def _parse_config(self) -> ConfigBlockNode:
        """config {| entries |}"""
        tok = self._advance()  # consume 'config'
        # Optional name after 'config'
        if self._check(TokenType.IDENT):
            self._advance()  # consume optional config name
        self._expect(TokenType.DELIM_NEURO_OPEN)
        entries: List[ConfigEntryNode] = []
        while not self._check(TokenType.DELIM_NEURO_CLOSE) and not self._is_at_end():
            entries.append(self._parse_config_entry())
        self._expect(TokenType.DELIM_NEURO_CLOSE)
        return ConfigBlockNode(line=tok.line, col=tok.col, entries=entries)

    def _parse_config_entry(self) -> ConfigEntryNode:
        """name :: Type = value"""
        tok = self._peek()
        name = self._expect(TokenType.IDENT).value
        type_expr = None
        value = None
        if self._match(TokenType.OP_COLON_COLON):
            type_expr = self._parse_type_expr()
        if self._match(TokenType.OP_FAT_ARROW):
            value = self._parse_expression()
        return ConfigEntryNode(line=tok.line, col=tok.col, name=name,
                               type_expr=type_expr, value=value)

    def _parse_struct(self) -> StructNode:
        """struct Name {| fields |}"""
        tok = self._advance()  # consume 'struct'
        name = self._expect(TokenType.IDENT).value
        self._expect(TokenType.DELIM_NEURO_OPEN)
        fields: List[FieldNode] = []
        while not self._check(TokenType.DELIM_NEURO_CLOSE) and not self._is_at_end():
            fields.append(self._parse_field())
        self._expect(TokenType.DELIM_NEURO_CLOSE)
        return StructNode(line=tok.line, col=tok.col, name=name, fields=fields)

    def _parse_field(self) -> FieldNode:
        """name :: Type [| constraints |]"""
        tok = self._peek()
        name = self._expect(TokenType.IDENT).value
        type_expr = None
        constraints = None
        default = None

        if self._match(TokenType.OP_COLON_COLON):
            type_expr = self._parse_type_expr()
        if self._check(TokenType.DELIM_CONSTRAINT_OPEN):
            constraints = self._parse_constraint_block()
        if self._match(TokenType.OP_FAT_ARROW):
            default = self._parse_expression()
        return FieldNode(line=tok.line, col=tok.col, name=name,
                         type_expr=type_expr, constraints=constraints,
                         default=default)

    def _parse_enum(self) -> EnumNode:
        """enum Name {| variants |}"""
        tok = self._advance()  # consume 'enum'
        name = self._expect(TokenType.IDENT).value
        self._expect(TokenType.DELIM_NEURO_OPEN)
        variants: List[EnumVariant] = []
        while not self._check(TokenType.DELIM_NEURO_CLOSE) and not self._is_at_end():
            variants.append(self._parse_enum_variant())
        self._expect(TokenType.DELIM_NEURO_CLOSE)
        return EnumNode(line=tok.line, col=tok.col, name=name, variants=variants)

    def _parse_enum_variant(self) -> EnumVariant:
        """VariantName or VariantName(Type, Type)"""
        tok = self._peek()
        name = self._expect(TokenType.IDENT).value
        fields: List[TypeExpr] = []
        if self._match(TokenType.DELIM_LPAREN):
            while not self._check(TokenType.DELIM_RPAREN) and not self._is_at_end():
                fields.append(self._parse_type_expr())
                if not self._match(TokenType.DELIM_COMMA):
                    break
            self._expect(TokenType.DELIM_RPAREN)
        return EnumVariant(line=tok.line, col=tok.col, name=name, fields=fields)

    def _parse_state(self) -> StateNode:
        """state name :: Type = initial_value"""
        tok = self._advance()  # consume 'state'
        name = self._expect(TokenType.IDENT).value
        type_expr = None
        initial_value = None

        if self._match(TokenType.OP_COLON_COLON):
            type_expr = self._parse_type_expr()
        if self._match(TokenType.OP_FAT_ARROW):
            initial_value = self._parse_expression()
        return StateNode(line=tok.line, col=tok.col, name=name,
                         type_expr=type_expr, initial_value=initial_value)

    def _parse_const(self) -> ConstNode:
        """const NAME :: Type = value"""
        tok = self._advance()  # consume 'const'
        name = self._expect(TokenType.IDENT).value
        type_expr = None
        value = None

        if self._match(TokenType.OP_COLON_COLON):
            type_expr = self._parse_type_expr()
        if self._match(TokenType.OP_FAT_ARROW):
            value = self._parse_expression()
        return ConstNode(line=tok.line, col=tok.col, name=name,
                         type_expr=type_expr, value=value)

    def _parse_syscall(self) -> SyscallNode:
        """syscall name(params) -> ReturnType {| body |}"""
        tok = self._advance()  # consume 'syscall'
        name = self._expect(TokenType.IDENT).value
        params: List[FieldNode] = []

        self._expect(TokenType.DELIM_LPAREN)
        while not self._check(TokenType.DELIM_RPAREN) and not self._is_at_end():
            params.append(self._parse_field())
            if not self._match(TokenType.DELIM_COMMA):
                break
        self._expect(TokenType.DELIM_RPAREN)

        return_type = None
        if self._match(TokenType.OP_ARROW):
            return_type = self._parse_type_expr()

        body = self._parse_neuro_block()
        return SyscallNode(line=tok.line, col=tok.col, name=name,
                           params=params, return_type=return_type, body=body)

    def _parse_service(self) -> ServiceNode:
        """service Name(params) {| body |}"""
        tok = self._advance()  # consume 'service'
        name = self._expect(TokenType.IDENT).value
        params: List[FieldNode] = []

        if self._match(TokenType.DELIM_LPAREN):
            while not self._check(TokenType.DELIM_RPAREN) and not self._is_at_end():
                params.append(self._parse_field())
                if not self._match(TokenType.DELIM_COMMA):
                    break
            self._expect(TokenType.DELIM_RPAREN)

        body = self._parse_neuro_block()
        return ServiceNode(line=tok.line, col=tok.col, name=name,
                           params=params, body=body)

    def _parse_phase(self) -> PhaseNode:
        """phase Name {| steps |}"""
        tok = self._advance()  # consume 'phase'
        name = self._expect(TokenType.IDENT).value
        body = self._parse_neuro_block()
        return PhaseNode(line=tok.line, col=tok.col, name=name, body=body)

    def _parse_handler(self) -> HandlerNode:
        """on event {| body |}"""
        tok = self._advance()  # consume 'on'
        event = self._parse_expression()
        params: List[FieldNode] = []
        if self._match(TokenType.DELIM_LPAREN):
            while not self._check(TokenType.DELIM_RPAREN) and not self._is_at_end():
                params.append(self._parse_field())
                if not self._match(TokenType.DELIM_COMMA):
                    break
            self._expect(TokenType.DELIM_RPAREN)
        body = self._parse_neuro_block()
        return HandlerNode(line=tok.line, col=tok.col, event=event,
                           params=params, body=body)

    def _parse_entry(self) -> EntryNode:
        """entry {| body |}"""
        tok = self._advance()  # consume 'entry'
        body = self._parse_neuro_block()
        return EntryNode(line=tok.line, col=tok.col, body=body)

    # ==================================================================
    # Neuro-Symbolic Components (.nxs)
    # ==================================================================

    def _parse_ontology(self) -> OntologyNode:
        """ontology Name {| concepts and relations |}"""
        tok = self._advance()  # consume 'ontology'
        name = self._parse_namespaced_name()
        self._expect(TokenType.DELIM_NEURO_OPEN)

        concepts: List[ConceptNode] = []
        relations: List[RelationNode] = []

        while not self._check(TokenType.DELIM_NEURO_CLOSE) and not self._is_at_end():
            if self._check(TokenType.KW_CONCEPT):
                concepts.append(self._parse_concept())
            elif self._check(TokenType.KW_RELATION):
                relations.append(self._parse_relation())
            else:
                self._error(f"Expected 'concept' or 'relation' in ontology, "
                            f"got {self._peek().type.name}")

        self._expect(TokenType.DELIM_NEURO_CLOSE)
        return OntologyNode(line=tok.line, col=tok.col, name=name,
                            concepts=concepts, relations=relations)

    def _parse_concept(self) -> ConceptNode:
        """concept Name <: Parent @weight {| fields |}"""
        tok = self._advance()  # consume 'concept'
        name = self._expect(TokenType.IDENT).value
        parent = None
        weight = 1.0
        fields: List[FieldNode] = []

        if self._match(TokenType.OP_SUBTYPE):
            parent = self._expect(TokenType.IDENT).value

        if self._match(TokenType.OP_AT):
            weight_tok = self._peek()
            if weight_tok.type == TokenType.LIT_FLOAT:
                weight = self._advance().value
            elif weight_tok.type == TokenType.LIT_INT:
                weight = float(self._advance().value)
            else:
                self._error(f"Expected numeric weight after '@', got {weight_tok.type.name}")

        if self._check(TokenType.DELIM_NEURO_OPEN):
            self._advance()
            while not self._check(TokenType.DELIM_NEURO_CLOSE) and not self._is_at_end():
                fields.append(self._parse_field())
            self._expect(TokenType.DELIM_NEURO_CLOSE)

        return ConceptNode(line=tok.line, col=tok.col, name=name,
                           parent=parent, weight=weight, fields=fields)

    def _parse_relation(self) -> RelationNode:
        """relation Name :: (SourceType, TargetType) @weight"""
        tok = self._advance()  # consume 'relation'
        name = self._expect(TokenType.IDENT).value
        source_type = ""
        target_type = ""
        weight = 1.0
        properties: List[FieldNode] = []

        if self._match(TokenType.OP_COLON_COLON):
            self._expect(TokenType.DELIM_LPAREN)
            source_type = self._expect(TokenType.IDENT).value
            self._expect(TokenType.DELIM_COMMA)
            target_type = self._expect(TokenType.IDENT).value
            self._expect(TokenType.DELIM_RPAREN)

        if self._match(TokenType.OP_AT):
            weight_tok = self._peek()
            if weight_tok.type == TokenType.LIT_FLOAT:
                weight = self._advance().value
            elif weight_tok.type == TokenType.LIT_INT:
                weight = float(self._advance().value)
            else:
                self._error(f"Expected numeric weight after '@', got {weight_tok.type.name}")

        if self._check(TokenType.DELIM_NEURO_OPEN):
            self._advance()
            while not self._check(TokenType.DELIM_NEURO_CLOSE) and not self._is_at_end():
                properties.append(self._parse_field())
            self._expect(TokenType.DELIM_NEURO_CLOSE)

        return RelationNode(line=tok.line, col=tok.col, name=name,
                            source_type=source_type, target_type=target_type,
                            weight=weight, properties=properties)

    def _parse_ruleset(self) -> RulesetNode:
        """ruleset Name {| rules and chains |}"""
        tok = self._advance()  # consume 'ruleset'
        name = self._parse_namespaced_name()
        self._expect(TokenType.DELIM_NEURO_OPEN)

        rules: List[RuleNode] = []
        chains: List[ChainNode] = []

        while not self._check(TokenType.DELIM_NEURO_CLOSE) and not self._is_at_end():
            if self._check(TokenType.KW_RULE):
                rules.append(self._parse_rule())
            elif self._check(TokenType.KW_CHAIN):
                chains.append(self._parse_chain())
            else:
                self._error(f"Expected 'rule' or 'chain' in ruleset, "
                            f"got {self._peek().type.name}")

        self._expect(TokenType.DELIM_NEURO_CLOSE)
        return RulesetNode(line=tok.line, col=tok.col, name=name,
                           rules=rules, chains=chains)

    def _parse_rule(self) -> RuleNode:
        """rule Name @weight {| when {| ... |} then {| ... |} |}"""
        tok = self._advance()  # consume 'rule'
        name = self._expect(TokenType.IDENT).value
        weight = 1.0

        if self._match(TokenType.OP_AT):
            weight_tok = self._peek()
            if weight_tok.type == TokenType.LIT_FLOAT:
                weight = self._advance().value
            elif weight_tok.type == TokenType.LIT_INT:
                weight = float(self._advance().value)
            else:
                self._error(f"Expected numeric weight after '@', got {weight_tok.type.name}")

        self._expect(TokenType.DELIM_NEURO_OPEN)

        when_clause = None
        then_clause = None

        while not self._check(TokenType.DELIM_NEURO_CLOSE) and not self._is_at_end():
            if self._check(TokenType.KW_WHEN):
                self._advance()
                when_clause = self._parse_when_clause()
            elif self._check(TokenType.KW_THEN):
                self._advance()
                then_clause = self._parse_then_clause()
            else:
                self._error(f"Expected 'when' or 'then' in rule, "
                            f"got {self._peek().type.name}")

        self._expect(TokenType.DELIM_NEURO_CLOSE)
        return RuleNode(line=tok.line, col=tok.col, name=name, weight=weight,
                        when_clause=when_clause, then_clause=then_clause)

    def _parse_when_clause(self) -> WhenClauseNode:
        """when {| conditions |}"""
        tok = self._peek()
        self._expect(TokenType.DELIM_NEURO_OPEN)
        conditions: List[ASTNode] = []
        while not self._check(TokenType.DELIM_NEURO_CLOSE) and not self._is_at_end():
            conditions.append(self._parse_expression())
        self._expect(TokenType.DELIM_NEURO_CLOSE)
        return WhenClauseNode(line=tok.line, col=tok.col, conditions=conditions)

    def _parse_then_clause(self) -> ThenClauseNode:
        """then {| actions |}"""
        tok = self._peek()
        self._expect(TokenType.DELIM_NEURO_OPEN)
        actions: List[ASTNode] = []
        while not self._check(TokenType.DELIM_NEURO_CLOSE) and not self._is_at_end():
            actions.append(self._parse_statement())
        self._expect(TokenType.DELIM_NEURO_CLOSE)
        return ThenClauseNode(line=tok.line, col=tok.col, actions=actions)

    def _parse_chain(self) -> ChainNode:
        """chain Name {| step N: expr => binding |}"""
        tok = self._advance()  # consume 'chain'
        name = self._expect(TokenType.IDENT).value
        self._expect(TokenType.DELIM_NEURO_OPEN)

        steps: List[ChainStepNode] = []
        while not self._check(TokenType.DELIM_NEURO_CLOSE) and not self._is_at_end():
            steps.append(self._parse_chain_step())
        self._expect(TokenType.DELIM_NEURO_CLOSE)
        return ChainNode(line=tok.line, col=tok.col, name=name, steps=steps)

    def _parse_chain_step(self) -> ChainStepNode:
        """step N: expression => binding"""
        tok = self._expect(TokenType.KW_STEP)
        order = self._expect(TokenType.LIT_INT).value
        self._expect(TokenType.DELIM_COLON)
        expression = self._parse_expression()
        binding = None
        if self._match(TokenType.OP_FAT_ARROW):
            binding = self._expect(TokenType.IDENT).value
        return ChainStepNode(line=tok.line, col=tok.col, order=order,
                             expression=expression, binding=binding)

    def _parse_bindings(self) -> BindingsNode:
        """bindings Name {| bind src => target |}"""
        tok = self._advance()  # consume 'bindings'
        name = self._parse_namespaced_name()
        self._expect(TokenType.DELIM_NEURO_OPEN)

        binds: List[BindNode] = []
        while not self._check(TokenType.DELIM_NEURO_CLOSE) and not self._is_at_end():
            binds.append(self._parse_bind())
        self._expect(TokenType.DELIM_NEURO_CLOSE)
        return BindingsNode(line=tok.line, col=tok.col, name=name, binds=binds)

    def _parse_bind(self) -> BindNode:
        """bind source => target"""
        tok = self._expect(TokenType.KW_BIND)
        source = self._parse_namespaced_name()
        self._expect(TokenType.OP_FAT_ARROW)
        target = self._parse_namespaced_name()
        return BindNode(line=tok.line, col=tok.col, source=source, target=target)

    # ==================================================================
    # Process Components (.oxp)
    # ==================================================================

    def _parse_process(self) -> ProcessNode:
        """process Name :: Type {| components |}"""
        tok = self._advance()  # consume 'process'
        name = self._parse_namespaced_name()
        process_type = ""

        if self._check(TokenType.LIT_SYMBOL):
            process_type = self._advance().value

        self._expect(TokenType.DELIM_NEURO_OPEN)
        components: List[ASTNode] = []

        while not self._check(TokenType.DELIM_NEURO_CLOSE) and not self._is_at_end():
            comp = self._parse_process_component()
            if comp is not None:
                components.append(comp)

        self._expect(TokenType.DELIM_NEURO_CLOSE)
        return ProcessNode(line=tok.line, col=tok.col, name=name,
                           process_type=process_type, components=components)

    def _parse_process_component(self) -> Optional[ASTNode]:
        """Parse a single component inside a process body."""
        tok = self._peek()
        tt = tok.type

        if tt == TokenType.KW_REQUIRES:
            return self._parse_requires_block()
        elif tt == TokenType.KW_STATE:
            return self._parse_state_block()
        elif tt == TokenType.KW_CHANNELS:
            return self._parse_channels()
        elif tt == TokenType.KW_LIFECYCLE:
            return self._parse_lifecycle()
        elif tt == TokenType.KW_BEHAVIOR:
            return self._parse_behavior()
        elif tt == TokenType.IDENT and tok.value == "singleton":
            return self._parse_singleton()
        elif tt == TokenType.IDENT and tok.value == "restart_policy":
            return self._parse_restart_policy()
        else:
            return self._parse_statement()

    def _parse_singleton(self) -> SingletonNode:
        """singleton true/false"""
        tok = self._advance()  # consume 'singleton'
        val = self._advance()
        bool_val = val.value if isinstance(val.value, bool) else val.value == "true"
        return SingletonNode(line=tok.line, col=tok.col, value=bool_val)

    def _parse_restart_policy(self) -> RestartPolicyNode:
        """restart_policy :always"""
        tok = self._advance()  # consume 'restart_policy'
        policy = self._expect(TokenType.LIT_SYMBOL).value
        return RestartPolicyNode(line=tok.line, col=tok.col, policy=policy)

    def _parse_requires_block(self) -> RequiresBlockNode:
        """requires {| capabilities [...], memory N, priority N |}"""
        tok = self._advance()  # consume 'requires'
        self._expect(TokenType.DELIM_NEURO_OPEN)

        node = RequiresBlockNode(line=tok.line, col=tok.col)

        while not self._check(TokenType.DELIM_NEURO_CLOSE) and not self._is_at_end():
            item_tok = self._peek()
            if item_tok.type == TokenType.IDENT:
                if item_tok.value == "capabilities":
                    self._advance()
                    self._expect(TokenType.DELIM_LBRACKET)
                    while not self._check(TokenType.DELIM_RBRACKET) and not self._is_at_end():
                        cap = self._peek()
                        if cap.type == TokenType.LIT_SYMBOL:
                            node.capabilities.append(self._advance().value)
                        else:
                            node.capabilities.append(self._advance().value)
                        self._match(TokenType.DELIM_COMMA)
                    self._expect(TokenType.DELIM_RBRACKET)
                elif item_tok.value == "memory":
                    self._advance()
                    node.memory = self._parse_expression()
                elif item_tok.value == "priority":
                    self._advance()
                    node.priority = self._parse_expression()
                else:
                    node.extra.append(self._parse_statement())
            else:
                node.extra.append(self._parse_statement())

        self._expect(TokenType.DELIM_NEURO_CLOSE)
        return node

    def _parse_state_block(self) -> StateBlockNode:
        """state {| declarations |}"""
        tok = self._advance()  # consume 'state'

        # If followed by a neuro-open, it's a state block
        if self._check(TokenType.DELIM_NEURO_OPEN):
            self._advance()
            declarations: List[StateNode] = []
            while not self._check(TokenType.DELIM_NEURO_CLOSE) and not self._is_at_end():
                field_tok = self._peek()
                name = self._expect(TokenType.IDENT).value
                type_expr = None
                initial_value = None
                if self._match(TokenType.OP_COLON_COLON):
                    type_expr = self._parse_type_expr()
                if self._match(TokenType.OP_FAT_ARROW):
                    initial_value = self._parse_expression()
                declarations.append(StateNode(
                    line=field_tok.line, col=field_tok.col,
                    name=name, type_expr=type_expr, initial_value=initial_value
                ))
            self._expect(TokenType.DELIM_NEURO_CLOSE)
            return StateBlockNode(line=tok.line, col=tok.col, declarations=declarations)
        else:
            # Single state declaration: state name :: Type = value
            name = self._expect(TokenType.IDENT).value
            type_expr = None
            initial_value = None
            if self._match(TokenType.OP_COLON_COLON):
                type_expr = self._parse_type_expr()
            if self._match(TokenType.OP_FAT_ARROW):
                initial_value = self._parse_expression()
            decl = StateNode(line=tok.line, col=tok.col, name=name,
                             type_expr=type_expr, initial_value=initial_value)
            return StateBlockNode(line=tok.line, col=tok.col, declarations=[decl])

    def _parse_channels(self) -> ChannelsBlockNode:
        """channels {| channel declarations |}"""
        tok = self._advance()  # consume 'channels'
        self._expect(TokenType.DELIM_NEURO_OPEN)
        channels: List[ChannelNode] = []

        while not self._check(TokenType.DELIM_NEURO_CLOSE) and not self._is_at_end():
            channels.append(self._parse_channel_decl())

        self._expect(TokenType.DELIM_NEURO_CLOSE)
        return ChannelsBlockNode(line=tok.line, col=tok.col, channels=channels)

    def _parse_channel_decl(self) -> ChannelNode:
        """name :: Send<Type> capacity N  or  channel name :: Recv<Type>"""
        tok = self._peek()

        # Optional 'channel' keyword prefix
        if self._check(TokenType.KW_CHANNEL):
            self._advance()

        name = self._expect(TokenType.IDENT).value
        self._expect(TokenType.OP_COLON_COLON)

        direction_tok = self._expect(TokenType.IDENT)
        direction = direction_tok.value  # "Send" or "Recv"

        message_type = None
        if self._match(TokenType.OP_LT):
            message_type = self._parse_type_expr()
            self._expect(TokenType.OP_GT)

        capacity = None
        if self._check(TokenType.IDENT) and self._peek().value == "capacity":
            self._advance()
            capacity = self._expect(TokenType.LIT_INT).value

        return ChannelNode(line=tok.line, col=tok.col, name=name,
                           direction=direction, message_type=message_type,
                           capacity=capacity)

    def _parse_lifecycle(self) -> LifecycleNode:
        """lifecycle {| on event {| ... |} |}"""
        tok = self._advance()  # consume 'lifecycle'
        self._expect(TokenType.DELIM_NEURO_OPEN)
        hooks: List[LifecycleHookNode] = []

        while not self._check(TokenType.DELIM_NEURO_CLOSE) and not self._is_at_end():
            hook_tok = self._expect(TokenType.KW_ON)
            event = self._expect(TokenType.IDENT).value
            body = self._parse_neuro_block()
            hooks.append(LifecycleHookNode(
                line=hook_tok.line, col=hook_tok.col, event=event, body=body
            ))

        self._expect(TokenType.DELIM_NEURO_CLOSE)
        return LifecycleNode(line=tok.line, col=tok.col, hooks=hooks)

    def _parse_behavior(self) -> BehaviorNode:
        """behavior {| on event {| ... |} |}"""
        tok = self._advance()  # consume 'behavior'
        self._expect(TokenType.DELIM_NEURO_OPEN)
        handlers: List[BehaviorHandlerNode] = []

        while not self._check(TokenType.DELIM_NEURO_CLOSE) and not self._is_at_end():
            handlers.append(self._parse_behavior_handler())

        self._expect(TokenType.DELIM_NEURO_CLOSE)
        return BehaviorNode(line=tok.line, col=tok.col, handlers=handlers)

    def _parse_behavior_handler(self) -> BehaviorHandlerNode:
        """on recv(channel) as binding {| body |} or on signal::NAME {| body |}"""
        tok = self._expect(TokenType.KW_ON)
        event_type = ""
        source: Optional[ASTNode] = None
        binding: Optional[str] = None
        params: List[FieldNode] = []

        next_tok = self._peek()
        if next_tok.type == TokenType.KW_RECV:
            event_type = "recv"
            self._advance()
            if self._match(TokenType.DELIM_LPAREN):
                source = self._parse_expression()
                self._expect(TokenType.DELIM_RPAREN)
        elif next_tok.type == TokenType.KW_SEND:
            event_type = "send"
            self._advance()
            if self._match(TokenType.DELIM_LPAREN):
                source = self._parse_expression()
                self._expect(TokenType.DELIM_RPAREN)
        elif next_tok.type == TokenType.KW_SIGNAL:
            event_type = "signal"
            self._advance()
            # Parse the signal name (e.g., ::SHUTDOWN or a namespaced ident)
            source = self._parse_expression()
        else:
            event_type = next_tok.value if next_tok.type == TokenType.IDENT else "event"
            source = self._parse_expression()

        if self._match(TokenType.KW_AS):
            binding = self._expect(TokenType.IDENT).value

        body = self._parse_neuro_block()
        return BehaviorHandlerNode(
            line=tok.line, col=tok.col, event_type=event_type,
            source=source, binding=binding, params=params, body=body
        )

    # ==================================================================
    # Statements
    # ==================================================================

    def _parse_statement(self) -> ASTNode:
        """Parse a single statement."""
        tok = self._peek()
        tt = tok.type

        if tt == TokenType.KW_LET:
            return self._parse_let()
        elif tt == TokenType.KW_INVOKE:
            return self._parse_invoke()
        elif tt == TokenType.KW_EMIT:
            return self._parse_emit()
        elif tt == TokenType.KW_SIGNAL:
            return self._parse_signal_stmt()
        elif tt == TokenType.KW_SPAWN:
            return self._parse_spawn()
        elif tt == TokenType.KW_SEND:
            return self._parse_send()
        elif tt == TokenType.KW_RETURN:
            return self._parse_return()
        elif tt == TokenType.KW_IF:
            return self._parse_if()
        elif tt == TokenType.KW_MATCH:
            return self._parse_match()
        elif tt == TokenType.KW_FOR:
            return self._parse_for()
        elif tt == TokenType.KW_TRANSITION:
            return self._parse_transition()
        else:
            return self._parse_expr_or_assign()

    def _parse_let(self) -> LetStmt:
        """let name :: Type = value"""
        tok = self._advance()  # consume 'let'
        name = self._expect(TokenType.IDENT).value
        type_expr = None
        value = None

        if self._match(TokenType.OP_COLON_COLON):
            type_expr = self._parse_type_expr()
        if self._match(TokenType.OP_FAT_ARROW):
            value = self._parse_expression()
        return LetStmt(line=tok.line, col=tok.col, name=name,
                       type_expr=type_expr, value=value)

    def _parse_invoke(self) -> InvokeStmt:
        """invoke call_expression()"""
        tok = self._advance()  # consume 'invoke'
        call = self._parse_expression()
        return InvokeStmt(line=tok.line, col=tok.col, call=call)

    def _parse_emit(self) -> EmitStmt:
        """emit signal::NAME { data }"""
        tok = self._advance()  # consume 'emit'
        signal = self._parse_expression()
        data = None
        if self._check(TokenType.DELIM_LBRACE):
            data = self._parse_struct_literal_body()
        return EmitStmt(line=tok.line, col=tok.col, signal=signal, data=data)

    def _parse_signal_stmt(self) -> SignalStmt:
        """signal target ::NAME { data }"""
        tok = self._advance()  # consume 'signal'
        target = self._parse_expression()
        signal_name = None
        if self._match(TokenType.OP_COLON_COLON):
            signal_name = IdentExpr(
                line=self._peek().line, col=self._peek().col,
                name=self._expect(TokenType.IDENT).value
            )
        data = None
        if self._check(TokenType.DELIM_LBRACE):
            data = self._parse_struct_literal_body()
        return SignalStmt(line=tok.line, col=tok.col, target=target,
                          signal_name=signal_name, data=data)

    def _parse_spawn(self) -> SpawnStmt:
        """spawn "path" as alias with { options }"""
        tok = self._advance()  # consume 'spawn'
        path = self._expect(TokenType.LIT_STRING).value
        alias = None
        options = None

        if self._match(TokenType.KW_AS):
            alias = self._expect(TokenType.IDENT).value
        if self._match(TokenType.KW_WITH):
            if self._check(TokenType.DELIM_LBRACE):
                options = self._parse_struct_literal_body()
        return SpawnStmt(line=tok.line, col=tok.col, path=path,
                         alias=alias, options=options)

    def _parse_send(self) -> SendStmt:
        """send channel <- value"""
        tok = self._advance()  # consume 'send'
        channel = self._parse_primary()
        # Expect <- which the lexer produces as OP_LT followed by OP_MINUS
        # or we just parse it as an expression context
        self._expect(TokenType.OP_LT)
        self._expect(TokenType.OP_MINUS)
        value = self._parse_expression()
        return SendStmt(line=tok.line, col=tok.col, channel=channel, value=value)

    def _parse_return(self) -> ReturnStmt:
        """return expression"""
        tok = self._advance()  # consume 'return'
        value = None
        # Return has a value unless immediately followed by a block-close or EOF
        if not self._check(TokenType.DELIM_NEURO_CLOSE) and not self._is_at_end():
            value = self._parse_expression()
        return ReturnStmt(line=tok.line, col=tok.col, value=value)

    def _parse_if(self) -> IfExpr:
        """if condition {| then |} else {| else |}"""
        tok = self._advance()  # consume 'if'
        condition = self._parse_expression()
        then_body = self._parse_neuro_block()
        else_body: List[ASTNode] = []

        if self._match(TokenType.KW_ELSE):
            if self._check(TokenType.KW_IF):
                else_body = [self._parse_if()]
            else:
                else_body = self._parse_neuro_block()

        return IfExpr(line=tok.line, col=tok.col, condition=condition,
                      then_body=then_body, else_body=else_body)

    def _parse_match(self) -> MatchExpr:
        """match subject {| pattern => body |}"""
        tok = self._advance()  # consume 'match'
        subject = self._parse_expression()
        self._expect(TokenType.DELIM_NEURO_OPEN)

        arms: List[MatchArm] = []
        while not self._check(TokenType.DELIM_NEURO_CLOSE) and not self._is_at_end():
            arms.append(self._parse_match_arm())

        self._expect(TokenType.DELIM_NEURO_CLOSE)
        return MatchExpr(line=tok.line, col=tok.col, subject=subject, arms=arms)

    def _parse_match_arm(self) -> MatchArm:
        """pattern [where guard] => body"""
        tok = self._peek()
        pattern = self._parse_pattern()
        guard = None

        if self._match(TokenType.KW_WHERE):
            guard = self._parse_expression()

        self._expect(TokenType.OP_FAT_ARROW)

        # Body can be a single expression or a neuro block
        if self._check(TokenType.DELIM_NEURO_OPEN):
            body = BlockExpr(
                line=self._peek().line, col=self._peek().col,
                statements=self._parse_neuro_block()
            )
        else:
            body = self._parse_expression()

        return MatchArm(line=tok.line, col=tok.col, pattern=pattern,
                        guard=guard, body=body)

    def _parse_pattern(self) -> ASTNode:
        """Parse a match pattern (symbol, literal, identifier, wildcard)."""
        tok = self._peek()

        if tok.type == TokenType.LIT_SYMBOL:
            self._advance()
            return LiteralExpr(line=tok.line, col=tok.col,
                               value=tok.value, literal_type="symbol")
        elif tok.type == TokenType.LIT_INT:
            self._advance()
            return LiteralExpr(line=tok.line, col=tok.col,
                               value=tok.value, literal_type="int")
        elif tok.type == TokenType.LIT_STRING:
            self._advance()
            return LiteralExpr(line=tok.line, col=tok.col,
                               value=tok.value, literal_type="string")
        elif tok.type == TokenType.LIT_BOOL:
            self._advance()
            return LiteralExpr(line=tok.line, col=tok.col,
                               value=tok.value, literal_type="bool")
        elif tok.type == TokenType.IDENT:
            self._advance()
            # Wildcard _
            if tok.value == "_":
                return IdentExpr(line=tok.line, col=tok.col, name="_")
            # Could be EnumVariant(fields)
            if self._match(TokenType.DELIM_LPAREN):
                args: List[ASTNode] = []
                while not self._check(TokenType.DELIM_RPAREN) and not self._is_at_end():
                    args.append(self._parse_pattern())
                    if not self._match(TokenType.DELIM_COMMA):
                        break
                self._expect(TokenType.DELIM_RPAREN)
                return CallExpr(line=tok.line, col=tok.col,
                                callee=IdentExpr(line=tok.line, col=tok.col, name=tok.value),
                                args=args)
            return IdentExpr(line=tok.line, col=tok.col, name=tok.value)
        elif tok.type in (TokenType.KW_SOME, TokenType.KW_NONE,
                          TokenType.KW_OK, TokenType.KW_ERR):
            self._advance()
            if self._match(TokenType.DELIM_LPAREN):
                args = []
                while not self._check(TokenType.DELIM_RPAREN) and not self._is_at_end():
                    args.append(self._parse_pattern())
                    if not self._match(TokenType.DELIM_COMMA):
                        break
                self._expect(TokenType.DELIM_RPAREN)
                return CallExpr(line=tok.line, col=tok.col,
                                callee=IdentExpr(line=tok.line, col=tok.col, name=tok.value),
                                args=args)
            return IdentExpr(line=tok.line, col=tok.col, name=tok.value)
        else:
            self._error(f"Expected pattern, got {tok.type.name}")

    def _parse_for(self) -> ForStmt:
        """for var in iterable [where cond] {| body |}"""
        tok = self._advance()  # consume 'for'
        variable = self._expect(TokenType.IDENT).value
        self._expect(TokenType.KW_IN)
        iterable = self._parse_expression()
        condition = None

        if self._match(TokenType.KW_WHERE):
            condition = self._parse_expression()

        body = self._parse_neuro_block()
        return ForStmt(line=tok.line, col=tok.col, variable=variable,
                       iterable=iterable, condition=condition, body=body)

    def _parse_transition(self) -> TransitionStmt:
        """transition target -> NewState"""
        tok = self._advance()  # consume 'transition'
        target = self._parse_primary()
        self._expect(TokenType.OP_ARROW)
        new_state = self._parse_primary()
        return TransitionStmt(line=tok.line, col=tok.col,
                              target=target, new_state=new_state)

    def _parse_expr_or_assign(self) -> ASTNode:
        """Parse an expression that might be followed by = (assignment) or
        just a standalone expression statement."""
        expr = self._parse_expression()

        # Check for assignment (fat arrow => used as assignment in this DSL)
        if self._match(TokenType.OP_FAT_ARROW):
            value = self._parse_expression()
            return AssignStmt(line=expr.line, col=expr.col,
                              target=expr, value=value)

        return ExprStmt(line=expr.line, col=expr.col, expression=expr)

    # ==================================================================
    # Expressions (Precedence Climbing)
    # ==================================================================

    def _parse_expression(self) -> ASTNode:
        """Parse an expression using precedence climbing."""
        return self._parse_or_expr()

    def _parse_or_expr(self) -> ASTNode:
        """Logical OR: expr or expr"""
        left = self._parse_and_expr()
        while self._check(TokenType.KW_OR):
            op_tok = self._advance()
            right = self._parse_and_expr()
            left = BinaryExpr(line=op_tok.line, col=op_tok.col,
                              left=left, op="or", right=right)
        return left

    def _parse_and_expr(self) -> ASTNode:
        """Logical AND: expr and expr"""
        left = self._parse_not_expr()
        while self._check(TokenType.KW_AND):
            op_tok = self._advance()
            right = self._parse_not_expr()
            left = BinaryExpr(line=op_tok.line, col=op_tok.col,
                              left=left, op="and", right=right)
        return left

    def _parse_not_expr(self) -> ASTNode:
        """Unary NOT: not expr"""
        if self._check(TokenType.KW_NOT):
            op_tok = self._advance()
            operand = self._parse_not_expr()
            return UnaryExpr(line=op_tok.line, col=op_tok.col,
                             op="not", operand=operand)
        return self._parse_comparison()

    def _parse_comparison(self) -> ASTNode:
        """Comparison: expr (== | != | < | > | <= | >=) expr"""
        left = self._parse_range_expr()

        cmp_ops = {
            TokenType.OP_EQ_EQ: "==",
            TokenType.OP_NOT_EQ: "!=",
            TokenType.OP_LT: "<",
            TokenType.OP_GT: ">",
            TokenType.OP_LT_EQ: "<=",
            TokenType.OP_GT_EQ: ">=",
        }

        if self._peek().type in cmp_ops:
            op_tok = self._advance()
            op_str = cmp_ops[op_tok.type]
            right = self._parse_range_expr()
            left = BinaryExpr(line=op_tok.line, col=op_tok.col,
                              left=left, op=op_str, right=right)
        return left

    def _parse_range_expr(self) -> ASTNode:
        """Range: expr .. expr"""
        left = self._parse_additive()
        if self._check(TokenType.OP_DOT_DOT):
            op_tok = self._advance()
            right = self._parse_additive()
            left = BinaryExpr(line=op_tok.line, col=op_tok.col,
                              left=left, op="..", right=right)
        return left

    def _parse_additive(self) -> ASTNode:
        """Addition/subtraction: expr (+|-) expr"""
        left = self._parse_multiplicative()
        while self._peek().type in (TokenType.OP_PLUS, TokenType.OP_MINUS):
            op_tok = self._advance()
            op_str = "+" if op_tok.type == TokenType.OP_PLUS else "-"
            right = self._parse_multiplicative()
            left = BinaryExpr(line=op_tok.line, col=op_tok.col,
                              left=left, op=op_str, right=right)
        return left

    def _parse_multiplicative(self) -> ASTNode:
        """Multiplication/division/modulo: expr (*|/|%) expr"""
        left = self._parse_unary()
        while self._peek().type in (TokenType.OP_STAR, TokenType.OP_SLASH,
                                    TokenType.OP_PERCENT):
            op_tok = self._advance()
            if op_tok.type == TokenType.OP_STAR:
                op_str = "*"
            elif op_tok.type == TokenType.OP_SLASH:
                op_str = "/"
            else:
                op_str = "%"
            right = self._parse_unary()
            left = BinaryExpr(line=op_tok.line, col=op_tok.col,
                              left=left, op=op_str, right=right)
        return left

    def _parse_unary(self) -> ASTNode:
        """Unary minus: -expr"""
        if self._check(TokenType.OP_MINUS):
            op_tok = self._advance()
            operand = self._parse_unary()
            return UnaryExpr(line=op_tok.line, col=op_tok.col,
                             op="-", operand=operand)
        return self._parse_postfix()

    def _parse_postfix(self) -> ASTNode:
        """Postfix operations: calls, field access, indexing."""
        expr = self._parse_primary()

        while True:
            if self._check(TokenType.DELIM_LPAREN):
                # Function call
                self._advance()
                args: List[ASTNode] = []
                while not self._check(TokenType.DELIM_RPAREN) and not self._is_at_end():
                    args.append(self._parse_expression())
                    if not self._match(TokenType.DELIM_COMMA):
                        break
                self._expect(TokenType.DELIM_RPAREN)
                expr = CallExpr(line=expr.line, col=expr.col,
                                callee=expr, args=args)
            elif self._check(TokenType.OP_DOT):
                # Field access
                self._advance()
                field_tok = self._expect(TokenType.IDENT)
                expr = FieldAccessExpr(line=expr.line, col=expr.col,
                                       object=expr, field_name=field_tok.value)
            elif self._check(TokenType.DELIM_LBRACKET):
                # Index access
                self._advance()
                index = self._parse_expression()
                self._expect(TokenType.DELIM_RBRACKET)
                expr = IndexExpr(line=expr.line, col=expr.col,
                                 object=expr, index=index)
            elif self._check(TokenType.OP_COLON_COLON):
                # Namespaced access: collect all parts
                parts = self._collect_namespace_parts(expr)
                expr = NamespacedIdent(line=expr.line, col=expr.col, parts=parts)
                # After building namespaced ident, check for call
                continue
            else:
                break

        return expr

    def _collect_namespace_parts(self, base: ASTNode) -> List[str]:
        """Collect namespace parts from a base identifier and :: separators."""
        parts: List[str] = []
        if isinstance(base, IdentExpr):
            parts.append(base.name)
        elif isinstance(base, NamespacedIdent):
            parts.extend(base.parts)
        else:
            parts.append(str(getattr(base, 'name', '?')))

        while self._match(TokenType.OP_COLON_COLON):
            part_tok = self._peek()
            if part_tok.type == TokenType.IDENT:
                parts.append(self._advance().value)
            elif part_tok.type in (TokenType.KW_SELF,):
                parts.append(self._advance().value)
            else:
                # Could be an uppercase keyword used as an identifier
                parts.append(self._advance().value)
        return parts

    def _parse_primary(self) -> ASTNode:
        """Parse a primary (atomic) expression."""
        tok = self._peek()

        # Literals
        if tok.type == TokenType.LIT_INT:
            self._advance()
            return LiteralExpr(line=tok.line, col=tok.col,
                               value=tok.value, literal_type="int")
        elif tok.type == TokenType.LIT_FLOAT:
            self._advance()
            return LiteralExpr(line=tok.line, col=tok.col,
                               value=tok.value, literal_type="float")
        elif tok.type == TokenType.LIT_STRING:
            self._advance()
            return LiteralExpr(line=tok.line, col=tok.col,
                               value=tok.value, literal_type="string")
        elif tok.type == TokenType.LIT_SYMBOL:
            self._advance()
            return LiteralExpr(line=tok.line, col=tok.col,
                               value=tok.value, literal_type="symbol")
        elif tok.type == TokenType.LIT_DURATION:
            self._advance()
            return LiteralExpr(line=tok.line, col=tok.col,
                               value=tok.value, literal_type="duration")
        elif tok.type == TokenType.LIT_BOOL:
            self._advance()
            return LiteralExpr(line=tok.line, col=tok.col,
                               value=tok.value, literal_type="bool")

        # None/null
        elif tok.type == TokenType.KW_NONE:
            self._advance()
            return LiteralExpr(line=tok.line, col=tok.col,
                               value=None, literal_type="null")

        # Self
        elif tok.type == TokenType.KW_SELF:
            self._advance()
            return IdentExpr(line=tok.line, col=tok.col, name="self")

        # Some/Ok/Err as constructors
        elif tok.type in (TokenType.KW_SOME, TokenType.KW_OK, TokenType.KW_ERR):
            self._advance()
            if self._match(TokenType.DELIM_LPAREN):
                args: List[ASTNode] = []
                while not self._check(TokenType.DELIM_RPAREN) and not self._is_at_end():
                    args.append(self._parse_expression())
                    if not self._match(TokenType.DELIM_COMMA):
                        break
                self._expect(TokenType.DELIM_RPAREN)
                return CallExpr(
                    line=tok.line, col=tok.col,
                    callee=IdentExpr(line=tok.line, col=tok.col, name=tok.value),
                    args=args
                )
            return IdentExpr(line=tok.line, col=tok.col, name=tok.value)

        # Identifiers
        elif tok.type == TokenType.IDENT:
            self._advance()
            return IdentExpr(line=tok.line, col=tok.col, name=tok.value)

        # Parenthesized expression
        elif tok.type == TokenType.DELIM_LPAREN:
            self._advance()
            expr = self._parse_expression()
            self._expect(TokenType.DELIM_RPAREN)
            return expr

        # List literal
        elif tok.type == TokenType.DELIM_LBRACKET:
            return self._parse_list_literal()

        # Struct literal or map { ... }
        elif tok.type == TokenType.DELIM_LBRACE:
            return self._parse_struct_literal_body()

        # Lambda: |params| body
        elif tok.type == TokenType.OP_PIPE:
            return self._parse_lambda()

        # recv keyword as expression
        elif tok.type == TokenType.KW_RECV:
            self._advance()
            channel = None
            timeout = None
            if self._match(TokenType.DELIM_LPAREN):
                channel = self._parse_expression()
                self._expect(TokenType.DELIM_RPAREN)
            return RecvExpr(line=tok.line, col=tok.col,
                            channel=channel, timeout=timeout)

        else:
            self._error(f"Expected expression, got {tok.type.name} ({tok.value!r})")

    def _parse_list_literal(self) -> ListLiteral:
        """[element, element, ...]"""
        tok = self._advance()  # consume '['
        elements: List[ASTNode] = []
        while not self._check(TokenType.DELIM_RBRACKET) and not self._is_at_end():
            elements.append(self._parse_expression())
            if not self._match(TokenType.DELIM_COMMA):
                break
        self._expect(TokenType.DELIM_RBRACKET)
        return ListLiteral(line=tok.line, col=tok.col, elements=elements)

    def _parse_struct_literal_body(self) -> StructLiteral:
        """{ field: value, ... }"""
        tok = self._advance()  # consume '{'
        fields: List[StructLiteralField] = []

        while not self._check(TokenType.DELIM_RBRACE) and not self._is_at_end():
            field_tok = self._peek()
            name = self._expect(TokenType.IDENT).value
            self._expect(TokenType.DELIM_COLON)
            value = self._parse_expression()
            fields.append(StructLiteralField(
                line=field_tok.line, col=field_tok.col, name=name, value=value
            ))
            self._match(TokenType.DELIM_COMMA)

        self._expect(TokenType.DELIM_RBRACE)
        return StructLiteral(line=tok.line, col=tok.col, type_name="", fields=fields)

    def _parse_lambda(self) -> LambdaExpr:
        """|params| body_expr"""
        tok = self._advance()  # consume first '|'
        params: List[FieldNode] = []

        while not self._check(TokenType.OP_PIPE) and not self._is_at_end():
            param_tok = self._peek()
            name = self._expect(TokenType.IDENT).value
            type_expr = None
            if self._match(TokenType.OP_COLON_COLON):
                type_expr = self._parse_type_expr()
            params.append(FieldNode(line=param_tok.line, col=param_tok.col,
                                    name=name, type_expr=type_expr))
            self._match(TokenType.DELIM_COMMA)

        self._expect(TokenType.OP_PIPE)  # consume closing '|'
        body = self._parse_expression()
        return LambdaExpr(line=tok.line, col=tok.col, params=params, body=body)

    # ==================================================================
    # Type Expressions
    # ==================================================================

    def _parse_type_expr(self) -> TypeExpr:
        """Parse a type expression: Name<Param, Param>?"""
        tok = self._peek()
        name = self._expect(TokenType.IDENT).value
        params: List[TypeExpr] = []
        is_optional = False

        if self._match(TokenType.OP_LT):
            while not self._check(TokenType.OP_GT) and not self._is_at_end():
                params.append(self._parse_type_expr())
                if not self._match(TokenType.DELIM_COMMA):
                    break
            self._expect(TokenType.OP_GT)

        if self._match(TokenType.OP_QUESTION):
            is_optional = True

        return TypeExpr(line=tok.line, col=tok.col, name=name,
                        params=params, is_optional=is_optional)

    # ==================================================================
    # Constraint Blocks
    # ==================================================================

    def parse_constraint_block(self) -> ConstraintExpr:
        """Public interface for parsing [| constraints |]."""
        return self._parse_constraint_block()

    def _parse_constraint_block(self) -> ConstraintExpr:
        """[| constraint_expr, constraint_expr |]"""
        tok = self._expect(TokenType.DELIM_CONSTRAINT_OPEN)
        constraints: List[ASTNode] = []

        while not self._check(TokenType.DELIM_CONSTRAINT_CLOSE) and not self._is_at_end():
            constraints.append(self._parse_expression())
            self._match(TokenType.DELIM_COMMA)

        self._expect(TokenType.DELIM_CONSTRAINT_CLOSE)
        return ConstraintExpr(line=tok.line, col=tok.col, constraints=constraints)

    # ==================================================================
    # Neuro Blocks
    # ==================================================================

    def parse_neuro_block(self) -> List[ASTNode]:
        """Public interface for parsing {| ... |}."""
        return self._parse_neuro_block()

    def _parse_neuro_block(self) -> List[ASTNode]:
        """{| statement; statement; ... |}"""
        self._expect(TokenType.DELIM_NEURO_OPEN)
        stmts: List[ASTNode] = []
        while not self._check(TokenType.DELIM_NEURO_CLOSE) and not self._is_at_end():
            stmts.append(self._parse_statement())
        self._expect(TokenType.DELIM_NEURO_CLOSE)
        return stmts

    # ==================================================================
    # Helpers
    # ==================================================================

    def _parse_namespaced_name(self) -> str:
        """Parse a namespaced identifier like kernel::memory::alloc and return
        it as a single string with :: separators."""
        parts: List[str] = []
        parts.append(self._expect(TokenType.IDENT).value)
        while self._match(TokenType.OP_COLON_COLON):
            parts.append(self._expect(TokenType.IDENT).value)
        return "::".join(parts)

    def _skip_newlines(self) -> None:
        """Skip any NEWLINE tokens (already filtered but kept for safety)."""
        while not self._is_at_end() and self._peek().type == TokenType.NEWLINE:
            self._advance()

    # ------------------------------------------------------------------
    # Token navigation
    # ------------------------------------------------------------------

    def _peek(self) -> Token:
        """Return the current token without consuming it."""
        if self._pos >= len(self._tokens):
            # Return a synthetic EOF token
            return Token(type=TokenType.EOF, value="", line=0, col=0)
        return self._tokens[self._pos]

    def _peek_next(self) -> Token:
        """Return the token after the current one without consuming."""
        idx = self._pos + 1
        if idx >= len(self._tokens):
            return Token(type=TokenType.EOF, value="", line=0, col=0)
        return self._tokens[idx]

    def _advance(self) -> Token:
        """Consume and return the current token."""
        tok = self._peek()
        if tok.type != TokenType.EOF:
            self._pos += 1
        return tok

    def _check(self, tt: TokenType) -> bool:
        """Return True if the current token has the given type."""
        return self._peek().type == tt

    def _match(self, tt: TokenType) -> bool:
        """If the current token matches the type, consume it and return True."""
        if self._check(tt):
            self._advance()
            return True
        return False

    def _expect(self, tt: TokenType) -> Token:
        """Consume and return the current token, or raise ParseError if it
        does not match the expected type."""
        tok = self._peek()
        if tok.type != tt:
            self._error(
                f"Expected {tt.name}, got {tok.type.name} ({tok.value!r})"
            )
        return self._advance()

    def _is_at_end(self) -> bool:
        """Return True if we have reached the EOF token."""
        return self._peek().type == TokenType.EOF

    def _error(self, message: str) -> None:
        """Raise a ParseError with current position info."""
        tok = self._peek()
        raise ParseError(
            message,
            file_path=self._source_file,
            line=tok.line,
            col=tok.col,
        )
