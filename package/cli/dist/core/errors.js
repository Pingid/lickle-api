import { InputError } from '@lickle/api';
/**
 * A user-facing failure: a bad flag, a missing argument, an unknown command.
 *
 * The exit code defaults to `2`, the conventional "usage error" status, which
 * keeps it distinguishable from a command that ran and failed (`1`). There is no
 * path on it: the runner knows the command path it resolved and reports against
 * that, rather than reaching into a thrown value to staple a field onto it.
 *
 * It extends core's `InputError`, so a handler that throws the portable one —
 * written for no target in particular — is treated here exactly the same way,
 * and gets the same exit code as a bad flag rather than being mistaken for the
 * command itself failing.
 */
export class CliError extends InputError {
    exitCode;
    constructor(message, opts = {}) {
        super(message);
        this.name = 'CliError';
        this.exitCode = opts.exitCode ?? 2;
    }
}
//# sourceMappingURL=errors.js.map