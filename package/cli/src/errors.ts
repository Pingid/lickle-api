import { InputError } from '@lickle/api'

/**
 * A user-facing failure: a bad flag, a missing argument, an unknown command.
 *
 * Extends core's `InputError`, so a command that throws the portable one is
 * treated exactly the same way here — and the same throw becomes `isError: true`
 * over MCP and a `400` over HTTP.
 *
 * The exit code defaults to `2`, the conventional "usage error" status, which
 * keeps it distinguishable from a command that ran and failed (`1`). There is no
 * `usagePath`: the runner knows the command path it resolved and uses that,
 * rather than reaching into a thrown value to decorate it.
 */
export class CliError extends InputError {
  readonly exitCode: number

  constructor(message: string, opts: { exitCode?: number } = {}) {
    super(message)
    this.name = 'CliError'
    this.exitCode = opts.exitCode ?? 2
  }
}
