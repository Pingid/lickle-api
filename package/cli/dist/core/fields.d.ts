import type { Operation, Schema } from '@lickle/api';
import { bind, schema as js } from '@lickle/api/util';
import type { FieldMeta, OpMeta } from '../meta.ts';
/**
 * An operation's inputs, as the command line sees them.
 *
 * Everything structural — what a written word should become, whether it repeats,
 * whether it may be left out — is read off the JSON Schema by `@lickle/api/util`
 * and is the same for every target. What is here is only what a command line
 * adds: the spellings a flag answers to, what it is worth when nobody writes it,
 * and the names a terminal uses for the types.
 */
/** One input, as a flag. */
export interface Field {
    key: string;
    /** Every spelling that reaches it, `key` first and without dashes. */
    names: string[];
    description: string;
    shape: js.Shape;
    /** Its own schema, when the operation's input exposes its fields. */
    schema?: Schema;
    /** It has to be written: the document requires it and nothing stands in for it. */
    required: boolean;
    /** The default the schema itself declares, which help shows. */
    default?: unknown;
}
export interface Inputs {
    /** The input schema read once, so binding a call does not read it again. */
    inputs: bind.Inputs;
    fields: Field[];
    /** Which inputs may be written by position, in order. */
    positionals: string[];
}
/** Read an operation's inputs the way the command line needs them. */
export declare const inputsOf: (op: Operation.Any) => Inputs;
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
export declare const fallbackFor: (property: js.Property) => {
    value: unknown;
} | undefined;
/** Type as help writes it: `num`, `string[]`, `string?`, `fast|safe`. */
export declare const typeLabel: (shape: js.Shape) => string;
/** The label inside a flag's angle brackets: `<fast|safe>`, `<string...>`. */
export declare const valueLabel: (shape: js.Shape) => string;
export declare const fieldMeta: (schema: Schema) => FieldMeta;
export declare const operationMeta: (op: Operation.Any) => OpMeta<Operation.Any>;
//# sourceMappingURL=fields.d.ts.map