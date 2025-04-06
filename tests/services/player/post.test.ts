import request from 'supertest'
import PlayerGroupFactory from '../../fixtures/PlayerGroupFactory'
import PlayerGroupRule, { PlayerGroupRuleCastType, PlayerGroupRuleName } from '../../../src/entities/player-group-rule'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import PlayerFactory from '../../fixtures/PlayerFactory'
import { randText, randUserName } from '@ngneat/falso'

describe('Player service - post', () => {
  it('should create a player', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
      .post(`/games/${game.id}/players`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player).toBeTruthy()
  })

  it('should create a player with aliases', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
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

    const res = await request(app)
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

    const group = await new PlayerGroupFactory().construct(game).state(() => ({ rules: [rule] })).one()
    await em.persistAndFlush(group)

    const res = await request(app)
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

    const res = await request(app)
      .post('/games/99999/players')
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not create a player for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    await request(app)
      .post(`/games/${game.id}/players`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not create a player if props are in the incorrect format', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
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

    const username = randUserName()

    const res = await request(app)
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
    await em.persistAndFlush(player)

    const res = await request(app)
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
      message: `Player with identifier '${player.aliases[0].identifier}' already exists`,
      errorCode: 'IDENTIFIER_TAKEN'
    })
  })

  it('should create a player when hitting 100% of pricing plan limit', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    organisation.pricingPlan.pricingPlan.playerLimit = 20
    const players = await new PlayerFactory([game]).many(20)
    await em.persistAndFlush(players)

    const res = await request(app)
      .post(`/games/${game.id}/players`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player).toBeTruthy()
  })

  it('should not create a player when going over 105% of pricing plan limit', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    organisation.pricingPlan.pricingPlan.playerLimit = 20
    const players = await new PlayerFactory([game]).many(21)
    await em.persistAndFlush(players)

    const res = await request(app)
      .post(`/games/${game.id}/players`)
      .auth(token, { type: 'bearer' })
      .expect(402)

    expect(res.body).toStrictEqual({
      message: 'Payment Required',
      limit: 20
    })
  })

  it('should create a player when under pricing plan limit', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    organisation.pricingPlan.pricingPlan.playerLimit = 2
    const player = await new PlayerFactory([game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .post(`/games/${game.id}/players`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player).toBeTruthy()
  })

  it('should reject props where the key is greater than 128 characters', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
      .post(`/games/${game.id}/players`)
      .send({
        props: [
          {
            key: randText({ charCount: 129 }),
            value: '1'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        props: ['Prop key length (129) exceeds 128 characters']
      }
    })
  })

  it('should reject props where the value is greater than 512 characters', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
      .post(`/games/${game.id}/players`)
      .send({
        props: [
          {
            key: 'bio',
            value: randText({ charCount: 513 })
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        props: ['Prop value length (513) exceeds 512 characters']
      }
    })
  })
})
