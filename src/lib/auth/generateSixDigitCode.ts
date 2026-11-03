import crypto from 'node:crypto'

const CODE_LENGTH = 6
const CODE_SPACE = 10 ** CODE_LENGTH

export function generateSixDigitCode() {
  return crypto.randomInt(CODE_SPACE).toString().padStart(CODE_LENGTH, '0')
}
