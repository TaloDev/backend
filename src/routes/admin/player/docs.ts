import { RouteDocs } from '../../../lib/docs/docs-registry.js'

const playerSample = {
  id: '9dd68e65-a583-493e-9b5e-b11db5da8860',
  props: [
    { key: 'currentLevel', value: '58' },
    { key: 'xPos', value: '13.29' },
    { key: 'yPos', value: '26.44' },
    { key: 'zoneId', value: '3' },
  ],
  aliases: [
    {
      id: 1,
      service: 'username',
      identifier: 'tud0r',
      displayName: 'tud0r',
      player: '/* [Circular] */',
    },
    {
      id: 2,
      service: 'steam',
      identifier: '11133645',
      displayName: '11133645',
      player: '/* [Circular] */',
    },
  ],
  devBuild: false,
  createdAt: '2022-01-15T13:20:32.133Z',
  lastSeenAt: '2022-04-12T15:09:43.066Z',
  groups: [{ id: '5826ca71-1964-4a1b-abcb-a61ffbe003be', name: 'Winners' }],
}

export const listDocs = {
  description: 'List the players in the game',
  samples: [
    {
      title: 'Sample response',
      sample: {
        players: [playerSample],
        count: 1,
        itemsPerPage: 25,
        isLastPage: true,
      },
    },
  ],
} satisfies RouteDocs

export const getDocs = {
  description: 'Get a player',
  samples: [
    {
      title: 'Sample response',
      sample: {
        player: playerSample,
      },
    },
  ],
} satisfies RouteDocs

export const updateDocs = {
  description: "Update a player's props or dev build status",
  samples: [
    {
      title: 'Sample request',
      sample: {
        props: [
          { key: 'currentLevel', value: '72' },
          { key: 'alive', value: null },
          { key: 'zoneId', value: '4' },
        ],
      },
    },
    {
      title: 'Sample response',
      sample: {
        player: {
          ...playerSample,
          props: [
            { key: 'currentLevel', value: '72' },
            { key: 'zoneId', value: '4' },
          ],
        },
        rejectedProps: [
          {
            key: 'nickname',
            error: 'PROP_CONTAINS_PROFANITY',
            message: 'Prop value contains profanity',
          },
        ],
      },
    },
    {
      title: 'Sample request marking a player as a dev build',
      sample: {
        devBuild: true,
      },
    },
    {
      title: 'Sample response after marking a player as a dev build',
      sample: {
        player: { ...playerSample, devBuild: true },
        rejectedProps: [],
      },
    },
  ],
} satisfies RouteDocs

export const deleteDocs = {
  description: 'Delete a player',
} satisfies RouteDocs
