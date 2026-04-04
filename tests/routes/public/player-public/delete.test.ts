import bcrypt from 'bcrypt'
import assert from 'node:assert'
import request from 'supertest'
import PlayerAuthActivity, {
  PlayerAuthActivityType,
} from '../../../../src/entities/player-auth-activity'
import { buildPublicPlayerSession } from '../../../../src/routes/public/player-public/common'
import * as deletePlayers from '../../../../src/tasks/deletePlayers'
import PlayerAuthActivityFactory from '../../../fixtures/PlayerAuthActivityFactory'
import PlayerAuthFactory from '../../../fixtures/PlayerAuthFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'

describe('Player public - delete', { timeout: 30_000 }, () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should delete the account if the current password is correct', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game])
      .withTaloAlias()
      .state(async () => ({
        auth: await new PlayerAuthFactory()
          .state(async () => ({
            password: await bcrypt.hash('password', 10),
          }))
          .one(),
      }))
      .one()
    const alias = player.aliases[0]
    const activities = await new PlayerAuthActivityFactory(game).state(() => ({ player })).many(10)
    await em.persist([player, ...activities]).flush()

    const { sessionToken } = await buildPublicPlayerSession(alias)
    const prevIdentifier = alias.identifier

    await request(app)
      .delete(`/public/players/${game.getToken()}`)
      .send({ sessionToken })
      .expect(204)

    const updatedPlayer = await em.refreshOrFail(player, { populate: ['aliases', 'auth'] })
    expect(updatedPlayer.aliases).toHaveLength(0)
    expect(updatedPlayer.auth).toBeNull()

    expect(await em.refresh(alias)).toBeNull()

    const activity = await em.repo(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.DELETED_AUTH,
      player: player.id,
      extra: {
        selfService: true,
        identifier: prevIdentifier,
      },
    })
    assert(activity)
    expect(activity.extra.ip).toBeUndefined()

    const activityCount = await em.repo(PlayerAuthActivity).count({ player: player.id })
    expect(activityCount).toBe(1)
  })

  it('should return 404 for an invalid game token', async () => {
    await request(app).delete('/public/players/badtoken').send({ sessionToken: 'fake' }).expect(404)
  })

  it('should return 401 for an invalid session', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game])
      .withTaloAlias()
      .state(async () => ({
        auth: await new PlayerAuthFactory()
          .state(async () => ({
            password: await bcrypt.hash('password', 10),
          }))
          .one(),
      }))
      .one()
    await em.persist(player).flush()

    const res = await request(app)
      .delete(`/public/players/${game.getToken()}`)
      .send({ sessionToken: 'invalid-session-token' })
      .expect(401)

    expect(res.body.errorCode).toBe('INVALID_SESSION')
  })

  it('should return 400 if the player does not have authentication', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game]).one()
    await em.persist(player).flush()

    const alias = player.aliases[0]
    const { sessionToken } = await buildPublicPlayerSession(alias)

    const res = await request(app)
      .delete(`/public/players/${game.getToken()}`)
      .send({ sessionToken })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Player does not have authentication' })
  })

  it('should rollback if clickhouse fails', async () => {
    vi.spyOn(deletePlayers, 'deleteClickHousePlayerData').mockRejectedValue(new Error())
    const [, game] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game])
      .withTaloAlias()
      .state(async () => ({
        auth: await new PlayerAuthFactory()
          .state(async () => ({
            password: await bcrypt.hash('password', 10),
          }))
          .one(),
      }))
      .one()
    const alias = player.aliases[0]
    await em.persist(player).flush()

    const { sessionToken } = await buildPublicPlayerSession(alias)

    await request(app)
      .delete(`/public/players/${game.getToken()}`)
      .send({ sessionToken })
      .expect(500)

    expect(await em.refresh(alias)).not.toBeNull()
  })

  it('should not delete an account from a different game', async () => {
    const [, game1] = await createOrganisationAndGame()
    const [, game2] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game1])
      .withTaloAlias()
      .state(async () => ({
        auth: await new PlayerAuthFactory()
          .state(async () => ({
            password: await bcrypt.hash('password', 10),
          }))
          .one(),
      }))
      .one()
    const alias = player.aliases[0]
    await em.persist(player).flush()

    const { sessionToken } = await buildPublicPlayerSession(alias)

    const res = await request(app)
      .delete(`/public/players/${game2.getToken()}`)
      .send({ sessionToken })
      .expect(401)

    expect(res.body.errorCode).toBe('INVALID_SESSION')
  })
})
