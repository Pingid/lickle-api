/**
 * A user-facing failure: a bad flag, a missing argument, an unknown command.
 *
 * The exit code defaults to `2`, the conventional "usage error" status, which
 * keeps it distinguishable from a command that ran and failed (`1`).
 */
export class CliError extends Error {
  readonly exitCode: number

  /** Command path to suggest `--help` for, filled in by the runner once known. */
  usagePath: string | undefined

  constructor(message: string, opts: { exitCode?: number; usagePath?: string } = {}) {
    super(message)
    this.name = 'CliError'
    this.exitCode = opts.exitCode ?? 2
    this.usagePath = opts.usagePath
  }
}

/** Attach a command path to a `CliError` raised before the path was known. */
export const withUsagePath = (e: unknown, usagePath: string): unknown => {
  if (e instanceof CliError && e.usagePath === undefined) e.usagePath = usagePath
  return e
}
