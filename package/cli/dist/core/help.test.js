import { t } from '@lickle/api';
import { expect, test } from 'vitest';
import { namespaceHelp, operationHelp } from './help.js';
const add = t
    .op({
    name: 'add',
    description: 'Add a task.',
    in: {
        title: t.string('What to do.'),
        tag: t.array(t.string(), 'Tags to file it under.').meta('cli', { short: 't' }),
        done: t.boolean('Mark it done immediately.').meta('cli', { short: 'd' }),
        mode: t.set(['fast', 'safe'], 'How to file it.').default('fast'),
    },
    out: t.object({ id: t.number('The new task id.'), title: t.string('What it says.') }),
    handle: async () => ({ id: 1, title: 'x' }),
})
    .meta('cli', { positionals: ['title'] });
test('an operation writes its help from its own inputs and outputs', () => {
    expect(operationHelp(add, ['todo', 'add'])).toBe([
        'Add a task.',
        '',
        'Usage: todo add [options] <title>',
        '',
        'Arguments:',
        '  <title>  What to do. (string)',
        '',
        'Options:',
        '  -t, --tag <string...>     Tags to file it under.',
        '  -d, --done                Mark it done immediately.',
        '      --mode <fast|safe>    How to file it. (default: "fast")',
        '  -h, --help                Show this help.',
        '  -o, --output <text|json>  Output format. (default: text)',
        '',
        'Output:',
        '  id     The new task id. (num)',
        '  title  What it says. (string)',
    ].join('\n'));
});
test('an input that has to be given says so', () => {
    const op = t.op({ name: 'n', in: { who: t.string('Who.') }, handle: async () => { } });
    expect(operationHelp(op, ['n'])).toContain('--who <string>        Who. (required)');
});
test('an operation returning nothing has no output section', () => {
    const op = t.op({ name: 'n', description: 'Does a thing.', handle: async () => { } });
    expect(operationHelp(op, ['n'])).not.toContain('Output:');
});
test('a streamed output says so', () => {
    const op = t.op({ name: 'n', out: t.output(t.string(), 'async-iter'), handle: async function* () { } });
    expect(operationHelp(op, ['n'])).toContain('Output (streamed):');
});
test('a namespace lists what it holds', () => {
    const ns = t.ns({ name: 'todo', description: 'A tiny task list.', operations: [add] });
    expect(namespaceHelp(ns, ['todo'])).toBe([
        'A tiny task list.',
        '',
        'Usage: todo <command> [options]',
        '',
        'Commands:',
        '  add  Add a task.',
        '',
        'Options:',
        '  -h, --help                Show this help.',
        '  -o, --output <text|json>  Output format. (default: text)',
    ].join('\n'));
});
test('a positional that need not be written is shown as optional', () => {
    // It reads as `[who]` because a declared default stands in for it — which is
    // `bind`'s answer now, not something this target absorbs into its fallback.
    const op = t
        .op({ name: 'greet', in: { who: t.string('Who to greet.').default('world') }, handle: async () => { } })
        .meta('cli', { positionals: ['who'] });
    const help = operationHelp(op, ['greet']);
    expect(help).toContain('Usage: greet [options] [who]');
    expect(help).toContain('[who]  Who to greet. (string, default: "world")');
});
test('a positional that must be written is shown as required', () => {
    const op = t
        .op({ name: 'greet', in: { who: t.string('Who to greet.') }, handle: async () => { } })
        .meta('cli', { positionals: ['who'] });
    expect(operationHelp(op, ['greet'])).toContain('Usage: greet [options] <who>');
});
//# sourceMappingURL=help.test.js.map