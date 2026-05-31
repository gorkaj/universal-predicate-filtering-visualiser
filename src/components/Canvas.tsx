import { useRef, useEffect, useCallback } from "react";
import type { Point, Candidate, WitnessGroup, Preset } from "../preset/types";

// ---- Coordinate system --------------------------------------------------

export interface CoordSystem {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
}

export const DEFAULT_COORDS: CoordSystem = {
    xMin: -15,
    xMax:  15,
    yMin: -10,
    yMax:  10,
};

function toPixel(p: Point, cs: CoordSystem, cssW: number, cssH: number): Point {
    return {
        x: ((p.x - cs.xMin) / (cs.xMax - cs.xMin)) * cssW,
        y: ((cs.yMax - p.y) / (cs.yMax - cs.yMin)) * cssH,
    };
}

export function toWorld(px: number, py: number, cs: CoordSystem, cssW: number, cssH: number): Point {
    return {
        x: cs.xMin + (px / cssW) * (cs.xMax - cs.xMin),
        y: cs.yMax - (py / cssH) * (cs.yMax - cs.yMin),
    };
}

// ---- Canvas ---------------------------------------------------------------------

interface CanvasProps {
    points: Point[];           // stored in WORLD coords
    candidates: Candidate[];
    candidateIdx: number;
    witnessIdx: number;
    preset: Preset;
    algoState: "idle" | "running" | "done";
    coords?: CoordSystem;
    onAddPoint: (p: Point) => void;   // emits WORLD coords
}

const COLORS = {
    candidatePt:       "#185FA5",
    candidatePtStroke: "#0C447C",
    witnessPt:         "#BA7517",
    witnessPtStroke:   "#854F0B",
    neutralPt:         "#888780",
    neutralPtStroke:   "#5F5E5A",
    passedPt:          "#1D9E75",
    passedPtStroke:    "#0F6B4F",
    passedEdge:        "#1D9E75",
    activeEdge:        "#185FA5",
    pendingEdge:       "#888780",
    witnessRing:       "#BA7517",
    label:             "#5F5E5A",
    axis:              "rgba(0,0,0,0.15)",
    axisLabel:         "#9b9990",
    grid:              "rgba(0,0,0,0.05)",
};

function drawGrid(
    ctx: CanvasRenderingContext2D,
    cs: CoordSystem,
    cssW: number,
    cssH: number,
) {
    const px = (p: Point) => toPixel(p, cs, cssW, cssH);

    // Grid lines at integer world coords
    ctx.save();
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth   = 1;
    ctx.font        = "9px monospace";
    ctx.fillStyle   = COLORS.axisLabel;

    for (let x = Math.ceil(cs.xMin); x <= Math.floor(cs.xMax); x++) {
        const { x: px_ } = px({ x, y: 0 });
        ctx.beginPath();
        ctx.moveTo(px_, 0);
        ctx.lineTo(px_, cssH);
        ctx.stroke();
        if (x !== 0) {
            ctx.fillText(String(x), px_ + 2, cssH - 3);
        }
    }

    for (let y = Math.ceil(cs.yMin); y <= Math.floor(cs.yMax); y++) {
        const { y: py_ } = px({ x: 0, y });
        ctx.beginPath();
        ctx.moveTo(0,    py_);
        ctx.lineTo(cssW, py_);
        ctx.stroke();
        if (y !== 0) {
            ctx.fillText(String(y), 3, py_ - 2);
        }
    }
    ctx.restore();

    // Axes
    ctx.save();
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth   = 1;

    const origin = px({ x: 0, y: 0 });

    // x-axis (only if y=0 is in range)
    if (cs.yMin <= 0 && cs.yMax >= 0) {
        ctx.beginPath();
        ctx.moveTo(0,    origin.y);
        ctx.lineTo(cssW, origin.y);
        ctx.stroke();
    }
    // y-axis (only if x=0 is in range)
    if (cs.xMin <= 0 && cs.xMax >= 0) {
        ctx.beginPath();
        ctx.moveTo(origin.x, 0);
        ctx.lineTo(origin.x, cssH);
        ctx.stroke();
    }
    ctx.restore();
}

export function Canvas({
                           points,
                           candidates,
                           candidateIdx,
                           witnessIdx,
                           preset,
                           algoState,
                           coords = DEFAULT_COORDS,
                           onAddPoint,
                       }: CanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr  = window.devicePixelRatio || 1;
        const cssW = canvas.offsetWidth;
        const cssH = canvas.offsetHeight;

        if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
            canvas.width  = cssW * dpr;
            canvas.height = cssH * dpr;
            ctx.scale(dpr, dpr);
        }

        ctx.clearRect(0, 0, cssW, cssH);

        drawGrid(ctx, coords, cssW, cssH);

        // Helper: world → pixel for this frame
        const px = (p: Point) => toPixel(p, coords, cssW, cssH);

        const currentCand: Candidate | undefined =
            algoState === "running" ? candidates[candidateIdx] : undefined;

        const currentWitnesses: WitnessGroup[] =
            currentCand && preset.m > 0
                ? preset.getWitnesses(points, currentCand.t)
                : [];
        const currentW: WitnessGroup | undefined = currentWitnesses[witnessIdx];

        // ---- Edges (k >= 2) ----
        if (preset.k >= 2) {
            candidates.forEach((c, ci) => {
                if (c.status === "failed") return;

                const isCurrent = ci === candidateIdx && algoState === "running";
                const isPassed  = c.status === "passed";

                const pairs: [Point, Point][] = c.t.map((ptIdx, i) => [
                    px(points[ptIdx]),
                    px(points[c.t[(i + 1) % c.t.length]]),
                ] as [Point, Point]).filter((_, i) => preset.k >= 3 || i < c.t.length - 1);

                if (pairs.some(([a, b]) => !a || !b)) return;

                ctx.save();
                ctx.globalAlpha = isPassed ? 1 : isCurrent ? 0.9 : 0.14;
                ctx.strokeStyle = isPassed  ? COLORS.passedEdge
                    : isCurrent             ? COLORS.activeEdge
                        :                         COLORS.pendingEdge;
                ctx.lineWidth = isPassed ? 2.5 : isCurrent ? 1.8 : 0.7;

                for (const [a, b] of pairs) {
                    ctx.beginPath();
                    const dx  = b.x - a.x;
                    const dy  = b.y - a.y;
                    const len = Math.hypot(dx, dy);
                    if (len < 1) continue;

                    const ux   = dx / len;
                    const uy   = dy / len;
                    const tipX = b.x - ux * 9;
                    const tipY = b.y - uy * 9;
                    const ang  = Math.atan2(dy, dx);
                    const as_  = 7;

                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(tipX, tipY);
                    ctx.moveTo(tipX, tipY);
                    ctx.lineTo(tipX - as_ * Math.cos(ang - 0.4), tipY - as_ * Math.sin(ang - 0.4));
                    ctx.moveTo(tipX, tipY);
                    ctx.lineTo(tipX - as_ * Math.cos(ang + 0.4), tipY - as_ * Math.sin(ang + 0.4));
                    ctx.stroke();
                }

                ctx.restore();
            });
        }

        // ---- Witness ring ----
        if (currentW) {
            currentW.forEach((wi) => {
                const wp = px(points[wi]);
                if (!wp) return;
                ctx.save();
                ctx.beginPath();
                ctx.arc(wp.x, wp.y, 15, 0, Math.PI * 2);
                ctx.strokeStyle = COLORS.witnessRing;
                ctx.lineWidth   = 1.5;
                ctx.setLineDash([3, 2]);
                ctx.stroke();
                ctx.restore();
            });
        }

        // ---- Points ----
        points.forEach((worldPt, i) => {
            const pt = px(worldPt);

            const isCandPt   = !!currentCand && currentCand.t.includes(i) && algoState === "running";
            const isWitPt    = currentW ? currentW.includes(i) : false;
            const isPassedPt = preset.k === 1 &&
                candidates.some(c => c.t[0] === i && c.status === "passed");

            const r      = isCandPt ? 7 : (isWitPt || isPassedPt) ? 6 : 5;
            const fill   = isCandPt  ? COLORS.candidatePt
                : isWitPt            ? COLORS.witnessPt
                    : isPassedPt         ? COLORS.passedPt
                        :                      COLORS.neutralPt;
            const stroke = isCandPt  ? COLORS.candidatePtStroke
                : isWitPt            ? COLORS.witnessPtStroke
                    : isPassedPt         ? COLORS.passedPtStroke
                        :                      COLORS.neutralPtStroke;

            ctx.beginPath();
            ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
            ctx.fillStyle   = fill;
            ctx.strokeStyle = stroke;
            ctx.lineWidth   = 1.2;
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = isCandPt ? COLORS.candidatePtStroke
                : isWitPt            ? COLORS.witnessPtStroke
                    :                      COLORS.label;
            ctx.font = "11px monospace";
            // Show world coordinates in the label
            ctx.fillText(
                `p${i}`,
                pt.x + 9,
                pt.y - 5,
            );
        });
    }, [points, candidates, candidateIdx, witnessIdx, preset, algoState, coords]);

    useEffect(() => { draw(); }, [draw]);

    useEffect(() => {
        const observer = new ResizeObserver(() => draw());
        if (canvasRef.current) observer.observe(canvasRef.current);
        return () => observer.disconnect();
    }, [draw]);

    const handleClick = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect   = canvas.getBoundingClientRect();
            const pixelX = e.clientX - rect.left;
            const pixelY = e.clientY - rect.top;
            // Convert click from pixel to world coords before emitting
            onAddPoint(toWorld(pixelX, pixelY, coords, rect.width, rect.height));
        },
        [onAddPoint, coords],
    );

    return (
        <canvas
            ref={canvasRef}
            onClick={handleClick}
            style={{ display: "block", width: "100%", height: 340, cursor: "crosshair" }}
        />
    );
}