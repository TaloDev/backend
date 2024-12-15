import { Collection, EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerAlias from '../../../../src/entities/player-alias'
import PlayerProp from '../../../../src/entities/player-prop'
import GameSaveFactory from '../../../fixtures/GameSaveFactory'
import PlayerGameStatFactory from '../../../fixtures/PlayerGameStatFactory'
import GameStatFactory from '../../../fixtures/GameStatFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import Player from '../../../../src/entities/player'

describe('Player API service - merge', () => {
  it('should not merge with no scopes', async () => {
    const [, token] = await createAPIKeyAndToken([])

    const res = await request(global.app)
      .post('/v1/players/merge')
      .send({ playerId1: '6901af6c-7581-40ec-83c8-c8866e77dbea', playerId2: 'cbc774b1-1542-4bce-b33f-4f090f53de68' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Missing access key scope(s): read:players, write:players' })
  })

  it('should not merge without the write scope', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])

    const res = await request(global.app)
      .post('/v1/players/merge')
      .send({ playerId1: '6901af6c-7581-40ec-83c8-c8866e77dbea', playerId2: 'cbc774b1-1542-4bce-b33f-4f090f53de68' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Missing access key scope(s): write:players' })
  })

  it('should not merge without the read scope', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const res = await request(global.app)
      .post('/v1/players/merge')
      .send({ playerId1: '6901af6c-7581-40ec-83c8-c8866e77dbea', playerId2: 'cbc774b1-1542-4bce-b33f-4f090f53de68' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Missing access key scope(s): read:players' })
  })

  it('should merge player2 into player1', async () => {
    const em: EntityManager = global.em
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()

    await em.persistAndFlush([player1, player2])

    const res = await request(global.app)
      .post('/v1/players/merge')
      .send({ playerId1: player1.id, playerId2: player2.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.id).toBe(player1.id)

    const prevId = player2.id
    const aliases = await em.getRepository(PlayerAlias).find({ player: prevId })
    expect(aliases).toHaveLength(0)

    em.clear()
    const mergedPlayer = await em.getRepository(Player).findOne(prevId)
    expect(mergedPlayer).toBeNull()
  })

  it('should correctly replace properties in player1 with player2\'s', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player1 = await new PlayerFactory([apiKey.game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'currentLevel', '60'),
        new PlayerProp(player, 'currentHealth', '66'),
        new PlayerProp(player, 'pos.x', '50'),
        new PlayerProp(player, 'pos.y', '-30')
      ])
    })).one()

    const player2 = await new PlayerFactory([apiKey.game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'currentLevel', '60'),
        new PlayerProp(player, 'pos.x', '58'),
        new PlayerProp(player, 'pos.y', '-24'),
        new PlayerProp(player, 'pos.z', '4')
      ])
    })).one()

    await (<EntityManager>global.em).persistAndFlush([player1, player2])

    const res = await request(global.app)
      .post('/v1/players/merge')
      .send({ playerId1: player1.id, playerId2: player2.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.props).toStrictEqual([
      {
        key: 'currentLevel',
        value: '60'
      },
      {
        key: 'pos.x',
        value: '58'
      },
      {
        key: 'pos.y',
        value: '-24'
      },
      {
        key: 'pos.z',
        value: '4'
      },
      {
        key: 'currentHealth',
        value: '66'
      }
    ])
  })

  it('should not merge players if alias1 does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player2 = await new PlayerFactory([apiKey.game]).one()

    await (<EntityManager>global.em).persistAndFlush(player2)

    const res = await request(global.app)
      .post('/v1/players/merge')
      .send({ playerId1: 'nah', playerId2: player2.id })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player nah does not exist' })
  })

  it('should not merge players if alias2 does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player1 = await new PlayerFactory([apiKey.game]).one()

    await (<EntityManager>global.em).persistAndFlush(player1)

    const res = await request(global.app)
      .post('/v1/players/merge')
      .send({ playerId1: player1.id, playerId2: 'nah' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player nah does not exist' })
  })

  it('should transfer player2\'s saves to player1', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    const save = await new GameSaveFactory([player2]).one()
    await (<EntityManager>global.em).persistAndFlush([player1, player2, save])

    await request(global.app)
      .post('/v1/players/merge')
      .send({ playerId1: player1.id, playerId2: player2.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    await (<EntityManager>global.em).refresh(save)
    expect(save.player.id).toBe(player1.id)
  })

  it('should transfer player2\'s stats to player1', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()

    const stat = await new GameStatFactory([apiKey.game]).one()
    const playerStat = await new PlayerGameStatFactory().construct(player2, stat).one()
    await (<EntityManager>global.em).persistAndFlush([player1, player2, playerStat])

    await request(global.app)
      .post('/v1/players/merge')
      .send({ playerId1: player1.id, playerId2: player2.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    await (<EntityManager>global.em).refresh(playerStat, { populate: ['player'] })
    expect(playerStat.player.id).toBe(player1.id)
  })

  it('should not merge if player1 has auth', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player1 = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    const player2 = await new PlayerFactory([apiKey.game]).one()

    await (<EntityManager>global.em).persistAndFlush([player1, player2])

    const res = await request(global.app)
      .post('/v1/players/merge')
      .send({ playerId1: player1.id, playerId2: player2.id })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      message: `Player ${player1.id} has authentication enabled and cannot be merged`
    })
  })

  it('should not merge if player2 has auth', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).withTaloAlias().one()

    await (<EntityManager>global.em).persistAndFlush([player1, player2])

    const res = await request(global.app)
      .post('/v1/players/merge')
      .send({ playerId1: player1.id, playerId2: player2.id })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      message: `Player ${player2.id} has authentication enabled and cannot be merged`
    })
  })
})
