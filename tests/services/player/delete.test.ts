import request from 'supertest'
import PlayerFactory from '../../fixtures/PlayerFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import userPermissionProvider from '../../utils/userPermissionProvider'
import { UserType } from '../../../src/entities/user'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'
import PlayerAlias from '../../../src/entities/player-alias'
import { Collection } from '@mikro-orm/mysql'

describe('Player service - delete', () => {
  it.each(userPermissionProvider([
    UserType.ADMIN
  ], 204))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type }, organisation)

    const player = await new PlayerFactory([game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .delete(`/games/${game.id}/players/${player.id}`)
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await em.repo(GameActivity).findOne({
      type: GameActivityType.PLAYER_DELETED,
      extra: {
        playerId: player.id
      }
    })

    const deletedPlayer = await em.refresh(player)
    if (statusCode === 204) {
      expect(activity).not.toBeNull()
      expect(deletedPlayer).toBeNull()
    } else {
      expect(res.body).toStrictEqual({
        message: 'You do not have permissions to delete players'
      })

      expect(activity).toBeNull()
      expect(deletedPlayer).not.toBeNull()
    }
  })

  it('should return 404 for non-existent player', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .delete(`/games/${game.id}/players/non-existent-id`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not allow users to delete players from other games', async () => {
    const [, game] = await createOrganisationAndGame()
    const [otherToken] = await createUserAndToken({ type: UserType.ADMIN })

    const player = await new PlayerFactory([game]).one()
    await em.persistAndFlush(player)

    await request(app)
      .delete(`/games/${game.id}/players/${player.id}`)
      .auth(otherToken, { type: 'bearer' })
      .expect(403)
  })

  it('should delete a player and their clickhouse data even if they have no aliases', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const player = await new PlayerFactory([game]).state((player) => ({
      aliases: new Collection<PlayerAlias>(player, [])
    })).one()
    await em.persistAndFlush(player)

    await request(app)
      .delete(`/games/${game.id}/players/${player.id}`)
      .auth(token, { type: 'bearer' })
      .expect(204)

    const deletedPlayer = await em.refresh(player)
    expect(deletedPlayer).toBeNull()

    await vi.waitUntil(async () => {
      // sessions are the only table related to players and not aliases
      const updatedPlayerSessionsCount = await clickhouse.query({
        query: 'SELECT count() as count FROM player_sessions',
        format: 'JSONEachRow'
      }).then((res) => res.json<{ count: string }>())
        .then((res) => Number(res[0].count))

      return updatedPlayerSessionsCount === 0
    })
  })
})
