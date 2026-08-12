"""
OpenXnet Neuro-Symbolic OS Kernel DSL - Lexer

A character-by-character scanner that transforms source text into a flat
list of Token objects. Supports all three DSL file formats (.oxk, .nxs, .oxp).

Features:
  - Single-line comments: -- ...
  - Multi-line comments: {-- ... --}
  - Neuro-block delimiters: {| |}
  - Constraint-block delimiters: [| |]
  - Duration literals: 30s, 100ms
  - Symbol literals: :IDLE, :BLOCKED
  - Two-character operators: ::, =>, ->, <:, <=, >=, !=, ==, ..
  - Full line/column tracking
"""

from typing import Optional

from .tokens import Token, TokenType, KEYWORDS
from .exceptions import LexerError


class Lexer:
    """Tokenizes OpenXnet DSL source code.

    Usage:
        lexer = Lexer(source_text, file_path="scheduler.oxk")
        tokens = lexer.tokenize()
    """

    def __init__(self, source: str, file_path: str = "<input>") -> None:
        self._source = source
        self._file_path = file_path
        self._pos = 0
        self._line = 1
        self._col = 1
        self._tokens: list[Token] = []

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def tokenize(self) -> list[Token]:
        """Scan the entire source and return the token list (ending with EOF)."""
        while not self._at_end():
            self._scan_token()
        self._emit(TokenType.EOF, "", self._line, self._col)
        return self._tokens

    # ------------------------------------------------------------------
    # Core scanning
    # ------------------------------------------------------------------

    def _scan_token(self) -> None:
        start_line = self._line
        start_col = self._col
        ch = self._advance()

        # Whitespace (non-newline)
        if ch in (' ', '\t', '\r'):
            return

        # Newlines
        if ch == '\n':
            self._emit(TokenType.NEWLINE, "\n", start_line, start_col)
            return

        # --- Comments and operators starting with '-' ---
        if ch == '-':
            if self._peek() == '-':
                self._single_line_comment(start_line, start_col)
                return
            if self._peek() == '>':
                self._advance()
                self._emit(TokenType.OP_ARROW, "->", start_line, start_col)
                return
            self._emit(TokenType.OP_MINUS, "-", start_line, start_col)
            return

        # --- Braces / neuro-block / multi-line comment ---
        if ch == '{':
            if self._peek() == '-' and self._peek_at(1) == '-':
                self._multi_line_comment(start_line, start_col)
                return
            if self._peek() == '|':
                self._advance()
                self._emit(TokenType.DELIM_NEURO_OPEN, "{|", start_line, start_col)
                return
            self._emit(TokenType.DELIM_LBRACE, "{", start_line, start_col)
            return

        # --- Pipe / neuro-close / constraint-close ---
        if ch == '|':
            if self._peek() == '}':
                self._advance()
                self._emit(TokenType.DELIM_NEURO_CLOSE, "|}", start_line, start_col)
                return
            if self._peek() == ']':
                self._advance()
                self._emit(TokenType.DELIM_CONSTRAINT_CLOSE, "|]", start_line, start_col)
                return
            self._emit(TokenType.OP_PIPE, "|", start_line, start_col)
            return

        # --- Brackets / constraint-open ---
        if ch == '[':
            if self._peek() == '|':
                self._advance()
                self._emit(TokenType.DELIM_CONSTRAINT_OPEN, "[|", start_line, start_col)
                return
            self._emit(TokenType.DELIM_LBRACKET, "[", start_line, start_col)
            return

        if ch == ']':
            self._emit(TokenType.DELIM_RBRACKET, "]", start_line, start_col)
            return

        if ch == '}':
            self._emit(TokenType.DELIM_RBRACE, "}", start_line, start_col)
            return

        # --- Parentheses ---
        if ch == '(':
            self._emit(TokenType.DELIM_LPAREN, "(", start_line, start_col)
            return
        if ch == ')':
            self._emit(TokenType.DELIM_RPAREN, ")", start_line, start_col)
            return

        # --- Comma, semicolon ---
        if ch == ',':
            self._emit(TokenType.DELIM_COMMA, ",", start_line, start_col)
            return
        if ch == ';':
            self._emit(TokenType.DELIM_SEMICOLON, ";", start_line, start_col)
            return

        # --- Operators ---
        if ch == '+':
            self._emit(TokenType.OP_PLUS, "+", start_line, start_col)
            return
        if ch == '*':
            self._emit(TokenType.OP_STAR, "*", start_line, start_col)
            return
        if ch == '/':
            self._emit(TokenType.OP_SLASH, "/", start_line, start_col)
            return
        if ch == '%':
            self._emit(TokenType.OP_PERCENT, "%", start_line, start_col)
            return
        if ch == '@':
            self._emit(TokenType.OP_AT, "@", start_line, start_col)
            return
        if ch == '?':
            self._emit(TokenType.OP_QUESTION, "?", start_line, start_col)
            return

        if ch == '.':
            if self._peek() == '.':
                self._advance()
                self._emit(TokenType.OP_DOT_DOT, "..", start_line, start_col)
                return
            self._emit(TokenType.OP_DOT, ".", start_line, start_col)
            return

        if ch == '=':
            if self._peek() == '=':
                self._advance()
                self._emit(TokenType.OP_EQ_EQ, "==", start_line, start_col)
                return
            if self._peek() == '>':
                self._advance()
                self._emit(TokenType.OP_FAT_ARROW, "=>", start_line, start_col)
                return
            self._emit(TokenType.OP_ASSIGN, "=", start_line, start_col)
            return

        if ch == '!':
            if self._peek() == '=':
                self._advance()
                self._emit(TokenType.OP_NOT_EQ, "!=", start_line, start_col)
                return
            self._emit(TokenType.OP_BANG, "!", start_line, start_col)
            return

        if ch == '<':
            if self._peek() == '=':
                self._advance()
                self._emit(TokenType.OP_LT_EQ, "<=", start_line, start_col)
                return
            if self._peek() == ':':
                self._advance()
                self._emit(TokenType.OP_SUBTYPE, "<:", start_line, start_col)
                return
            self._emit(TokenType.OP_LT, "<", start_line, start_col)
            return

        if ch == '>':
            if self._peek() == '=':
                self._advance()
                self._emit(TokenType.OP_GT_EQ, ">=", start_line, start_col)
                return
            self._emit(TokenType.OP_GT, ">", start_line, start_col)
            return

        if ch == ':':
            if self._peek() == ':':
                self._advance()
                self._emit(TokenType.OP_COLON_COLON, "::", start_line, start_col)
                return
            # Symbol literal :NAME
            if self._peek() and self._peek().isalpha():
                self._symbol_literal(start_line, start_col)
                return
            self._emit(TokenType.DELIM_COLON, ":", start_line, start_col)
            return

        if ch == '^':
            self._emit(TokenType.OP_CARET, "^", start_line, start_col)
            return

        # --- String literal ---
        if ch == '"':
            self._string_literal(start_line, start_col)
            return

        # --- Number literals (int, float, duration) ---
        if ch.isdigit():
            self._number_literal(ch, start_line, start_col)
            return

        # --- Identifiers and keywords ---
        if ch.isalpha() or ch == '_':
            self._identifier(ch, start_line, start_col)
            return

        self._error(f"Unexpected character {ch!r}", start_line, start_col)

    # ------------------------------------------------------------------
    # Literal scanners
    # ------------------------------------------------------------------

    def _string_literal(self, start_line: int, start_col: int) -> None:
        """Scan a double-quoted string literal (supports basic escape sequences)."""
        buf: list[str] = []
        while not self._at_end():
            ch = self._advance()
            if ch == '"':
                self._emit(TokenType.LIT_STRING, "".join(buf), start_line, start_col)
                return
            if ch == '\\':
                esc = self._advance() if not self._at_end() else ''
                if esc == 'n':
                    buf.append('\n')
                elif esc == 't':
                    buf.append('\t')
                elif esc == 'r':
                    buf.append('\r')
                elif esc == '\\':
                    buf.append('\\')
                elif esc == '"':
                    buf.append('"')
                elif esc == '0':
                    buf.append('\0')
                else:
                    buf.append('\\')
                    buf.append(esc)
            elif ch == '\n':
                # Newlines inside strings still update line tracking
                buf.append(ch)
            else:
                buf.append(ch)
        self._error("Unterminated string literal", start_line, start_col)

    def _number_literal(self, first: str, start_line: int, start_col: int) -> None:
        """Scan an integer, float, or duration literal."""
        buf = [first]
        is_float = False

        # Hex literal
        if first == '0' and self._peek() in ('x', 'X'):
            buf.append(self._advance())
            while not self._at_end() and (self._peek().isalnum() or self._peek() == '_'):
                buf.append(self._advance())
            self._emit(TokenType.LIT_INT, int("".join(buf), 16), start_line, start_col)
            return

        # Decimal digits
        while not self._at_end() and (self._peek().isdigit() or self._peek() == '_'):
            buf.append(self._advance())

        # Decimal point (float)
        if not self._at_end() and self._peek() == '.':
            # Make sure it's not '..' (range operator)
            if self._peek_at(1) != '.':
                is_float = True
                buf.append(self._advance())  # consume '.'
                while not self._at_end() and (self._peek().isdigit() or self._peek() == '_'):
                    buf.append(self._advance())

        # Duration suffix: 'ms' or 's'
        if not self._at_end() and self._peek() == 'm' and self._peek_at(1) == 's':
            buf.append(self._advance())  # 'm'
            buf.append(self._advance())  # 's'
            self._emit(TokenType.LIT_DURATION, "".join(buf), start_line, start_col)
            return
        if not self._at_end() and self._peek() == 's' and not self._is_ident_char(self._peek_at(1)):
            buf.append(self._advance())  # 's'
            self._emit(TokenType.LIT_DURATION, "".join(buf), start_line, start_col)
            return

        raw = "".join(buf).replace("_", "")
        if is_float:
            self._emit(TokenType.LIT_FLOAT, float(raw), start_line, start_col)
        else:
            self._emit(TokenType.LIT_INT, int(raw), start_line, start_col)

    def _symbol_literal(self, start_line: int, start_col: int) -> None:
        """Scan a symbol literal like :IDLE or :BLOCKED."""
        buf: list[str] = []
        while not self._at_end() and self._is_ident_char(self._peek()):
            buf.append(self._advance())
        name = "".join(buf)
        if not name:
            self._error("Expected symbol name after ':'", start_line, start_col)
        self._emit(TokenType.LIT_SYMBOL, ":" + name, start_line, start_col)

    def _identifier(self, first: str, start_line: int, start_col: int) -> None:
        """Scan an identifier or keyword."""
        buf = [first]
        while not self._at_end() and self._is_ident_char(self._peek()):
            buf.append(self._advance())
        word = "".join(buf)

        # Check for keywords
        if word in KEYWORDS:
            tt = KEYWORDS[word]
            # true/false are also bool literals
            if tt == TokenType.KW_TRUE:
                self._emit(TokenType.LIT_BOOL, True, start_line, start_col)
            elif tt == TokenType.KW_FALSE:
                self._emit(TokenType.LIT_BOOL, False, start_line, start_col)
            else:
                self._emit(tt, word, start_line, start_col)
        else:
            self._emit(TokenType.IDENT, word, start_line, start_col)

    # ------------------------------------------------------------------
    # Comment scanners
    # ------------------------------------------------------------------

    def _single_line_comment(self, start_line: int, start_col: int) -> None:
        """Consume a -- single-line comment until end of line."""
        self._advance()  # consume second '-'
        buf: list[str] = ['-', '-']
        while not self._at_end() and self._peek() != '\n':
            buf.append(self._advance())
        # Comments are skipped (not emitted) by default.
        # Uncomment the next line to preserve them:
        # self._emit(TokenType.COMMENT, "".join(buf), start_line, start_col)

    def _multi_line_comment(self, start_line: int, start_col: int) -> None:
        """Consume a {-- ... --} multi-line comment (supports nesting)."""
        # We already consumed '{'; consume the '--'
        self._advance()  # '-'
        self._advance()  # '-'
        depth = 1
        while not self._at_end() and depth > 0:
            c = self._advance()
            if c == '{' and self._peek() == '-' and self._peek_at(1) == '-':
                self._advance()
                self._advance()
                depth += 1
            elif c == '-' and self._peek() == '-' and self._peek_at(1) == '}':
                self._advance()
                self._advance()
                depth -= 1
        if depth > 0:
            self._error("Unterminated multi-line comment", start_line, start_col)

    # ------------------------------------------------------------------
    # Character-level helpers
    # ------------------------------------------------------------------

    def _at_end(self) -> bool:
        return self._pos >= len(self._source)

    def _advance(self) -> str:
        """Consume and return the current character, updating line/col."""
        ch = self._source[self._pos]
        self._pos += 1
        if ch == '\n':
            self._line += 1
            self._col = 1
        else:
            self._col += 1
        return ch

    def _peek(self) -> Optional[str]:
        """Return the current character without consuming it (or None at EOF)."""
        if self._pos >= len(self._source):
            return None
        return self._source[self._pos]

    def _peek_at(self, offset: int) -> Optional[str]:
        """Return the character at pos+offset without consuming (or None)."""
        idx = self._pos + offset
        if idx >= len(self._source):
            return None
        return self._source[idx]

    @staticmethod
    def _is_ident_char(ch: Optional[str]) -> bool:
        """Return True if ch can appear in an identifier (after the first char)."""
        if ch is None:
            return False
        return ch.isalnum() or ch == '_'

    # ------------------------------------------------------------------
    # Token emission and errors
    # ------------------------------------------------------------------

    def _emit(self, token_type: TokenType, value: object, line: int, col: int) -> None:
        self._tokens.append(Token(type=token_type, value=value, line=line, col=col))

    def _error(self, message: str, line: int, col: int) -> None:
        raise LexerError(message, file_path=self._file_path, line=line, col=col)
