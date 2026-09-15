import { expect, test } from 'vitest';
import { z } from 'zod';
import { t } from '../build.js';
import { accept, conform, defaultOf, isNothing, issuePath, json, own, parse, properties, shape, validate, } from './schema.js';
const shapeOf = (s) => shape(json(s));
test('emits the document a type describes', () => {
    expect(json(t.string('a str'))).toEqual({ type: 'string', description: 'a str' });
    expect(json(t.number().default(3).describe('n'))).toEqual({ type: 'number', description: 'n', default: 3 });
    expect(json(t.set(['fast', 'safe']))).toEqual({ type: 'string', enum: ['fast', 'safe'] });
});
test('reads a shape out of core types', () => {
    expect(shapeOf(t.string())).toMatchObject({ type: 'string', list: false, optional: false });
    expect(shapeOf(t.array(t.number()))).toMatchObject({ type: 'number', list: true });
    expect(shapeOf(t.set(['fast', 'safe']))).toMatchObject({ type: 'string', values: ['fast', 'safe'] });
    expect(shapeOf(t.union([t.string(), t.undefined()]))).toMatchObject({ type: 'string', optional: true });
    expect(shapeOf(t.unknown())).toMatchObject({ type: 'unknown' });
});
test('reads the same shape out of a foreign schema', () => {
    expect(shapeOf(z.string())).toMatchObject({ type: 'string', list: false });
    expect(shapeOf(z.array(z.string()))).toMatchObject({ type: 'string', list: true });
    expect(shapeOf(z.enum(['fast', 'safe']))).toMatchObject({ values: ['fast', 'safe'] });
    expect(shapeOf(z.number().int())).toMatchObject({ type: 'integer' });
});
test('knows a schema that describes no value at all', () => {
    expect(isNothing(json(t.void))).toBe(true);
    expect(isNothing(json(t.undefined()))).toBe(true);
    expect(isNothing(json(t.string()))).toBe(false);
});
test('a declared default is not the same as defaulting to undefined', () => {
    expect(defaultOf(json(t.number().default(3)))).toEqual({ value: 3 });
    expect(defaultOf(json(t.number()))).toBeUndefined();
    expect(defaultOf(json(t.union([t.string().default('x'), t.undefined()])))).toEqual({ value: 'x' });
});
test('an object built here hands its fields over; a foreign one keeps them', () => {
    const native = t.object({ a: t.string(), b: t.optional(t.number()) });
    expect(Object.keys(own(native) ?? {})).toEqual(['a', 'b']);
    expect(own(z.object({ a: z.string() }))).toBeUndefined();
});
test('lists an object’s properties, required as the document says', () => {
    const native = properties(t.object({ a: t.string('A.'), b: t.optional(t.number()) }));
    expect(native.map((p) => [p.key, p.required, p.schema !== undefined])).toEqual([
        ['a', true, true],
        ['b', false, true],
    ]);
    expect(native[0].json.description).toBe('A.');
    const foreign = properties(z.object({ a: z.string(), b: z.number().optional() }));
    expect(foreign.map((p) => [p.key, p.required, p.schema !== undefined])).toEqual([
        ['a', true, false],
        ['b', false, false],
    ]);
});
test('turns a written value into what the schema describes', () => {
    expect(parse('3', shapeOf(t.number()))).toEqual({ ok: true, value: 3 });
    expect(parse('true', shapeOf(t.boolean()))).toEqual({ ok: true, value: true });
    expect(parse('no', shapeOf(t.boolean()))).toEqual({ ok: true, value: false });
    expect(parse('x', shapeOf(t.string()))).toEqual({ ok: true, value: 'x' });
    expect(parse('anything', shapeOf(t.unknown()))).toEqual({ ok: true, value: 'anything' });
    expect(parse('{"a":1}', shapeOf(t.object({ a: t.number() })))).toEqual({ ok: true, value: { a: 1 } });
});
test('one written value parses to one element of a list', () => {
    expect(parse('3', shapeOf(t.array(t.number())))).toEqual({ ok: true, value: 3 });
});
test('a rejection names what was expected, and leaves the sentence to the caller', () => {
    expect(parse('abc', shapeOf(t.number()))).toEqual({ ok: false, expected: 'a number' });
    expect(parse('1.5', shapeOf(z.number().int()))).toEqual({ ok: false, expected: 'an integer' });
    expect(parse('maybe', shapeOf(t.boolean()))).toEqual({ ok: false, expected: `'true' or 'false'` });
    expect(parse('sloppy', shapeOf(t.set(['fast', 'safe'])))).toEqual({ ok: false, expected: `'fast' or 'safe'` });
    expect(parse('{', shapeOf(t.object({})))).toEqual({ ok: false, expected: 'JSON' });
    expect(parse('d', shapeOf(t.set(['a', 'b', 'c'])))).toEqual({ ok: false, expected: `'a', 'b' or 'c'` });
});
test('a schema without a validator passes its value through', async () => {
    expect(await validate(t.number(), 3)).toEqual({ ok: true, value: 3 });
    expect(await validate(undefined, 3)).toEqual({ ok: true, value: 3 });
});
test('a schema with one gets the last word', async () => {
    expect(await validate(z.string().email(), 'a@b.com')).toEqual({ ok: true, value: 'a@b.com' });
    const failed = await validate(z.string().email(), 'nope');
    expect(failed.ok).toBe(false);
    expect(failed.ok === false && failed.issues[0].message).toBe('Invalid email address');
});
test('an issue says where it happened', async () => {
    const failed = await validate(z.object({ to: z.string().email() }), { to: 'nope' });
    expect(failed.ok === false && issuePath(failed.issues[0])).toBe('to');
    expect(issuePath({ message: 'x' })).toBe('');
});
// ---------------- Taking a value -------------------------------------------
const shapeOfOp = (s) => ({ shape: shapeOf(s), schema: s });
test('the floor takes a value that already matches its shape', () => {
    expect(conform(3, shapeOf(t.number()))).toEqual({ ok: true, value: 3 });
    expect(conform('x', shapeOf(t.string()))).toEqual({ ok: true, value: 'x' });
    expect(conform(true, shapeOf(t.boolean()))).toEqual({ ok: true, value: true });
    expect(conform(['a', 'b'], shapeOf(t.array(t.string())))).toEqual({ ok: true, value: ['a', 'b'] });
    expect(conform('anything', shapeOf(t.unknown()))).toEqual({ ok: true, value: 'anything' });
});
test('the floor refuses a value of the wrong type, and never converts one', () => {
    expect(conform('2', shapeOf(t.number()))).toEqual({ ok: false, expected: 'a number', path: '' });
    expect(conform(2, shapeOf(t.string()))).toEqual({ ok: false, expected: 'a string', path: '' });
    expect(conform('true', shapeOf(t.boolean()))).toEqual({ ok: false, expected: `'true' or 'false'`, path: '' });
    expect(conform(1.5, shapeOf(z.number().int()))).toEqual({ ok: false, expected: 'an integer', path: '' });
    expect(conform('sloppy', shapeOf(t.set(['fast', 'safe'])))).toMatchObject({ ok: false, expected: `'fast' or 'safe'` });
});
test('a list is taken element by element, and a refusal says which element', () => {
    expect(conform('home', shapeOf(t.array(t.string())))).toEqual({ ok: false, expected: 'a list', path: '' });
    expect(conform(['a', 2], shapeOf(t.array(t.string())))).toEqual({ ok: false, expected: 'a string', path: '1' });
});
test('this is the whole check for a type that carries no validator', async () => {
    // `t.number()` has no `~standard.validate`, so without the floor a target
    // reading typed values would hand a string straight to the handler.
    expect(t.number()['~standard'].validate).toBeUndefined();
    expect(await accept('lots', shapeOfOp(t.number()), 'typed')).toMatchObject({ ok: false, expected: 'a number' });
});
test('text is converted only by a target that reads text', async () => {
    const num = shapeOfOp(t.number());
    expect(await accept('2', num, 'text')).toEqual({ ok: true, value: 2 });
    expect(await accept('2', num, 'typed')).toMatchObject({ ok: false, expected: 'a number' });
    // Already the right type either way — which is what lets a bare `--done` and
    // `--done=false` reach the same field without a special case.
    expect(await accept(true, shapeOfOp(t.boolean()), 'text')).toEqual({ ok: true, value: true });
    expect(await accept('false', shapeOfOp(t.boolean()), 'text')).toEqual({ ok: true, value: false });
});
test('a validator gets the last word on a value that already conforms', async () => {
    const email = shapeOfOp(z.string().email());
    expect(await accept('a@b.com', email, 'typed')).toEqual({ ok: true, value: 'a@b.com' });
    const refused = await accept('nope', email, 'typed');
    expect('issues' in refused && refused.issues[0].message).toBe('Invalid email address');
});
test('a validator is never reached by a value the floor already refused', async () => {
    const refused = await accept(2, shapeOfOp(z.string().email()), 'typed');
    expect(refused).toEqual({ ok: false, expected: 'a string', path: '' });
});
test('an input that declares a default is not one the caller has to supply', () => {
    // Whoever reads this — a model deciding what to send, a form deciding what to
    // ask for — would otherwise be told to provide what it can leave out.
    const doc = json(t.object({ a: t.string(), b: t.number().default(2), c: t.optional(t.string()) }));
    expect(doc.required).toEqual(['a']);
    expect(properties(t.object({ b: t.number().default(2) }))[0].required).toBe(false);
});
//# sourceMappingURL=schema.test.js.map