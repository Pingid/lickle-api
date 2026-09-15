/**
 * Reading a type the way a target has to read it.
 *
 * A type is a Standard Schema, which is validate-only: it can reject `'3'` for a
 * number, but it cannot say that a value may repeat, may be left out, or has a
 * closed set of members — and it cannot turn `'3'` into `3`. The JSON Schema a
 * type emits says all of that, and says it the same way for a type built here as
 * for one from zod or valibot. So a target reads structure from the document and
 * keeps only its own policy.
 *
 * Nothing here knows what a flag, a tool or a workflow input is. What a target
 * substitutes for an absent value, and how it words a rejection, is the target's
 * own business — which is why a rejection names what was expected and stops
 * short of writing the sentence.
 */
const TARGET = 'draft-07';
/** The JSON Schema a type emits for the values it produces. */
export const json = (schema, target = TARGET) => schema['~standard'].jsonSchema.output({ target });
/** Types that stand for the absence of a value: core's `void` and `undefined`. */
const NOTHING = ['undefined', 'void', 'never'];
const types = (json) => json.type === undefined ? [] : Array.isArray(json.type) ? json.type : [json.type];
/** Whether a schema describes the absence of a value rather than one. */
export const isNothing = (json) => types(json).some((t) => NOTHING.includes(t));
/**
 * Reduce a schema to what a target needs to know about it.
 *
 * Unions are read one level deep — `string | undefined` is a string that may be
 * omitted — which covers what `optional` produces without pretending that a
 * text-carrying target can offer a choice between two shapes.
 */
export const shape = (json) => {
    const branches = json.oneOf ?? json.anyOf ?? [json];
    const chosen = branches.find((b) => !isNothing(b)) ?? {};
    const list = types(chosen).includes('array');
    const leaf = list ? (chosen.items ?? {}) : chosen;
    return { type: scalar(leaf), list, optional: branches.some(isNothing), values: values(leaf), items: chosen.items };
};
const SCALARS = ['string', 'number', 'integer', 'boolean', 'null', 'object'];
const scalar = (json) => {
    const named = types(json).find((t) => SCALARS.includes(t));
    if (named !== undefined)
        return named;
    const members = values(json);
    if (members !== undefined)
        return typeof members[0] === 'number' ? 'number' : 'string';
    return 'unknown';
};
const values = (json) => {
    const members = json.enum?.filter((v) => typeof v === 'string' || typeof v === 'number');
    return members === undefined || members.length === 0 ? undefined : members;
};
/** The default the document declares, if any. Declaring no default is not the same as defaulting to `undefined`. */
export const defaultOf = (json) => {
    if (json.default !== undefined)
        return { value: json.default };
    for (const branch of json.oneOf ?? json.anyOf ?? [])
        if (branch.default !== undefined)
            return { value: branch.default };
    return undefined;
};
/**
 * The field types an object exposes, or `undefined` when it does not.
 *
 * An object built here hands its fields over as types, so each can be described,
 * configured and validated on its own. A foreign object — a zod one, say —
 * describes its fields in JSON Schema but keeps them to itself, so it validates
 * as a whole or not at all. Which of the two a target has is the difference
 * between per-field and whole-object handling, and this is how it finds out.
 */
export const own = (schema) => {
    const properties = schema.properties;
    return typeof properties === 'object' && properties !== null ? properties : undefined;
};
/** Every property of an object schema, in the order the document lists them. */
export const properties = (schema) => {
    const doc = json(schema);
    const fields = own(schema);
    const required = new Set(doc.required ?? []);
    return Object.entries(doc.properties ?? {}).map(([key, property]) => ({
        key,
        json: property,
        shape: shape(property),
        schema: fields?.[key],
        required: required.has(key),
    }));
};
const BOOLS = {
    true: true,
    false: false,
    yes: true,
    no: false,
    '1': true,
    '0': false,
};
/**
 * Turn one written value into what its schema describes.
 *
 * Every target that receives text — argv, a workflow input, an environment
 * variable — has to do this, and a validator cannot do it for them. A list's
 * shape carries its element type, so one written value parses to one element and
 * collecting the repeats is the caller's job.
 */
export const parse = (raw, shape) => {
    switch (shape.type) {
        case 'string':
            return member(raw, shape);
        case 'number':
        case 'integer': {
            const n = Number(raw);
            const expected = shape.type === 'integer' ? 'an integer' : 'a number';
            if (raw.trim() === '' || Number.isNaN(n))
                return { ok: false, expected };
            if (shape.type === 'integer' && !Number.isInteger(n))
                return { ok: false, expected };
            return member(n, shape);
        }
        case 'boolean': {
            const b = BOOLS[raw.toLowerCase()];
            return b === undefined ? { ok: false, expected: `'true' or 'false'` } : { ok: true, value: b };
        }
        case 'null':
            return { ok: true, value: null };
        case 'object':
            try {
                return { ok: true, value: JSON.parse(raw) };
            }
            catch {
                return { ok: false, expected: 'JSON' };
            }
        case 'unknown':
            return { ok: true, value: raw };
    }
};
const member = (value, shape) => shape.values === undefined || shape.values.includes(value)
    ? { ok: true, value }
    : { ok: false, expected: oneOf(shape.values) };
/** `'a', 'b' or 'c'` — the way a sentence lists alternatives. */
const oneOf = (values) => {
    const quoted = values.map((v) => (typeof v === 'string' ? `'${v}'` : String(v)));
    const last = quoted[quoted.length - 1] ?? '';
    return quoted.length < 2 ? last : `${quoted.slice(0, -1).join(', ')} or ${last}`;
};
/**
 * Hand a value to the schema that declared it, when that schema validates.
 *
 * Core's own types describe shape and do not validate, so a schema without a
 * validator passes its value through: this is where an outside library's
 * constraints — an email, a minimum — get their say, and nowhere else.
 */
export const validate = async (schema, value) => {
    const check = schema?.['~standard'].validate;
    if (check === undefined)
        return { ok: true, value };
    const result = await check(value);
    return result.issues === undefined ? { ok: true, value: result.value } : { ok: false, issues: result.issues };
};
/** Where an issue happened, as a dotted path. Empty when it is about the value as a whole. */
export const issuePath = (issue) => (issue.path ?? []).map((s) => String(typeof s === 'object' ? s.key : s)).join('.');
/**
 * Does this already-typed value match the shape its schema describes?
 *
 * The JSON Schema is the floor. It is the half of a type that is always there —
 * a validator is optional — so it is what makes an operation's declared output
 * type true for a type that carries no validator of its own. Nothing is
 * converted here: `'2'` is not a number.
 */
export const conform = (value, shape) => take(value, shape, 'typed');
/**
 * Take a value as its schema describes it: the floor first, then the refinement.
 *
 * 1. it already conforms to the shape — take it
 * 2. it was written as text and this target reads text — convert it, then conform
 * 3. otherwise refuse it, naming what was expected
 * 4. the schema validates — let it have the last word
 *
 * `reading` is a fact about the target rather than a setting: argv, an
 * environment variable and a workflow input all arrive as text and are
 * converted; a JSON-RPC argument and an HTTP body arrive already typed and are
 * not. So whether `'2'` is accepted for a number is answered once, by where the
 * value came from, and not by a leniency flag.
 *
 * A validator refines the floor: it can refuse more, never less, and it never
 * changes the type. A schema without one — every type this package builds — is
 * checked by the floor alone.
 */
export const accept = async (value, property, reading) => {
    const taken = take(value, property.shape, reading);
    if (!taken.ok)
        return taken;
    const checked = await validate(property.schema, taken.value);
    return checked.ok ? { ok: true, value: checked.value } : { ok: false, issues: checked.issues };
};
/** A list is taken element by element, so a refusal says which element. */
const take = (value, shape, reading) => {
    if (!shape.list)
        return one(value, shape, reading);
    if (!Array.isArray(value))
        return { ok: false, expected: 'a list', path: '' };
    const items = [];
    for (const [index, item] of value.entries()) {
        const taken = one(item, shape, reading);
        if (!taken.ok)
            return { ...taken, path: String(index) };
        items.push(taken.value);
    }
    return { ok: true, value: items };
};
const one = (value, shape, reading) => {
    const fits = leaf(value, shape);
    if (fits.ok || reading === 'typed' || typeof value !== 'string')
        return fits;
    return at(parse(value, shape));
};
/** The floor for a single value, as its JSON type. */
const leaf = (value, shape) => {
    switch (shape.type) {
        case 'string':
            return typeof value === 'string' ? at(member(value, shape)) : no('a string');
        case 'number':
        case 'integer': {
            const expected = shape.type === 'integer' ? 'an integer' : 'a number';
            if (typeof value !== 'number' || Number.isNaN(value))
                return no(expected);
            if (shape.type === 'integer' && !Number.isInteger(value))
                return no(expected);
            return at(member(value, shape));
        }
        case 'boolean':
            return typeof value === 'boolean' ? { ok: true, value } : no(`'true' or 'false'`);
        case 'null':
            return value === null ? { ok: true, value } : no('null');
        case 'object':
            return typeof value === 'object' && value !== null && !Array.isArray(value)
                ? { ok: true, value }
                : no('an object');
        case 'unknown':
            return { ok: true, value };
    }
};
const no = (expected) => ({ ok: false, expected, path: '' });
const at = (parsed) => (parsed.ok ? parsed : no(parsed.expected));
//# sourceMappingURL=schema.js.map