import { parseExpression } from "../parser/parser";
import { evaluate } from "../parser/evaluator";
import type { ASTNode } from "../parser/ast";
import type { Preset, Point, Candidate, WitnessGroup } from "./types";

export interface ParsedPreset {
    k: number;
    m: number;
    candidateVars: string[];
    witnessVars: string[];
    expression: string;
    ast: ASTNode;
    formula: string;
}

export type ParseResult =
    | { ok: true;  preset: ParsedPreset }
    | { ok: false; error: string };

export interface NamedPreset {
    name: string;
    preset: Preset;
    formula: string;
    k: number;
    m: number;
}

export type FileParseResult =
    | { ok: true;  presets: NamedPreset[]; warnings: string[] }
    | { ok: false; error: string };

export function parsePresetSpec(raw: string): ParseResult {
    const lines = raw.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 3) return { ok: false, error: "Expected 3 lines: k=..., m=..., <vars> : <vars> : <expr>" };

    const kMatch = lines[0].match(/^k\s*=\s*(\d+)$/i);
    if (!kMatch) return { ok: false, error: `Line 1: expected "k=<integer>", got "${lines[0]}"` };
    const k = parseInt(kMatch[1], 10);
    if (k < 1) return { ok: false, error: "k must be grater than 0" };

    const mMatch = lines[1].match(/^m\s*=\s*(\d+)$/i);
    if (!mMatch) return { ok: false, error: `Line 2: expected "m=<integer>", got "${lines[1]}"` };
    const m = parseInt(mMatch[1], 10);
    if (m < 0) return { ok: false, error: "m must be greater than or equal to 0" };

    const parts = lines[2].split(":").map(p => p.trim());
    if (parts.length !== 3) return { ok: false, error: `Line 3: expected 3 colon-separated parts, got ${parts.length}` };

    const candidateVars = parts[0].split(/\s+/).filter(Boolean);
    const witnessVars   = parts[1].split(/\s+/).filter(Boolean);
    const expression    = parts[2];

    if (candidateVars.length !== k * 2)
        return { ok: false, error: `k=${k} requires ${k*2} candidate variables, got ${candidateVars.length}: [${candidateVars.join(", ")}]` };
    if (witnessVars.length !== m * 2)
        return { ok: false, error: `m=${m} requires ${m*2} witness variables, got ${witnessVars.length}: [${witnessVars.join(", ")}]` };

    const allVars = [...candidateVars, ...witnessVars];
    const seen = new Set<string>();
    for (const v of allVars) {
        if (seen.has(v)) return { ok: false, error: `Duplicate variable name: "${v}"` };
        seen.add(v);
    }

    let ast: ASTNode;
    try { ast = parseExpression(expression); }
    catch (e) { return { ok: false, error: `Expression parse error: ${(e as Error).message}` }; }

    // @ts-ignore
    for (const v of collectVars(ast)) {
        if (!seen.has(v)) return { ok: false, error: `Undeclared variable "${v}". Declared: [${allVars.join(", ")}]` };
    }

    return { ok: true, preset: { k, m, candidateVars, witnessVars, expression, ast, formula: buildFormula(k, m, candidateVars, witnessVars, expression) } };
}

export function parsePresetFile(raw: string): FileParseResult {
    const blocks = raw.split(/\n[ \t]*\n/).map(b => b.trim()).filter(b => b.length > 0);
    if (blocks.length === 0) return { ok: false, error: "File is empty or contains no predicate blocks." };

    const presets: NamedPreset[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < blocks.length; i++) {
        const lines = blocks[i].split("\n").map(l => l.trim()).filter(l => l.length > 0);

        if (lines.length < 4) {
            warnings.push(`Block ${i+1}: too few lines (need: name, k=, m=, predicate). Skipped.`);
            continue;
        }

        const name = lines[0];
        if (/^k\s*=/i.test(name) || /^m\s*=/i.test(name)) {
            warnings.push(`Block ${i+1}: first line "${name}" looks like a parameter — missing name? Skipped.`);
            continue;
        }

        const result = parsePresetSpec(lines.slice(1).join("\n"));
        if (!result.ok) {
            warnings.push(`Block ${i+1} ("${name}"): ${result.error}`);
            continue;
        }

        const builtPreset = buildPreset(result.preset);
        builtPreset.id    = `file_${i}_${name.replace(/\W+/g, "_")}`;
        builtPreset.label = name;
        builtPreset.description = result.preset.expression;

        presets.push({ name, preset: builtPreset, formula: result.preset.formula, k: result.preset.k, m: result.preset.m });
    }

    if (presets.length === 0) {
        return { ok: false, error: "No valid predicate blocks found." + (warnings.length > 0 ? "\n\n" + warnings.join("\n") : "") };
    }

    return { ok: true, presets, warnings };
}

export function buildPreset(parsed: ParsedPreset): Preset {
    const { k, m, candidateVars, witnessVars, ast, formula } = parsed;
    return {
        id: "custom", label: "Custom predicate", k, m, formula,
        description: parsed.expression,

        genCandidates(points: Point[]): Candidate[] {
            const out: Candidate[] = [];
            generateTuples(points.length, k, [], out);
            return out;
        },
        testWitness(points: Point[], t: number[], w: WitnessGroup): boolean {
            try { return evaluate(ast, buildEnv(points, t, candidateVars, w, witnessVars)) as boolean; }
            catch { return false; }
        },
        getWitnesses(points: Point[], t: number[]): WitnessGroup[] {
            if (m === 0) return [];
            const out: WitnessGroup[] = [];
            generateWitnessTuples(points.length, m, [], out);
            return out.filter(w => !arraysEqual(w, t));
        },
        testSelf(points: Point[], t: number[], _cw: number, _ch: number): boolean {
            try { return evaluate(ast, buildEnv(points, t, candidateVars, [], [])) as boolean; }
            catch { return false; }
        },
    };
}

function collectVars(node: ASTNode): Set<string> {
    const vars = new Set<string>();
    function walk(n: ASTNode) {
        if (n.kind === "Var") { vars.add(n.name); return; }
        if (n.kind === "Number") return;
        if (n.kind === "Not") { walk(n.operand); return; }
        if ("left" in n) { walk((n as any).left); walk((n as any).right); }
    }
    walk(node); return vars;
}

function buildEnv(points: Point[], t: number[], cvars: string[], w: number[], wvars: string[]): Record<string, number> {
    const env: Record<string, number> = {};
    for (let i = 0; i < t.length; i++) { env[cvars[i*2]] = points[t[i]].x; env[cvars[i*2+1]] = points[t[i]].y; }
    for (let i = 0; i < w.length; i++) { env[wvars[i*2]] = points[w[i]].x; env[wvars[i*2+1]] = points[w[i]].y; }
    return env;
}

function generateTuples(n: number, k: number, current: number[], out: Candidate[]) {
    if (current.length === k) { if (new Set(current).size === k) out.push({ t: [...current], status: "pending" }); return; }
    for (let i = 0; i < n; i++) { current.push(i); generateTuples(n, k, current, out); current.pop(); }
}

function generateWitnessTuples(n: number, m: number, current: number[], out: WitnessGroup[]) {
    if (current.length === m) { if (new Set(current).size === m) out.push([...current]); return; }
    for (let i = 0; i < n; i++) { current.push(i); generateWitnessTuples(n, m, current, out); current.pop(); }
}

function arraysEqual(a: number[], b: number[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

function buildFormula(k: number, m: number, cvars: string[], wvars: string[], expr: string): string {
    const t = Array.from({ length: k }, (_, i) => `(${cvars[i*2]},${cvars[i*2+1]})`).join(",");
    if (m === 0) return `Sol(D) = { t ∈ D^${k} : ${expr} }`;
    const u = Array.from({ length: m }, (_, i) => `(${wvars[i*2]},${wvars[i*2+1]})`).join(",");
    return `Sol(D) = { t=(${t}) ∈ D^${k} : ∀ u=(${u}) ∈ D^${m}  ${expr} }`;
}
 
