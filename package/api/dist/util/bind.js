import { accept, defaultOf, issuePath, own, properties, validate, } from './schema.js';
export const inputs = (schema) => ({
    schema,
    properties: properties(schema),
    own: own(schema) !== undefined,
});
/**
 * Bind `given` onto an object schema's inputs.
 *
 * A supplied value goes through `accept`, so it is checked against the shape the
 * schema describes and then against the schema's own validator when it has one.
 * A default or a fallback does not: a bad declared default is the author's
 * mistake, and surfacing it as a caller-facing refusal would blame the wrong
 * person.
 *
 * `undefined` means absent. `null` is a value, and the floor refuses it where
 * the schema does not describe one — a target whose callers write `null` for
 * "not set" drops those keys before calling here, because that leniency is its
 * own and not every target's.
 */
export const to = async (to, given, policy = {}) => {
    const { schema, properties, own } = '~standard' in to ? inputs(to) : to;
    const reading = policy.reading ?? 'typed';
    const problems = [];
    const value = {};
    if (policy.unknown !== 'ignore') {
        const keys = new Set(properties.map((p) => p.key));
        for (const key of Object.keys(given))
            if (!keys.has(key))
                problems.push({ kind: 'unknown', key });
    }
    // Document order, so the bound record's keys come out in the order the
    // operation declares them rather than the order the caller wrote them.
    for (const property of properties) {
        const key = property.key;
        if (Object.hasOwn(given, key) && given[key] !== undefined) {
            const taken = await accept(given[key], property, reading);
            if (taken.ok)
                value[key] = taken.value;
            else if ('issues' in taken)
                for (const issue of taken.issues)
                    problems.push({ kind: 'invalid', key, path: issuePath(issue), issue });
            else
                problems.push({ kind: 'invalid', key, path: taken.path, expected: taken.expected });
            continue;
        }
        const stood = defaultOf(property.json) ?? policy.fallback?.(property);
        if (stood !== undefined)
            value[key] = stood.value;
        // The document already said this one need not be given, so it is left
        // unbound rather than missing — a target that would rather see the key
        // present says so by falling back to `{ value: undefined }`.
        else if (property.required)
            problems.push({ kind: 'missing', key });
    }
    const expected = properties.map((p) => p.key);
    if (problems.length > 0)
        return { ok: false, problems, expected };
    // A schema that does not hand its fields over validates once, at the end, with
    // each issue attributed to the input that carried it. Skipped when anything is
    // already wrong, or one mistake would be reported as two.
    if (own)
        return { ok: true, value };
    const checked = await validate(schema, value);
    if (checked.ok)
        return { ok: true, value: checked.value };
    return { ok: false, problems: checked.issues.map(attribute), expected };
};
/** An issue about the whole object, read as an issue about one of its inputs. */
const attribute = (issue) => {
    const [head, ...rest] = issue.path ?? [];
    const key = head === undefined ? '' : String(typeof head === 'object' ? head.key : head);
    return { kind: 'invalid', key, path: rest.map((s) => String(typeof s === 'object' ? s.key : s)).join('.'), issue };
};
//# sourceMappingURL=bind.js.map