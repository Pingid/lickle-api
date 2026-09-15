import { api, bind, is, meta, operations, schema as js } from '@lickle/api/util';
import { toolNames } from './names.js';
export const nodeMeta = (node) => meta.of(node, 'mcp') ?? {};
/**
 * A node this target does not publish, and does not walk into.
 *
 * Hiding a namespace takes its subtree with it, which is what `Skip` is for:
 * core never learns the word "hidden", it only takes the predicate.
 */
export const isHidden = (node) => nodeMeta(node).hidden === true;
/**
 * Every callable operation in the tree, as a tool.
 *
 * A tree is nested and a tool list is flat, so the path becomes the name — and
 * that is the only real work here. Everything else is read off the operation,
 * which is why a command written for a command line and an operation written for
 * no target at all both arrive here as tools without either knowing.
 */
export const tools = (program, opts = {}) => {
    const root = api.of(program);
    const warn = opts.onWarn ?? ((message) => void console.error(message));
    const found = is.operation(root)
        ? isHidden(root)
            ? []
            : [{ path: [root.name], node: root }]
        : operations(root, isHidden);
    const named = toolNames(found.map((located) => nodeMeta(located.node).name?.split(' ') ?? located.path), opts.naming);
    return found.map((located, index) => {
        const { name, wanted } = named[index];
        if (wanted !== undefined)
            warn(`tool name '${wanted}' is taken; '${located.path.join(' ')}' is '${name}'`);
        const op = located.node;
        const config = nodeMeta(op);
        const out = js.json(op.out);
        const structured = !js.isNothing(out);
        const stream = op.out.returns === 'async-iter';
        return {
            tool: {
                name,
                title: config.title ?? located.path.join(' '),
                ...(op.description === undefined ? {} : { description: op.description }),
                inputSchema: js.json(op.in),
                // A streaming operation declares the schema of one item, so what a call
                // answers with — all of them at once — is a list of that.
                ...(structured ? { outputSchema: (stream ? { type: 'array', items: out } : out) } : {}),
                ...(config.annotations === undefined ? {} : { annotations: config.annotations }),
            },
            op,
            path: located.path,
            inputs: bind.inputs(op.in),
            structured,
            stream,
        };
    });
};
//# sourceMappingURL=tools.js.map