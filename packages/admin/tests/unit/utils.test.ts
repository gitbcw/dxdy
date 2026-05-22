import { describe, expect, it } from 'vitest'
import { cn } from '../../src/lib/utils'

describe('cn', () => {
  it('merges classes and resolves tailwind conflicts', () => {
    expect(cn('px-2', 'px-4', false && 'hidden', 'block')).toBe('px-4 block')
  })
})
