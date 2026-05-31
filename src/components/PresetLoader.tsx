import React, { useRef, useState, useCallback } from "react";
import { parsePresetFile } from "../preset/presetBuilder";
import type { NamedPreset } from "../preset/presetBuilder";

const T = {
    navy:        "#0f1923",
    cream:       "#f7f5f0",
    creamBorder: "#d8d3c8",
    ink:         "#1a1916",
    inkMid:      "#4a4844",
    inkLight:    "#8a8680",
    green:       "#16a34a",
    amber:       "#d97706",
    red:         "#dc2626",
    mono:        "'IBM Plex Mono', 'Fira Mono', monospace",
    sans:        "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
};

interface PresetLoaderProps {
    onPresetsLoaded: (presets: NamedPreset[]) => void;
}

const TEMPLATE = `\
1D triangulation
k=2
m=1
tx1 ty1 tx2 ty2 : ux uy : (tx1 < tx2) and not (tx1 < ux and ux < tx2)

Convex hull
k=2
m=1
ax ay bx by : px py : ((bx-ax)*(py-ay)-(by-ay)*(px-ax)) >= 0

Closest pair
k=2
m=2
ax ay bx by : cx cy dx dy : ((ax-bx)*(ax-bx)+(ay-by)*(ay-by)) <= ((cx-dx)*(cx-dx)+(cy-dy)*(cy-dy))

Window query
k=1
m=0
px py : : px >= -10 and px <= 10 and py >= -5 and py <= 5`;

type Status =
    | { kind: "idle" }
    | { kind: "ok";  count: number; warnings: string[] }
    | { kind: "err"; message: string };

export function PresetLoader({ onPresetsLoaded }: PresetLoaderProps) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [status,   setStatus]   = useState<Status>({ kind: "idle" });
    const [hintOpen, setHintOpen] = useState(false);

    const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const raw    = ev.target?.result as string;
            const result = parsePresetFile(raw);
            if (!result.ok) { setStatus({ kind: "err", message: result.error }); return; }
            setStatus({ kind: "ok", count: result.presets.length, warnings: result.warnings });
            onPresetsLoaded(result.presets);
        };
        reader.readAsText(file);
        e.target.value = "";
    }, [onPresetsLoaded]);

    const downloadExample = useCallback(() => {
        const a   = document.createElement("a");
        a.href    = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/plain" }));
        a.download = "predicates.txt";
        a.click();
    }, []);

    return (
        <div style={{
            background: "#fff",
            border: `1px solid ${T.creamBorder}`,
            borderRadius: 4,
            overflow: "hidden",
        }}>
            {/* Main row */}
            <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 14px",
                background: T.cream,
                borderBottom: hintOpen || status.kind !== "idle"
                    ? `1px solid ${T.creamBorder}` : "none",
            }}>
                <span style={{ fontFamily: T.mono, fontSize: 10, color: T.inkLight,
                    textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    problems specification
                </span>

                <div style={{ flex: 1 }} />

                {/* Status indicator */}
                {status.kind === "ok" && (
                    <span style={{ fontFamily: T.mono, fontSize: 10, color: T.green }}>
                        {status.count} predicate{status.count !== 1 ? "s" : ""} loaded
                        {status.warnings.length > 0 && (
                            <span style={{ color: T.amber, marginLeft: 8 }}>
                                {status.warnings.length} warning{status.warnings.length > 1 ? "s" : ""}
                            </span>
                        )}
                    </span>
                )}
                {status.kind === "err" && (
                    <span style={{ fontFamily: T.mono, fontSize: 10, color: T.red }}>
                        Parsing error
                    </span>
                )}

                <input ref={fileRef} type="file" accept=".txt"
                       style={{ display: "none" }} onChange={handleFile} />

                <button
                    onClick={() => fileRef.current?.click()}
                    style={{
                        fontFamily: T.mono, fontSize: 10,
                        padding: "4px 12px",
                        background: T.navy, color: "#fff",
                        border: "none", borderRadius: 3, cursor: "pointer",
                        letterSpacing: "0.03em",
                    }}
                >
                    Upload
                </button>

                <button
                    onClick={() => setHintOpen(o => !o)}
                    style={{
                        fontFamily: T.mono, fontSize: 10,
                        padding: "4px 10px",
                        background: "transparent", color: T.inkLight,
                        border: `1px solid ${T.creamBorder}`,
                        borderRadius: 3, cursor: "pointer",
                    }}
                >
                    {hintOpen ? "▲" : "▼"} Format
                </button>
            </div>

            {/* Error detail */}
            {status.kind === "err" && (
                <div style={{
                    padding: "8px 14px",
                    fontFamily: T.mono, fontSize: 10, color: T.red,
                    lineHeight: 1.7, whiteSpace: "pre-wrap",
                    borderBottom: hintOpen ? `1px solid ${T.creamBorder}` : "none",
                }}>
                    {status.message}
                </div>
            )}

            {/* Warnings */}
            {status.kind === "ok" && status.warnings.length > 0 && (
                <div style={{
                    padding: "8px 14px",
                    fontFamily: T.mono, fontSize: 10, color: T.amber,
                    lineHeight: 1.7, whiteSpace: "pre-wrap",
                    borderBottom: hintOpen ? `1px solid ${T.creamBorder}` : "none",
                }}>
                    {status.warnings.join("\n")}
                </div>
            )}

            {/* Format hint */}
            {hintOpen && (
                <div style={{ padding: "12px 14px" }}>
                    <div style={{
                        fontFamily: T.mono, fontSize: 10, color: T.inkLight,
                        lineHeight: 1.8, marginBottom: 10,
                    }}>
                        Plain text file, 4 lines per problem<br />
                        <span style={{ color: T.inkMid }}>problem name</span> <br/>
                        <span style={{ color: T.inkMid }}>k=&lt;int&gt; (k&gt;0)</span> <br/>
                        <span style={{ color: T.inkMid }}>m=&lt;int&gt; (m&ge;0)</span> <br/>
                        <span style={{ color: T.inkMid }}>&lt;k×2 vars&gt; : &lt;m×2 vars&gt; : &lt;expr&gt;</span><br />
                        Supported operations: <span style={{ color: T.inkMid }}>and  or  not  &lt;  &gt;  &lt;=  &gt;=  =  +  -  *  /</span>
                    </div>

                    <div style={{ marginTop: 8 }}>
                        <button
                            onClick={downloadExample}
                            style={{
                                fontFamily: T.mono, fontSize: 10,
                                padding: "4px 10px",
                                background: "transparent", color: T.inkLight,
                                border: `1px solid ${T.creamBorder}`,
                                borderRadius: 3, cursor: "pointer",
                            }}
                        >
                            Download example file
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}