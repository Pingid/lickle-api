import { InputError, isNamespace } from '@lickle/api-legacy'
import type { Command, Namespace } from '@lickle/api-legacy'
import { CliError } from './errors.ts'
import { cmdHelp, namespaceHelp } from './help.ts'
import { parseArgs, peekFormat } from './parse.ts'
import { render, renderError, type Format } from './output.ts'

export interface RunOpts {
  /** Program name used in usage lines. Defaults to the root namespace's name. */
  name?: string
  stdout?: (s: string) => void
  stderr?: (s: string) => void
}

/** Exit codes: `0` success, `1` the command failed, `2` the invocation was wrong. */
export const EXIT = { ok: 0, failed: 1, usage: 2 } as const

/**
 * Run a command tree against `argv` (without the `node script` prefix).
 *
 * Resolves the command path, parses the remaining arguments against its
 * operation, invokes it, and prints its result as text or JSON. Never terminates
 * the process — it returns the exit code for the caller to act on:
 *
 * ```ts
 * process.exit(await run(cmds, process.argv.slice(2)))
 * ```
 */
export const run = async (tree: Namespace, argv: string[], opts: RunOpts = {}): Promise<number> => {
  const stdout = opts.stdout ?? ((s: string) => void process.stdout.write(s))
  const stderr = opts.stderr ?? ((s: string) => void process.stderr.write(s))

  // The path is tracked here and grows as `resolve` descends, so an error raised
  // on the way down can be reported against the path reached so far — without
  // anything reaching into a thrown value to staple a field onto it.
  const path: string[] = [opts.name ?? tree.name]

  // Read the format up front so failures before or during parsing are still
  // reported the way the caller asked for.
  let output: Format = peekFormat(argv)

  try {
    const { target, rest } = resolve(tree, argv, path)
    // A namespace declares no inputs, so it parses as itself: global flags only.
    const parsed = await parseArgs(target, rest)
    output = parsed.output

    if (isNamespace(target)) {
      const help = namespaceHelp(target, path) + '\n'
      // Landing on a namespace without naming a command is a usage error, but
      // asking for its help is not.
      if (parsed.help) {
        stdout(help)
        return EXIT.ok
      }
      stderr(help)
      return EXIT.usage
    }

    if (parsed.help) {
      stdout(cmdHelp(target, path) + '\n')
      return EXIT.ok
    }

    const result = await target.run(parsed.inputs)
    const text = render(result, target.outputs, output)
    if (text !== '') stdout(text + '\n')
    return EXIT.ok
  } catch (e) {
    stderr(renderError(e, output) + '\n')
    if (e instanceof InputError) {
      if (output === 'text') stderr(`Try '${path.join(' ')} --help' for more information.\n`)
      return e instanceof CliError ? e.exitCode : EXIT.usage
    }
    return EXIT.failed
  }
}

interface Resolved {
  target: Command | Namespace
  /** Arguments left after the command path. */
  rest: string[]
}

/**
 * Walk leading argv segments down the tree until a command is reached, pushing
 * each matched segment onto `path`.
 */
const resolve = (root: Namespace, argv: string[], path: string[]): Resolved => {
  let ns = root
  let i = 0

  while (i < argv.length) {
    const segment = argv[i]!
    if (segment.startsWith('-')) break

    const child = ns.cmds.find((c) => c.name === segment)
    if (child === undefined) throw new CliError(`unknown command '${segment}'`)

    i++
    path.push(segment)
    if (!isNamespace(child)) return { target: child, rest: argv.slice(i) }
    ns = child
  }

  return { target: ns, rest: argv.slice(i) }
}
