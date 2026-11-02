import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execFile } from 'child_process';

const [sourceDir, backupDir] = process.argv.slice(2);
if (!sourceDir || !backupDir) {
    console.error('Usage: ts-node src/index.ts <sourceDir> <backupDir>');
    process.exit(1);
}

const LOG = path.join(backupDir, 'backup_log.txt');
const HASH_PREFIX = 'HASH: ';

function log(level: string, msg: string) {
    const ts = new Date().toISOString();
    fs.appendFileSync(LOG, `${ts}: ${level}: ${msg}\n`);
}

function computeHash(dir: string): string {
    const names = fs.readdirSync(dir, { withFileTypes: true })
        .filter(e => e.isFile())
        .map(e => e.name)
        .sort();
    return crypto.createHash('sha256').update(names.join('\n')).digest('hex');
}

function readPreviousHash(): string | null {
    if (!fs.existsSync(LOG)) return null;
    const lines = fs.readFileSync(LOG, 'utf8').split('\n');
    let last: string | null = null;
    for (const l of lines) {
        if (l.startsWith(HASH_PREFIX)) {
            last = l.slice(HASH_PREFIX.length).trim();
        }
    }
    return last;
}

function createBackup(): Promise<void> {
    const iso = new Date().toISOString().replace(/[:.]/g, '-');
    const archive = path.resolve(backupDir, `backup-${iso}.tar.gz`);
    const absSource = path.resolve(sourceDir);

    return new Promise((resolve, reject) => {
        execFile('tar', ['-czf', archive, '-C', absSource, '.'], (err) => {
            err ? reject(err) : resolve();
        });
    });
}

async function main() {
    fs.mkdirSync(backupDir, { recursive: true });

    if (!fs.existsSync(sourceDir)) {
        console.error(`ERROR: source directory does not exist: ${sourceDir}`);
        process.exit(1);
    }
    if (!fs.statSync(sourceDir).isDirectory()) {
        console.error(`ERROR: source path is not a directory: ${sourceDir}`);
        process.exit(1);
    }

    const current = computeHash(sourceDir);
    if (readPreviousHash() === current) {
        log('SKIPPED', 'No changes detected');
        console.log('SKIPPED: No changes detected');
        return;
    }

    try {
        await createBackup();
    } catch {
        log('FAILED', 'tar command failed');
        console.error('FAILED: tar command failed');
        process.exit(1);
    }

    log('SUCCESS', 'Backup created');
    fs.appendFileSync(LOG, `${HASH_PREFIX}${current}\n`);
    console.log('SUCCESS: Backup created');
}

main().catch(err => { console.error(err); process.exit(1); });