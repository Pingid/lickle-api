import { InputError } from '@lickle/api';
import { bind } from '@lickle/api/util';
/**
 * Turning a tool call's arguments into an operation's inputs.
 *
 * Two things make this different from a command line, and only two. A tool call
 * substitutes *nothing* for an argument it did not receive: a list that was not
 * sent is not empty, a bool that was not sent is not false, and only a default
 * the schema declares fills a gap — so no fallback is passed. And its values
 * arrive already typed, because JSON has types, so `reading: 'typed'` refuses a
 * string where a number was described rather than converting it.
 *
 * Everything else — precedence, defaults, validation — is the same as it is
 * everywhere, and is `bind`'s.
 */
export const bindArgs = async (inputs, args = {}) => {
    const bound = await bind.to(inputs, absent(args), { reading: 'typed' });
    if (bound.ok)
        return bound.value;
    throw new InputError(bound.problems.map((problem) => say(problem, bound.expected)).join('; '));
};
/**
 * A model writes `null` for "I am not sending this" constantly, and reading it
 * as a value would turn that into an error it has to recover from for nothing.
 * Core treats only `undefined` as absent, because `null` is a value where a
 * schema describes one; taking the lenient reading is this target's call.
 */
const absent = (args) => Object.fromEntries(Object.entries(args).filter(([, value]) => value !== null && value !== undefined));
/**
 * A problem, worded for a model.
 *
 * It is the model that reads this and tries again, so each one says what was
 * wrong and — where it helps — what would have been right. Naming the arguments
 * that exist is why an unknown one is worth reporting at all rather than
 * ignoring: it is usually a near-miss the model can correct on its own.
 */
const say = (problem, expected) => {
    const at = (key, path) => (path === '' ? key : `${key}.${path}`);
    switch (problem.kind) {
        case 'missing':
            return `missing required argument '${problem.key}'`;
        case 'unknown':
            return `unknown argument '${problem.key}'; expected ${list(expected)}`;
        case 'invalid':
            return problem.expected === undefined
                ? `invalid value for '${at(problem.key, problem.path)}': ${problem.issue?.message ?? ''}`
                : `invalid value for '${at(problem.key, problem.path)}': expected ${problem.expected}`;
    }
};
const list = (keys) => {
    if (keys.length === 0)
        return 'no arguments';
    const quoted = keys.map((key) => `'${key}'`);
    const last = quoted[quoted.length - 1];
    return quoted.length < 2 ? last : `${quoted.slice(0, -1).join(', ')} and ${last}`;
};
//# sourceMappingURL=args.js.map