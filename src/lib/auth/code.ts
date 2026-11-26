import crypto from 'node:crypto'

// I, L, O, S and Z can be ambiguous so they're not included
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRTUVWXY'

const CODE_LENGTH = 6

export function generateCode() {
  const chars = Array.from({ length: CODE_LENGTH }).map(() => {
    return CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]
  })

  return chars.join('')
}

export function normaliseCode(code: string) {
  return code.trim().toUpperCase()
}
