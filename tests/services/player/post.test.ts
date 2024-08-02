import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import PlayerGroupFactory from '../../fixtures/PlayerGroupFactory'
import PlayerGroupRule, { PlayerGroupRuleCastType, PlayerGroupRuleName } from '../../../src/entities/player-group-rule'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import PlayerFactory from '../../fixtures/PlayerFactory'
import casual from 'casual'

describe('Player service - post', () => {
  it('should create a player', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .post(`/games/${game.id}/players`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player).toBeTruthy()
  })

  it('should create a player with aliases', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .post(`/games/${game.id}/players`)
      .send({
        aliases: [{
          service: 'steam',
          identifier: '12345'
        }]
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player).toBeTruthy()
    expect(res.body.player.aliases).toHaveLength(1)
    expect(res.body.player.aliases[0].service).toBe('steam')
    expect(res.body.player.aliases[0].identifier).toBe('12345')
  })

  it('should create a player with props', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .post(`/games/${game.id}/players`)
      .send({
        props: [
          {
            key: 'characterName',
            value: 'Bob John'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.props[0].key).toBe('characterName')
    expect(res.body.player.props[0].value).toBe('Bob John')
  })

  it('should put the newly created player in the correct groups', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const rule = new PlayerGroupRule(PlayerGroupRuleName.LT, 'props.currentLevel')
    rule.castType = PlayerGroupRuleCastType.DOUBLE
    rule.operands = ['60']

    const group = await new PlayerGroupFactory().state(() => ({ game })).state(() => ({ rules: [rule] })).one()
    await (<EntityManager>global.em).persistAndFlush(group)

    const res = await request(global.app)
      .post(`/games/${game.id}/players`)
      .send({
        props: [
          {
            key: 'currentLevel',
            value: '1'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.groups).toStrictEqual([
      {
        id: group.id,
        name: group.name
      }
    ])
  })

  it('should not create a player for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    const res = await request(global.app)
      .post('/games/99999/players')
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not create a player for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    await request(global.app)
      .post(`/games/${game.id}/players`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not create a player if props are in the incorrect format', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .post(`/games/${game.id}/players`)
      .send({
        props: {
          characterName: 'Bob John'
        }
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        props: ['Props must be an array']
      }
    })
  })

  it('should create a player with a META_DEV_BUILD prop', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const username = casual.username

    const res = await request(global.app)
      .post(`/games/${game.id}/players`)
      .send({
        aliases: [{
          service: 'steam',
          identifier: username
        }]
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-dev-build', '1')
      .expect(200)

    expect(res.body.player).toBeTruthy()
    expect(res.body.player.aliases).toHaveLength(1)
    expect(res.body.player.aliases[0].service).toBe('steam')
    expect(res.body.player.aliases[0].identifier).toBe(username)
    expect(res.body.player.props).toStrictEqual([
      { key: 'META_DEV_BUILD', value: '1' }
    ])
  })

  it('should not create duplicate player aliases', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    await (<EntityManager>global.em).persistAndFlush(player)

    const res = await request(global.app)
      .post(`/games/${game.id}/players`)
      .send({
        aliases: [{
          service: player.aliases[0].service,
          identifier: player.aliases[0].identifier
        }]
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      message: `Player with identifier ${player.aliases[0].identifier} already exists`,
      errorCode: 'IDENTIFIER_TAKEN'
    })
  })
})
