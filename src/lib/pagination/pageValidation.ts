import { ValidationCondition } from 'koa-clay'

export const pageValidation = {
  validation: async (val: unknown): Promise<ValidationCondition[]> => {
    const page = Number(val)
    return [
      {
        check: !val || (!isNaN(page) && Number.isInteger(page)),
        error: 'Page must be an integer',
        break: true
      },
      {
        check: !val || page >= 0,
        error: 'Page must be greater than or equal to 0'
      }
    ]
  }
}
