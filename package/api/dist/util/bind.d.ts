import type { Schema } from '../types.ts';
import { type Issue, type Property, type Reading } from './schema.ts';
/**
 * Binding a call's values onto an operation's inputs.
 *
 * Precedence is the same everywhere and is settled here: what the caller
 * supplied, then the default the schema declares, then whatever the target
 * stands in with, then nothing — and nothing is what makes an input required.
 *
 * What is left to a target is only what it substitutes for an absence, and how
 * it words a refusal. So refusals come back as data rather than as a thrown
 * message: a command line names a missing input by how it could have been
 * written (`<title>` or `--title`) and stops at the first one, while a tool call
 * names it plainly and wants every problem at once so a model can fix them in a
 * single turn. One sentence cannot serve both.
 */
/**
 * An object schema read once, so binding a call does not read it again.
 *
 * `properties` re-emits the JSON Schema document on every call — for a native
 * object that means re-serialising every field. A command line pays that once
 * per process; a server would pay it on every tool call.
 */
export interface Inputs {
    schema: Schema;
    /** Its properties, in the order the document lists them. */
    properties: Property[];
    /** Its fields validate on their own; otherwise the object validates as a whole. */
    own: boolean;
}
export declare const inputs: (schema: Schema) => Inputs;
export interface Policy {
    /** How this target's values arrive. Defaults to `'typed'`. */
    reading?: Reading;
    /**
     * A stand-in when nothing was supplied and the schema declares no default.
     *
     * Returning `undefined` leaves the input unbound, which is what makes it
     * required. Returning `{ value: undefined }` binds the key to `undefined`,
     * which is not the same thing — a handler can tell `'note' in input` apart
     * from a missing argument.
     */
    fallback?: (property: Property) => {
        value: unknown;
    } | undefined;
    /** A key that is not an input. Refused unless a target says otherwise. */
    unknown?: 'reject' | 'ignore';
}
/** Why one input could not be bound. What it *reads like* is the target's business. */
export type Problem = {
    kind: 'missing';
    key: string;
} | {
    kind: 'unknown';
    key: string;
}
/** `expected` when it was the wrong shape, `issue` when the schema that declared it refused it. */
 | {
    kind: 'invalid';
    key: string;
    path: string;
    expected?: string;
    issue?: Issue;
};
export type Result = {
    ok: true;
    value: Record<string, unknown>;
}
/** Every problem at once, and the keys that were expected, so a target need not walk them again. */
 | {
    ok: false;
    problems: Problem[];
    expected: string[];
};
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
export declare const to: (to: Schema | Inputs, given: Record<string, unknown>, policy?: Policy) => Promise<Result>;
//# sourceMappingURL=bind.d.ts.map