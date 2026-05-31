import { useEffect, useRef } from "react";
import type { LogEntry } from "../preset/types";

interface LogPanelProps {
    entries: LogEntry[];
}

const KIND_COLOR: Record<LogEntry["kind"], string> = {
    ok:   "#1D9E75",
    fail: "#D85A30",
    info: "var(--text-secondary, #6b6a65)",
};

export function LogPanel({ entries }: LogPanelProps) {
    const ref = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new entries
    useEffect(() => {
        if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    }, [entries]);

    return (
        <div
            ref={ref}
            style={{
                background: "var(--bg-secondary, #f5f4f0)",
                border: "0.5px solid var(--border, rgba(0,0,0,0.12))",
                borderRadius: 8,
                padding: "10px 14px",
                maxHeight: 110,
                overflowY: "auto",
            }}
        >
            {entries.map((e, i) => (
                <span
                    key={i}
                    style={{
                        display: "block",
                        fontSize: 11,
                        fontFamily: "monospace",
                        lineHeight: 1.9,
                        color: KIND_COLOR[e.kind],
                    }}
                >
          {e.message}
        </span>
            ))}
        </div>
    );
}
