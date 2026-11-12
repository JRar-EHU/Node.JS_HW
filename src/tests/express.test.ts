import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import type { Server } from 'node:http';
import { createExpressApp } from '../expressApp.ts';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
    server = createExpressApp().listen(0, '127.0.0.1');
    await new Promise<void>((r) => server.once('listening', () => r()));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('bad address');
    baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
});

const AUTH = { Authorization: 'Bearer secret-token' };
const JSON_HEADER = { 'Content-Type': 'application/json' };

describe('GET /public/info', () => {
    test('200 without auth', async () => {
        const res = await fetch(`${baseUrl}/public/info`);
        expect(res.status).toBe(200);
        expect(await res.json()).toHaveProperty('info');
    });
});

describe('GET /api/data', () => {
    test('200 with valid token', async () => {
        const res = await fetch(`${baseUrl}/api/data`, { headers: AUTH });
        expect(res.status).toBe(200);
        expect(await res.json()).toHaveProperty('data');
    });

    test('401 without token', async () => {
        const res = await fetch(`${baseUrl}/api/data`);
        expect(res.status).toBe(401);
    });

    test('401 with wrong token', async () => {
        const res = await fetch(`${baseUrl}/api/data`, {
            headers: { Authorization: 'Bearer wrong' },
        });
        expect(res.status).toBe(401);
    });
});

describe('POST /api/users', () => {
    const valid = { name: 'Anna', age: 25, email: 'anna@example.com' };

    test('201 with valid body + token', async () => {
        const res = await fetch(`${baseUrl}/api/users`, {
            method: 'POST',
            headers: { ...AUTH, ...JSON_HEADER },
            body: JSON.stringify(valid),
        });
        expect(res.status).toBe(201);
        expect(await res.json()).toEqual({ id: 1, ...valid });
    });

    test('401 without token (validation skipped)', async () => {
        const res = await fetch(`${baseUrl}/api/users`, {
            method: 'POST',
            headers: JSON_HEADER,
            body: JSON.stringify(valid),
        });
        expect(res.status).toBe(401);
    });

    test.each([
        ['name missing', { age: 25, email: 'a@b.co' }],
        ['name too short', { name: 'A', age: 25, email: 'a@b.co' }],
        ['age out of range', { name: 'Anna', age: 121, email: 'a@b.co' }],
        ['age not number', { name: 'Anna', age: '25', email: 'a@b.co' }],
        ['email invalid', { name: 'Anna', age: 25, email: 'not-an-email' }],
    ])('400 for %s', async (_label, body) => {
        const res = await fetch(`${baseUrl}/api/users`, {
            method: 'POST',
            headers: { ...AUTH, ...JSON_HEADER },
            body: JSON.stringify(body),
        });
        expect(res.status).toBe(400);
        expect(await res.json()).toHaveProperty('error');
    });

    test('400 for malformed JSON (from express.json)', async () => {
        const res = await fetch(`${baseUrl}/api/users`, {
            method: 'POST',
            headers: { ...AUTH, ...JSON_HEADER },
            body: '{ not json',
        });
        expect(res.status).toBe(400);
    });
});