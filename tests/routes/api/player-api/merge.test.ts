import { Collection } from '@mikro-orm/mysql'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerAlias from '../../../../src/entities/player-alias'
import PlayerGameStat from '../../../../src/entities/player-game-stat'
import PlayerProp from '../../../../src/entities/player-prop'
import PlayerSession from '../../../../src/entities/player-session'
import GameSaveFactory from '../../../fixtures/GameSaveFactory'
import GameStatFactory from '../../../fixtures/GameStatFactory'
import PlayerAliasFactory from '../../../fixtures/PlayerAliasFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerGameStatFactory from '../../../fixtures/PlayerGameStatFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Player API - merge', () => {
  it('should not merge with no scopes', async () => {
    const [, token] = await createAPIKeyAndToken([])

    const res = await request(app)
      .post('/v1/players/merge')
      .send({
        playerId1: '6901af6c-7581-40ec-83c8-c8866e77dbea',
        playerId2: 'cbc774b1-1542-4bce-b33f-4f090f53de68',
      })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({
      message: 'Missing access key scope(s): read:players, write:players',
    })
  })

  it('should not merge without the write scope', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])

    const res = await request(app)
      .post('/v1/players/merge')
      .send({
        playerId1: '6901af6c-7581-40ec-83c8-c8866e77dbea',
        playerId2: 'cbc774b1-1542-4bce-b33f-4f090f53de68',
      })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Missing access key scope(s): write:players' })
  })

  it('should not merge without the read scope', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const res = await request(app)
      .post('/v1/players/merge')
      .send({
        playerId1: '6901af6c-7581-40ec-83c8-c8866e77dbea',
        playerId2: 'cbc774b1-1542-4bce-b33f-4f090f53de68',
      })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Missing access key scope(s): read:players' })
  })

  it('should not merge a player into itself', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .post('/v1/players/merge')
      .send({ playerId1: player.id, playerId2: player.id })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      message: 'Cannot merge a player into itself',
    })
  })

  it('should merge player2 into player1', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player1 = await new PlayerFactory([apiKey.game]).withSteamAlias().one()
    const player2 = await new PlayerFactory([apiKey.game]).withUsernameAlias().one()

    await em.persist([player1, player2]).flush()

    const res = await request(app)
      .post('/v1/players/merge')
      .send({ playerId1: player1.id, playerId2: player2.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.id).toBe(player1.id)

    const prevId = player2.id
    const aliases = await em.repo(PlayerAlias).find({ player: prevId }, { refresh: true })
    expect(aliases).toHaveLength(0)

    const props = await em.repo(PlayerProp).find({ player: prevId }, { refresh: true })
    expect(props).toHaveLength(0)

    const mergedPlayer = await em.refresh(player2)
    expect(mergedPlayer).toBeNull()
  })

  it("should correctly replace properties in player1 with player2's", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player1 = await new PlayerFactory([apiKey.game])
      .withSteamAlias()
      .state((player) => ({
        props: new Collection<PlayerProp>(player, [
          new PlayerProp(player, 'currentLevel', '60'),
          new PlayerProp(player, 'currentHealth', '66'),
          new PlayerProp(player, 'pos.x', '50'),
          new PlayerProp(player, 'pos.y', '-30'),
        ]),
      }))
      .one()

    const player2 = await new PlayerFactory([apiKey.game])
      .withUsernameAlias()
      .state((player) => ({
        props: new Collection<PlayerProp>(player, [
          new PlayerProp(player, 'currentLevel', '60'),
          new PlayerProp(player, 'pos.x', '58'),
          new PlayerProp(player, 'pos.y', '-24'),
          new PlayerProp(player, 'pos.z', '4'),
        ]),
      }))
      .one()

    await em.persist([player1, player2]).flush()

    const res = await request(app)
      .post('/v1/players/merge')
      .send({ playerId1: player1.id, playerId2: player2.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.props).toEqual(
      expect.arrayContaining([
        {
          key: 'currentLevel',
          value: '60',
        },
        {
          key: 'pos.x',
          value: '58',
        },
        {
          key: 'pos.y',
          value: '-24',
        },
        {
          key: 'pos.z',
          value: '4',
        },
        {
          key: 'currentHealth',
          value: '66',
        },
      ]),
    )

    const player1PropCount = await em.repo(PlayerProp).count({ player: player1 })
    expect(player1PropCount).toBe(5)

    const player2PropCount = await em.repo(PlayerProp).count({ player: player2 })
    expect(player2PropCount).toBe(0)
  })

  it('should not merge players if alias1 does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player2 = await new PlayerFactory([apiKey.game]).one()

    await em.persist(player2).flush()

    const res = await request(app)
      .post('/v1/players/merge')
      .send({ playerId1: '600dc817-8664-4a22-8ce6-cce0d2b683dd', playerId2: player2.id })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({
      message: 'Player 600dc817-8664-4a22-8ce6-cce0d2b683dd does not exist',
    })
  })

  it('should not merge players if alias2 does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player1 = await new PlayerFactory([apiKey.game]).one()

    await em.persist(player1).flush()

    const res = await request(app)
      .post('/v1/players/merge')
      .send({ playerId1: player1.id, playerId2: '600dc817-8664-4a22-8ce6-cce0d2b683dd' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({
      message: 'Player 600dc817-8664-4a22-8ce6-cce0d2b683dd does not exist',
    })
  })

  it("should transfer player2's saves to player1", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player1 = await new PlayerFactory([apiKey.game]).withSteamAlias().one()
    const player2 = await new PlayerFactory([apiKey.game]).withUsernameAlias().one()
    const save = await new GameSaveFactory([player2]).one()
    await em.persist([player1, player2, save]).flush()

    await request(app)
      .post('/v1/players/merge')
      .send({ playerId1: player1.id, playerId2: player2.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    await em.refresh(save)
    expect(save.player.id).toBe(player1.id)
  })

  it("should transfer player2's stats to player1", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player1 = await new PlayerFactory([apiKey.game]).withSteamAlias().one()
    const player2 = await new PlayerFactory([apiKey.game]).withUsernameAlias().one()

    const stat = await new GameStatFactory([apiKey.game]).one()
    const playerStat = await new PlayerGameStatFactory().construct(player2, stat).one()
    await em.persist([player1, player2, playerStat]).flush()

    await request(app)
      .post('/v1/players/merge')
      .send({ playerId1: player1.id, playerId2: player2.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    await em.refresh(playerStat, { populate: ['player'] })
    expect(playerStat.player.id).toBe(player1.id)
  })

  it("should add player2's stat value to player1's when both have the same stat", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player1 = await new PlayerFactory([apiKey.game]).withSteamAlias().one()
    const player2 = await new PlayerFactory([apiKey.game]).withUsernameAlias().one()

    const stat = await new GameStatFactory([apiKey.game])
      .state(() => ({ minValue: null, maxValue: null }))
      .one()
    const player1Stat = await new PlayerGameStatFactory()
      .construct(player1, stat)
      .state(() => ({ value: 10 }))
      .one()
    const player2Stat = await new PlayerGameStatFactory()
      .construct(player2, stat)
      .state(() => ({ value: 5 }))
      .one()
    await em.persist([player1, player2, player1Stat, player2Stat]).flush()

    await request(app)
      .post('/v1/players/merge')
      .send({ playerId1: player1.id, playerId2: player2.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    await em.refresh(player1Stat)
    expect(player1Stat.value).toBe(15)

    const player2StatCount = await em.repo(PlayerGameStat).count({ player: player2 })
    expect(player2StatCount).toBe(0)
  })

  it("should keep player1's stat unchanged when player2 does not have the same stat", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player1 = await new PlayerFactory([apiKey.game]).withSteamAlias().one()
    const player2 = await new PlayerFactory([apiKey.game]).withUsernameAlias().one()

    const stat = await new GameStatFactory([apiKey.game]).one()
    const player1Stat = await new PlayerGameStatFactory()
      .construct(player1, stat)
      .state(() => ({ value: 42 }))
      .one()
    await em.persist([player1, player2, player1Stat]).flush()

    await request(app)
      .post('/v1/players/merge')
      .send({ playerId1: player1.id, playerId2: player2.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    await em.refresh(player1Stat)
    expect(player1Stat.value).toBe(42)
    expect(player1Stat.player.id).toBe(player1.id)
  })

  it('should cap summed player stats at the max value', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player1 = await new PlayerFactory([apiKey.game]).withSteamAlias().one()
    const player2 = await new PlayerFactory([apiKey.game]).withUsernameAlias().one()

    const stat = await new GameStatFactory([apiKey.game]).state(() => ({ maxValue: 15 })).one()
    const player1Stat = await new PlayerGameStatFactory()
      .construct(player1, stat)
      .state(() => ({ value: 10 }))
      .one()
    const player2Stat = await new PlayerGameStatFactory()
      .construct(player2, stat)
      .state(() => ({ value: 10 }))
      .one()
    await em.persist([player1, player2, player1Stat, player2Stat]).flush()

    await request(app)
      .post('/v1/players/merge')
      .send({ playerId1: player1.id, playerId2: player2.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    await em.refresh(player1Stat)
    expect(player1Stat.value).toBe(15)
  })

  it('should cap summed player stats at the min value', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player1 = await new PlayerFactory([apiKey.game]).withSteamAlias().one()
    const player2 = await new PlayerFactory([apiKey.game]).withUsernameAlias().one()

    const stat = await new GameStatFactory([apiKey.game]).state(() => ({ minValue: 0 })).one()
    const player1Stat = await new PlayerGameStatFactory()
      .construct(player1, stat)
      .state(() => ({ value: 10 }))
      .one()
    const player2Stat = await new PlayerGameStatFactory()
      .construct(player2, stat)
      .state(() => ({ value: -15 }))
      .one()
    await em.persist([player1, player2, player1Stat, player2Stat]).flush()

    await request(app)
      .post('/v1/players/merge')
      .send({ playerId1: player1.id, playerId2: player2.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    await em.refresh(player1Stat)
    expect(player1Stat.value).toBe(0)
  })

  it('should not merge if player1 has auth', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player1 = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    const player2 = await new PlayerFactory([apiKey.game]).one()

    await em.persist([player1, player2]).flush()

    const res = await request(app)
      .post('/v1/players/merge')
      .send({ playerId1: player1.id, playerId2: player2.id })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      message: `Player ${player1.id} has authentication enabled and cannot be merged`,
    })
  })

  it('should not merge if player2 has auth', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).withTaloAlias().one()

    await em.persist([player1, player2]).flush()

    const res = await request(app)
      .post('/v1/players/merge')
      .send({ playerId1: player1.id, playerId2: player2.id })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      message: `Player ${player2.id} has authentication enabled and cannot be merged`,
    })
  })

  it("should delete player2's sessions", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player1 = await new PlayerFactory([apiKey.game]).withSteamAlias().one()
    const player2 = await new PlayerFactory([apiKey.game]).withUsernameAlias().one()

    await em.persist([player1, player2]).flush()

    await clickhouse.insert({
      table: 'player_sessions',
      values: Array.from({ length: 10 }).map((_) => {
        const session = new PlayerSession()
        session.construct(player2)
        return session.toInsertable()
      }),
      format: 'JSONEachRow',
    })

    await request(app)
      .post('/v1/players/merge')
      .send({ playerId1: player1.id, playerId2: player2.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    await vi.waitUntil(async () => {
      const updatedPlayerSessionsCount = await clickhouse
        .query({
          query: `SELECT count() as count FROM player_sessions WHERE player_id = '${player2.id}'`,
          format: 'JSONEachRow',
        })
        .then((res) => res.json<{ count: string }>())
        .then((res) => Number(res[0].count))

      return updatedPlayerSessionsCount === 0
    })
  })

  it('should not merge if both players have aliases with the same service', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player1 = await new PlayerFactory([apiKey.game])
      .state((player) => ({
        aliases: new Collection<PlayerAlias>(player, []),
      }))
      .one()
    const player2 = await new PlayerFactory([apiKey.game])
      .state((player) => ({
        aliases: new Collection<PlayerAlias>(player, []),
      }))
      .one()

    const steamAlias1 = await new PlayerAliasFactory(player1)
      .steam()
      .state(() => ({
        identifier: 'player1_steam_id',
        lastSeenAt: new Date('2024-01-01'),
      }))
      .one()

    const steamAlias2 = await new PlayerAliasFactory(player2)
      .steam()
      .state(() => ({
        identifier: 'player2_steam_id',
        lastSeenAt: new Date('2024-06-01'),
      }))
      .one()

    player1.aliases.add(steamAlias1)
    player2.aliases.add(steamAlias2)

    await em.persist([player1, player2, steamAlias1, steamAlias2]).flush()

    const res = await request(app)
      .post('/v1/players/merge')
      .send({ playerId1: player1.id, playerId2: player2.id })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      message:
        'Cannot merge players: both players have aliases with the following service(s): steam',
    })
  })
})
