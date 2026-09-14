import mri from 'mri'

import type { AnyNamespace, AnyOperation } from '@lickle/api'

import type { Cmd } from '../build.ts'

export const run = (_t: Cmd | AnyNamespace | AnyOperation, argv: string[]) => {
  const args = parse(argv)
  console.log(args)
}

const parse = (argv: string[]) => mri(argv)
