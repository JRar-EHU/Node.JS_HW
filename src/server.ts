import { createNewServer } from './app.ts';

const hostname = '127.0.0.1';
const port = 3000;

createNewServer().listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});