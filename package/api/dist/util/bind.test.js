import { expect, test } from 'vitest';
import { z } from 'zod';
import { t } from '../build.js';
import * as bind from './bind.js';
const schema = t.object({
    title: t.string(),
    tag: t.array(t.string()),
    done: t.boolean(),
    times: t.number().default(2),
    note: t.optional(t.string()),
});
/** What a command line stands in with; a tool call passes no fallback at all. */
const cli = (property) => property.shape.list
    ? { value: [] }
    : property.shape.type === 'boolean'
        ? { value: false }
        : property.shape.optional || !property.required
            ? { value: undefined }
            : undefined;
test('supplied beats the declared default, which beats the fallback', async () => {
    expect(await bind.to(schema, { title: 'x', times: 9 }, { fallback: cli })).toEqual({
        ok: true,
        value: { title: 'x', tag: [], done: false, times: 9, note: undefined },
    });
    expect(await bind.to(schema, { title: 'x' }, { fallback: cli })).toMatchObject({ value: { times: 2 } });
});
test('an input with nothing to stand in for it is missing', async () => {
    expect(await bind.to(schema, {})).toEqual({
        ok: false,
        problems: [
            { kind: 'missing', key: 'title' },
            { kind: 'missing', key: 'tag' },
            { kind: 'missing', key: 'done' },
        ],
        expected: ['title', 'tag', 'done', 'times', 'note'],
    });
});
test('every problem comes back at once', async () => {
    const got = await bind.to(schema, { title: 2, nope: 1 });
    expect(got.ok).toBe(false);
    expect(got.ok === false && got.problems.map((p) => [p.kind, p.key])).toEqual([
        ['unknown', 'nope'],
        ['invalid', 'title'],
        ['missing', 'tag'],
        ['missing', 'done'],
    ]);
});
test('an unknown key can be ignored by a target that wants to', async () => {
    const got = await bind.to(schema, { title: 'x', nope: 1 }, { fallback: cli, unknown: 'ignore' });
    expect(got).toMatchObject({ ok: true, value: { title: 'x' } });
    expect(got.ok === true && 'nope' in got.value).toBe(false);
});
test('a refusal says what was expected, and where inside a list', async () => {
    expect(await bind.to(schema, { title: 'x', tag: ['a', 2], done: true })).toMatchObject({
        problems: [{ kind: 'invalid', key: 'tag', path: '1', expected: 'a string' }],
    });
});
test('how values arrive decides whether text is converted', async () => {
    const given = { title: 'x', tag: ['a'], done: true, times: '9' };
    expect(await bind.to(schema, given, { reading: 'text' })).toMatchObject({ ok: true, value: { times: 9 } });
    expect(await bind.to(schema, given, { reading: 'typed' })).toMatchObject({
        problems: [{ kind: 'invalid', key: 'times', expected: 'a number' }],
    });
});
test('a default or a fallback is taken as given, never validated', async () => {
    // A bad declared default is the author's mistake; blaming the caller for it
    // would name the wrong person.
    const odd = t.object({ n: t.number().default('nope') });
    expect(await bind.to(odd, {})).toEqual({ ok: true, value: { n: 'nope' } });
});
test('a fallback to undefined sets the key; without one the key is simply unbound', async () => {
    const given = { title: 'x', tag: [], done: false };
    const withFallback = await bind.to(schema, given, { fallback: cli });
    expect(withFallback.ok === true && 'note' in withFallback.value).toBe(true);
    // An input the document does not require is absent, not missing.
    const without = await bind.to(schema, given);
    expect(without).toMatchObject({ ok: true });
    expect(without.ok === true && 'note' in without.value).toBe(false);
});
test('keys come out in the order the operation declares them', async () => {
    const got = await bind.to(schema, { note: 'n', done: true, tag: [], title: 'x' });
    expect(got.ok === true && Object.keys(got.value)).toEqual(['title', 'tag', 'done', 'times', 'note']);
});
test('a required input is one the document requires and nothing stands in for', async () => {
    const got = await bind.to(schema, {}, { fallback: cli });
    expect(got).toMatchObject({ ok: false, problems: [{ kind: 'missing', key: 'title' }] });
    expect(got.ok === false && got.problems).toHaveLength(1);
});
test('a schema that keeps its fields validates as a whole, attributed by input', async () => {
    const foreign = z.object({ to: z.string().email(), count: z.number() });
    expect(await bind.to(foreign, { to: 'a@b.com', count: 2 })).toEqual({
        ok: true,
        value: { to: 'a@b.com', count: 2 },
    });
    const refused = await bind.to(foreign, { to: 'nope', count: 2 });
    expect(refused).toMatchObject({ problems: [{ kind: 'invalid', key: 'to', path: '' }] });
});
test('the floor still applies to a schema that keeps its fields', async () => {
    const foreign = z.object({ count: z.number() });
    expect(await bind.to(foreign, { count: '2' })).toMatchObject({
        problems: [{ kind: 'invalid', key: 'count', expected: 'a number' }],
    });
});
test('an object read once binds the same as one read per call', async () => {
    const prepared = bind.inputs(schema);
    expect(prepared.own).toBe(true);
    expect(bind.inputs(z.object({ a: z.string() })).own).toBe(false);
    expect(await bind.to(prepared, { title: 'x' }, { fallback: cli })).toEqual(await bind.to(schema, { title: 'x' }, { fallback: cli }));
});
//# sourceMappingURL=bind.test.js.map