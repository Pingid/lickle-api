import { bind } from '@lickle/api/util';
import { CliError } from './errors.js';
import { fallbackFor, inputsOf } from './fields.js';
import { isFormat } from './output.js';
import { tokenise } from './tokenise.js';
/** Flags every command answers to, whatever its operation declares. */
export const RESERVED = ['help', 'h', 'output', 'o'];
const isHelp = (name) => name === 'help' || name === 'h';
const isOutput = (name) => name === 'output' || name === 'o';
/**
 * Read `--output`/`-o` out of a raw argv, knowing nothing else about it.
 *
 * Parsing can fail before it reaches the output flag — or before a command is
 * even resolved — so the runner peeks first to report those failures in the
 * format that was asked for. It runs the same grammar as `parseArgs` with only
 * the reserved flags declared, so the two cannot disagree about what was
 * written: `-vo json` reads as `json` here exactly as it does there.
 */
export const peekFormat = (argv) => {
    let format = 'text';
    for (const { name, value } of tokenise(argv, isOutput))
        if (name !== undefined && isOutput(name) && typeof value === 'string' && isFormat(value))
            format = value;
    return format;
};
/**
 * Parse the flags a namespace answers to.
 *
 * A namespace declares no inputs, so the reserved flags are all there is — and
 * anything else written against it is a mistake worth naming. A leftover word
 * cannot reach here: resolution stops at the first segment that is not a child,
 * and reports that as an unknown command.
 */
export const parseGlobals = (argv) => {
    const parsed = { inputs: {}, help: false, output: 'text' };
    for (const { name, display, value } of tokenise(argv, isOutput)) {
        if (name === undefined)
            throw new CliError(`unknown command '${String(value)}'`);
        if (isHelp(name))
            parsed.help = true;
        else if (isOutput(name))
            parsed.output = asFormat(display, value);
        else
            throw new CliError(`unknown option '${display}'`);
    }
    return parsed;
};
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
export const parseArgs = async (op, argv) => {
    const inputs = inputsOf(op);
    assertUsable(op, inputs);
    const byName = new Map();
    for (const field of inputs.fields)
        for (const name of field.names)
            byName.set(name, field);
    const isBool = (field) => field.shape.type === 'boolean';
    const takesValue = (name) => {
        if (isHelp(name))
            return false;
        if (isOutput(name))
            return true;
        const field = byName.get(name);
        return field !== undefined && !isBool(field);
    };
    /** Words written for each input, in the order they were written. */
    const written = new Map();
    const record = (key, display, value) => {
        const got = written.get(key) ?? { display, values: [] };
        got.display = display;
        got.values.push(value);
        written.set(key, got);
    };
    const positionalArgs = [];
    let help = false;
    let output = 'text';
    for (const { name, display, value } of tokenise(argv, takesValue)) {
        if (name === undefined) {
            positionalArgs.push(value);
            continue;
        }
        if (isHelp(name)) {
            help = true;
            continue;
        }
        if (isOutput(name)) {
            output = asFormat(display, value);
            continue;
        }
        // `--no-verbose` clears a bool without taking a value.
        const negated = byName.has(name) ? undefined : negatedOf(name, byName, isBool);
        if (negated !== undefined) {
            record(negated.key, display, 'false');
            continue;
        }
        const field = byName.get(name);
        if (field === undefined)
            throw new CliError(`unknown option '${display}'`);
        if (value === true && !isBool(field))
            throw new CliError(`option '${display}' requires a value`);
        record(field.key, display, value);
    }
    if (help)
        return { inputs: {}, help, output };
    bindPositionals(op, inputs, positionalArgs, written, record);
    // What was written, and nothing more. Turning a word into a value, applying
    // defaults and asking the schema are all the same everywhere, so `bind` does
    // them; `reading: 'text'` is the whole of what makes this target's values
    // different from a tool call's.
    const given = {};
    for (const field of inputs.fields) {
        const got = written.get(field.key);
        if (got !== undefined)
            given[field.key] = field.shape.list ? got.values : got.values[got.values.length - 1];
    }
    const bound = await bind.to(inputs.inputs, given, { reading: 'text', fallback: fallbackFor });
    if (!bound.ok)
        throw new CliError(bound.problems.map((p) => say(p, inputs, written)).join('; '));
    return { inputs: bound.value, help, output };
};
/**
 * A problem, worded the way a command line words it.
 *
 * All of it turns on how the input could have been written: a missing one is an
 * argument or an option depending on where it was placed, and a bad value is
 * named by the spelling that was actually typed — `-t`, not `--tag` — which is
 * why this reads the written map rather than the key.
 */
const say = (problem, inputs, written) => {
    const { key } = problem;
    const display = written.get(key)?.display ?? `--${key}`;
    switch (problem.kind) {
        case 'missing':
            return inputs.positionals.includes(key)
                ? `missing required argument '<${key}>'`
                : `missing required option '--${key}'`;
        case 'unknown':
            return `unknown option '--${key}'`;
        case 'invalid': {
            if (problem.expected === undefined)
                return `invalid value for '${display}': ${problem.issue?.message ?? ''}`;
            const raw = wordFor(written.get(key), problem.path);
            const was = raw === undefined ? '' : `'${raw}' `;
            return `invalid value for '${display}': ${was}(expected ${problem.expected})`;
        }
    }
};
/** The word behind a refusal: the last one written, or the one at that index in a list. */
const wordFor = (got, path) => {
    if (got === undefined)
        return undefined;
    const word = path === '' ? got.values[got.values.length - 1] : got.values[Number(path)];
    return typeof word === 'string' ? word : undefined;
};
/** The input behind `--no-x`, when `x` is a bool flag. */
const negatedOf = (name, byName, isBool) => {
    if (!name.startsWith('no-'))
        return undefined;
    const field = byName.get(name.slice(3));
    return field !== undefined && isBool(field) ? field : undefined;
};
/** Bind leftover positional arguments to the inputs named by `meta.cli`. */
const bindPositionals = (op, inputs, args, written, record) => {
    let p = 0;
    for (const [index, key] of inputs.positionals.entries()) {
        const field = inputs.fields.find((f) => f.key === key);
        if (field === undefined)
            throw new Error(`operation '${op.name}': positional '${key}' is not an input`);
        const last = index === inputs.positionals.length - 1;
        if (field.shape.list && !last)
            throw new Error(`operation '${op.name}': positional '${key}' is a list, so it has to be the last one`);
        // The last positional, when it is a list, takes everything left over.
        if (last && field.shape.list) {
            for (; p < args.length; p++)
                record(key, `<${key}>`, args[p]);
            continue;
        }
        if (p < args.length) {
            if (written.has(key))
                throw new CliError(`'${key}' was given both as an option and as an argument`);
            record(key, `<${key}>`, args[p]);
            p++;
        }
    }
    if (p < args.length)
        throw new CliError(`unexpected argument '${args[p]}'`);
};
const asFormat = (display, value) => {
    if (value === true)
        throw new CliError(`option '${display}' requires a value`);
    if (!isFormat(value))
        throw new CliError(`invalid value for '${display}': '${value}' (expected 'text' or 'json')`);
    return value;
};
/**
 * An operation whose inputs collide with the flags every command answers to
 * cannot be run here. That is the author's mistake, not the caller's, so it is a
 * plain error rather than a usage one.
 */
const assertUsable = (op, inputs) => {
    for (const field of inputs.fields)
        for (const name of field.names)
            if (RESERVED.includes(name))
                throw new Error(`operation '${op.name}': input '${field.key}' uses reserved flag name '${name}'`);
};
//# sourceMappingURL=parse.js.map