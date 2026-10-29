import { bucketStarts, EventInterval, nextBucketStart } from '../../../src/lib/events/interval.js'

const wednesday = new Date('2026-01-07T15:30:00.000Z')
const januaryFirst = new Date('2026-01-01T00:00:00.000Z')
const januarySeventh = new Date('2026-01-07T16:00:00.000Z')

function iso(dates: Date[]) {
  return dates.map((date) => date.toISOString())
}

describe('Event interval helpers', () => {
  it('should align bucket starts to the interval', () => {
    expect(iso(bucketStarts(wednesday, januarySeventh, EventInterval.DAY))).toStrictEqual([
      '2026-01-07T00:00:00.000Z',
    ])
    // weeks start on Monday
    expect(iso(bucketStarts(wednesday, januarySeventh, EventInterval.WEEK))).toStrictEqual([
      '2026-01-05T00:00:00.000Z',
    ])
    expect(iso(bucketStarts(januaryFirst, januarySeventh, EventInterval.MONTH))).toStrictEqual([
      '2026-01-01T00:00:00.000Z',
    ])
    expect(iso(bucketStarts(januaryFirst, januarySeventh, EventInterval.YEAR))).toStrictEqual([
      '2026-01-01T00:00:00.000Z',
    ])
  })

  it('should step to the next bucket start', () => {
    expect(nextBucketStart(januaryFirst, EventInterval.DAY).toISOString()).toBe(
      '2026-01-02T00:00:00.000Z',
    )
    expect(nextBucketStart(januaryFirst, EventInterval.WEEK).toISOString()).toBe(
      '2026-01-08T00:00:00.000Z',
    )
    expect(nextBucketStart(januaryFirst, EventInterval.MONTH).toISOString()).toBe(
      '2026-02-01T00:00:00.000Z',
    )
    expect(nextBucketStart(januaryFirst, EventInterval.YEAR).toISOString()).toBe(
      '2027-01-01T00:00:00.000Z',
    )
  })

  it('should list every bucket start covered by the range', () => {
    const to = new Date('2026-01-03T12:00:00.000Z')

    expect(iso(bucketStarts(januaryFirst, to, EventInterval.DAY))).toStrictEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-01-02T00:00:00.000Z',
      '2026-01-03T00:00:00.000Z',
    ])
    expect(
      iso(bucketStarts(januaryFirst, new Date('2027-06-01T00:00:00.000Z'), EventInterval.YEAR)),
    ).toStrictEqual(['2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z'])
  })
})
