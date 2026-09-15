import { t } from '@lickle/api';
import { meta, api } from '@lickle/api/util';
/**
 * Put anything into a command tree.
 *
 * A `Cmd` is compiled to the operation it describes. An operation or a namespace
 * built with `@lickle/api` is already one and passes straight through, so a
 * tree can mix commands written for this target with operations written for no
 * target in particular.
 */
export const cmd = (p) => {
    if (!isCmd(p))
        return p;
    // The args become the operation's input object, carrying their description in
    // the schema itself and their command-line spellings as this target's meta —
    // so everything the runner needs it reads back off the operation.
    const properties = {};
    for (const [key, arg] of Object.entries(p.args)) {
        const type = arg.type;
        if (arg.description !== undefined)
            meta.update(type, { description: arg.description });
        const field = {};
        if (arg.short !== undefined)
            field.short = arg.short;
        if (arg.aliases !== undefined)
            field.aliases = arg.aliases;
        if (Object.keys(field).length > 0)
            meta.update(type, { meta: { cli: [field] } });
        properties[key] = type;
    }
    const operation = t.op({
        name: p.name,
        description: p.description,
        in: t.object(properties),
        out: t.empty(),
        handle: p.handle,
    });
    if (p.positional !== undefined)
        meta.update(operation, { meta: { cli: [{ positionals: p.positional }] } });
    return api.on(p, operation);
};
/** A command written here has `args`; an operation or a namespace does not. */
const isCmd = (p) => typeof p === 'object' && p !== null && 'args' in p && 'handle' in p;
export const flag = (description) => t.boolean(description);
export const string = (description) => t.string(description);
export const num = (description) => t.number(description);
/** A closed set: the handler sees the members, not just `string`. */
export const choice = (members, description) => t.set(members, description);
/**
 * Repeated on the command line: `-t home -t errands`. Absent means empty.
 *
 * The item-less form is a separate, non-generic signature on purpose: an arg's
 * declared type is `Cmd.Type`, and a generic return would be inferred from that
 * context — making `list()` a list of anything a command line can express
 * rather than a list of strings.
 */
export const list = (of, description) => typeof of === 'object' ? t.array(of, description) : t.array(string(), of);
/** May be left out entirely, which is not the same as having a default. */
export const optional = (of, description) => t.union([of, t.undefined()], description);
//# sourceMappingURL=build.js.map