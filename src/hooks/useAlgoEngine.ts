import { useState, useCallback } from "react";
import type { Preset, Point, Candidate, LogEntry, AlgoState, WitnessGroup } from "../preset/types";

interface AlgoEngineState {
    candidates: Candidate[];
    candidateIdx: number;
    witnessIdx: number;
    algoState: AlgoState;
    log: LogEntry[];
}

interface AlgoEngine extends AlgoEngineState {
    currentCandidate: Candidate | undefined;
    currentWitness: WitnessGroup | undefined;
    init: (points: Point[]) => void;
    step: (points: Point[]) => void;
    stepCandidate: (points: Point[]) => void;
    runAll: (points: Point[]) => void;
    reset: () => void;
}

const EMPTY_STATE: AlgoEngineState = {
    candidates: [],
    candidateIdx: 0,
    witnessIdx: 0,
    algoState: "idle",
    log: [{ message: "add points to the canvas, then press step or run all", kind: "info" }],
};

function appendLog(log: LogEntry[], message: string, kind: LogEntry["kind"]): LogEntry[] {
    const next = [...log, { message, kind }];
    return next.length > 80 ? next.slice(next.length - 80) : next;
}

export function useAlgoEngine(preset: Preset): AlgoEngine {
    const [state, setState] = useState<AlgoEngineState>(EMPTY_STATE);

    // ----------------------------------------------------------------
    // Init
    // ----------------------------------------------------------------
    const init = useCallback(
        (points: Point[]) => {
            if (points.length < 2) {
                setState((s) => ({
                    ...s,
                    log: appendLog(s.log, "need at least 2 points to start", "fail"),
                }));
                return;
            }
            const candidates = preset.genCandidates(points);
            setState({
                candidates,
                candidateIdx: 0,
                witnessIdx: 0,
                algoState: "running",
                log: [{ message: `generated ${candidates.length} candidate(s)`, kind: "info" }],
            });
        },
        [preset]
    );

    // ----------------------------------------------------------------
    // Single atomic step (pure function so runAll can call it in a loop)
    // ----------------------------------------------------------------
    function advanceState(
        s: AlgoEngineState,
        points: Point[],
        preset: Preset,
        canvasW: number,
        canvasH: number
    ): AlgoEngineState {
        if (s.algoState !== "running") return s;

        let { candidates, candidateIdx, witnessIdx, log } = s;

        // Clone candidates array so React detects the change
        candidates = candidates.map((c) => ({ ...c }));

        // Skip already-failed candidates
        while (candidateIdx < candidates.length && candidates[candidateIdx].status === "failed") {
            candidateIdx++;
            witnessIdx = 0;
        }
        
        if (candidateIdx >= candidates.length) {
            const passed = candidates.filter((c) => c.status === "passed").length;
            log = appendLog(log, `Algorithm completed - ${passed} solution component(s) in Sol(D)`, "ok");
            return { candidates, candidateIdx, witnessIdx, algoState: "done", log };
        }

        const cand = candidates[candidateIdx];

        // ---- m = 0: test candidate against itself ----
        if (preset.m === 0) {
            const ok = preset.testSelf
                ? preset.testSelf(points, cand.t, canvasW, canvasH)
                : true;
            candidates[candidateIdx] = { ...cand, status: ok ? "passed" : "failed" };
            const label = cand.t.map((i) => `p${i}`).join(",");
            log = appendLog(
                log,
                ok ? `t=(${label}) accepted ` : `t=(${label}) eliminated`,
                ok ? "ok" : "fail"
            );
            return { candidates, candidateIdx: candidateIdx + 1, witnessIdx: 0, algoState: "running", log };
        }

        // ---- m > 0: test one witness at a time ----
        const witnesses: WitnessGroup[] = preset.getWitnesses(points, cand.t);

        if (witnessIdx >= witnesses.length) {
            // All witnesses passed = a candidate survives
            candidates[candidateIdx] = { ...cand, status: "passed" };
            const label = cand.t.map((i) => `p${i}`).join(",");
            log = appendLog(log, `t=(${label}) - passed all ${witnesses.length} witness(es)`, "ok");
            return { candidates, candidateIdx: candidateIdx + 1, witnessIdx: 0, algoState: "running", log };
        }

        const w = witnesses[witnessIdx];
        const ok = preset.testWitness(points, cand.t, w);
        const tLabel = cand.t.map((i) => `p${i}`).join(",");
        const wLabel = w.map((i) => `p${i}`).join(",");

        if (!ok) {
            candidates[candidateIdx] = { ...cand, status: "failed" };
            log = appendLog(log, `t=(${tLabel}) vs u=(${wLabel}) - P fails`, "fail");
            return { candidates, candidateIdx: candidateIdx + 1, witnessIdx: 0, algoState: "running", log };
        }

        log = appendLog(log, `t=(${tLabel}) vs u=(${wLabel}) - P holds`, "info");
        return { candidates, candidateIdx, witnessIdx: witnessIdx + 1, algoState: "running", log };
    }

    // ----------------------------------------------------------------
    // Public step (triggers one React re-render)
    // ----------------------------------------------------------------
    const step = useCallback(
        (points: Point[]) => {
            setState((s) => {
                if (s.algoState === "idle") {
                    if (points.length < 2) {
                        return { ...s, log: appendLog(s.log, "Need at least 2 points to start", "fail") };
                    }
                    const candidates = preset.genCandidates(points);
                    return {
                        candidates,
                        candidateIdx: 0,
                        witnessIdx: 0,
                        algoState: "running",
                        log: [{ message: `Generated ${candidates.length} candidate(s)`, kind: "info" }],
                    };
                }
                if (s.algoState === "done") {
                    return { ...s, log: appendLog(s.log, "Algorithm completed - press reset to restart", "info") };
                }
                return advanceState(s, points, preset, window.innerWidth, 340);
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [preset]
    );


    const stepCandidate = useCallback(
        (points: Point[]) => {
            setState((s) => {
                if (s.algoState === "idle") {
                    if (points.length < 2) {
                        return { ...s, log: appendLog(s.log, "Need at least 2 points to start", "fail") };
                    }
                    const candidates = preset.genCandidates(points);
                    return {
                        candidates,
                        candidateIdx: 0,
                        witnessIdx: 0,
                        algoState: "running",
                        log: [{ message: `Generated ${candidates.length} candidate(s)`, kind: "info" }],
                    };
                }
                if (s.algoState === "done") {
                    return { ...s, log: appendLog(s.log, "Algorithm completed - press reset to restart", "info") };
                }
                // Advance until candidateIdx changes or algorithm finishes
                const startIdx = s.candidateIdx;
                let current = s;
                let guard = 0;
                while (
                    current.algoState === "running" &&
                    current.candidateIdx === startIdx &&
                    guard++ < 100_000
                    ) {
                    current = advanceState(current, points, preset, window.innerWidth, 340);
                }
                return current;
            });
        },
        [preset]
    );

    // ----------------------------------------------------------------
    // Run all (loop inside a single setState to avoid flicker)
    // ----------------------------------------------------------------
    const runAll = useCallback(
        (points: Point[]) => {
            setState((s) => {
                let current = s;

                if (current.algoState === "idle") {
                    if (points.length < 2) {
                        return { ...s, log: appendLog(s.log, "Need at least 2 points to start", "fail") };
                    }
                    const candidates = preset.genCandidates(points);
                    current = {
                        candidates,
                        candidateIdx: 0,
                        witnessIdx: 0,
                        algoState: "running",
                        log: [{ message: `Generated ${candidates.length} candidate(s)`, kind: "info" }],
                    };
                }

                let guard = 0;
                while (current.algoState === "running" && guard++ < 100_000) {
                    current = advanceState(current, points, preset, window.innerWidth, 340);
                }
                return current;
            });
        },
        [preset]
    );

    // ----------------------------------------------------------------
    // Reset
    // ----------------------------------------------------------------
    const reset = useCallback(() => {
        setState({
            ...EMPTY_STATE,
            log: [{ message: "Algorithm reset", kind: "info" }],
        });
    }, []);

    // ----------------------------------------------------------------
    // Derived values exposed to components
    // ----------------------------------------------------------------
    const currentCandidate =
        state.algoState === "running" ? state.candidates[state.candidateIdx] : undefined;

    const currentWitness: WitnessGroup | undefined =
        currentCandidate && preset.m > 0
            ? preset.getWitnesses(
                // We don't have points here — resolved in Canvas component
                [] as Point[],
                currentCandidate.t
            )[state.witnessIdx]
            : undefined;

    return {
        ...state,
        currentCandidate,
        currentWitness,
        init,
        step,
        stepCandidate,
        runAll,
        reset,
    };
}