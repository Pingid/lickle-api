import * as cp from 'node:child_process'

export const spawn = async (
  cmd: string,
  args: string[],
  opts: cp.SpawnOptions = {},
): Promise<{ stdout: string; stderr: string; code: number }> => {
  const { stdout, stderr, code } = await new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
    const out = { stdout: '', stderr: '' }

    const append = (t: keyof typeof out) => (data: string) => {
      if (t === 'stdout') out.stdout += data
      if (t === 'stderr') out.stderr += data
    }

    const proc = cp.spawn(cmd, args, { ...opts, stdio: 'pipe' })
    proc.stdout.on('data', append('stdout'))
    proc.stderr.on('data', append('stderr'))
    proc.on('close', (code) => resolve({ stdout: out.stdout.trim(), stderr: out.stderr.trim(), code: code ?? 0 }))
  })
  if (code !== 0) throw new Error(`Failed to spawn ${cmd} ${args.join(' ')}: ${stderr}`)
  return { stdout, stderr, code }
}

spawn.stdout = async (
  cmd: string,
  args: string[],
  opts: cp.SpawnOptions & { silent?: boolean } = {},
): Promise<string> => spawn(cmd, args, opts).then(({ stdout }) => stdout)

spawn.inherit = async (cmd: string, args: string[], opts: cp.SpawnOptions & { silent?: boolean } = {}) => {
  const { code } = await new Promise<{ code: number }>((resolve) => {
    const proc = cp.spawn(cmd, args, { ...opts, stdio: 'inherit' })
    proc.on('close', (code) => resolve({ code: code ?? 0 }))
  })
  if (code !== 0) throw new Error(`Failed to spawn ${cmd} ${args.join(' ')}`)
  return code
}
