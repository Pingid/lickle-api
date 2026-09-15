import { t } from '@lickle/api';
import { expect, test } from 'vitest';
import { z } from 'zod';
import { parseArgs, parseGlobals, peekFormat } from './parse.js';
const op = t
    .op({
    name: 'add',
    description: 'Add a task.',
    in: {
        title: t.string('What to do.'),
        tag: t.array(t.string()).meta('cli', { short: 't' }),
        done: t.boolean().meta('cli', { short: 'd' }),
        times: t.number().default(1),
        note: t.optional(t.string()),
    },
    handle: async () => { },
})
    .meta('cli', { positionals: ['title', 'tag'] });
const parse = (argv) => parseArgs(op, argv);
test('binds options, coercing each to its declared type', async () => {
    const { inputs } = await parse(['--title', 'x', '--times', '3', '-t', 'home', '-t', 'work', '-d']);
    expect(inputs).toEqual({ title: 'x', tag: ['home', 'work'], done: true, times: 3, note: undefined });
});
test('substitutes what this target uses for an absent input', async () => {
    const { inputs } = await parse(['--title', 'x']);
    expect(inputs).toEqual({ title: 'x', tag: [], done: false, times: 1, note: undefined });
});
test('places positionals in order, the last list taking what is left', async () => {
    const { inputs } = await parse(['x', 'home', 'work']);
    expect(inputs).toMatchObject({ title: 'x', tag: ['home', 'work'] });
});
test('a bool can be cleared by negation or by value', async () => {
    expect((await parse(['x', '-d', '--no-done'])).inputs).toMatchObject({ done: false });
    expect((await parse(['x', '--done=false'])).inputs).toMatchObject({ done: false });
});
test('names a missing input as the way it could have been given', async () => {
    await expect(parse([])).rejects.toThrow(`missing required argument '<title>'`);
    const named = t.op({ name: 'n', in: { who: t.string() }, handle: async () => { } });
    await expect(parseArgs(named, [])).rejects.toThrow(`missing required option '--who'`);
});
test('rejects what it cannot place', async () => {
    await expect(parse(['x', '--bogus'])).rejects.toThrow(`unknown option '--bogus'`);
    await expect(parse(['--title'])).rejects.toThrow(`option '--title' requires a value`);
    await expect(parse(['--title', 'x', 'y'])).rejects.toThrow(`'title' was given both as an option and as an argument`);
    const one = t.op({ name: 'o', in: { a: t.string() }, handle: async () => { } }).meta('cli', { positionals: ['a'] });
    await expect(parseArgs(one, ['x', 'y'])).rejects.toThrow(`unexpected argument 'y'`);
});
test('asking for help is never an error, however wrong the rest is', async () => {
    const { help, inputs } = await parse(['--help']);
    expect(help).toBe(true);
    expect(inputs).toEqual({});
});
test('answers the reserved flags, and refuses an operation that reuses their names', async () => {
    expect((await parse(['x', '-o', 'json'])).output).toBe('json');
    await expect(parse(['x', '-o', 'yaml'])).rejects.toThrow(/expected 'text' or 'json'/);
    const clash = t.op({ name: 'c', in: { help: t.string() }, handle: async () => { } });
    await expect(parseArgs(clash, [])).rejects.toThrow(/reserved flag name 'help'/);
});
test('a foreign input is validated whole, with issue paths named as flags', async () => {
    const foreign = t.op({
        name: 'f',
        in: z.object({ to: z.string().email(), count: z.coerce.number().int().min(1) }),
        out: t.empty(),
        handle: async () => { },
    });
    expect((await parseArgs(foreign, ['--to', 'a@b.com', '--count', '2'])).inputs).toEqual({ to: 'a@b.com', count: 2 });
    await expect(parseArgs(foreign, ['--to', 'nope', '--count', '2'])).rejects.toThrow(/invalid value for '--to'/);
});
test('a native input is validated field by field', async () => {
    const mixed = t.op({ name: 'm', in: { email: z.string().email() }, handle: async () => { } });
    await expect(parseArgs(mixed, ['--email', 'nope'])).rejects.toThrow(/invalid value for '--email'/);
});
test('a namespace answers the reserved flags and nothing else', () => {
    expect(parseGlobals(['--help'])).toMatchObject({ help: true, output: 'text' });
    expect(parseGlobals(['-o', 'json'])).toMatchObject({ output: 'json' });
    expect(() => parseGlobals(['--bogus'])).toThrow(`unknown option '--bogus'`);
    expect(() => parseGlobals(['-o', 'json', 'stray'])).toThrow(`unknown command 'stray'`);
});
test('the format can be read before anything else is known', () => {
    expect(peekFormat(['add', 'x', '--output', 'json'])).toBe('json');
    expect(peekFormat(['add', '-vo', 'json'])).toBe('json');
    expect(peekFormat(['add'])).toBe('text');
    expect(peekFormat(['-o', 'yaml'])).toBe('text');
});
test('a bad value is named by the spelling that was written, not by the key', async () => {
    await expect(parse(['x', '-t', 'a', '-t', 'b', '--times', 'abc'])).rejects.toThrow(`invalid value for '--times': 'abc' (expected a number)`);
    const short = t.op({ name: 's', in: { n: t.number().meta('cli', { short: 'n' }) }, handle: async () => { } });
    await expect(parseArgs(short, ['-n', 'abc'])).rejects.toThrow(`invalid value for '-n': 'abc' (expected a number)`);
});
test('a refusal inside a list says which element', async () => {
    const list = t.op({ name: 'l', in: { n: t.array(t.number()) }, handle: async () => { } });
    await expect(parseArgs(list, ['--n', '1', '--n', 'two'])).rejects.toThrow(`'two' (expected a number)`);
});
test('every problem is reported, not just the first', async () => {
    const two = t.op({ name: 't', in: { a: t.string(), b: t.string() }, handle: async () => { } });
    await expect(parseArgs(two, [])).rejects.toThrow(`missing required option '--a'; missing required option '--b'`);
});
test('an input that may be left out is still a key, so a handler can see it', async () => {
    const { inputs } = await parse(['x']);
    expect('note' in inputs).toBe(true);
    expect(inputs['note']).toBeUndefined();
});
//# sourceMappingURL=parse.test.js.map