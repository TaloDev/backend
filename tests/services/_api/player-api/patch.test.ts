import { Collection, EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import PlayerProp from '../../../../src/entities/player-prop'
import PlayerGroupFactory from '../../../fixtures/PlayerGroupFactory'
import PlayerGroupRule, { PlayerGroupRuleCastType, PlayerGroupRuleName } from '../../../../src/entities/player-group-rule'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import { randWord } from '@ngneat/falso'

describe('Player API service - patch', () => {
  it('should update a player\'s properties', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'collectibles', '0'),
        new PlayerProp(player, 'zonesExplored', '1')
      ])
    })).one()
    await (<EntityManager>global.em).persistAndFlush(player)

    const res = await request(global.app)
      .patch(`/v1/players/${player.id}`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '1'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.props).toEqual(expect.arrayContaining([
      {
        key: 'collectibles',
        value: '1'
      },
      {
        key: 'zonesExplored',
        value: '1'
      }
    ]))
  })

  it('should not update a player\'s properties if the scope is missing', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const player = await new PlayerFactory([apiKey.game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'collectibles', '0'),
        new PlayerProp(player, 'zonesExplored', '1')
      ])
    })).one()
    await (<EntityManager>global.em).persistAndFlush(player)

    await request(global.app)
      .patch(`/v1/players/${player.id}`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '1'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not update a non-existent player\'s properties', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const res = await request(global.app)
      .patch('/v1/players/546')
      .send({
        props: [
          {
            key: 'collectibles',
            value: '1'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not update a player from another game\'s properties', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const [, otherGame] = await createOrganisationAndGame()
    const otherPlayer = await new PlayerFactory([otherGame]).one()
    await (<EntityManager>global.em).persistAndFlush(otherPlayer)

    const res = await request(global.app)
      .patch(`/v1/players/${otherPlayer.id}`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '1'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should update group memberships when props change', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const rule = new PlayerGroupRule(PlayerGroupRuleName.GTE, 'props.currentLevel')
    rule.castType = PlayerGroupRuleCastType.DOUBLE
    rule.operands = ['60']

    const group = await new PlayerGroupFactory().construct(apiKey.game).state(() => ({ rules: [rule] })).one()

    const player = await new PlayerFactory([apiKey.game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'collectibles', '0'),
        new PlayerProp(player, 'currentLevel', '59')
      ])
    })).one()
    await (<EntityManager>global.em).persistAndFlush([group, player])

    const res = await request(global.app)
      .patch(`/v1/players/${player.id}`)
      .send({
        props: [
          {
            key: 'currentLevel',
            value: '60'
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

  it('should remove players from a group when they are no longer eligible', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const rule = new PlayerGroupRule(PlayerGroupRuleName.LTE, 'props.currentLevel')
    rule.castType = PlayerGroupRuleCastType.DOUBLE
    rule.operands = ['59']

    const group = await new PlayerGroupFactory().construct(apiKey.game).state(() => ({ rules: [rule] })).one()

    const player = await new PlayerFactory([apiKey.game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'collectibles', '0'),
        new PlayerProp(player, 'currentLevel', '59')
      ])
    })).one()
    await (<EntityManager>global.em).persistAndFlush([group, player])

    await (<EntityManager>global.em).refresh(group, { populate: ['members'] })
    expect(group.members).toHaveLength(1)

    const res = await request(global.app)
      .patch(`/v1/players/${player.id}`)
      .send({
        props: [
          {
            key: 'currentLevel',
            value: '60'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.groups).toHaveLength(0)
  })

  it('should filter keys starting with META_', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).one()
    player.setProps([
      {
        key: `${randWord()}${randWord()}${randWord()}`,
        value: randWord()
      }
    ])
    await (<EntityManager>global.em).persistAndFlush(player)

    const res = await request(global.app)
      .patch(`/v1/players/${player.id}`)
      .send({
        props: [
          {
            key: `${randWord()}${randWord()}${randWord()}`,
            value: randWord()
          },
          {
            key: 'META_BREAK_THINGS',
            value: 'true'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.props).toHaveLength(2)
  })
})
