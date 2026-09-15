import { InputError, outputFields } from '@lickle/api-legacy'
import type { Command, Namespace } from '@lickle/api-legacy'
import { bindArgs } from './args.ts'
import { errorResult, toolResult } from './result.ts'
import { tools, type ToolEntry, type ToolsOpts } from './tools.ts'
import {
  INTERNAL_ERROR,
  INVALID_PARAMS,
  INVALID_REQUEST,
  JSONRPC_VERSION,
  METHOD_NOT_FOUND,
  PROTOCOL_VERSION,
  UNSUPPORTED_PROTOCOL_VERSION,
  type CallToolRequestParams,
  type DiscoverResult,
  type JSONRPCRequest,
  type JSONRPCResponse,
  type ListToolsResult,
  type RequestId,
} from './types.ts'

export interface McpOpts extends ToolsOpts {
  /** Server name. Defaults to the root group's name, then 'cli'. */
  name?: string
  version?: string
  /** Guidance about the server as a whole. Defaults to the root description. */
  instructions?: string
}

/**
 * Handle one decoded JSON-RPC message. Resolves to `undefined` for a
 * notification, which takes no response.
 */
export type Dispatch = (message: unknown) => Promise<JSONRPCResponse | undefined>

/**
 * Build a transport-agnostic MCP server over a command tree.
 *
 * This is the whole protocol surface as a plain function — message in,
 * message out — so every behaviour below is testable without a transport or a
 * subprocess. `stdio.ts` and `http.ts` only move bytes.
 *
 * Scope is the tools half of the protocol: `server/discover`, `tools/list` and
 * `tools/call`. Capabilities advertise nothing else, so answering everything
 * else with METHOD_NOT_FOUND is correct rather than merely incomplete.
 */
export const server = (tree: Namespace, opts: McpOpts = {}): Dispatch => {
  const entries = tools(tree, opts)
  const byName = new Map(entries.map((e) => [e.tool.name, e]))

  const discover = (): DiscoverResult => ({
    supportedVersions: [PROTOCOL_VERSION],
    capabilities: { tools: {} },
    ...(instructionsOf(tree, opts) === undefined ? {} : { instructions: instructionsOf(tree, opts) }),
  })

  return async (message: unknown): Promise<JSONRPCResponse | undefined> => {
    if (!isRequest(message)) return error(null, INVALID_REQUEST, 'not a JSON-RPC request')

    const { id, method, params } = message
    // No `id` means a notification: act on nothing, answer nothing.
    if (id === undefined) return undefined

    const declared = params?._meta?.['io.modelcontextprotocol/protocol-version']
    if (typeof declared === 'string' && declared !== PROTOCOL_VERSION)
      return error(id, UNSUPPORTED_PROTOCOL_VERSION, `unsupported protocol version '${declared}'`, {
        supportedVersions: [PROTOCOL_VERSION],
      })

    switch (method) {
      case 'server/discover':
        return result(id, discover())

      case 'tools/list':
        return result(id, { tools: entries.map((e) => e.tool) } satisfies ListToolsResult)

      case 'tools/call':
        return callTool(id, params as CallToolRequestParams | undefined, byName)

      default:
        return error(id, METHOD_NOT_FOUND, `unknown method '${method}'`)
    }
  }
}

const callTool = async (
  id: RequestId,
  params: CallToolRequestParams | undefined,
  byName: Map<string, ToolEntry>,
): Promise<JSONRPCResponse> => {
  const name = params?.name
  if (typeof name !== 'string') return error(id, INVALID_PARAMS, "'name' is required")

  // Failing to *find* the tool is a protocol error; everything that goes wrong
  // once it is found is a tool result the model can read and correct.
  const entry = byName.get(name)
  if (entry === undefined) return error(id, METHOD_NOT_FOUND, `unknown tool '${name}'`)

  let inputs: Record<string, unknown>
  try {
    inputs = await bindArgs(entry.cmd, params?.arguments)
  } catch (e) {
    if (e instanceof InputError) return result(id, errorResult(e))
    return error(id, INTERNAL_ERROR, e instanceof Error ? e.message : String(e))
  }

  try {
    const value = await entry.cmd.run(inputs)
    return result(id, toolResult(value, outputFields(entry.cmd.outputs) !== undefined))
  } catch (e) {
    return result(id, errorResult(e))
  }
}

const instructionsOf = (tree: Namespace, opts: McpOpts): string | undefined =>
  opts.instructions ?? (tree.description === '' ? undefined : tree.description)

const isRequest = (m: unknown): m is JSONRPCRequest =>
  typeof m === 'object' &&
  m !== null &&
  (m as JSONRPCRequest).jsonrpc === JSONRPC_VERSION &&
  typeof (m as JSONRPCRequest).method === 'string'

const result = (id: RequestId, value: object): JSONRPCResponse => ({
  jsonrpc: JSONRPC_VERSION,
  id,
  result: value as Record<string, unknown>,
})

const error = (id: RequestId | null, code: number, message: string, data?: unknown): JSONRPCResponse => ({
  jsonrpc: JSONRPC_VERSION,
  id,
  error: { code, message, ...(data === undefined ? {} : { data }) },
})

/** A `Command` is the unit a tool wraps; re-exported for adapter typing. */
export type { Command }
