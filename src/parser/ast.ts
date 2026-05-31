// ---------------------------------------------------------------------------
// AST node types for the FOL predicate expression
// ---------------------------------------------------------------------------

export type ASTNode =
    | { kind: "Number";   value: number }
    | { kind: "Var";      name: string }
    | { kind: "BinArith"; op: "+" | "-" | "*" | "/"; left: ASTNode; right: ASTNode }
    | { kind: "Compare";  op: "<" | ">" | "<=" | ">=" | "=" | "!="; left: ASTNode; right: ASTNode }
    | { kind: "And";      left: ASTNode; right: ASTNode }
    | { kind: "Or";       left: ASTNode; right: ASTNode }
    | { kind: "Not";      operand: ASTNode };
