import type { IncomingMessage, ServerResponse } from 'node:http';
import { readBody, MAX_BODY } from './body.ts';
import {sendJson} from "./app.ts";

export function parseUser(input: unknown): { name: string; age: number } | Error {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        return new Error('Root value must be a JSON object');
    }
    const { name, age } = input as Record<string, unknown>;

    if (typeof name !== 'string' || name.trim() === '') {
        return new Error('"name" must be a non-empty string');
    }
    if (typeof age !== 'number' || !Number.isFinite(age) || age < 0) {
        return new Error('"age" must be a non-negative number');
    }
    return { name: name.trim(), age };
}

export async function handleUsers(
    req: IncomingMessage,
    res: ServerResponse,
): Promise<{ name: string; age: number } | null> {
    if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method Not Allowed' }, { Allow: 'POST' });
        return null;
    }

    const cl = req.headers['content-length'];
    if (cl !== undefined && Number(cl) > MAX_BODY) {
        sendJson(res, 413, { error: 'Payload Too Large' }, { Connection: 'close' });
        return null;
    }

    const ct = String(req.headers['content-type'] ?? '').toLowerCase();
    if (!ct.startsWith('application/json')) {
        sendJson(res, 415, { error: 'Unsupported Media Type: expected application/json' });
        return null;
    }

    const body = await readBody(req, MAX_BODY);
    if (!body.ok) {
        sendJson(res, body.status, { error: body.error });
        return null;
    }

    if (body.text.trim() === '') {
        sendJson(res, 400, { error: 'Request body is empty' });
        return null;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(body.text);
    } catch {
        sendJson(res, 400, { error: 'Invalid JSON' });
        return null;
    }

    const data = parseUser(parsed);
    if (data instanceof Error) {
        sendJson(res, 400, { error: data.message });
        return null;
    }

    return data;
}