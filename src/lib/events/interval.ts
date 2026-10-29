import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  eachYearOfInterval,
} from 'date-fns'

export enum EventInterval {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

const BUCKET_EXPRESSIONS: Record<EventInterval, string> = {
  [EventInterval.DAY]: 'toStartOfDay(created_at)',
  [EventInterval.WEEK]: 'toStartOfWeek(created_at, 1)',
  [EventInterval.MONTH]: 'toStartOfMonth(created_at)',
  [EventInterval.YEAR]: 'toStartOfYear(created_at)',
}

const BUCKET_STARTS: Record<EventInterval, (from: Date, to: Date) => Date[]> = {
  [EventInterval.DAY]: (from, to) => eachDayOfInterval({ start: from, end: to }),
  [EventInterval.WEEK]: (from, to) =>
    eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 }),
  [EventInterval.MONTH]: (from, to) => eachMonthOfInterval({ start: from, end: to }),
  [EventInterval.YEAR]: (from, to) => eachYearOfInterval({ start: from, end: to }),
}

const NEXT_BUCKET_START: Record<EventInterval, (start: Date) => Date> = {
  [EventInterval.DAY]: (start) => addDays(start, 1),
  [EventInterval.WEEK]: (start) => addWeeks(start, 1),
  [EventInterval.MONTH]: (start) => addMonths(start, 1),
  [EventInterval.YEAR]: (start) => addYears(start, 1),
}

export function bucketExpression(interval: EventInterval): string {
  return BUCKET_EXPRESSIONS[interval]
}

export function nextBucketStart(start: Date, interval: EventInterval): Date {
  return NEXT_BUCKET_START[interval](start)
}

export function bucketStarts(from: Date, to: Date, interval: EventInterval): Date[] {
  return BUCKET_STARTS[interval](from, to)
}
