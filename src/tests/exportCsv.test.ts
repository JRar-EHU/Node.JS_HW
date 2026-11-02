import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { exportCsvToTxt } from '../exportCsv.ts';

const ASSETS = path.resolve('src/assets');
const CSV = path.join(ASSETS, 'movies.csv');
const TXT = path.join(ASSETS, 'movies.txt');
const SUMMARY = path.join(ASSETS, 'summary.json');

const TEST_CSV = `Movie;Director;Year;Duration;Rating
Inception;Christopher Nolan;2010;148;8,8
The Matrix;Lana Wachowski;1999;136;8,7
Interstellar;Christopher Nolan;2014;169;8,7
Pulp Fiction;Quentin Tarantino;1994;154;8,9
The Godfather;Francis Ford Coppola;1972;175;9,2
Fight Club;David Fincher;1999;139;8,8
Parasite;Bong Joon-ho;2019;132;8,5
Spirited Away;Hayao Miyazaki;2001;125;8,6
Gladiator;Ridley Scott;2000;155;8,5
The Shawshank Redemption;Frank Darabont;1994;142;9,3
Mad Max: Fury Road;George Miller;2015;120;8,1
Whiplash;Damien Chazelle;2014;106;8,5
"Crouching Tiger; Hidden Dragon";Ang Lee;2000;120;7,9
Unknown Film;Some Director;2005;100;n/a
Tenet;Christopher Nolan;2020;150;7,3
`;

let csvBackup: Buffer | null = null;

beforeAll(() => {
    fs.mkdirSync(ASSETS, { recursive: true });
    if (fs.existsSync(CSV)) csvBackup = fs.readFileSync(CSV);
    fs.writeFileSync(CSV, TEST_CSV);
});

afterAll(() => {
    if (csvBackup) {
        fs.writeFileSync(CSV, csvBackup);
    } else {
        try { fs.unlinkSync(CSV); } catch {}
    }
    for (const f of [TXT, SUMMARY]) {
        try { fs.unlinkSync(f); } catch {}
    }
});

describe('exportCsvToTxt — default options', () => {
    test('returns expected stats', async () => {
        const stats = await exportCsvToTxt();

        expect(stats.processed).toBe(15);
        expect(stats.exported).toBe(8);
        expect(stats.skipped.invalid).toBe(1);
        expect(stats.skipped.filtered).toBe(6);
        expect(stats.byDecade).toEqual({
            '1990s': 2,
            '2000s': 2,
            '2010s': 4,
        });
    });

    test('writes movies.txt in JSON Lines format', async () => {
        await exportCsvToTxt();

        const content = fs.readFileSync(TXT, 'utf-8').trim();
        const lines = content.split('\n');

        expect(lines).toHaveLength(8);

        const first = JSON.parse(lines[0]);
        expect(Object.keys(first)).toEqual([
            'movie', 'director', 'year', 'rating', 'decade', 'length',
        ]);
        expect(typeof first.year).toBe('number');
        expect(typeof first.rating).toBe('number');
        expect(first).not.toHaveProperty('Duration');
        expect(first).not.toHaveProperty('duration');
    });

    test('writes summary.json matching the returned stats', async () => {
        const stats = await exportCsvToTxt();
        const summary = JSON.parse(fs.readFileSync(SUMMARY, 'utf-8'));

        expect(summary).toEqual(stats);
    });

    test('correctly handles quoted ; inside a field', async () => {
        await exportCsvToTxt();
        const lines = fs.readFileSync(TXT, 'utf-8').trim().split('\n');
        // Crouching Tiger имеет рейтинг 7.9 < 8.5 → не должен попасть
        // Но если парсер сломался бы на ; внутри кавычек, тут был бы мусор
        const titles = lines.map((l) => JSON.parse(l).movie);
        expect(titles).not.toContain('Crouching Tiger');
        expect(titles).not.toContain('Crouching Tiger; Hidden Dragon');
    });
});

describe('exportCsvToTxt — custom options', () => {
    test('minYear filters more films', async () => {
        const baseline = await exportCsvToTxt();
        const filtered = await exportCsvToTxt({ minYear: 2010 });

        expect(filtered.exported).toBeLessThan(baseline.exported);
        expect(filtered.skipped.filtered).toBeGreaterThan(baseline.skipped.filtered);
    });

    test('minRating filters more films', async () => {
        const baseline = await exportCsvToTxt();
        const filtered = await exportCsvToTxt({ minRating: 9.0 });

        expect(filtered.exported).toBeLessThan(baseline.exported);
    });

    test('accepts partial options object', async () => {
        // Только minYear, без minRating — minRating должен остаться по умолчанию (8.5)
        const stats = await exportCsvToTxt({ minYear: 2000 });
        expect(stats.processed).toBe(15); // все строки всё ещё «processed»
    });
});

describe('exportCsvToTxt — error handling', () => {
    test('rejects when input file is missing', async () => {
        const backup = fs.readFileSync(CSV);
        fs.unlinkSync(CSV);

        try {
            await expect(exportCsvToTxt()).rejects.toThrow();
        } finally {
            fs.writeFileSync(CSV, backup);
        }
    });
});