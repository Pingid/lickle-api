export interface Token {
    /** Flag name as written, without dashes. Absent for a positional argument. */
    name?: string;
    /** How it was written, for messages: `--tag`, `-t`. */
    display: string;
    /** The value given, or `true` for a flag written without one. */
    value: string | true;
}
/**
 * Split an argv into flags and positionals.
 *
 * Purely syntactic, and it never throws: it reports what was written and leaves
 * every judgement to the caller. The only thing the grammar needs to know about
 * the operation is which flags consume the next word, which arrives as
 * `takesValue` — so the runner can run this same grammar over a raw argv
 * knowing only the reserved flags and get the same answer the real parse will.
 * One grammar, one implementation.
 *
 * Supports `--name value`, `--name=value`, `-n value`, `-n=value`, grouped short
 * flags (`-abc`), and `--` to end flag parsing. `--no-name` comes back as a flag
 * named `no-name`; resolving that against the operation is the caller's job.
 */
export declare const tokenise: (argv: string[], takesValue: (name: string) => boolean) => Token[];
//# sourceMappingURL=tokenise.d.ts.map