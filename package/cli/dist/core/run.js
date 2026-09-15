import { isInputError } from '@lickle/api';
import { findChild, is, api } from '@lickle/api/util';
import { CliError } from './errors.js';
import { namespaceHelp, operationHelp } from './help.js';
import { parseArgs, parseGlobals, peekFormat } from './parse.js';
import { renderError, rendererFor } from './output.js';
/** Exit codes: `0` success, `1` the command failed, `2` the invocation was wrong. */
export const EXIT = { ok: 0, failed: 1, usage: 2 };
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
export const run = async (program, argv, ...args) => {
    const [opts] = args;
    const stdout = opts?.stdout ?? ((s) => void process.stdout.write(s));
    const stderr = opts?.stderr ?? ((s) => void process.stderr.write(s));
    const root = api.of(program);
    // The path is tracked here and grows as `resolve` descends, so an error raised
    // on the way down is reported against the path reached so far — without
    // anything reaching into a thrown value to staple a field onto it.
    const path = [opts?.name ?? root.name];
    // Read the format up front so a failure before or during parsing is still
    // reported the way the caller asked for.
    let format = peekFormat(argv);
    try {
        const { target, rest } = resolve(root, argv, path);
        if (!is.operation(target)) {
            const parsed = parseGlobals(rest);
            format = parsed.output;
            const help = namespaceHelp(target, path) + '\n';
            // Landing on a namespace without naming a command is a usage error, but
            // asking for its help is not.
            if (parsed.help) {
                stdout(help);
                return EXIT.ok;
            }
            stderr(help);
            return EXIT.usage;
        }
        const parsed = await parseArgs(target, rest);
        format = parsed.output;
        if (parsed.help) {
            stdout(operationHelp(target, path) + '\n');
            return EXIT.ok;
        }
        const render = rendererFor(target.out, format);
        const write = (value) => {
            const line = render(value);
            if (line !== '')
                stdout(line + '\n');
        };
        // An operation that declares `async-iter` hands back items as it produces
        // them, and they are printed as they arrive rather than collected first.
        const result = target.handle(parsed.inputs, opts?.context);
        if (is.stream(result))
            for await (const item of result)
                write(item);
        else
            write(await result);
        return EXIT.ok;
    }
    catch (e) {
        stderr(renderError(e, format) + '\n');
        if (isInputError(e)) {
            if (format === 'text')
                stderr(`Try '${path.join(' ')} --help' for more information.\n`);
            return e instanceof CliError ? e.exitCode : EXIT.usage;
        }
        return EXIT.failed;
    }
};
/**
 * Walk leading argv segments down the tree until an operation is reached,
 * pushing each matched segment onto `path`.
 */
const resolve = (root, argv, path) => {
    let target = root;
    let i = 0;
    while (!is.operation(target) && i < argv.length) {
        const segment = argv[i];
        if (segment.startsWith('-'))
            break;
        const child = findChild(target, segment);
        if (child === undefined)
            throw new CliError(`unknown command '${segment}'`);
        i++;
        path.push(segment);
        target = child;
    }
    return { target, rest: argv.slice(i) };
};
//# sourceMappingURL=run.js.map