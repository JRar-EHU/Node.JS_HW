import { describe, test, expect } from '@jest/globals';
import { parseUser } from '../users.ts';

describe('parseUser — success', () => {
    test('valid input', () => {
        expect(parseUser({ name: 'Anna', age: 25 })).toEqual({ name: 'Anna', age: 25 });
    });

    test('trims name', () => {
        expect(parseUser({ name: '  Anna  ', age: 25 })).toEqual({ name: 'Anna', age: 25 });
    });

    test('ignores extra fields', () => {
        expect(parseUser({ name: 'Anna', age: 25, role: 'admin', x: 1 }))
            .toEqual({ name: 'Anna', age: 25 });
    });

    test('age = 0 is valid', () => {
        expect(parseUser({ name: 'Baby', age: 0 })).toEqual({ name: 'Baby', age: 0 });
    });
});

describe('parseUser — non-object root', () => {
    test.each([
        ['null', null],
        ['array', []],
        ['string', 'Anna'],
        ['number', 42],
        ['boolean', true],
    ])('%s', (_label, input) => {
        const r = parseUser(input);
        expect(r).toBeInstanceOf(Error);
        expect((r as Error).message).toMatch(/JSON object/);
    });
});

describe('parseUser — invalid name', () => {
    test.each([
        ['missing', {}],
        ['non-string', { name: 123, age: 25 }],
        ['empty', { name: '', age: 25 }],
        ['whitespace-only', { name: '   ', age: 25 }],
        ['null', { name: null, age: 25 }],
    ])('%s', (_label, input) => {
        const r = parseUser(input);
        expect(r).toBeInstanceOf(Error);
        expect((r as Error).message).toMatch(/"name"/);
    });
});

describe('parseUser — invalid age', () => {
    test.each([
        ['missing', { name: 'A' }],
        ['non-number', { name: 'A', age: '25' }],
        ['negative', { name: 'A', age: -1 }],
        ['NaN', { name: 'A', age: NaN }],
        ['Infinity', { name: 'A', age: Infinity }],
    ])('%s', (_label, input) => {
        const r = parseUser(input);
        expect(r).toBeInstanceOf(Error);
        expect((r as Error).message).toMatch(/"age"/);
    });
});