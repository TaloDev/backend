import { addSeconds } from 'date-fns'
import request from 'supertest'
import Game from '../../../../src/entities/game.js'
import EventFactory from '../../../fixtures/EventFactory.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'

const baseTime = new Date('2026-09-01T10:00:00Z')

// players 1-4 and 6 have props on their kill event; player 5 has none
const playerProps: { key: string; value: string }[][] = [
  [
    { key: 'weapon', value: 'iron-sword' },
    { key: 'amount', value: '25' },
    { key: 'level', value: '5' },
  ],
  [
    { key: 'weapon', value: 'axe' },
    { key: 'amount', value: '10' },
    { key: 'level', value: '5' },
  ],
  [
    { key: 'weapon', value: 'bow' },
    { key: 'amount', value: '50' },
    { key: 'level', value: '7' },
  ],
  [
    { key: 'weapon', value: 'sword' },
    { key: 'amount', value: 'banana' },
    { key: 'level', value: '9' },
  ],
  [],
  [
    { key: 'weapon', value: 'sword' },
    { key: 'amount', value: '10.0' },
    { key: 'level', value: '6' },
  ],
]

async function setup(game: Game) {
  for (const props of playerProps) {
    const player = await new PlayerFactory([game]).one()
    await em.persist(player).flush()
    const playerAlias = player.aliases.getItems()[0]

    const event = await new EventFactory([player])
      .state(() => ({
        name: 'Chest Looted',
        createdAt: baseTime,
        props,
        playerAlias,
      }))
      .one()

    await clickhouse.insert({
      table: 'events',
      values: [event.toInsertable()],
      format: 'JSONEachRow',
    })
    await clickhouse.insert({
      table: 'event_props',
      values: event.getInsertableProps(),
      format: 'JSONEachRow',
    })
  }
}

async function previewPlayers(
  game: Game,
  token: string,
  rules: { key: string; op: string; value: string[] }[],
) {
  const res = await request(app)
    .post(`/games/${game.id}/event-funnels/preview`)
    .send({
      steps: [
        { name: 'Chest Looted', props: { ruleMode: 'and', rules } },
        { name: 'Item Used', props: { ruleMode: 'and', rules: [] } },
      ],
      maxGap: 60,
      startDate: '2026-09-01',
      endDate: '2026-09-02',
    })
    .auth(token, { type: 'bearer' })
    .expect(200)

  return res.body.result.steps[0].players
}

describe('Event funnels - prop rules', () => {
  let game: Game
  let token: string

  beforeEach(async () => {
    const [organisation, createdGame] = await createOrganisationAndGame()
    const [createdToken] = await createUserAndToken({}, organisation)
    game = createdGame
    token = createdToken
    await setup(game)
  })

  it('matches set for a key that exists', async () => {
    expect(await previewPlayers(game, token, [{ key: 'weapon', op: 'set', value: [] }])).toBe(5)
  })

  it('does not match set for a key that is never set', async () => {
    expect(await previewPlayers(game, token, [{ key: 'armor', op: 'set', value: [] }])).toBe(0)
  })

  it('matches equals for strings', async () => {
    expect(await previewPlayers(game, token, [{ key: 'weapon', op: '=', value: ['sword'] }])).toBe(
      2,
    )
  })

  it('matches equals numerically when strings differ in format', async () => {
    expect(await previewPlayers(game, token, [{ key: 'amount', op: '=', value: ['10'] }])).toBe(2)
  })

  it('matches not equals', async () => {
    expect(await previewPlayers(game, token, [{ key: 'weapon', op: '!=', value: ['sword'] }])).toBe(
      3,
    )
  })

  it('matches greater than', async () => {
    expect(await previewPlayers(game, token, [{ key: 'amount', op: '>', value: ['20'] }])).toBe(2)
  })

  it('matches greater than or equal', async () => {
    expect(await previewPlayers(game, token, [{ key: 'amount', op: '>=', value: ['10'] }])).toBe(4)
  })

  it('matches less than', async () => {
    expect(await previewPlayers(game, token, [{ key: 'amount', op: '<', value: ['15'] }])).toBe(2)
  })

  it('matches less than or equal', async () => {
    expect(await previewPlayers(game, token, [{ key: 'amount', op: '<=', value: ['10'] }])).toBe(2)
  })

  it('matches between', async () => {
    expect(
      await previewPlayers(game, token, [{ key: 'amount', op: 'between', value: ['20', '30'] }]),
    ).toBe(1)
  })

  it('matches contains as a substring', async () => {
    expect(
      await previewPlayers(game, token, [{ key: 'weapon', op: 'contains', value: ['sword'] }]),
    ).toBe(3)
  })

  it('combines rules with and mode', async () => {
    expect(
      await previewPlayers(game, token, [
        { key: 'weapon', op: 'contains', value: ['sword'] },
        { key: 'amount', op: '>', value: ['20'] },
      ]),
    ).toBe(1)
  })

  it('combines rules with or mode', async () => {
    const res = await request(app)
      .post(`/games/${game.id}/event-funnels/preview`)
      .send({
        steps: [
          {
            name: 'Chest Looted',
            props: {
              ruleMode: 'or',
              rules: [
                { key: 'weapon', op: '=', value: ['axe'] },
                { key: 'amount', op: '>', value: ['40'] },
              ],
            },
          },
          { name: 'Item Used', props: { ruleMode: 'and', rules: [] } },
        ],
        maxGap: 60,
        startDate: '2026-09-01',
        endDate: '2026-09-02',
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.result.steps[0].players).toBe(2)
  })

  it('does not filter when rules are empty', async () => {
    expect(await previewPlayers(game, token, [])).toBe(6)
  })

  it('filters players on a later step', async () => {
    const playerA = await new PlayerFactory([game]).one()
    const playerB = await new PlayerFactory([game]).one()
    await em.persist([playerA, playerB]).flush()
    const aliasA = playerA.aliases.getItems()[0]
    const aliasB = playerB.aliases.getItems()[0]

    const events = [
      await new EventFactory([playerA])
        .state(() => ({ name: 'Game Started', createdAt: baseTime, playerAlias: aliasA }))
        .one(),
      await new EventFactory([playerA])
        .state(() => ({
          name: 'Chest Looted',
          createdAt: addSeconds(baseTime, 10),
          props: [{ key: 'weapon', value: 'sword' }],
          playerAlias: aliasA,
        }))
        .one(),
      await new EventFactory([playerB])
        .state(() => ({ name: 'Game Started', createdAt: baseTime, playerAlias: aliasB }))
        .one(),
      await new EventFactory([playerB])
        .state(() => ({
          name: 'Chest Looted',
          createdAt: addSeconds(baseTime, 10),
          props: [{ key: 'weapon', value: 'axe' }],
          playerAlias: aliasB,
        }))
        .one(),
    ]

    for (const event of events) {
      await clickhouse.insert({
        table: 'events',
        values: [event.toInsertable()],
        format: 'JSONEachRow',
      })
      await clickhouse.insert({
        table: 'event_props',
        values: event.getInsertableProps(),
        format: 'JSONEachRow',
      })
    }

    const res = await request(app)
      .post(`/games/${game.id}/event-funnels/preview`)
      .send({
        steps: [
          { name: 'Game Started', props: { ruleMode: 'and', rules: [] } },
          {
            name: 'Chest Looted',
            props: { ruleMode: 'and', rules: [{ key: 'weapon', op: '=', value: ['sword'] }] },
          },
        ],
        maxGap: 60,
        startDate: '2026-09-01',
        endDate: '2026-09-02',
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.result.steps[0].players).toBe(2)
    expect(res.body.result.steps[1].players).toBe(1)
  })
})
