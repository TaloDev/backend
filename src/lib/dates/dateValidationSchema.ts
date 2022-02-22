import { isAfter, isValid } from 'date-fns'
import { Request } from 'koa-clay'

const schema = {
  startDate: async (val: string, req: Request): Promise<boolean> => {
    if (!val) return false

    const startDate = new Date(val)
    if (!isValid(startDate)) throw new Error('Invalid start date, please use YYYY-MM-DD or a timestamp')

    const endDate = new Date(req.ctx.query.endDate as string)
    if (isValid(endDate) && isAfter(startDate, endDate)) throw new Error('Invalid start date, it should be before the end date')

    return true
  },
  endDate: async (val: string): Promise<boolean> => {
    if (!val) return false

    const endDate = new Date(val)
    if (!isValid(endDate)) throw new Error('Invalid end date, please use YYYY-MM-DD or a timestamp')

    return true
  }
}

export default schema
