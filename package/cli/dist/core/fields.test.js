import { t } from '@lickle/api';
import { schema as js } from '@lickle/api/util';
import { expect, test } from 'vitest';
import { z } from 'zod';
import { fallbackFor, inputsOf, typeLabel, valueLabel } from './fields.js';
import { parseArgs } from './parse.js';
const op = t
    .op({
    name: 'op',
    description: 'An operation.',
    in: {
        title: t.string('What to do.'),
        tag: t.array(t.string()).meta('cli', { short: 't' }),
        done: t.boolean(),
        note: t.optional(t.string()),
        times: t.number().default(2),
    },
    handle: async () => { },
})
    .meta('cli', { positionals: ['title'] });
const by = () => Object.fromEntries(inputsOf(op).fields.map((f) => [f.key, f]));
test('an input has to be written only when nothing can stand in for it', () => {
    const fields = by();
    expect(fields['title'].required).toBe(true);
    expect(fields['tag'].required).toBe(false); // a list that was not repeated is empty
    expect(fields['done'].required).toBe(false); // a bool that was not passed is false
    expect(fields['note'].required).toBe(false); // it may be left out
    expect(fields['times'].required).toBe(false); // it declares a default
});
test('what this target stands in with, which is what `bind` asks it for', () => {
    const by = Object.fromEntries(inputsOf(op).inputs.properties.map((p) => [p.key, fallbackFor(p)]));
    expect(by['title']).toBeUndefined();
    expect(by['tag']).toEqual({ value: [] });
    expect(by['done']).toEqual({ value: false });
    expect(by['note']).toEqual({ value: undefined });
});
test('a declared default is applied before this target is asked to stand in', async () => {
    // Which is why `fallbackFor` no longer mentions defaults at all: `bind`
    // reaches for the schema's own before it reaches for the target's.
    const { inputs } = await parseArgs(op, ['x']);
    expect(inputs['times']).toBe(2);
});
test('only a declared default is shown as one', () => {
    expect(by()['times'].default).toBe(2);
    expect(by()['tag'].default).toBeUndefined();
});
test('an input answers to its key and to the spellings its meta adds', () => {
    expect(by()['tag'].names).toEqual(['tag', 't']);
    expect(by()['title'].names).toEqual(['title']);
    expect(by()['title'].description).toBe('What to do.');
});
test('aliases can be named on the operation instead of the type', () => {
    const aliased = t
        .op({ name: 'a', in: { verbose: t.boolean() }, handle: async () => { } })
        .meta('cli', { aliases: { verbose: ['v', 'loud'] } });
    expect(inputsOf(aliased).fields[0].names).toEqual(['verbose', 'v', 'loud']);
});
test('positionals come off the operation, not the type', () => {
    expect(inputsOf(op).positionals).toEqual(['title']);
});
test('a foreign input validates as a whole, a native one field by field', () => {
    expect(inputsOf(op).inputs.own).toBe(true);
    const foreign = t.op({ name: 'f', in: z.object({ a: z.string() }), out: t.empty(), handle: async () => { } });
    expect(inputsOf(foreign).inputs.own).toBe(false);
    expect(inputsOf(foreign).fields[0].schema).toBeUndefined();
});
const shapeOf = (s) => js.shape(js.json(s));
test('labels a shape the way a terminal reads it', () => {
    expect(typeLabel(shapeOf(t.number()))).toBe('num');
    expect(typeLabel(shapeOf(t.array(t.string())))).toBe('string[]');
    expect(typeLabel(shapeOf(t.union([t.string(), t.undefined()])))).toBe('string?');
    expect(typeLabel(shapeOf(t.set(['fast', 'safe'])))).toBe('fast|safe');
    expect(typeLabel(shapeOf(z.number().int()))).toBe('int');
    expect(valueLabel(shapeOf(t.array(t.string())))).toBe('string...');
    expect(valueLabel(shapeOf(t.set(['fast', 'safe'])))).toBe('fast|safe');
});
//# sourceMappingURL=fields.test.js.map