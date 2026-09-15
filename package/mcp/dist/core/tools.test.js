import { t } from '@lickle/api';
import { expect, test } from 'vitest';
import { tools } from './tools.js';
const add = t.op({
    name: 'add',
    description: 'Add a task.',
    in: { title: t.string('What to do.'), tags: t.array(t.string(), 'Tags.') },
    out: t.object({ id: t.number('The id.') }),
    handle: async () => ({ id: 1 }),
});
const version = t.op({ name: 'version', description: 'Print it.', out: t.string(), handle: async () => '1.0.0' });
const quiet = t.op({ name: 'quiet', description: 'Returns nothing.', handle: async () => { } });
const tree = t.ns({
    name: 'todo',
    description: 'A tiny task list.',
    operations: [t.ns({ name: 'task', operations: [add] }), version, quiet],
});
const quiet2 = () => ({ onWarn: () => { } });
const named = (program) => tools(program, quiet2()).map((e) => e.tool.name);
test('a nested tree becomes a flat tool list, named by path', () => {
    const list = tools(tree, quiet2());
    expect(list.map((e) => [e.tool.name, e.tool.title])).toEqual([
        ['task_add', 'task add'],
        ['version', 'version'],
        ['quiet', 'quiet'],
    ]);
    expect(list.map((e) => e.tool.description)).toEqual(['Add a task.', 'Print it.', 'Returns nothing.']);
});
test('only the leaves are tools; a namespace is a path segment, not a tool', () => {
    expect(named(tree)).not.toContain('task');
});
test('an operation on its own is a one-tool server', () => {
    expect(named(add)).toEqual(['add']);
});
test('the input schema is the operation, verbatim', () => {
    const [entry] = tools(add, quiet2());
    expect(entry.tool.inputSchema).toEqual({
        type: 'object',
        properties: {
            title: { type: 'string', description: 'What to do.' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Tags.' },
        },
        required: ['title', 'tags'],
    });
});
test('a single value is published structurally, not only as text', () => {
    // The revision allows any JSON value as structured content, and an operation
    // returns one value described by one schema — so there is nothing to branch on.
    const [entry] = tools(version, quiet2());
    expect(entry.tool.outputSchema).toEqual({ type: 'string' });
    expect(entry.structured).toBe(true);
});
test('an operation that returns nothing declares no output schema', () => {
    const [entry] = tools(quiet, quiet2());
    expect(entry.tool.outputSchema).toBeUndefined();
    expect(entry.structured).toBe(false);
});
test('a streaming operation declares the list a call will answer with', () => {
    const tick = t.op({
        name: 'tick',
        out: t.output(t.string('One tick.'), 'async-iter'),
        handle: async function* () { },
    });
    const [entry] = tools(tick, quiet2());
    expect(entry.tool.outputSchema).toEqual({ type: 'array', items: { type: 'string', description: 'One tick.' } });
    expect(entry.stream).toBe(true);
});
test('a hidden operation is not a tool', () => {
    const hidden = t.op({ name: 'secret', handle: async () => { } }).meta('mcp', { hidden: true });
    expect(named(t.ns({ name: 'root', operations: [version, hidden] }))).toEqual(['version']);
});
test('hiding a namespace takes its subtree with it', () => {
    const inner = t.ns({ name: 'admin', operations: [add, version] }).meta('mcp', { hidden: true });
    expect(named(t.ns({ name: 'root', operations: [inner, quiet] }))).toEqual(['quiet']);
});
test('a name and a title can be overridden where the program is assembled', () => {
    const renamed = t.op({ name: 'add', handle: async () => { } }).meta('mcp', { name: 'create task', title: 'Create' });
    const [entry] = tools(t.ns({ name: 'root', operations: [renamed] }), quiet2());
    expect(entry.tool.name).toBe('create_task');
    expect(entry.tool.title).toBe('Create');
});
test('annotations are a claim, so nothing derives them', () => {
    const read = t.op({ name: 'ls', handle: async () => { } }).meta('mcp', { annotations: { readOnlyHint: true } });
    const [entry] = tools(t.ns({ name: 'root', operations: [read] }), quiet2());
    expect(entry.tool.annotations).toEqual({ readOnlyHint: true });
    expect(tools(version, quiet2())[0].tool.annotations).toBeUndefined();
});
test('a name collision is resolved and reported, never to stdout', () => {
    const warnings = [];
    const collide = t.ns({
        name: 'root',
        operations: [
            t.ns({ name: 'a', operations: [t.op({ name: 'run', handle: async () => { } })] }),
            t.ns({ name: 'b', operations: [t.op({ name: 'run', handle: async () => { } })] }),
        ],
    });
    const list = tools(collide, { naming: { separator: '' }, onWarn: (m) => warnings.push(m) });
    expect(list.map((e) => e.tool.name)).toEqual(['arun', 'brun']);
    expect(warnings).toEqual([]);
    const same = tools(collide, { naming: { separator: '' }, onWarn: (m) => warnings.push(m) });
    expect(same).toHaveLength(2);
});
test('tool names follow the policy the caller states', () => {
    expect(tools(tree, { ...quiet2(), naming: { separator: '.' } }).map((e) => e.tool.name)).toEqual([
        'task.add',
        'version',
        'quiet',
    ]);
});
//# sourceMappingURL=tools.test.js.map