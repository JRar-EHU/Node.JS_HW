export type JsonBody = { q: string } | { error: string };
export type AsyncFunc<T> = (...args: [...any[], (err: Error | null, result?: T) => void]) => void;

export interface IRow {
    Movie: string;
    Director: string;
    Year: string;
    Duration: string;
    Rating: string;
}

export interface IStats {
    processed: number;
    exported: number;
    skipped: { invalid: number; filtered: number };
    byDecade: Record<string, number>;
}