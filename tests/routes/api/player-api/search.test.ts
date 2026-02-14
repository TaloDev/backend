import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import GameChannelFactory from '../../../fixtures/GameChannelFactory'
import PlayerGroupFactory from '../../../fixtures/PlayerGroupFactory'
import PlayerGroupRule, { PlayerGroupRuleCastType, PlayerGroupRuleName } from '../../../../src/entities/player-group-rule'
import PlayerProp from '../../../../src/entities/player-prop'
import { Collection } from '@mikro-orm/mysql'

describe('Player API  - search', () => {
  it('should search for a player by ID', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .get('/v1/players/search')
      .query({ query: player.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(1)
    expect(res.body.players[0].id).toBe(player.id)
  })

  it('should not search by channels', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush([channel, player])

    const res = await request(app)
      .get('/v1/players/search')
      .query({ query: `channel:${channel.id}` })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(0)
  })

  it('should not search by groups', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const rule = new PlayerGroupRule(PlayerGroupRuleName.GTE, 'props.currentLevel')
    rule.castType = PlayerGroupRuleCastType.DOUBLE
    rule.operands = ['60']

    const group = await new PlayerGroupFactory()
      .construct(apiKey.game).
      state(() => ({ rules: [rule] }))
      .one()

    const player = await new PlayerFactory([apiKey.game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'currentLevel', '60')
      ])
    })).one()
    await em.persistAndFlush([group, player])

    const res = await request(app)
      .get('/v1/players/search')
      .query({ query: `group:${group.id}` })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(0)
  })

  it('should not search for players if the query is missing', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])

    const res = await request(app)
      .get('/v1/players/search')
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        query: ['query is missing from the request query']
      }
    })
  })

  it('should not search for players if the query is empty', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])

    const res = await request(app)
      .get('/v1/players/search')
      .query({ query: '' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        query: ['Query must be a non-empty string']
      }
    })
  })

  it('should not search for players if the query is a single -', async () => { // it would match all UUIDs
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])

    const res = await request(app)
      .get('/v1/players/search')
      .query({ query: '-' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        query: ['Query must be a non-empty string']
      }
    })
  })

  it('should not search for players if the scope is missing', async () => {
    const [, token] = await createAPIKeyAndToken([])

    await request(app)
      .get('/v1/players/search')
      .query({ query: 'identifier' })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
