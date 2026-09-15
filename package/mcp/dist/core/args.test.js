import { isInputError, t } from '@lickle/api';
import { bind } from '@lickle/api/util';
import { expect, test } from 'vitest';
import { z } from 'zod';
import { bindArgs } from './args.js';
const op = t.op({
    name: 'add',
    in: {
        title: t.string('What to do.'),
        tags: t.array(t.string()),
        done: t.boolean(),
        times: t.number().default(2),
        note: t.optional(t.string()),
        mode: t.set(['fast', 'safe']),
    },
    handle: async () => { },
});
const args = (given) => bindArgs(bind.inputs(op.in), given);
const whole = { title: 'x', tags: ['home'], done: false, mode: 'fast' };
test('arguments that match the operation are bound as they are', async () => {
    expect(await args({ ...whole, times: 9, note: 'n' })).toEqual({ ...whole, times: 9, note: 'n' });
});
test('a default fills a gap; nothing else does', async () => {
    // Unlike a command line, a tool call substitutes nothing: an absent list is
    // not empty and an absent bool is not false, so both have to be sent.
    expect(await args(whole)).toEqual({ ...whole, times: 2 });
    await expect(args({ title: 'x', mode: 'fast' })).rejects.toThrow(`missing required argument 'tags'; missing required argument 'done'`);
});
test('an argument that may be left out is simply not there', async () => {
    const bound = await args(whole);
    expect('note' in bound).toBe(false);
});
test('a value of the wrong type is refused, never converted', async () => {
    // v1 coerced, because every type validated by coercing. JSON has types, so a
    // string where a number was described is a mistake the model can see and fix.
    await expect(args({ ...whole, times: '9' })).rejects.toThrow(`invalid value for 'times': expected a number`);
    await expect(args({ ...whole, done: 'true' })).rejects.toThrow(`invalid value for 'done': expected 'true' or 'false'`);
    await expect(args({ ...whole, title: 5 })).rejects.toThrow(`invalid value for 'title': expected a string`);
});
test('a closed set names its members', async () => {
    await expect(args({ ...whole, mode: 'sloppy' })).rejects.toThrow(`expected 'fast' or 'safe'`);
});
test('a bad element of a list says which element', async () => {
    await expect(args({ ...whole, tags: ['home', 2] })).rejects.toThrow(`invalid value for 'tags.1': expected a string`);
});
test('an unknown argument names the ones that exist, so the model can correct itself', async () => {
    await expect(args({ ...whole, nope: 1 })).rejects.toThrow(`unknown argument 'nope'; expected 'title', 'tags', 'done', 'times', 'note' and 'mode'`);
    const none = t.op({ name: 'n', handle: async () => { } });
    await expect(bindArgs(bind.inputs(none.in), { a: 1 })).rejects.toThrow(`expected no arguments`);
});
test('null reads as "not sending this", so a default still applies', async () => {
    // Models write `null` for an absent value constantly; reading it as a value
    // would turn that into an error to recover from for nothing.
    expect(await args({ ...whole, times: null, note: null })).toEqual({ ...whole, times: 2 });
});
test('every problem comes back at once, so one turn can fix them all', async () => {
    await expect(args({ title: 5, nope: 1 })).rejects.toThrow(/unknown argument 'nope'.*invalid value for 'title'.*missing required argument 'tags'/s);
});
test('a refusal is a caller error, which is what makes it a tool result', async () => {
    await expect(args({})).rejects.toSatisfy(isInputError);
});
test('a foreign input validates whole, and each issue names the argument that carried it', async () => {
    const foreign = t.op({
        name: 'mail',
        in: z.object({ to: z.string().email(), count: z.number().int().min(1) }),
        out: t.empty(),
        handle: async () => { },
    });
    const inputs = bind.inputs(foreign.in);
    expect(await bindArgs(inputs, { to: 'a@b.com', count: 2 })).toEqual({ to: 'a@b.com', count: 2 });
    await expect(bindArgs(inputs, { to: 'nope', count: 2 })).rejects.toThrow(/invalid value for 'to'/);
    await expect(bindArgs(inputs, { to: 'a@b.com', count: '2' })).rejects.toThrow(`invalid value for 'count': expected an integer`);
});
//# sourceMappingURL=args.test.js.map