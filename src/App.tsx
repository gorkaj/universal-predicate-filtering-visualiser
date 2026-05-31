import React, {useState, useCallback, useRef, useEffect} from "react";
import {Canvas, DEFAULT_COORDS} from "./components/Canvas";
import type {Point, Preset} from "./preset/types";
import {NamedPreset} from "./preset/presetBuilder";
import {PresetLoader} from "./components/PresetLoader";
import {useAlgoEngine} from "./hooks/useAlgoEngine";

// COLORS
const T = {
    navy:        "#0f1923",
    navyMid:     "#1a2736",
    navyBorder:  "#243040",
    cream:       "#f7f5f0",
    creamDark:   "#ede9e1",
    creamBorder: "#d8d3c8",
    ink:         "#1a1916",
    inkMid:      "#4a4844",
    inkLight:    "#8a8680",
    blue:        "#2563eb",
    blueLight:   "#dbeafe",
    green:       "#16a34a",
    greenLight:  "#dcfce7",
    amber:       "#d97706",
    amberLight:  "#fef3c7",
    red:         "#dc2626",
    mono:        "'IBM Plex Mono', 'Fira Mono', 'Cascadia Code', monospace",
    sans:        "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
} as const;

// PRIMITVES

function Mono({ children, size = 12, color = T.inkMid }: {
    children: React.ReactNode; size?: number; color?: string;
}) {
    return <span style={{ fontFamily: T.mono, fontSize: size, color }}>{children}</span>;
}

function Label({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            fontFamily: T.mono, fontSize: 9, color: T.inkLight,
            textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6,
        }}>{children}</div>
    );
}

function Pill({ children, scheme }: { children: React.ReactNode; scheme: "blue" | "green" }) {
    const s = scheme === "blue"
        ? { bg: T.blueLight,  text: T.blue }
        : { bg: T.greenLight, text: T.green };
    return (
        <span style={{
            fontFamily: T.mono, fontSize: 10, fontWeight: 600,
            padding: "2px 8px", borderRadius: 2,
            background: s.bg, color: s.text,
            border: `1px solid ${s.text}22`,
            letterSpacing: "0.03em",
        }}>{children}</span>
    );
}

function Btn({ children, onClick, variant = "ghost", disabled }: {
    children: React.ReactNode;
    onClick: () => void;
    variant?: "primary" | "ghost" | "outline";
    disabled?: boolean;
}) {
    const styles: Record<string, React.CSSProperties> = {
        primary: {
            background: T.navy, color: "#fff",
            border: `1px solid ${T.navy}`,
        },
        outline: {
            background: "transparent", color: T.ink,
            border: `1px solid ${T.creamBorder}`,
        },
        ghost: {
            background: "transparent", color: T.inkMid,
            border: `1px solid transparent`,
        },
    };
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                ...styles[variant],
                fontFamily: T.mono, fontSize: 11,
                padding: "5px 14px", borderRadius: 3,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.38 : 1,
                transition: "opacity 0.1s",
                whiteSpace: "nowrap",
            }}
        >{children}</button>
    );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <div style={{
            background: "#fff",
            border: `1px solid ${T.creamBorder}`,
            borderRadius: 4,
            ...style,
        }}>{children}</div>
    );
}

function CardSection({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <div style={{ padding: "10px 14px", ...style }}>{children}</div>
    );
}

const NULL_PRESET: Preset = {
    id: "none", label: "", k: 1, m: 0, formula: "", description: "",
    genCandidates: () => [], testWitness: () => true, getWitnesses: () => [],
};

const randomPoints = (): Point[] => Array.from({ length: 6 }, () => ({
    x: DEFAULT_COORDS.xMin + 1 + Math.random() * (DEFAULT_COORDS.xMax - 2 - DEFAULT_COORDS.xMin),
    y: DEFAULT_COORDS.yMin + 1 + Math.random() * (DEFAULT_COORDS.yMax - 2 - DEFAULT_COORDS.yMin),
}));

// APP

export default function App() {
    const [loadedPresets, setLoadedPresets] = useState<NamedPreset[]>([]);
    const [activePreset,  setActivePreset]  = useState<Preset | null>(null);
    const [points,        setPoints]        = useState<Point[]>([]);

    const canvasWrapRef = useRef<HTMLDivElement>(null);
    const logRef        = useRef<HTMLDivElement>(null);

    const engine = useAlgoEngine(activePreset ?? NULL_PRESET);

    const resetEngine = useCallback((msg?: string) => {
        engine.reset();
    }, [engine]);

    const handlePresetsLoaded = useCallback((presets: NamedPreset[]) => {
        setLoadedPresets(presets);
        setActivePreset(presets[0].preset);
        engine.reset();
        setPoints([]);
    }, [engine]);

    const handleDropdownChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const named = loadedPresets.find(p => p.preset.id === e.target.value);
        if (!named) return;
        setActivePreset(named.preset);
        engine.reset();
        setPoints([]);
    }, [loadedPresets, engine]);

    const handleAddPoint = useCallback((p: Point) => {
        setPoints(prev => [...prev, p]);
        engine.reset();
    }, [engine]);

    const handleClear  = useCallback(() => { setPoints([]);        engine.reset(); }, [engine]);
    const handleRandom = useCallback(() => { setPoints(randomPoints()); engine.reset(); }, [engine]);

    const step   = useCallback(() => { engine.step(points);   }, [engine, points]);
    const stepCandidate = useCallback(() => { engine.stepCandidate(points); }, [engine, points]);
    const runAll = useCallback(() => { engine.runAll(points); }, [engine, points]);

    useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [engine.log]);

    const passed   = engine.candidates.filter(c => c.status === "passed").length;
    const failed   = engine.candidates.filter(c => c.status === "failed").length;
    const noPreset = activePreset === null;

    return (
        <div style={{
            fontFamily: T.sans, background: T.cream,
            minHeight: "100vh", color: T.ink,
        }}>

            {/* ── Top bar ── */}
            <div style={{
                background: T.creamDark,
                padding: "0 24px",
                display: "flex", alignItems: "center",
                height: 48, gap: 20,
            }}>
                <span style={{
                    fontFamily: T.mono, fontSize: 11,
                    color: `${T.navyBorder}ee`,
                    borderLeft: `1px solid ${T.navyBorder}`,
                    paddingLeft: 20,
                }}>
                    Universal predicate filtering — visualiser
                </span>
                <div style={{ flex: 1 }} />
            </div>

            {/* ── Body ── */}
            <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 20px 40px" }}>

                {/* Row 1: loader + params */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginBottom: 10 }}>

                    {/* Loader */}
                    <PresetLoader onPresetsLoaded={handlePresetsLoaded} />

                    {/* Problem selector */}
                    <Card style={{ minWidth: 220 }}>
                        <CardSection>
                            <Label>problem</Label>
                            {loadedPresets.length === 0 ? (
                                <Mono size={11} color={T.inkLight}>no file loaded</Mono>
                            ) : (
                                <select
                                    value={activePreset?.id ?? ""}
                                    onChange={handleDropdownChange}
                                    style={{
                                        width: "100%", fontFamily: T.mono, fontSize: 11,
                                        background: "#fff", color: T.ink,
                                        border: `1px solid ${T.creamBorder}`,
                                        borderRadius: 3, padding: "4px 6px",
                                        outline: "none",
                                    }}
                                >
                                    {loadedPresets.map(np => (
                                        <option key={np.preset.id} value={np.preset.id}>{np.name}</option>
                                    ))}
                                </select>
                            )}
                        </CardSection>
                        {!noPreset && (
                            <CardSection style={{
                                borderTop: `1px solid ${T.creamBorder}`,
                                display: "flex", gap: 6, alignItems: "center",
                            }}>
                                <Pill scheme="blue">k={activePreset.k}</Pill>
                                <Pill scheme="green">m={activePreset.m}</Pill>
                            </CardSection>
                        )}
                    </Card>
                </div>

                {/* Row 2: canvas */}
                <Card style={{ marginBottom: 10, overflow: "hidden" }}>

                    {/* Canvas header bar */}
                    <div style={{
                        borderBottom: `1px solid ${T.creamBorder}`,
                        padding: "6px 14px",
                        display: "flex", alignItems: "center", gap: 8,
                        background: T.cream,
                    }}>
                        <Mono size={10} color={T.inkLight}>canvas</Mono>
                        <div style={{ flex: 1 }} />
                        {/* Legend inline */}
                        {[
                            { color: "#185FA5", label: "candidate t" },
                            { color: "#BA7517", label: "witness u", dashed: true },
                            { color: "#16a34a", label: "solution",  line: true  },
                            { color: "#888780", label: "point" },
                        ].map(({ color, label, dashed, line }) => (
                            <div key={label} style={{
                                display: "flex", alignItems: "center", gap: 4,
                                fontSize: 10, fontFamily: T.mono, color: T.inkLight,
                            }}>
                                {line
                                    ? <div style={{ width: 14, height: 2, background: color }} />
                                    : <div style={{
                                        width: 8, height: 8, borderRadius: "50%",
                                        background: color,
                                        border: dashed ? `1px dashed #854F0B` : undefined,
                                    }} />}
                                {label}
                            </div>
                        ))}
                    </div>

                    <div ref={canvasWrapRef} style={{ background: "#fff" }}>
                        <Canvas
                            points={points}
                            candidates={engine.candidates}
                            candidateIdx={engine.candidateIdx}
                            witnessIdx={engine.witnessIdx}
                            preset={noPreset ? NULL_PRESET : activePreset}
                            algoState={engine.algoState}
                            coords={DEFAULT_COORDS}
                            onAddPoint={noPreset ? () => {} : handleAddPoint}
                        />
                    </div>
                </Card>

                {/* Row 3: controls + stats */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginBottom: 10 }}>

                    {/* Controls */}
                    <Card>
                        <CardSection style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <Btn variant="primary" onClick={step}   disabled={noPreset}>Step</Btn>
                            <Btn variant="primary" onClick={stepCandidate}   disabled={noPreset}>Step candidate</Btn>
                            <Btn variant="outline" onClick={runAll} disabled={noPreset}>Run all</Btn>

                            <Btn variant="outline" onClick={handleRandom} disabled={noPreset}>Random points</Btn>
                            <Btn variant="outline"   onClick={handleClear}  disabled={noPreset}>Clear</Btn>

                            <Btn variant="outline"   onClick={() => resetEngine()} disabled={noPreset}>Reset</Btn>
                        </CardSection>
                    </Card>

                    {/* Stats */}
                    <Card>
                        <div style={{ display: "flex", height: "100%" }}>
                            {[
                                { v: points.length,            l: "|D|"      },
                                { v: engine.candidates.length, l: "cands"    },
                                { v: passed,                   l: "passed"   },
                                { v: failed,                   l: "elim"     },
                            ].map(({ v, l }, i) => (
                                <div key={l} style={{
                                    padding: "8px 16px",
                                    borderLeft: i > 0 ? `1px solid ${T.creamBorder}` : undefined,
                                    minWidth: 56, textAlign: "center",
                                }}>
                                    <div style={{
                                        fontFamily: T.mono, fontSize: 20,
                                        fontWeight: 500, color: T.ink,
                                        lineHeight: 1.2,
                                    }}>{v}</div>
                                    <div style={{
                                        fontFamily: T.mono, fontSize: 9,
                                        color: T.inkLight, marginTop: 2,
                                        textTransform: "uppercase", letterSpacing: "0.08em",
                                    }}>{l}</div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Row 4: formula + log */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>

                    {/* Formula */}
                    {!noPreset && (
                        <Card>
                            <CardSection style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                                <div style={{
                                    fontFamily: T.mono, fontSize: 11, color: T.inkMid,
                                    flex: 1, overflow: "hidden",
                                    textOverflow: "ellipsis", whiteSpace: "nowrap",
                                }}>
                                    {activePreset.formula}
                                </div>
                            </CardSection>
                        </Card>
                    )}

                    {/* Log */}
                    <Card>
                        <div style={{
                            borderBottom: `1px solid ${T.creamBorder}`,
                            padding: "5px 14px",
                            background: T.cream,
                        }}>
                            <Mono size={9} color={T.inkLight}>execution log</Mono>
                        </div>
                        <div
                            ref={logRef}
                            style={{
                                padding: "8px 14px",
                                maxHeight: 120, overflowY: "auto",
                                background: "#fff",
                            }}
                        >
                            {engine.log.map((e, i) => (
                                <div key={i} style={{
                                    fontFamily: T.mono, fontSize: 11,
                                    lineHeight: 1.9,
                                    color: e.kind === "ok"  ?  T.green
                                        : e.kind === "fail" ?  T.red
                                            :                  T.inkLight,
                                }}>
                                    {e.message}
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}