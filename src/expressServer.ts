import { createExpressApp } from './expressApp.ts';

createExpressApp().listen(3001, '127.0.0.1', () => {
    console.log('Express on http://127.0.0.1:3001');
});