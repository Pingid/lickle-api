import type { Cmd, Spec } from '@lickle/cmd-core'
import { CliError, withUsagePath } from './errors.ts'
import { cmdHelp, groupHelp } from './help.ts'
import { parseArgs, peekFormat } from './parse.ts'
import { render, renderError, type Format } from './output.ts'
import { findChild, isSubCmds, type SubCmds } from './spec.ts'

export interface RunOpts {
  /** Program name used in usage lines. Defaults to the root group's name. */
  name?: string
  stdout?: (s: string) => void
  stderr?: (s: string) => void
}

/** Exit codes: `0` success, `1` the command failed, `2` the invocation was wrong. */
export const EXIT = { ok: 0, failed: 1, usage: 2 } as const

/**
 * Run a command tree against `argv` (without the `node script` prefix).
 *
 * Resolves the command path, parses the remaining arguments against its spec,
 * invokes it, and prints its outputs as text or JSON. Never terminates the
 * process — it returns the exit code for the caller to act on:
 *
 * ```ts
 * process.exit(await run(cmds, process.argv.slice(2)))
 * ```
 */
export const run = async (cmds: SubCmds, argv: string[], opts: RunOpts = {}): Promise<number> => {
  const stdout = opts.stdout ?? ((s: string) => void process.stdout.write(s))
  const stderr = opts.stderr ?? ((s: string) => void process.stderr.write(s))
  // Read the format up front so failures before or during parsing are still
  // reported the way the caller asked for.
  let output: Format = peekFormat(argv)

  try {
    const { target, path, rest } = resolve(cmds, argv, [opts.name ?? cmds.name ?? 'cli'])
    const usagePath = path.join(' ')

    let parsed
    try {
      parsed = parseArgs(isSubCmds(target) ? groupSpec(target, path) : target.spec, rest)
    } catch (e) {
      throw withUsagePath(e, usagePath)
    }
    output = parsed.output

    if (isSubCmds(target)) {
      const help = groupHelp(target, path) + '\n'
      // Landing on a group without naming a command is a usage error, but
      // asking for its help is not.
      if (parsed.help) {
        stdout(help)
        return EXIT.ok
      }
      stderr(help)
      return EXIT.usage
    }

    if (parsed.help) {
      stdout(cmdHelp(target.spec, path) + '\n')
      return EXIT.ok
    }

    // `Cmd['run']` erases to a zero-argument signature because `Spec['inputs']`
    // is optional; the inputs are checked against the spec by `parseArgs`.
    const result = await (target.run as (i: Record<string, unknown>) => unknown)(parsed.inputs)
    const text = render(result, target.spec.outputs, output)
    if (text !== '') stdout(text + '\n')
    return EXIT.ok
  } catch (e) {
    stderr(renderError(e, output) + '\n')
    if (e instanceof CliError) {
      if (output === 'text' && e.usagePath !== undefined) stderr(`Try '${e.usagePath} --help' for more information.\n`)
      return e.exitCode
    }
    return EXIT.failed
  }
}

interface Resolved {
  target: Cmd | SubCmds
  /** Command path including the program name, for usage lines. */
  path: string[]
  /** Arguments left after the command path. */
  rest: string[]
}

/** Walk leading argv segments down the command tree until a command is reached. */
const resolve = (root: SubCmds, argv: string[], path: string[]): Resolved => {
  let group = root
  let i = 0

  while (i < argv.length) {
    const segment = argv[i]!
    if (segment.startsWith('-')) break

    const child = findChild(group, segment)
    if (child === undefined) throw new CliError(`unknown command '${segment}'`, { usagePath: path.join(' ') })

    i++
    path = [...path, segment]
    if (!isSubCmds(child)) return { target: child, path, rest: argv.slice(i) }
    group = child
  }

  return { target: group, path, rest: argv.slice(i) }
}

/** Groups have no inputs of their own; they still answer to the global flags. */
const groupSpec = (group: SubCmds, path: string[]): Spec => ({
  name: group.name ?? path[path.length - 1] ?? '',
  description: group.description ?? '',
})
