import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import type { Server } from 'node:http';
import { createNewServer } from '../app.ts';
import type { JsonBody } from '../types.ts';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
    server = createNewServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

    const addr = server.address();
    if (!addr || typeof addr === 'string') {
        throw new Error('failed to get server address');
    }
    baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function get(path: string): Promise<{
    status: number;
    headers: Headers;
    body: JsonBody;
}> {
    const res = await fetch(`${baseUrl}${path}`);
    return {
        status: res.status,
        headers: res.headers,
        body: (await res.json()) as JsonBody,
    };
}

describe('GET /search — success', () => {
    test('200 and { q } for a valid q', async () => {
        const res = await get('/search?q=node');
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toMatch(/^application\/json/);
        expect(res.body).toEqual({ q: 'node' });
    });
});

describe('GET /search — q validation', () => {
    test('400 when q is missing', async () => {
        const res = await get('/search');
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    test('400 when q is empty (?q=)', async () => {
        const res = await get('/search?q=');
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    test('400 when q is whitespace-only (?q=%20%20)', async () => {
        const res = await get('/search?q=%20%20');
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });
});

describe('Path', () => {
    test('404 for an unknown path', async () => {
        const res = await get('/foo');
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Not Found' });
    });
});

describe('Method', () => {
    test('405 for POST /search with Allow: GET', async () => {
        const res = await fetch(`${baseUrl}/search?q=node`, { method: 'POST' });
        expect(res.status).toBe(405);
        expect(res.headers.get('allow')).toBe('GET');
        expect(await res.json()).toEqual({ error: 'Method Not Allowed' });
    });
});