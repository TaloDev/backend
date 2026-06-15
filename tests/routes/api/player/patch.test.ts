import { Collection } from '@mikro-orm/mysql'
import { randWord } from '@ngneat/falso'
import { Redis } from 'ioredis'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key.js'
import PlayerGroupRule, {
  PlayerGroupRuleCastType,
  PlayerGroupRuleName,
} from '../../../../src/entities/player-group-rule.js'
import PlayerGroup from '../../../../src/entities/player-group.js'
import PlayerProp from '../../../../src/entities/player-prop.js'
import { DEV_BUILD_META_KEY } from '../../../../src/entities/player.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import PlayerGroupFactory from '../../../fixtures/PlayerGroupFactory.js'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'

describe('Player API - update', () => {
  it("should update a player's properties", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game])
      .state((player) => ({
        props: new Collection<PlayerProp>(player, [
          new PlayerProp(player, 'collectibles', '0'),
          new PlayerProp(player, 'zonesExplored', '1'),
        ]),
      }))
      .one()
    await em.persist(player).flush()

    const res = await request(app)
      .patch(`/v1/players/${player.id}`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '1',
          },
        ],
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.props).toEqual(
      expect.arrayContaining([
        {
          key: 'collectibles',
          value: '1',
        },
        {
          key: 'zonesExplored',
          value: '1',
        },
      ]),
    )
  })

  it("should not update a player's properties if the scope is missing", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const player = await new PlayerFactory([apiKey.game])
      .state((player) => ({
        props: new Collection<PlayerProp>(player, [
          new PlayerProp(player, 'collectibles', '0'),
          new PlayerProp(player, 'zonesExplored', '1'),
        ]),
      }))
      .one()
    await em.persist(player).flush()

    await request(app)
      .patch(`/v1/players/${player.id}`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '1',
          },
        ],
      })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it("should not update a non-existent player's properties", async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const res = await request(app)
      .patch('/v1/players/546')
      .send({
        props: [
          {
            key: 'collectibles',
            value: '1',
          },
        ],
      })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it("should not update a player from another game's properties", async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const [, otherGame] = await createOrganisationAndGame()
    const otherPlayer = await new PlayerFactory([otherGame]).one()
    await em.persist(otherPlayer).flush()

    const res = await request(app)
      .patch(`/v1/players/${otherPlayer.id}`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '1',
          },
        ],
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

    const group = await new PlayerGroupFactory()
      .construct(apiKey.game)
      .state(() => ({ rules: [rule] }))
      .one()

    const player = await new PlayerFactory([apiKey.game])
      .state((player) => ({
        props: new Collection<PlayerProp>(player, [
          new PlayerProp(player, 'collectibles', '0'),
          new PlayerProp(player, 'currentLevel', '59'),
        ]),
      }))
      .one()
    await em.persist([group, player]).flush()

    const res = await request(app)
      .patch(`/v1/players/${player.id}`)
      .send({
        props: [
          {
            key: 'currentLevel',
            value: '60',
          },
        ],
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.groups).toStrictEqual([
      {
        id: group.id,
        name: group.name,
      },
    ])
  })

  it('should remove players from a group when they are no longer eligible', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const rule = new PlayerGroupRule(PlayerGroupRuleName.LTE, 'props.currentLevel')
    rule.castType = PlayerGroupRuleCastType.DOUBLE
    rule.operands = ['59']

    const group = await new PlayerGroupFactory()
      .construct(apiKey.game)
      .state(() => ({ rules: [rule] }))
      .one()

    const player = await new PlayerFactory([apiKey.game])
      .state((player) => ({
        props: new Collection<PlayerProp>(player, [
          new PlayerProp(player, 'collectibles', '0'),
          new PlayerProp(player, 'currentLevel', '59'),
        ]),
      }))
      .one()
    await em.persist([group, player]).flush()

    await group.checkMembership(em)
    expect(group.members).toHaveLength(1)

    const res = await request(app)
      .patch(`/v1/players/${player.id}`)
      .send({
        props: [
          {
            key: 'currentLevel',
            value: '60',
          },
        ],
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
        value: randWord(),
      },
    ])
    await em.persist(player).flush()

    const res = await request(app)
      .patch(`/v1/players/${player.id}`)
      .send({
        props: [
          {
            key: `${randWord()}${randWord()}${randWord()}`,
            value: randWord(),
          },
          {
            key: 'META_BREAK_THINGS',
            value: 'true',
          },
        ],
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.props).toHaveLength(2)
  })

  it('should keep the META_DEV_BUILD prop', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game])
      .state((player) => ({
        props: new Collection<PlayerProp>(player, [
          new PlayerProp(player, 'collectibles', '0'),
          new PlayerProp(player, 'zonesExplored', '1'),
          new PlayerProp(player, DEV_BUILD_META_KEY, '1'),
        ]),
      }))
      .one()
    await em.persist(player).flush()

    const res = await request(app)
      .patch(`/v1/players/${player.id}`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '1',
          },
          {
            key: 'aNewProp',
            value: 'aNewValue',
          },
        ],
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.props).toHaveLength(4)
    expect(res.body.player.props).toEqual(
      expect.arrayContaining([
        {
          key: DEV_BUILD_META_KEY,
          value: '1',
        },
        {
          key: 'collectibles',
          value: '1',
        },
        {
          key: 'zonesExplored',
          value: '1',
        },
        {
          key: 'aNewProp',
          value: 'aNewValue',
        },
      ]),
    )
  })

  it('should skip checkGroupMemberships when the checkMembership redis lock is already held', async () => {
    const isPlayerEligibleSpy = vi
      .spyOn(PlayerGroup.prototype, 'isPlayerEligible')
      .mockResolvedValue(true)

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const rule = new PlayerGroupRule(PlayerGroupRuleName.GTE, 'props.currentLevel')
    rule.castType = PlayerGroupRuleCastType.DOUBLE
    rule.operands = ['60']

    const group = await new PlayerGroupFactory()
      .construct(apiKey.game)
      .state(() => ({ rules: [rule] }))
      .one()

    const player = await new PlayerFactory([apiKey.game])
      .state((player) => ({
        props: new Collection<PlayerProp>(player, [
          new PlayerProp(player, 'collectibles', '0'),
          new PlayerProp(player, 'currentLevel', '59'),
        ]),
      }))
      .one()
    await em.persist([group, player]).flush()

    // Pre-hold the checkMembership redis lock to verify the early-return path.
    // Cross-request serialisation is handled by the redlock in `updatePlayerHandler`.
    // This lock is a defensive backstop.
    await redis.set(`checkMembership:${player.id}`, '1', 'EX', 30)

    await request(app)
      .patch(`/v1/players/${player.id}`)
      .send({
        props: [
          {
            key: 'currentLevel',
            value: '60',
          },
        ],
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(isPlayerEligibleSpy).not.toHaveBeenCalled()
    isPlayerEligibleSpy.mockRestore()
  })

  it('should handle checkGroupMemberships errors', async () => {
    const isPlayerEligibleSpy = vi
      .spyOn(PlayerGroup.prototype, 'isPlayerEligible')
      .mockRejectedValueOnce(new Error('unknown'))
    const consoleSpy = vi.spyOn(console, 'error')

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const rule = new PlayerGroupRule(PlayerGroupRuleName.GTE, 'props.currentLevel')
    rule.castType = PlayerGroupRuleCastType.DOUBLE
    rule.operands = ['60']

    const group = await new PlayerGroupFactory()
      .construct(apiKey.game)
      .state(() => ({ rules: [rule] }))
      .one()

    const player = await new PlayerFactory([apiKey.game])
      .state((player) => ({
        props: new Collection<PlayerProp>(player, [
          new PlayerProp(player, 'collectibles', '0'),
          new PlayerProp(player, 'currentLevel', '59'),
        ]),
      }))
      .one()
    await em.persist([group, player]).flush()

    await request(app)
      .patch(`/v1/players/${player.id}`)
      .send({
        props: [
          {
            key: 'currentLevel',
            value: '60',
          },
        ],
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(consoleSpy).toHaveBeenCalledWith('Failed checking memberships: unknown')
    isPlayerEligibleSpy.mockRestore()
    consoleSpy.mockRestore()
  })

  it('should reject profane props when blockPropsProfanity is enabled', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])
    apiKey.game.blockPropsProfanity = true
    await em.flush()

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .patch(`/v1/players/${player.id}`)
      .send({
        props: [
          { key: 'nickname', value: 'fuck' },
          { key: 'level', value: '5' },
        ],
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.props).toEqual(expect.arrayContaining([{ key: 'level', value: '5' }]))
    expect(res.body.rejectedProps).toEqual([
      {
        key: 'nickname',
        error: 'PROP_CONTAINS_PROFANITY',
        message: 'Prop value contains profanity',
      },
    ])
  })

  it('should allow profane props when blockPropsProfanity is disabled', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .patch(`/v1/players/${player.id}`)
      .send({
        props: [
          { key: 'nickname', value: 'fuck' },
          { key: 'level', value: '5' },
        ],
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.props).toEqual(
      expect.arrayContaining([
        { key: 'nickname', value: 'fuck' },
        { key: 'level', value: '5' },
      ]),
    )
    expect(res.body.rejectedProps).toEqual([])
  })

  // this is more likely to happen with event/stat flushing, but easier to test it here
  it('should handle unique constraint failures for groups', async () => {
    const redisSetSpy = vi.spyOn(Redis.prototype, 'set').mockResolvedValue('OK')
    const consoleSpy = vi.spyOn(console, 'info')

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const rule = new PlayerGroupRule(PlayerGroupRuleName.GTE, 'props.currentLevel')
    rule.castType = PlayerGroupRuleCastType.DOUBLE
    rule.operands = ['60']

    const group = await new PlayerGroupFactory()
      .construct(apiKey.game)
      .state(() => ({ rules: [rule] }))
      .one()

    const player = await new PlayerFactory([apiKey.game])
      .state((player) => ({
        props: new Collection<PlayerProp>(player, [
          new PlayerProp(player, 'collectibles', '0'),
          new PlayerProp(player, 'currentLevel', '59'),
        ]),
      }))
      .one()
    await em.persist([group, player]).flush()

    await Promise.allSettled(
      ['60', '61', '62', '63', '64', '65'].map((level) => {
        return request(app)
          .patch(`/v1/players/${player.id}`)
          .send({
            props: [
              {
                key: 'currentLevel',
                value: level,
              },
            ],
          })
          .auth(token, { type: 'bearer' })
          .expect(200)
      }),
    )

    expect(consoleSpy).toHaveBeenCalledWith(`Duplicate group attempt for player ${player.id}`)

    redisSetSpy.mockRestore()
    consoleSpy.mockRestore()
  })

  it('should serialize concurrent updates for the same player', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])
    const player = await new PlayerFactory([apiKey.game])
      .state((p) => ({ props: new Collection<PlayerProp>(p) }))
      .one()
    await em.persist(player).flush()

    const results = await Promise.allSettled(
      ['a', 'b', 'c', 'd', 'e'].map((suffix) =>
        request(app)
          .patch(`/v1/players/${player.id}`)
          .send({
            props: [{ key: `prop-${suffix}`, value: '1' }],
          })
          .auth(token, { type: 'bearer' }),
      ),
    )

    results.forEach((res) => {
      if (res.status === 'rejected') throw res.reason
      expect(res.value.status).toBe(200)
    })

    await em.refresh(player)
    const props = player.props.getItems()
    expect(props.length).toBe(5)
  })

  it('should not block concurrent updates for different players', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])
    const players = await new PlayerFactory([apiKey.game]).many(5)
    await em.persist(players).flush()

    const results = await Promise.all(
      players.map((player) =>
        request(app)
          .patch(`/v1/players/${player.id}`)
          .send({
            props: [{ key: 'foo', value: 'bar' }],
          })
          .auth(token, { type: 'bearer' }),
      ),
    )

    results.forEach((res) => {
      expect(res.status).toBe(200)
    })

    for (const player of players) {
      await em.refresh(player)
      const prop = player.props.getItems().find((p) => p.key === 'foo')
      expect(prop?.value).toBe('bar')
    }
  })
})
