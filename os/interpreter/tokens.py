"""
OpenXnet Neuro-Symbolic OS Kernel DSL - Token Definitions

Defines all token types for the three DSL file formats:
  .oxk  - Kernel module definitions
  .nxs  - Neuro-symbolic reasoning rules
  .oxp  - Process/service lifecycle descriptors
"""

from enum import Enum, auto
from dataclasses import dataclass
from typing import Any


class TokenType(Enum):
    """All token types for the OpenXnet kernel DSL."""

    # --- Keywords ---
    KW_MODULE = auto()
    KW_SERVICE = auto()
    KW_SYSCALL = auto()
    KW_STRUCT = auto()
    KW_ENUM = auto()
    KW_STATE = auto()
    KW_CONFIG = auto()
    KW_PHASE = auto()
    KW_INVOKE = auto()
    KW_EMIT = auto()
    KW_SIGNAL = auto()
    KW_SPAWN = auto()
    KW_BIND = auto()
    KW_FUSE = auto()
    KW_PERCEIVE = auto()
    KW_ON = auto()
    KW_IF = auto()
    KW_ELSE = auto()
    KW_FOR = auto()
    KW_IN = auto()
    KW_LET = auto()
    KW_MATCH = auto()
    KW_RETURN = auto()
    KW_CONCEPT = auto()
    KW_RELATION = auto()
    KW_RULE = auto()
    KW_WHEN = auto()
    KW_THEN = auto()
    KW_ASSERT = auto()
    KW_BOOST = auto()
    KW_DECAY = auto()
    KW_PROCESS = auto()
    KW_LIFECYCLE = auto()
    KW_BEHAVIOR = auto()
    KW_CHANNELS = auto()
    KW_CHANNEL = auto()
    KW_REQUIRES = auto()
    KW_SEND = auto()
    KW_RECV = auto()
    KW_BROADCAST = auto()
    KW_TRANSITION = auto()
    KW_AFTER = auto()
    KW_RETRY = auto()
    KW_CHAIN = auto()
    KW_STEP = auto()
    KW_OUTPUT = auto()
    KW_ENTRY = auto()
    KW_ONTOLOGY = auto()
    KW_RULESET = auto()
    KW_BINDINGS = auto()
    KW_PATTERN = auto()
    KW_WHERE = auto()
    KW_NOT = auto()
    KW_AND = auto()
    KW_OR = auto()
    KW_WITH = auto()
    KW_AS = auto()
    KW_CONST = auto()
    KW_TRUE = auto()
    KW_FALSE = auto()
    KW_HAS = auto()
    KW_SOME = auto()
    KW_NONE = auto()
    KW_OK = auto()
    KW_ERR = auto()
    KW_SELF = auto()

    # --- Ternary Keywords ---
    KW_TRIT = auto()
    KW_NEGATE = auto()
    KW_INHIBIT = auto()
    KW_UNKNOWN = auto()
    KW_TERNARY = auto()

    # --- Operators ---
    OP_PLUS = auto()        # +
    OP_MINUS = auto()       # -
    OP_STAR = auto()        # *
    OP_SLASH = auto()       # /
    OP_PERCENT = auto()     # %
    OP_EQ_EQ = auto()       # ==
    OP_NOT_EQ = auto()      # !=
    OP_LT = auto()          # <
    OP_GT = auto()          # >
    OP_LT_EQ = auto()       # <=
    OP_GT_EQ = auto()       # >=
    OP_FAT_ARROW = auto()   # =>
    OP_ARROW = auto()       # ->
    OP_SUBTYPE = auto()     # <:
    OP_COLON_COLON = auto() # ::
    OP_AT = auto()          # @
    OP_QUESTION = auto()    # ?
    OP_DOT = auto()         # .
    OP_DOT_DOT = auto()     # ..
    OP_PIPE = auto()        # |
    OP_ASSIGN = auto()      # =
    OP_CARET = auto()       # ^ (exponent/xor)
    OP_BANG = auto()        # !

    # --- Delimiters ---
    DELIM_NEURO_OPEN = auto()       # {|
    DELIM_NEURO_CLOSE = auto()      # |}
    DELIM_CONSTRAINT_OPEN = auto()  # [|
    DELIM_CONSTRAINT_CLOSE = auto() # |]
    DELIM_LPAREN = auto()           # (
    DELIM_RPAREN = auto()           # )
    DELIM_LBRACKET = auto()         # [
    DELIM_RBRACKET = auto()         # ]
    DELIM_LBRACE = auto()           # {
    DELIM_RBRACE = auto()           # }
    DELIM_COMMA = auto()            # ,
    DELIM_SEMICOLON = auto()        # ;
    DELIM_COLON = auto()            # :

    # --- Literals ---
    LIT_INT = auto()        # e.g. 42, 0xFF
    LIT_FLOAT = auto()      # e.g. 3.14
    LIT_STRING = auto()     # e.g. "hello"
    LIT_SYMBOL = auto()     # e.g. :IDLE, :BLOCKED
    LIT_DURATION = auto()   # e.g. 30s, 100ms
    LIT_BOOL = auto()       # true / false

    # --- Other ---
    IDENT = auto()          # identifiers
    NEWLINE = auto()        # significant newlines
    EOF = auto()            # end of file
    COMMENT = auto()        # comments (usually skipped)


# Keyword string -> TokenType mapping
KEYWORDS: dict[str, TokenType] = {
    "module": TokenType.KW_MODULE,
    "service": TokenType.KW_SERVICE,
    "syscall": TokenType.KW_SYSCALL,
    "struct": TokenType.KW_STRUCT,
    "enum": TokenType.KW_ENUM,
    "state": TokenType.KW_STATE,
    "config": TokenType.KW_CONFIG,
    "phase": TokenType.KW_PHASE,
    "invoke": TokenType.KW_INVOKE,
    "emit": TokenType.KW_EMIT,
    "signal": TokenType.KW_SIGNAL,
    "spawn": TokenType.KW_SPAWN,
    "bind": TokenType.KW_BIND,
    "fuse": TokenType.KW_FUSE,
    "perceive": TokenType.KW_PERCEIVE,
    "on": TokenType.KW_ON,
    "if": TokenType.KW_IF,
    "else": TokenType.KW_ELSE,
    "for": TokenType.KW_FOR,
    "in": TokenType.KW_IN,
    "let": TokenType.KW_LET,
    "match": TokenType.KW_MATCH,
    "return": TokenType.KW_RETURN,
    "concept": TokenType.KW_CONCEPT,
    "relation": TokenType.KW_RELATION,
    "rule": TokenType.KW_RULE,
    "when": TokenType.KW_WHEN,
    "then": TokenType.KW_THEN,
    "assert": TokenType.KW_ASSERT,
    "boost": TokenType.KW_BOOST,
    "decay": TokenType.KW_DECAY,
    "process": TokenType.KW_PROCESS,
    "lifecycle": TokenType.KW_LIFECYCLE,
    "behavior": TokenType.KW_BEHAVIOR,
    "channels": TokenType.KW_CHANNELS,
    "channel": TokenType.KW_CHANNEL,
    "requires": TokenType.KW_REQUIRES,
    "send": TokenType.KW_SEND,
    "recv": TokenType.KW_RECV,
    "broadcast": TokenType.KW_BROADCAST,
    "transition": TokenType.KW_TRANSITION,
    "after": TokenType.KW_AFTER,
    "retry": TokenType.KW_RETRY,
    "chain": TokenType.KW_CHAIN,
    "step": TokenType.KW_STEP,
    "output": TokenType.KW_OUTPUT,
    "entry": TokenType.KW_ENTRY,
    "ontology": TokenType.KW_ONTOLOGY,
    "ruleset": TokenType.KW_RULESET,
    "bindings": TokenType.KW_BINDINGS,
    "pattern": TokenType.KW_PATTERN,
    "where": TokenType.KW_WHERE,
    "not": TokenType.KW_NOT,
    "and": TokenType.KW_AND,
    "or": TokenType.KW_OR,
    "with": TokenType.KW_WITH,
    "as": TokenType.KW_AS,
    "const": TokenType.KW_CONST,
    "true": TokenType.KW_TRUE,
    "false": TokenType.KW_FALSE,
    "has": TokenType.KW_HAS,
    "Some": TokenType.KW_SOME,
    "None": TokenType.KW_NONE,
    "Ok": TokenType.KW_OK,
    "Err": TokenType.KW_ERR,
    "self": TokenType.KW_SELF,
    "trit": TokenType.KW_TRIT,
    "negate": TokenType.KW_NEGATE,
    "inhibit": TokenType.KW_INHIBIT,
    "unknown": TokenType.KW_UNKNOWN,
    "ternary": TokenType.KW_TERNARY,
}


@dataclass(frozen=True, slots=True)
class Token:
    """A single token produced by the lexer.

    Attributes:
        type:  The category/type of this token.
        value: The raw string value from source (or converted literal value).
        line:  1-based line number where the token starts.
        col:   1-based column number where the token starts.
    """
    type: TokenType
    value: Any
    line: int
    col: int

    def __repr__(self) -> str:
        return f"Token({self.type.name}, {self.value!r}, {self.line}:{self.col})"
