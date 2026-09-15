import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Schema } from '../types.ts';
/** The JSON Schema keywords these helpers read. The rest of a document is ignored. */
export interface Json {
    type?: string | string[];
    description?: string;
    default?: unknown;
    enum?: unknown[];
    items?: Json;
    properties?: Record<string, Json>;
    required?: string[];
    oneOf?: Json[];
    anyOf?: Json[];
}
/** The JSON Schema a type emits for the values it produces. */
export declare const json: (schema: Schema, target?: string) => Json;
export type Scalar = 'string' | 'number' | 'integer' | 'boolean' | 'null' | 'object' | 'unknown';
/** What a schema amounts to once unions and lists are unwrapped. */
export interface Shape {
    /** What a written value should become. For a list, what one element should become. */
    type: Scalar;
    /** It holds many of them. */
    list: boolean;
    /** A branch of it accepts nothing, so it may be left out. */
    optional: boolean;
    /** Its members, when it is a closed set. */
    values?: (string | number)[];
    /** The element schema, when it is a list. */
    items?: Json;
}
/** Whether a schema describes the absence of a value rather than one. */
export declare const isNothing: (json: Json) => boolean;
/**
 * Reduce a schema to what a target needs to know about it.
 *
 * Unions are read one level deep — `string | undefined` is a string that may be
 * omitted — which covers what `optional` produces without pretending that a
 * text-carrying target can offer a choice between two shapes.
 */
export declare const shape: (json: Json) => Shape;
/** The default the document declares, if any. Declaring no default is not the same as defaulting to `undefined`. */
export declare const defaultOf: (json: Json) => {
    value: unknown;
} | undefined;
/** One property of an object schema, with whatever that schema exposes of it. */
export interface Property {
    key: string;
    json: Json;
    shape: Shape;
    /** Its own type, when the object exposes its fields. */
    schema?: Schema;
    /** The document lists it as required. What to do about that is the target's call. */
    required: boolean;
}
/**
 * The field types an object exposes, or `undefined` when it does not.
 *
 * An object built here hands its fields over as types, so each can be described,
 * configured and validated on its own. A foreign object — a zod one, say —
 * describes its fields in JSON Schema but keeps them to itself, so it validates
 * as a whole or not at all. Which of the two a target has is the difference
 * between per-field and whole-object handling, and this is how it finds out.
 */
export declare const own: (schema: Schema) => Record<string, Schema> | undefined;
/** Every property of an object schema, in the order the document lists them. */
export declare const properties: (schema: Schema) => Property[];
export type Parsed = {
    ok: true;
    value: unknown;
} | {
    ok: false;
    expected: string;
};
/**
 * Turn one written value into what its schema describes.
 *
 * Every target that receives text — argv, a workflow input, an environment
 * variable — has to do this, and a validator cannot do it for them. A list's
 * shape carries its element type, so one written value parses to one element and
 * collecting the repeats is the caller's job.
 */
export declare const parse: (raw: string, shape: Shape) => Parsed;
export type Issue = StandardSchemaV1.Issue;
export type Checked = {
    ok: true;
    value: unknown;
} | {
    ok: false;
    issues: readonly Issue[];
};
/**
 * Hand a value to the schema that declared it, when that schema validates.
 *
 * Core's own types describe shape and do not validate, so a schema without a
 * validator passes its value through: this is where an outside library's
 * constraints — an email, a minimum — get their say, and nowhere else.
 */
export declare const validate: (schema: Schema | undefined, value: unknown) => Promise<Checked>;
/** Where an issue happened, as a dotted path. Empty when it is about the value as a whole. */
export declare const issuePath: (issue: Issue) => string;
/** How a target's values arrive, which decides whether text is converted or refused. */
export type Reading = 'text' | 'typed';
/** Why a value is not what its schema describes, and where inside it. */
export type Conformed = {
    ok: true;
    value: unknown;
} | {
    ok: false;
    expected: string;
    path: string;
};
export type Accepted = Conformed | {
    ok: false;
    issues: readonly Issue[];
};
/**
 * Does this already-typed value match the shape its schema describes?
 *
 * The JSON Schema is the floor. It is the half of a type that is always there —
 * a validator is optional — so it is what makes an operation's declared output
 * type true for a type that carries no validator of its own. Nothing is
 * converted here: `'2'` is not a number.
 */
export declare const conform: (value: unknown, shape: Shape) => Conformed;
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
export declare const accept: (value: unknown, property: Pick<Property, 'shape' | 'schema'>, reading: Reading) => Promise<Accepted>;
//# sourceMappingURL=schema.d.ts.map