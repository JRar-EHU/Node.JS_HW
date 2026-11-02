import { createServer, type ServerResponse } from 'node:http';

const hostname = '127.0.0.1';

function sendJson(
    res: ServerResponse,
    statusCode: number,
    body: unknown,
    extraHeaders: Record<string, string> = {},
): void {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        ...extraHeaders,
    });
    res.end(JSON.stringify(body));
}

export function createNewServer() {
    return createServer((req, res) => {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? hostname}`);
        const path = url.pathname;

        if (path !== '/search') {
            return sendJson(res, 404, { error: 'Not Found' });
        }

        if (req.method !== 'GET') {
            return sendJson(res, 405, { error: 'Method Not Allowed' }, { Allow: 'GET' });
        }

        const q = url.searchParams.get('q');
        if (q === null) {
            return sendJson(res, 400, { error: 'Query parameter "q" is required' });
        }
        if (q.trim() === '') {
            return sendJson(res, 400, { error: 'Query parameter "q" must not be empty' });
        }

        return sendJson(res, 200, { q });
    });
}