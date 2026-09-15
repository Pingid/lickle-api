import type { Operation } from '@lickle/api';
import { type Format } from './output.ts';
/** Flags every command answers to, whatever its operation declares. */
export declare const RESERVED: readonly ['help', 'h', 'output', 'o'];
export interface Parsed {
    /** Inputs coerced to the types the operation declares, with defaults applied. */
    inputs: Record<string, unknown>;
    /** `--help` / `-h` was given; the runner prints help instead of running. */
    help: boolean;
    /** `--output` / `-o`, defaulting to `text`. */
    output: Format;
}
/**
 * Read `--output`/`-o` out of a raw argv, knowing nothing else about it.
 *
 * Parsing can fail before it reaches the output flag — or before a command is
 * even resolved — so the runner peeks first to report those failures in the
 * format that was asked for. It runs the same grammar as `parseArgs` with only
 * the reserved flags declared, so the two cannot disagree about what was
 * written: `-vo json` reads as `json` here exactly as it does there.
 */
export declare const peekFormat: (argv: string[]) => Format;
/**
 * Parse the flags a namespace answers to.
 *
 * A namespace declares no inputs, so the reserved flags are all there is — and
 * anything else written against it is a mistake worth naming. A leftover word
 * cannot reach here: resolution stops at the first segment that is not a child,
 * and reports that as an unknown command.
 */
export declare const parseGlobals: (argv: string[]) => Parsed;
/**
 * Parse `argv` (already stripped of the command path) against an operation.
 *
 * Tokenising, coercing and validating stay separate: the grammar runs first and
 * produces raw words, the JSON Schema says what each word should become, and the
 * schema itself gets the last word when it has one. What is left as this
 * target's policy is only what it substitutes for an absent input and how it
 * names one it did not get.
 *
 * Asynchronous because an input's type may be any Standard Schema, and those may
 * validate asynchronously.
 *
 * When `--help` is present, parsing stops short of demanding required inputs —
 * asking for help should never be an error.
 */
export declare const parseArgs: (op: Operation.Any, argv: string[]) => Promise<Parsed>;
//# sourceMappingURL=parse.d.ts.map