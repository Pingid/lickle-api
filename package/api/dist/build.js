import { apiAs, } from './types.js';
import * as reg from './register.js';
export const op = (schema) => {
    const s = schema;
    Object.defineProperty(s, 'meta', {
        enumerable: false,
        value: (k, ...args) => (reg.update(s, { meta: { [k]: args } }), s),
    });
    return s;
};
export const ns = (schema) => {
    const s = { name: schema.name, operations: schema.operations.map((x) => apiAs(x)) };
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
const VENDOR = '@lickle/api';
const _type = (tt, json = tt) => {
    const t = tt;
    const js = (opts) => {
        const m = reg.get(t);
        return { description: m.description, default: m.default, ...(typeof json === 'function' ? json(opts, m) : json) };
    };
    const props = {
        version: 1,
        vendor: VENDOR,
        jsonSchema: { input: js, output: js },
    };
    Object.defineProperty(t, '~standard', { value: props, enumerable: false });
    Object.defineProperty(t, 'default', { value: (d) => (reg.update(t, { default: d }), t) });
    Object.defineProperty(t, 'describe', { value: (d) => (reg.update(t, { description: d }), t) });
    Object.defineProperty(t, 'meta', { value: (k, c) => (reg.update(t, { meta: { [k]: c } }), t) });
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
export const array = (p, description) => _type({ type: 'array', items: _type(p), description }, (opts) => ({
    type: 'array',
    items: p['~standard'].jsonSchema.output(opts),
    description,
}));
export const set = (p, description) => _type({ type: 'enum', enum: p, description }, { type: 'string', enum: p, description });
export const union = (p, description) => _type({ type: 'union', oneOf: p }, (opts) => ({
    oneOf: p.map((s) => s['~standard'].jsonSchema.output(opts)),
    description,
}));
export const object = (p, description) => _type({ type: 'object', properties: p, description }, (opts) => ({
    type: 'object',
    properties: Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v['~standard'].jsonSchema.output(opts)])),
    required: Object.entries(p)
        .filter(([_, v]) => v.optional)
        .map(([k]) => k),
    description,
}));
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