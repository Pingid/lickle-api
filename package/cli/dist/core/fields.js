import { bind, meta, schema as js } from '@lickle/api/util';
/** Read an operation's inputs the way the command line needs them. */
export const inputsOf = (op) => {
    const cli = operationMeta(op);
    const inputs = bind.inputs(op.in);
    const fields = inputs.properties.map((property) => {
        const field = property.schema === undefined ? {} : fieldMeta(property.schema);
        const aliases = [...(field.short === undefined ? [] : [field.short]), ...(field.aliases ?? [])];
        return {
            key: property.key,
            names: [...new Set([property.key, ...aliases, ...(cli.aliases?.[property.key] ?? [])])],
            description: property.json.description ?? '',
            shape: property.shape,
            schema: property.schema,
            required: js.defaultOf(property.json) === undefined && fallbackFor(property) === undefined,
            default: js.defaultOf(property.json)?.value,
        };
    });
    return { inputs, fields, positionals: [...(cli.positionals ?? [])].map(String) };
};
/**
 * What an input is worth when it was not written.
 *
 * This is the command line's policy rather than a fact about the operation: a
 * bool that is not passed is `false` and a list that is not repeated is empty,
 * so neither is ever demanded. Another target answers the same question its own
 * way — a tool call substitutes nothing at all — which is why the operation does
 * not answer it.
 *
 * A default the schema declares is not here: `bind` applies that for every
 * target before it asks. What is left is only this target's own standing in,
 * which is why this is `Policy.fallback` as it is written.
 */
export const fallbackFor = (property) => {
    if (property.shape.list)
        return { value: [] };
    if (property.shape.type === 'boolean')
        return { value: false };
    if (property.shape.optional || !property.required)
        return { value: undefined };
    return undefined;
};
// ---------------- Labels ---------------------------------------------------
/** The command line's names for the JSON types, so help reads as a terminal does. */
const LABEL = {
    string: 'string',
    number: 'num',
    integer: 'int',
    boolean: 'bool',
    null: 'null',
    object: 'json',
    unknown: 'value',
};
const base = (shape) => (shape.values === undefined ? LABEL[shape.type] : shape.values.join('|'));
/** Type as help writes it: `num`, `string[]`, `string?`, `fast|safe`. */
export const typeLabel = (shape) => `${base(shape)}${shape.list ? '[]' : ''}${shape.optional ? '?' : ''}`;
/** The label inside a flag's angle brackets: `<fast|safe>`, `<string...>`. */
export const valueLabel = (shape) => `${base(shape)}${shape.list ? '...' : ''}`;
// ---------------- Meta -----------------------------------------------------
export const fieldMeta = (schema) => meta.of(schema, 'cli') ?? {};
export const operationMeta = (op) => meta.of(op, 'cli') ?? {};
//# sourceMappingURL=fields.js.map