import { pageValidation } from '../../../src/lib/pagination/pageValidation'

// simulates @Validate
async function getErrors(val: unknown) {
  const errors: string[] = []

  const res = await pageValidation.validation(val)
  for (const cond of res) {
    const failed = !cond.check

    if (failed && cond.error) {
      errors.push(cond.error)
    }
    if (failed && cond.break) {
      break
    }
  }

  return errors
}

describe('pageValidation', () => {
  it('should allow positive integer pages', async () => {
    expect(await getErrors('1')).toStrictEqual([])
  })

  it('should not allow invalid numbers', async () => {
    expect(await getErrors('hello')).toStrictEqual(['Page must be an integer'])
  })

  it('should not allow decimal numbers', async () => {
    expect(await getErrors('1.11')).toStrictEqual(['Page must be an integer'])
  })

  it('should not allow negative numbers', async () => {
    expect(await getErrors('-1')).toStrictEqual(['Page must be greater than or equal to 0'])
  })

  it('should allow 0', async () => {
    expect(await getErrors('0')).toStrictEqual([])
  })

  it('should allow empty values', async () => {
    expect(await getErrors(undefined)).toStrictEqual([])
  })
})
