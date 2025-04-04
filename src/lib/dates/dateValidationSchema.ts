import { isBefore, isSameDay, isValid } from 'date-fns'
import { Request, Validatable, ValidationCondition } from 'koa-clay'

export function buildDateValidationSchema(startDateRequired: boolean, endDateRequired: boolean) {
  const schema: Validatable = {
    startDate: {
      required: startDateRequired,
      validation: async (val: unknown, req: Request): Promise<ValidationCondition[]> => {
        const startDate = new Date(val as string | number)
        const endDate = new Date(req.ctx.query.endDate as string | number)

        return [
          {
            check: startDateRequired ? isValid(startDate) : true,
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
      required: endDateRequired,
      validation: async (val: unknown): Promise<ValidationCondition[]> => [
        {
          check: endDateRequired ? isValid(new Date(val as string | number)) : true,
          error: 'Invalid end date, please use YYYY-MM-DD or a timestamp'
        }
      ]
    }
  }
  return schema
}

const dateValidationSchema = buildDateValidationSchema(true, true)

export default dateValidationSchema
