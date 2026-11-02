import EventEmitter from "node:events";
import type {AsyncFunc} from "./types.ts";

export class WithTime extends EventEmitter {
    async execute<T>(asyncFunc: AsyncFunc<T>,...args: any[]): Promise<void> {
        this.emit('begin');
        console.time('execute');

        try {
            const result = await new Promise<T | undefined>((resolve, reject) => {
                asyncFunc(...args, (err: Error | null, result?:T) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                })
            })
            if (result !== undefined) {
                this.emit('data', result);
            }
        } catch(err) {
            this.emit('error', err);
        } finally {
            console.timeEnd('execute');
            this.emit('end');
        }
    }
}