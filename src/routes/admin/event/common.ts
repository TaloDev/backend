import { millisecondsInDay } from 'date-fns/constants'
import { RefinementCtx, z } from 'zod'
import { bucketStarts, EventInterval } from '../../../lib/events/interval.js'
import { dateStringSchema, isValidDateString } from '../../../lib/validation/dateRangeSchema.js'

type DateRange = { from: string; to: string }

const MAX_WINDOW_DAYS = 90
const MAX_WINDOW_MS = MAX_WINDOW_DAYS * millisecondsInDay
const MAX_RAW_EVENTS_PER_PAGE = 2_000
const MAX_AGGREGATE_BUCKETS = 750
const MAX_AGGREGATE_NAMES = 10

const dateRangeShape = {
  from: dateStringSchema('from', 'from date').meta({
    description: 'Inclusive UTC start of the range, ISO 8601',
  }),
  to: dateStringSchema('to', 'to date').meta({
    description: 'Inclusive UTC end of the range, ISO 8601',
  }),
}

function validateRange<T extends DateRange>(data: T, ctx: RefinementCtx<T>) {
  if (!isValidDateString(data.from) || !isValidDateString(data.to)) {
    return false
  }

  const from = new Date(data.from).getTime()
  const to = new Date(data.to).getTime()

  if (to < from) {
    ctx.addIssue({
      code: 'custom',
      message: 'to must be after or equal to from',
      path: ['to'],
    })
    return false
  }

  if (to - from > MAX_WINDOW_MS) {
    ctx.addIssue({
      code: 'custom',
      message: `Date range is too large, the maximum is ${MAX_WINDOW_DAYS} days`,
      path: ['from'],
    })
    return false
  }

  return true
}

export const listEventsQuerySchema = z
  .object({
    ...dateRangeShape,
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_RAW_EVENTS_PER_PAGE)
      .default(MAX_RAW_EVENTS_PER_PAGE)
      .meta({
        description: `Events per page (default and maximum ${MAX_RAW_EVENTS_PER_PAGE})`,
      }),
    includeProps: z
      .string()
      .optional()
      .meta({ description: 'Set to 1 to include event props (off by default)' }),
    cursor: z.string().optional().meta({ description: 'Cursor from a previous page (nextCursor)' }),
  })
  .superRefine((data, ctx) => {
    validateRange(data, ctx)
  })

export const aggregateEventsQuerySchema = z
  .object({
    ...dateRangeShape,
    interval: z.enum(EventInterval).meta({
      description: 'Bucket size: day, week, month or year (weeks start on Monday)',
    }),
    name: z
      .union([z.string(), z.array(z.string())])
      .transform((value) => (Array.isArray(value) ? value : [value]))
      .refine((names) => names.length > 0 && names.every((name) => name.trim().length > 0), {
        error: 'Event names must be non-empty',
      })
      .refine((names) => names.length <= MAX_AGGREGATE_NAMES, {
        error: `Maximum ${MAX_AGGREGATE_NAMES} event names per request`,
      })
      .optional()
      .meta({
        description: `Event names to break the counts down by (maximum ${MAX_AGGREGATE_NAMES})`,
      }),
  })
  .superRefine((data, ctx) => {
    if (!validateRange(data, ctx)) {
      return
    }

    const seriesCount = data.name ? new Set(data.name).size : 1
    const buckets = bucketStarts(new Date(data.from), new Date(data.to), data.interval).length

    if (seriesCount * buckets > MAX_AGGREGATE_BUCKETS) {
      ctx.addIssue({
        code: 'custom',
        message: `This query needs more than ${MAX_AGGREGATE_BUCKETS} buckets, use a coarser interval or fewer event names`,
        path: ['interval'],
      })
    }
  })
