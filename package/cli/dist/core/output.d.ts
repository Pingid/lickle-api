import type { Operation } from '@lickle/api';
export declare const FORMATS: readonly ['text', 'json'];
export type Format = (typeof FORMATS)[number];
export declare const isFormat: (v: string) => v is Format;
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
export declare const rendererFor: (out: Operation.Output | undefined, format: Format) => ((value: unknown) => string);
/** Render a single value as text, against the field order its schema declares. */
export declare const render: (value: unknown, out: Operation.Output | undefined, format: Format) => string;
/** Render a thrown value as the CLI's error output, honouring the chosen format. */
export declare const renderError: (err: unknown, format: Format) => string;
//# sourceMappingURL=output.d.ts.map