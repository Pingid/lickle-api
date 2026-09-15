import { isInputError, type Namespace, type Operation, type Api } from '@lickle/api'
import { findChild, is, api } from '@lickle/api/util'

import { CliError } from './errors.ts'
import { namespaceHelp, operationHelp } from './help.ts'
import { parseArgs, parseGlobals, peekFormat } from './parse.ts'
import { renderError, rendererFor, type Format } from './output.ts'

export interface RunOpts {
  /** Program name used in usage lines. Defaults to the root node's own name. */
  name?: string
  stdout?: (s: string) => void
  stderr?: (s: string) => void
}

type RunContext<T extends Api.Program> =
  Namespace.Cx<T> extends void ? [(RunOpts & { context?: Namespace.Cx<T> })?] : [RunOpts & { context: Namespace.Cx<T> }]

/** Exit codes: `0` success, `1` the command failed, `2` the invocation was wrong. */
export const EXIT = { ok: 0, failed: 1, usage: 2 } as const

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
export const run = async <T extends Api.Program>(
  program: T,
  argv: string[],
  ...args: RunContext<T>
): Promise<number> => {
  const [opts] = args as [RunOpts & { context: Namespace.Cx<T> }]
  const stdout = opts?.stdout ?? ((s: string) => void process.stdout.write(s))
  const stderr = opts?.stderr ?? ((s: string) => void process.stderr.write(s))

  const root = api.of(program as Operation.Any | Namespace.Any)

  // The path is tracked here and grows as `resolve` descends, so an error raised
  // on the way down is reported against the path reached so far — without
  // anything reaching into a thrown value to staple a field onto it.
  const path: string[] = [opts?.name ?? root.name]

  // Read the format up front so a failure before or during parsing is still
  // reported the way the caller asked for.
  let format: Format = peekFormat(argv)

  try {
    const { target, rest } = resolve(root, argv, path)

    if (!is.operation(target)) {
      const parsed = parseGlobals(rest)
      format = parsed.output
      const help = namespaceHelp(target as Namespace.Any, path) + '\n'
      // Landing on a namespace without naming a command is a usage error, but
      // asking for its help is not.
      if (parsed.help) {
        stdout(help)
        return EXIT.ok
      }
      stderr(help)
      return EXIT.usage
    }

    const parsed = await parseArgs(target, rest)
    format = parsed.output

    if (parsed.help) {
      stdout(operationHelp(target, path) + '\n')
      return EXIT.ok
    }

    const render = rendererFor(target.out, format)
    const write = (value: unknown): void => {
      const line = render(value)
      if (line !== '') stdout(line + '\n')
    }

    // An operation that declares `async-iter` hands back items as it produces
    // them, and they are printed as they arrive rather than collected first.
    const result: unknown = target.handle(parsed.inputs, opts?.context as any)
    if (is.stream(result)) for await (const item of result) write(item)
    else write(await result)

    return EXIT.ok
  } catch (e) {
    stderr(renderError(e, format) + '\n')
    if (isInputError(e)) {
      if (format === 'text') stderr(`Try '${path.join(' ')} --help' for more information.\n`)
      return e instanceof CliError ? e.exitCode : EXIT.usage
    }
    return EXIT.failed
  }
}

interface Resolved {
  target: Operation.Any | Namespace.Any
  /** Arguments left after the command path. */
  rest: string[]
}

/**
 * Walk leading argv segments down the tree until an operation is reached,
 * pushing each matched segment onto `path`.
 */
const resolve = (root: Operation.Any | Namespace.Any, argv: string[], path: string[]): Resolved => {
  let target: any = root
  let i = 0

  while (!is.operation(target) && i < argv.length) {
    const segment = argv[i]!
    if (segment.startsWith('-')) break

    const child = findChild(target as Namespace.Any, segment)
    if (child === undefined) throw new CliError(`unknown command '${segment}'`)

    i++
    path.push(segment)
    target = child
  }

  return { target, rest: argv.slice(i) }
}
