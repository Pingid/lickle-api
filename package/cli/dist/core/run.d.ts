import { type Namespace, type Api } from '@lickle/api';
export interface RunOpts {
    /** Program name used in usage lines. Defaults to the root node's own name. */
    name?: string;
    stdout?: (s: string) => void;
    stderr?: (s: string) => void;
}
type RunContext<T extends Api.Program> = Namespace.Cx<T> extends void ? [(RunOpts & {
    context?: Namespace.Cx<T>;
})?] : [RunOpts & {
    context: Namespace.Cx<T>;
}];
/** Exit codes: `0` success, `1` the command failed, `2` the invocation was wrong. */
export declare const EXIT: {
    readonly ok: 0;
    readonly failed: 1;
    readonly usage: 2;
};
/**
 * Run a program against `argv` (without the `node script` prefix).
 *
 * Resolves the command path, parses the remaining arguments against the
 * operation it reached, invokes it, and prints what comes back as text or JSON.
 * Never terminates the process — it returns the exit code for the caller to act
 * on:
 *
 * ```ts
 * process.exit(await run(cmds, process.argv.slice(2)))
 * ```
 */
export declare const run: <T extends Api.Program>(program: T, argv: string[], ...args: RunContext<T>) => Promise<number>;
export {};
//# sourceMappingURL=run.d.ts.map