import { RouteDocs } from '../../../lib/docs/docs-registry.js'

export const listDocs = {
  description:
    'List events in a UTC date range, oldest first.\nFollow nextCursor until it is null to read the whole range.',
  samples: [
    {
      title: 'Sample request',
      sample: {
        url: '/admin/v1/events?from=2026-08-01T00:00:00.000Z&to=2026-08-15T23:59:59.999Z&includeProps=1',
        query: {
          from: '2026-08-01T00:00:00.000Z',
          to: '2026-08-15T23:59:59.999Z',
          includeProps: '1',
        },
      },
    },
    {
      title: 'Sample response',
      sample: {
        events: [
          {
            id: 'a3f3c1b8-4c2d-4a0e-9d4f-2b1c8e5a7f60',
            name: 'Level completed',
            playerAliasId: 105,
            devBuild: false,
            createdAt: '2026-08-15T12:45:39.409Z',
            props: [
              { key: 'level', value: '3' },
              { key: 'META_OS', value: 'iOS' },
            ],
          },
        ],
        nextCursor: 'WyIyMDI2LTA4LTE1IDEyOjQ1OjM5LjQwOSIsImEzZjNjMWI4...',
      },
    },
  ],
} satisfies RouteDocs

export const aggregateDocs = {
  description:
    'Count game events into day, week, month or year buckets.\nBuckets align to their interval (weeks start on Monday). The first and last bucket only count events inside from/to, so their counts can be partial.\nOmit name for a single series with a null name.',
  samples: [
    {
      title: 'Sample request',
      sample: {
        url: '/admin/v1/events/aggregate?from=2026-08-01&to=2026-08-31&interval=day&name=Level%20completed&name=Item%20purchased',
        query: {
          from: '2026-08-01',
          to: '2026-08-31',
          interval: 'day',
          name: ['Level completed', 'Item purchased'],
        },
      },
    },
    {
      title: 'Sample response',
      sample: {
        series: [
          {
            name: 'Level completed',
            buckets: [
              { start: '2026-08-01T00:00:00.000Z', end: '2026-08-02T00:00:00.000Z', count: 64 },
              { start: '2026-08-02T00:00:00.000Z', end: '2026-08-03T00:00:00.000Z', count: 0 },
            ],
          },
          {
            name: 'Item purchased',
            buckets: [
              { start: '2026-08-01T00:00:00.000Z', end: '2026-08-02T00:00:00.000Z', count: 12 },
              { start: '2026-08-02T00:00:00.000Z', end: '2026-08-03T00:00:00.000Z', count: 7 },
            ],
          },
        ],
      },
    },
  ],
} satisfies RouteDocs
