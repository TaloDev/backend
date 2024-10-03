import { isBefore, isSameDay, isValid } from 'date-fns'
import { Request, Validatable, ValidationCondition } from 'koa-clay'

const schema: Validatable = {
  startDate: {
    required: true,
    validation: async (val: unknown, req: Request): Promise<ValidationCondition[]> => {
      const startDate = new Date(val as string)
      const endDate = new Date(req.ctx.query.endDate as string)

      return [
        {
          check: isValid(startDate),
          error: 'Invalid start date, please use YYYY-MM-DD or a timestamp',
          break: true
        },
        {
          check: isValid(endDate) ? (isBefore(startDate, endDate) || isSameDay(startDate, endDate)) : true,
          error: 'Invalid start date, it should be before the end date'
        }
      ]
    }
  },
  endDate: {
    required: true,
    validation: async (val: unknown): Promise<ValidationCondition[]> => [
      {
        check: isValid(new Date(val as string)),
        error: 'Invalid end date, please use YYYY-MM-DD or a timestamp'
      }
    ]
  }
}

export default schema
