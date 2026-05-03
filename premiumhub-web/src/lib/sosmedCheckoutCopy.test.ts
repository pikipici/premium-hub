import { describe, expect, it } from 'vitest'

import { SOSMED_TARGET_INPUT_COPY } from './sosmedCheckoutCopy'

describe('SOSMED_TARGET_INPUT_COPY', () => {
  it('uses generic target copy that works for every sosmed platform', () => {
    expect(SOSMED_TARGET_INPUT_COPY.label).toBe('Link / Username Target')
    expect(SOSMED_TARGET_INPUT_COPY.placeholder).toBe('contoh: link postingan/profil atau @username')
    expect(SOSMED_TARGET_INPUT_COPY.helper).toBe(
      'Isi sesuai kebutuhan layanan, bisa berupa link postingan, link profil, video, channel, atau username target.'
    )
  })

  it('does not hardcode Instagram-only examples', () => {
    const combinedCopy = Object.values(SOSMED_TARGET_INPUT_COPY).join(' ')

    expect(combinedCopy.toLowerCase()).not.toContain('instagram.com/username')
  })
})
