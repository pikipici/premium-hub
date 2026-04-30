type OtpTemplateCard = {
  app: string
  code: string
}

const FNV_OFFSET_BASIS = 2166136261
const FNV_PRIME = 16777619

function hashSeed(seedKey: string): number {
  let hash = FNV_OFFSET_BASIS
  for (let i = 0; i < seedKey.length; i += 1) {
    hash ^= seedKey.charCodeAt(i)
    hash = Math.imul(hash, FNV_PRIME)
  }
  return (hash >>> 0) || 1
}

function nextPseudoDigit(state: number): { state: number; digit: string } {
  const nextState = (Math.imul(state, 1664525) + 1013904223) >>> 0
  const digit = String(nextState % 10)
  return { state: nextState || 1, digit }
}

export function generateCodeFromTemplate(template: string, seedKey: string): string {
  if (!template) return template

  let state = hashSeed(seedKey)
  return template.replace(/\d/g, () => {
    const next = nextPseudoDigit(state)
    state = next.state
    return next.digit
  })
}

export function buildOtpCardsForCycle<T extends OtpTemplateCard>(cards: T[], cycleSeed: number): T[] {
  return cards.map((card, index) => ({
    ...card,
    code: generateCodeFromTemplate(card.code, `${card.app}:${index}:${cycleSeed}`),
  }))
}
