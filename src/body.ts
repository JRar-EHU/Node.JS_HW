import type { IncomingMessage } from 'node:http';
import type {BodyResult} from "./types.ts";

export const MAX_BODY = 1024 * 1024;

export function readBody(req: IncomingMessage, limit = MAX_BODY): Promise<BodyResult> {
    return new Promise((resolve) => {
        const chunks: Buffer[] = [];
        let total = 0;
        let done = false;
        const finish = (r: BodyResult) => {
            if (!done) {
                done = true;
                resolve(r);
            }
        };

        req.on('data', (chunk: Buffer) => {
            if (done) return;
            total += chunk.length;
            if (total > limit) {
                finish({ ok: false, status: 413, error: 'Payload Too Large' });
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => finish({ ok: true, text: Buffer.concat(chunks).toString('utf-8') }));
        req.on('error', () => finish({ ok: false, status: 400, error: 'Request stream error' }));
    });
}