import type { ASTNode } from "./ast";

export type Env = Record<string, number>;

// ---------------------------------------------------------------------------
// Evaluate an AST node under a variable environment.
// Returns a number (for arithmetic nodes) or boolean (for logical nodes).
// We use a union return type and cast at the call sites.
// ---------------------------------------------------------------------------

export function evaluate(node: ASTNode, env: Env): number | boolean {
    switch (node.kind) {
        case "Number":
            return node.value;

        case "Var": {
            const val = env[node.name];
            if (val === undefined) {
                throw new Error(`Unbound variable: "${node.name}"`);
            }
            return val;
        }

        case "BinArith": {
            const l = evaluate(node.left, env) as number;
            const r = evaluate(node.right, env) as number;
            switch (node.op) {
                case "+": return l + r;
                case "-": return l - r;
                case "*": return l * r;
                case "/":
                    if (r === 0) throw new Error("Division by zero");
                    return l / r;
            }
            break;
        }

        case "Compare": {
            const l = evaluate(node.left, env) as number;
            const r = evaluate(node.right, env) as number;
            switch (node.op) {
                case "<":  return l < r;
                case ">":  return l > r;
                case "<=": return l <= r;
                case ">=": return l >= r;
                case "=":  return Math.abs(l - r) < 1e-9;
                case "!=": return Math.abs(l - r) >= 1e-9;
            }
            break;
        }

        case "And":
            return (evaluate(node.left, env) as boolean) &&
                (evaluate(node.right, env) as boolean);

        case "Or":
            return (evaluate(node.left, env) as boolean) ||
                (evaluate(node.right, env) as boolean);

        case "Not":
            return !(evaluate(node.operand, env) as boolean);
    }

    throw new Error(`Unknown node kind: ${(node as ASTNode).kind}`);
}