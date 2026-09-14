import { t } from '@lickle/api';
import * as c from './index.js';
const cmd = c.cmd({
    name: 'cmd1',
    description: 'test',
    args: {
        foo: { description: 'foo', short: 'f', type: c.string() },
        bar: { description: 'bar', short: 'b', type: c.num() },
        baz: { description: 'baz', short: 'z', type: c.list() },
        f: { description: 'f', type: c.flag() },
    },
    positional: ['foo', 'bar', 'baz'],
    handle: async (t) => {
        Promise.resolve(t.bar);
    },
});
const cmdo = c.cmd(t.op({
    name: 'op1',
    description: 'group1',
    in: {
        foo: t.string('foo'),
        bar: t.number('bar').meta('cli', { short: 'b' }),
        baz: t.array(t.string('baz')),
        f: t.boolean().meta('cli', { short: 'f' }),
    },
    handle: () => Promise.resolve(),
}));
const cmdn = c.cmd(t.ns({
    name: 'group2',
    description: 'group1',
    operations: [cmd, cmdo],
}));
const lll = t.ns({
    name: 'group3',
    description: 'group1',
    operations: [
        t.ns({
            name: 'group2',
            description: 'group1',
            operations: [cmd, cmdo, cmdn],
        }),
    ],
});
void lll;
//# sourceMappingURL=t.test.js.map