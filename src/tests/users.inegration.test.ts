import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import type { Server } from 'node:http';
import http from 'node:http';
import { createNewServer } from '../app.ts';

let server: Server;
let baseUrl: string;
let port: number;

beforeAll(async () => {
    server = createNewServer();
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('bad address');
    port = addr.port;
    baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
});

function postUsers(body: string, headers: Record<string, string> = {}) {
    return fetch(`${baseUrl}/users`, { method: 'POST', headers, body });
}

const JSON_HEADER = { 'Content-Type': 'application/json' };

describe('POST /users — 201 success', () => {
    test('creates user and returns id/name/age + Location', async () => {
        const res = await postUsers(JSON.stringify({ name: 'Anna', age: 25 }), JSON_HEADER);

        expect(res.status).toBe(201);
        expect(res.headers.get('location')).toMatch(/^\/users\/\d+$/);
        const body = await res.json() as any;
        expect(body).toEqual({ id: expect.any(Number), name: 'Anna', age: 25 });
    });

    test('ids are unique across requests', async () => {
        const a = await (await postUsers(JSON.stringify({ name: 'A', age: 1 }), JSON_HEADER)).json() as any;
        const b = await (await postUsers(JSON.stringify({ name: 'B', age: 2 }), JSON_HEADER)).json() as any;
        expect(a.id).not.toBe(b.id);
    });

    test('ignores extra fields', async () => {
        const res = await postUsers(
            JSON.stringify({ name: 'Bob', age: 30, role: 'admin', nested: { x: 1 } }),
            JSON_HEADER,
        );
        expect(res.status).toBe(201);
        const body = await res.json() as any;
        expect(Object.keys(body).sort()).toEqual(['age', 'id', 'name']);
    });

    test('accepts application/json; charset=utf-8', async () => {
        const res = await postUsers(
            JSON.stringify({ name: 'C', age: 1 }),
            { 'Content-Type': 'application/json; charset=utf-8' },
        );
        expect(res.status).toBe(201);
    });
});

describe('POST /users — 400 validation', () => {
    test('invalid JSON syntax', async () => {
        const res = await postUsers('{ not json', JSON_HEADER);
        expect(res.status).toBe(400);
        expect((await res.json() as any).error).toMatch(/Invalid JSON/);
    });

    test('empty body', async () => {
        const res = await postUsers('', JSON_HEADER);
        expect(res.status).toBe(400);
        expect((await res.json() as any).error).toMatch(/empty/i);
    });

    test.each([
        ['null', 'null'],
        ['array', '[]'],
        ['string', '"Anna"'],
        ['number', '42'],
    ])('non-object root: %s', async (_label, body) => {
        const res = await postUsers(body, JSON_HEADER);
        expect(res.status).toBe(400);
        expect((await res.json() as any).error).toMatch(/JSON object/);
    });

    test('missing name', async () => {
        const res = await postUsers(JSON.stringify({ age: 25 }), JSON_HEADER);
        expect(res.status).toBe(400);
        expect((await res.json() as any).error).toMatch(/"name"/);
    });

    test('non-string name', async () => {
        const res = await postUsers(JSON.stringify({ name: 123, age: 25 }), JSON_HEADER);
        expect(res.status).toBe(400);
    });

    test('negative age', async () => {
        const res = await postUsers(JSON.stringify({ name: 'A', age: -1 }), JSON_HEADER);
        expect(res.status).toBe(400);
        expect((await res.json() as any).error).toMatch(/"age"/);
    });
});

describe('POST /users — 415 Content-Type', () => {
    test('missing Content-Type', async () => {
        const res = await fetch(`${baseUrl}/users`, {
            method: 'POST',
            body: JSON.stringify({ name: 'A', age: 1 }),
        });
        expect(res.status).toBe(415);
    });

    test('text/plain', async () => {
        const res = await postUsers(JSON.stringify({ name: 'A', age: 1 }), { 'Content-Type': 'text/plain' });
        expect(res.status).toBe(415);
    });

    test('multipart/form-data', async () => {
        const res = await postUsers('x', { 'Content-Type': 'multipart/form-data' });
        expect(res.status).toBe(415);
    });
});

describe('POST /users — 413 Payload Too Large', () => {
    test('Content-Length > 1 MiB → 413 without reading body', async () => {
        const status = await new Promise<number>((resolve) => {
            const req = http.request(
                {
                    hostname: '127.0.0.1',
                    port,
                    path: '/users',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': String(5 * 1024 * 1024),
                    },
                },
                (res) => {
                    res.resume();
                    res.on('end', () => resolve(res.statusCode!));
                    res.on('close', () => resolve(res.statusCode!));
                },
            );
            req.on('error', () => {});
            req.end();
        });
        expect(status).toBe(413);
    }, 3000);
});

describe('Routing', () => {
    test('405 for GET /users with Allow: POST', async () => {
        const res = await fetch(`${baseUrl}/users`);
        expect(res.status).toBe(405);
        expect(res.headers.get('allow')).toBe('POST');
    });

    test('405 for DELETE /users', async () => {
        const res = await fetch(`${baseUrl}/users`, { method: 'DELETE' });
        expect(res.status).toBe(405);
        expect(res.headers.get('allow')).toBe('POST');
    });

    test('404 for unknown path', async () => {
        const res = await fetch(`${baseUrl}/unknown`);
        expect(res.status).toBe(404);
    });

    test('GET /search still works', async () => {
        const res = await fetch(`${baseUrl}/search?q=node`);
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ q: 'node' });
    });

    test('405 for POST /search', async () => {
        const res = await fetch(`${baseUrl}/search?q=node`, { method: 'POST' });
        expect(res.status).toBe(405);
        expect(res.headers.get('allow')).toBe('GET');
    });
});