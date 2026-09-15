import { expect, test } from 'vitest';
import { is } from './index.js';
import { collect } from './invoke.js';
async function* three() {
    yield 1;
    yield 2;
    yield 3;
}
test('a stream is drained into its items', async () => {
    expect(await collect(three())).toEqual([1, 2, 3]);
});
test('an empty stream is an empty list, which is an answer', async () => {
    expect(await collect((async function* () { })())).toEqual([]);
});
test('anything else is awaited', async () => {
    expect(await collect(Promise.resolve('hi'))).toBe('hi');
    expect(await collect('hi')).toBe('hi');
    expect(await collect(undefined)).toBeUndefined();
});
test('a stream is what has an async iterator, not what was declared', () => {
    expect(is.stream(three())).toBe(true);
    expect(is.stream('abc')).toBe(false);
    expect(is.stream([1, 2])).toBe(false);
    expect(is.stream(null)).toBe(false);
});
//# sourceMappingURL=invoke.test.js.map