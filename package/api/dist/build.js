import {} from './types.js';
import * as reg from './register.js';
import { api } from './util/index.js';
export const op = (schema) => {
    const s = schema;
    // `in` is usually written as the bare record of fields it describes; an
    // operation always carries a schema, so the record becomes one here rather
    // than at every site that reads it.
    s.in = s.in === undefined ? object({}) : '~standard' in s.in ? s.in : object(s.in);
    s.out = s.out ?? empty();
    Object.defineProperty(s, 'describe', { enumerable: false, value: (d) => ((s.description = d), s) });
    Object.defineProperty(s, 'meta', {
        enumerable: false,
        value: (k, ...args) => (reg.update(s, { meta: { [k]: args } }), s),
    });
    return api.as(s);
};
export const ns = (schema) => {
    const s = { ...schema, operations: schema.operations.map((x) => api.as(x)) };
    Object.defineProperty(s, 'describe', { enumerable: false, value: (d) => ((s.description = d), s) });
    Object.defineProperty(s, 'meta', {
        enumerable: false,
        value: (k, ...args) => (reg.update(s, { meta: { [k]: args } }), s),
    });
    return s;
};
export const output = (o, returns) => {
    if (!o)
        return empty();
    if (returns)
        Object.defineProperty(o, 'returns', { value: returns });
    return o;
};
const VENDOR = '@lickle/api-legacy';
const _type = (tt, json = tt) => {
    const t = tt;
    const js = (opts) => {
        const m = reg.get(t);
        // The type's own shape first, then whatever `describe`/`default` recorded
        // after it was built. An absent key is dropped rather than written as
        // `undefined`, so a bare type emits `{ type: 'string' }` and nothing else.
        const out = { ...(typeof json === 'function' ? json(opts, m) : json) };
        if (m.description !== undefined)
            out['description'] = m.description;
        if (m.default !== undefined)
            out['default'] = m.default;
        for (const k of Object.keys(out))
            if (out[k] === undefined)
                delete out[k];
        return out;
    };
    const props = {
        version: 1,
        vendor: VENDOR,
        jsonSchema: { input: js, output: js },
    };
    Object.defineProperty(t, '~standard', { value: props, enumerable: false });
    Object.defineProperty(t, 'default', { value: (d) => (reg.update(t, { default: d }), t) });
    Object.defineProperty(t, 'describe', { value: (d) => (reg.update(t, { description: d }), t) });
    Object.defineProperty(t, 'meta', {
        value: (k, ...args) => (reg.update(t, { meta: { [k]: args } }), t),
    });
    return t;
};
export const empty = (d) => _type({ type: 'void', description: d });
export const number = (d) => _type({ type: 'number', description: d });
export const string = (d) => _type({ type: 'string', description: d });
export const boolean = (d) => _type({ type: 'boolean', description: d });
export const unknown = (d) => _type({ type: 'unknown', description: d });
export const any = (d) => _type({ type: 'any', description: d });
export const nul = (d) => _type({ type: 'null', description: d });
export const undef = (d) => _type({ type: 'undefined', description: d });
export const array = (p, description) => _type({ type: 'array', items: p, description }, (opts) => ({
    type: 'array',
    items: p['~standard'].jsonSchema.output(opts),
    description,
}));
export const set = (p, description) => _type({ type: 'enum', enum: p, description }, { type: 'string', enum: p, description });
export const union = (p, description) => _type({ type: 'union', oneOf: p, description }, (opts) => ({
    oneOf: p.map((s) => s['~standard'].jsonSchema.output(opts)),
    description,
}));
export const object = (p, description) => _type({ type: 'object', properties: p, description }, (opts) => {
    const properties = Object.entries(p).map(([k, v]) => [k, v['~standard'].jsonSchema.output(opts)]);
    return {
        type: 'object',
        properties: Object.fromEntries(properties),
        // A field that declares a default need not be supplied: whoever is
        // reading this — a model deciding what to send, a form deciding what to
        // ask for — would otherwise be told to provide what it can leave out.
        required: properties.filter(([k, json]) => !p[k]?.optional && json['default'] === undefined).map(([k]) => k),
        description,
    };
});
export const optional = (t) => {
    Object.defineProperty(t, 'optional', { value: true });
    return t;
};
export const t = {
    void: empty(),
    empty,
    number,
    string,
    boolean,
    unknown,
    any,
    null: nul,
    undefined: undef,
    array,
    set,
    union,
    object,
    optional,
    output,
    op,
    ns,
};
//# sourceMappingURL=build.js.map