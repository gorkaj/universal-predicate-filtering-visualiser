// ---------------------------------------------------------------------------
// Lexer
// ---------------------------------------------------------------------------

export type TokenKind =
    | "NUMBER"
    | "IDENT"
    | "LPAREN"
    | "RPAREN"
    | "LT"
    | "GT"
    | "LTE"
    | "GTE"
    | "EQ"
    | "NEQ"
    | "PLUS"
    | "MINUS"
    | "STAR"
    | "SLASH"
    | "AND"
    | "OR"
    | "NOT"
    | "EOF";

export interface Token {
    kind: TokenKind;
    value: string;
}

export function tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    while (i < input.length) {
        // Skip whitespace
        if (/\s/.test(input[i])) { i++; continue; }

        // Two-char operators
        if (input[i] === "<" && input[i + 1] === "=") {
            tokens.push({ kind: "LTE", value: "<=" }); i += 2; continue;
        }
        if (input[i] === ">" && input[i + 1] === "=") {
            tokens.push({ kind: "GTE", value: ">=" }); i += 2; continue;
        }
        if (input[i] === "!" && input[i + 1] === "=") {
            tokens.push({ kind: "NEQ", value: "!=" }); i += 2; continue;
        }

        // Single-char operators
        const single: Record<string, TokenKind> = {
            "(": "LPAREN", ")": "RPAREN",
            "<": "LT",     ">": "GT",
            "=": "EQ",     "+": "PLUS",
            "-": "MINUS",  "*": "STAR",
            "/": "SLASH",
        };
        if (single[input[i]]) {
            tokens.push({ kind: single[input[i]], value: input[i] }); i++; continue;
        }

        // Numbers (including decimals)
        if (/[0-9]/.test(input[i])) {
            let num = "";
            while (i < input.length && /[0-9.]/.test(input[i])) num += input[i++];
            tokens.push({ kind: "NUMBER", value: num }); continue;
        }

        // Identifiers and keywords
        if (/[a-zA-Z_]/.test(input[i])) {
            let ident = "";
            while (i < input.length && /[a-zA-Z_0-9]/.test(input[i])) ident += input[i++];
            const lower = ident.toLowerCase();
            if (lower === "and") tokens.push({ kind: "AND", value: lower });
            else if (lower === "or") tokens.push({ kind: "OR", value: lower });
            else if (lower === "not") tokens.push({ kind: "NOT", value: lower });
            else tokens.push({ kind: "IDENT", value: ident });
            continue;
        }

        throw new Error(`Unexpected character: '${input[i]}' at position ${i}`);
    }

    tokens.push({ kind: "EOF", value: "" });
    return tokens;
}
