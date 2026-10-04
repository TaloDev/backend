import { RouteDocs } from '../../../lib/docs/docs-registry.js'

const changeSample = {
  id: 4,
  key: 'xpRate',
  value: '2',
  applyAt: '2026-08-20T12:00:00.000Z',
  createdAt: '2026-08-15T12:45:39.409Z',
}

export const getDocs = {
  description: 'Get the live config',
  samples: [
    {
      title: 'Sample response',
      sample: {
        config: [
          { key: 'xpRate', value: '2' },
          { key: 'maxLevel', value: '80' },
        ],
      },
    },
  ],
} satisfies RouteDocs

export const updateDocs = {
  description: 'Update the live config',
  samples: [
    {
      title: 'Sample request',
      sample: {
        props: [{ key: 'xpRate', value: '2' }],
      },
    },
    {
      title: 'Sample response',
      sample: {
        game: {
          id: 1,
          name: 'My game',
          props: [{ key: 'xpRate', value: '2' }],
          createdAt: '2026-08-01T12:00:00.000Z',
        },
      },
    },
    {
      title: 'Sample request deleting a prop',
      sample: {
        props: [{ key: 'halloweenEventEnabled', value: null }],
      },
    },
    {
      title: 'Sample response after deleting a prop',
      sample: {
        game: {
          id: 1,
          name: 'My game',
          props: [{ key: 'xpRate', value: '2' }],
          createdAt: '2026-08-01T12:00:00.000Z',
        },
      },
    },
  ],
} satisfies RouteDocs

export const listScheduledChangesDocs = {
  description: 'List the scheduled live config changes',
  samples: [
    {
      title: 'Sample response',
      sample: {
        changes: [changeSample],
      },
    },
  ],
} satisfies RouteDocs

export const createScheduledChangesDocs = {
  description:
    'Schedule live config changes\nSet a value to null to delete the prop when the change is applied',
  samples: [
    {
      title: 'Sample request',
      sample: {
        changes: [{ key: 'xpRate', value: '3', applyAt: '2026-08-20T12:00:00.000Z' }],
      },
    },
    {
      title: 'Sample response',
      sample: {
        changes: [changeSample],
      },
    },
    {
      title: 'Sample request deleting a prop',
      sample: {
        changes: [{ key: 'xpRate', value: null, applyAt: '2026-08-20T12:00:00.000Z' }],
      },
    },
    {
      title: 'Sample response deleting a prop',
      sample: {
        changes: [{ ...changeSample, value: null }],
      },
    },
  ],
} satisfies RouteDocs

export const deleteScheduledChangeDocs = {
  description: 'Cancel a scheduled live config change',
} satisfies RouteDocs
