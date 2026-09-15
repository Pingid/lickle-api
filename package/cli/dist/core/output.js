import { schema as js } from '@lickle/api/util';
export const FORMATS = ['text', 'json'];
export const isFormat = (v) => FORMATS.includes(v);
/**
 * Build the renderer for one run.
 *
 * It is built once rather than called per value because an operation that
 * returns an async iterable renders each item as it arrives, and re-reading the
 * output schema for every item would be wasted work.
 *
 * `json` emits the value verbatim — one document per item, so a stream stays a
 * stream. `text` emits one `key: value` line per field, ordered by the schema so
 * output is stable regardless of insertion order, or the bare value when the
 * operation returns something that is not a record. An operation that returns
 * nothing renders to the empty string, which the runner prints as nothing at all.
 */
export const rendererFor = (out, format) => {
    if (format === 'json')
        return (value) => (value === undefined ? '' : JSON.stringify(value, null, 2));
    const keys = out === undefined ? [] : Object.keys(js.json(out).properties ?? {});
    return (value) => text(value, keys);
};
/** Render a single value as text, against the field order its schema declares. */
export const render = (value, out, format) => rendererFor(out, format)(value);
const text = (value, keys) => {
    if (value === undefined || value === null)
        return '';
    if (Array.isArray(value))
        return value.map(scalar).join('\n');
    if (typeof value !== 'object')
        return String(value);
    const record = value;
    const ordered = [...new Set([...keys, ...Object.keys(record)])].filter((k) => record[k] !== undefined);
    const width = Math.max(0, ...ordered.filter((k) => !Array.isArray(record[k])).map((k) => k.length));
    const lines = [];
    for (const key of ordered) {
        const v = record[key];
        if (Array.isArray(v)) {
            lines.push(`${key}:`);
            for (const item of v)
                lines.push(`  - ${scalar(item)}`);
        }
        else {
            lines.push(`${`${key}:`.padEnd(width + 1)} ${scalar(v)}`);
        }
    }
    return lines.join('\n');
};
/** Render a thrown value as the CLI's error output, honouring the chosen format. */
export const renderError = (err, format) => {
    const message = err instanceof Error ? err.message : String(err);
    return format === 'json' ? JSON.stringify({ error: { message } }, null, 2) : `error: ${message}`;
};
const scalar = (v) => (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v));
//# sourceMappingURL=output.js.map