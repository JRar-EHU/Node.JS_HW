import fs from 'node:fs';
import csv from 'csvtojson';
import type {IRow, IStats} from "./types.ts";

function parseRating(raw: string): number | null {
    const n = parseFloat(raw.replace(',', '.'));
    return Number.isNaN(n) ? null : n;
}

function formatLength(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h ${m}m`;
}

export async function exportCsvToTxt(
    { minYear = 1995, minRating = 8.5 } = {},
): Promise<IStats> {
    const stats: IStats = {
        processed: 0,
        exported: 0,
        skipped: { invalid: 0, filtered: 0 },
        byDecade: {},
    };

    const readStream = fs.createReadStream('./src/assets/movies.csv');
    const writeStream = fs.createWriteStream('./src/assets/movies.txt');
    const csvStream = csv({ delimiter: ';' }).fromStream(readStream);

    return new Promise((resolve, reject) => {
        const fail = (err: Error) => {
            readStream.destroy();
            writeStream.destroy();
            csvStream.destroy();
            reject(err);
        };

        readStream.on('error', fail);
        csvStream.on('error', fail);
        writeStream.on('error', fail);

        csvStream.on('data', (chunk: Buffer) => {
            stats.processed++;
            const row: IRow = JSON.parse(chunk.toString());

            const year = Number(row.Year);
            const rating = parseRating(row.Rating);

            if (Number.isNaN(year) || rating === null) {
                stats.skipped.invalid++;
                return;
            }
            if (year < minYear || rating < minRating) {
                stats.skipped.filtered++;
                return;
            }

            const decade = `${Math.floor(year / 10) * 10}s`;
            const record = {
                movie: row.Movie,
                director: row.Director,
                year,
                rating,
                decade,
                length: formatLength(Number(row.Duration)),
            };

            stats.exported++;
            stats.byDecade[decade] = (stats.byDecade[decade] ?? 0) + 1;

            if (!writeStream.write(JSON.stringify(record) + '\n')) {
                csvStream.pause();
                writeStream.once('drain', () => csvStream.resume());
            }
        });

        csvStream.on('end', () => writeStream.end());

        writeStream.on('finish', async () => {
            try {
                await fs.promises.writeFile(
                    './src/assets/summary.json',
                    JSON.stringify(stats, null, 2),
                );
                resolve(stats);
            } catch (err) {
                reject(err);
            }
        });
    });
}

exportCsvToTxt()
    .then((stats) => console.log('done:', stats))
    .catch((err) => {
        console.error('failed:', err);
        process.exit(1);
    });