import { isBefore, isSameDay, isValid } from 'date-fns'
import { z } from 'zod'

export function isValidDateString(value: string) {
  return isValid(new Date(value))
}

export function dateStringSchema(field: string, label: string) {
  return z
    .string({ error: `${field} is missing from the request query` })
    .refine(isValidDateString, {
      error: `Invalid ${label}, please use YYYY-MM-DD or a timestamp`,
    })
}

export const dateRangeSchema = z
  .object({
    startDate: dateStringSchema('startDate', 'start date'),
    endDate: dateStringSchema('endDate', 'end date'),
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate)
      const end = new Date(data.endDate)
      if (!isValid(start) || !isValid(end)) {
        return true
      }
      return isBefore(start, end) || isSameDay(start, end)
    },
    {
      error: 'Invalid start date, it should be before the end date',
      path: ['startDate'],
    },
  )
