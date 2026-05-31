export interface Point {
    x: number;
    y: number;
}

export type CandidateStatus = "pending" | "passed" | "failed";

export interface Candidate {
    t: number[];
    status: CandidateStatus;
}

export type WitnessGroup = number[]; // length = m

export interface LogEntry {
    message: string;
    kind: "info" | "ok" | "fail";
}

export type AlgoState = "idle" | "running" | "done";

export interface Preset {
    id: string;
    label: string;
    k: number;
    m: number;
    formula: string;
    description: string;
    
    genCandidates(points: Point[]): Candidate[];
    testWitness(points: Point[], t: number[], w: WitnessGroup): boolean;
    getWitnesses(points: Point[], t: number[]): WitnessGroup[];
    testSelf?(points: Point[], t: number[], canvasW: number, canvasH: number): boolean;
}
