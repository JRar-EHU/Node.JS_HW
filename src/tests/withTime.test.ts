import { describe, test, expect, jest } from '@jest/globals';
import {WithTime} from "../withTime.ts";



function collect(wt: WithTime) {
    const events: Array<{ name: string; payload?: unknown }> = [];
    for (const name of ['begin', 'data', 'error', 'end'] as const) {
        wt.on(name, (payload?: unknown) => events.push({ name, payload }));
    }
    return events;
}

describe('WithTime', () => {
    test('success: emits begin → data → end', async () => {
        const wt = new WithTime();
        const events = collect(wt);

        await wt.execute(((cb: (err: Error | null, result?: { id: number }) => void) => cb(null, { id: 1 })) as any
        );

        expect(events.map((e) => e.name)).toEqual(['begin', 'data', 'end']);
        expect(events[1].payload).toEqual({ id: 1 });
    });

    test('failure: emits begin → error → end', async () => {
        const wt = new WithTime();
        const events = collect(wt);
        const boom = new Error('boom');

        await wt.execute(((cb: any) => cb(boom)) as any);

        expect(events.map((e) => e.name)).toEqual(['begin', 'error', 'end']);
        expect(events[1].payload).toBe(boom);
    });

    test('no data when result is undefined', async () => {
        const wt = new WithTime();
        const events = collect(wt);

        await wt.execute(((cb: any) => cb(null)) as any);

        expect(events.map((e) => e.name)).toEqual(['begin', 'end']);
    });

    test('passes extra args to asyncFunc', async () => {
        const wt = new WithTime();
        wt.on('error', () => {});
        let received: unknown[] = [];

        await wt.execute(
            ((a: number, b: number, cb: (err: Error | null, r?: number) => void) => {
                received = [a, b];
                cb(null, a + b);
            }) as any,
            2,
            3,
        );

        expect(received).toEqual([2, 3]);
    });

    test('awaits async callback (setTimeout)', async () => {
        const wt = new WithTime();
        wt.on('error', () => {});

        const data = await new Promise<unknown>((resolve) => {
            wt.on('data', resolve);
            wt.execute(((cb: any) => setTimeout(() => cb(null, 'delayed'), 10)) as any);
        });

        expect(data).toBe('delayed');
    });

    test('measures time via console.time / console.timeEnd', async () => {
        const wt = new WithTime();
        wt.on('error', () => {});

        const time = jest.spyOn(console, 'time').mockImplementation(() => {});
        const timeEnd = jest.spyOn(console, 'timeEnd').mockImplementation(() => {});

        await wt.execute(((cb: any) => cb(null, 1)) as any);

        expect(time).toHaveBeenCalledWith('execute');
        expect(timeEnd).toHaveBeenCalledWith('execute');

        time.mockRestore();
        timeEnd.mockRestore();
    });
});