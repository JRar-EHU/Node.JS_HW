export type JsonBody = { q: string } | { error: string };

export type BodyResult =
    | { ok: true; text: string }
    | { ok: false; status: 400 | 413; error: string };