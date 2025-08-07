import { Collection } from '@mikro-orm/mysql'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import PlayerProp from '../../../../src/entities/player-prop'
import PlayerGroupFactory from '../../../fixtures/PlayerGroupFactory'
import PlayerGroupRule, { PlayerGroupRuleCastType, PlayerGroupRuleName } from '../../../../src/entities/player-group-rule'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import { randWord } from '@ngneat/falso'
import * as checkGroupMemberships from '../../../../src/lib/groups/checkGroupMemberships'

describe('Player API service - patch', () => {
  it('should update a player\'s properties', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'collectibles', '0'),
        new PlayerProp(player, 'zonesExplored', '1')
      ])
    })).one()
    await em.persistAndFlush(player)

    const res = await request(app)
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
    await em.persistAndFlush(player)

    await request(app)
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

    const res = await request(app)
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
    await em.persistAndFlush(otherPlayer)

    const res = await request(app)
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
    await em.persistAndFlush([group, player])

    const res = await request(app)
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
    await em.persistAndFlush([group, player])

    await em.refresh(group, { populate: ['members'] })
    expect(group.members).toHaveLength(1)

    const res = await request(app)
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
    await em.persistAndFlush(player)

    const res = await request(app)
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

  it('should keep the META_DEV_BUILD prop', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'collectibles', '0'),
        new PlayerProp(player, 'zonesExplored', '1'),
        new PlayerProp(player, 'META_DEV_BUILD', '1')
      ])
    })).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .patch(`/v1/players/${player.id}`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '1'
          },
          {
            key: 'aNewProp',
            value: 'aNewValue'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.props).toHaveLength(4)
    expect(res.body.player.props).toEqual(expect.arrayContaining([
      {
        key: 'META_DEV_BUILD',
        value: '1'
      },
      {
        key: 'collectibles',
        value: '1'
      },
      {
        key: 'zonesExplored',
        value: '1'
      },
      {
        key: 'aNewProp',
        value: 'aNewValue'
      }
    ]))
  })

  it('should only allow memberships to be checked for a player once per request lifecycle', async () => {
    const checkGroupMembershipsSpy = vi.spyOn(checkGroupMemberships, 'default').mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return false
    })

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
    await em.persistAndFlush([group, player])

    await Promise.allSettled(['60', '61', '62', '63', '64', '65'].map((level) => {
      return request(app)
        .patch(`/v1/players/${player.id}`)
        .send({
          props: [
            {
              key: 'currentLevel',
              value: level
            }
          ]
        })
        .auth(token, { type: 'bearer' })
        .expect(200)
    }))

    // once when the player is created, and once for the first patch request
    expect(checkGroupMembershipsSpy).toHaveBeenCalledTimes(2)
    checkGroupMembershipsSpy.mockRestore()
  })

  it('should handle checkGroupMemberships errors', async () => {
    const checkGroupMembershipsSpy = vi.spyOn(checkGroupMemberships, 'default')
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error('unknown'))
    const consoleSpy = vi.spyOn(console, 'error')

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
    await em.persistAndFlush([group, player])

    await request(app)
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

    expect(consoleSpy).toHaveBeenCalledWith('Failed checking memberships: unknown')
    checkGroupMembershipsSpy.mockRestore()
    consoleSpy.mockRestore()
  })
})
