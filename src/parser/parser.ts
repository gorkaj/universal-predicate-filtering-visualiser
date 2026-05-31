import { tokenize, Token, TokenKind } from "./lexer";
import type { ASTNode } from "./ast";

// ---------------------------------------------------------------------------
// Parser
//
// Grammar:
//   expr → or_expr
//   or_expr → and_expr ('or' and_expr)*
//   and_expr → not_expr ('and' not_expr)*
//   not_expr → 'not' not_expr | compare
//   compare  → arith (('<'|'>'|'<='|'>='|'='|'!=') arith)?
//   arith  → term (('+' | '-')  term)*
//   term  → factor (('*' | '/')  factor)*
//   factor → '(' expr ')'  |  NUMBER  |  IDENT
// ---------------------------------------------------------------------------

class Parser {
    private tokens: Token[];
    private pos = 0;

    constructor(input: string) {
        this.tokens = tokenize(input);
    }

    // ---- helpers -----------------------------------------------------------

    private peek(): Token {
        return this.tokens[this.pos];
    }

    private consume(): Token {
        return this.tokens[this.pos++];
    }

    private expect(kind: TokenKind): Token {
        const t = this.consume();
        if (t.kind !== kind) {
            throw new Error(`Expected ${kind} but got ${t.kind} ("${t.value}")`);
        }
        return t;
    }

    private match(...kinds: TokenKind[]): boolean {
        return kinds.includes(this.peek().kind);
    }

    // ---- grammar rules -----------------------------------------------------

    parse(): ASTNode {
        const node = this.parseOr();
        if (this.peek().kind !== "EOF") {
            throw new Error(`Unexpected token "${this.peek().value}" after expression`);
        }
        return node;
    }

    private parseOr(): ASTNode {
        let left = this.parseAnd();
        while (this.match("OR")) {
            this.consume();
            const right = this.parseAnd();
            left = { kind: "Or", left, right };
        }
        return left;
    }

    private parseAnd(): ASTNode {
        let left = this.parseNot();
        while (this.match("AND")) {
            this.consume();
            const right = this.parseNot();
            left = { kind: "And", left, right };
        }
        return left;
    }

    private parseNot(): ASTNode {
        if (this.match("NOT")) {
            this.consume();
            const operand = this.parseNot();
            return { kind: "Not", operand };
        }
        return this.parseCompare();
    }

    private parseCompare(): ASTNode {
        const left = this.parseArith();
        const opMap: Partial<Record<TokenKind, "<" | ">" | "<=" | ">=" | "=" | "!=">> = {
            LT: "<", GT: ">", LTE: "<=", GTE: ">=", EQ: "=", NEQ: "!=",
        };
        const op = opMap[this.peek().kind];
        if (op) {
            this.consume();
            const right = this.parseArith();
            return { kind: "Compare", op, left, right };
        }
        return left;
    }

    private parseArith(): ASTNode {
        let left = this.parseTerm();
        while (this.match("PLUS", "MINUS")) {
            const op = this.consume().value as "+" | "-";
            const right = this.parseTerm();
            left = { kind: "BinArith", op, left, right };
        }
        return left;
    }

    private parseTerm(): ASTNode {
        let left = this.parseFactor();
        while (this.match("STAR", "SLASH")) {
            const op = this.consume().value as "*" | "/";
            const right = this.parseFactor();
            left = { kind: "BinArith", op, left, right };
        }
        return left;
    }

    private parseFactor(): ASTNode {
        const t = this.peek();

        if (t.kind === "LPAREN") {
            this.consume();
            const node = this.parseOr();
            this.expect("RPAREN");
            return node;
        }

        if (t.kind === "NUMBER") {
            this.consume();
            return { kind: "Number", value: parseFloat(t.value) };
        }

        if (t.kind === "IDENT") {
            this.consume();
            return { kind: "Var", name: t.value };
        }

        // Unary minus: treat "-3" as (0 - 3)
        if (t.kind === "MINUS") {
            this.consume();
            const operand = this.parseFactor();
            return { kind: "BinArith", op: "-", left: { kind: "Number", value: 0 }, right: operand };
        }

        throw new Error(`Unexpected token "${t.value}" (${t.kind})`);
    }
}

// ---------------------------------------------------------------------------
// Public parse
// ---------------------------------------------------------------------------

export function parseExpression(input: string): ASTNode {
    return new Parser(input).parse();
}
