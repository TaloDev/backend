import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity.js'
import GameStatFactory from '../../../fixtures/GameStatFactory.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'

describe('Game stat admin API - update', () => {
  it('should update a stat for a key with the write:stats scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_STATS])

    const stat = await new GameStatFactory([apiKey.game]).one()
    await em.persist(stat).flush()

    const res = await request(app)
      .put(`/admin/v1/game-stats/${stat.id}`)
      .send({
        name: 'New name',
        internalName: stat.internalName,
        global: stat.global,
        maxChange: stat.maxChange,
        minValue: stat.minValue,
        maxValue: stat.maxValue,
        defaultValue: stat.defaultValue,
        minTimeBetweenUpdates: stat.minTimeBetweenUpdates,
      })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.name).toBe('New name')

    const activity = await em.repo(GameActivity).findOneOrFail({
      type: GameActivityType.GAME_STAT_UPDATED,
      game: apiKey.game,
      adminAPIKey: apiKey,
    })
    expect(activity.adminAPIKey?.id).toBe(apiKey.id)
  })

  it('should return 403 for a key missing the write:stats scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_STATS])

    const stat = await new GameStatFactory([apiKey.game]).one()
    await em.persist(stat).flush()

    const res = await request(app)
      .put(`/admin/v1/game-stats/${stat.id}`)
      .send({ name: 'New name' })
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('write:stats')
  })

  it('should return 404 for a stat that does not belong to the key game', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_STATS])
    const [, otherGame] = await createOrganisationAndGame()

    const stat = await new GameStatFactory([otherGame]).one()
    await em.persist(stat).flush()

    const res = await request(app)
      .put(`/admin/v1/game-stats/${stat.id}`)
      .send({ name: 'New name' })
      .auth(keyString, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Stat not found' })
  })
})
