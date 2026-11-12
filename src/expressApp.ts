import express, { type Request, type Response, type NextFunction } from 'express';

const TOKEN = 'secret-token';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function logger(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    res.on('finish', () => {
        console.log(
            `[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${Date.now() - start}ms`,
        );
    });
    next();
}

function auth(req: Request, res: Response, next: NextFunction): void {
    if (req.headers.authorization !== `Bearer ${TOKEN}`) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    next();
}

function validateUser(req: Request, res: Response, next: NextFunction): void {
    const { name, age, email } = req.body ?? {};

    if (typeof name !== 'string' || name.trim().length < 2) {
        res.status(400).json({ error: '"name" must be a string of at least 2 characters' });
        return;
    }
    if (typeof age !== 'number' || !Number.isFinite(age) || age < 0 || age > 120) {
        res.status(400).json({ error: '"age" must be a number between 0 and 120' });
        return;
    }
    if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
        res.status(400).json({ error: '"email" must be a valid email' });
        return;
    }

    next();
}

export function createExpressApp() {
    const app = express();

    app.use(express.json());
    app.use(logger);

    app.get('/public/info', (_req, res) => {
        res.json({ info: 'public endpoint' });
    });

    app.get('/api/data', auth, (_req, res) => {
        res.json({ data: [1, 2, 3] });
    });

    app.post('/api/users', auth, validateUser, (req, res) => {
        const { name, age, email } = req.body;
        res.status(201).json({ id: 1, name, age, email });
    });

    return app;
}