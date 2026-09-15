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
export declare const bindArgs: (inputs: bind.Inputs, args?: Record<string, unknown>) => Promise<Record<string, unknown>>;
//# sourceMappingURL=args.d.ts.map