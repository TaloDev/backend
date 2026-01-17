import { isBefore, isSameDay, isValid } from 'date-fns'
import { z } from 'zod'

export const dateRangeSchema = z.object({
  startDate: z.string().refine((val) => isValid(new Date(val)), {
    message: 'Invalid start date, please use YYYY-MM-DD or a timestamp'
  }),
  endDate: z.string().refine((val) => isValid(new Date(val)), {
    message: 'Invalid end date, please use YYYY-MM-DD or a timestamp'
  })
}).refine((data) => {
  const start = new Date(data.startDate)
  const end = new Date(data.endDate)
  return isBefore(start, end) || isSameDay(start, end)
}, {
  message: 'Invalid start date, it should be before the end date',
  path: ['startDate']
})
