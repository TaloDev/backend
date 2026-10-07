import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity.js'
import { DEV_BUILD_META_KEY } from '../../../../src/entities/player.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'

describe('Player admin API - update', () => {
  it('should update a player for a key with the write:players scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .patch(`/admin/v1/players/${player.id}`)
      .send({
        props: [{ key: 'currentLevel', value: '72' }],
      })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.props).toEqual(
      expect.arrayContaining([{ key: 'currentLevel', value: '72' }]),
    )
    expect(res.body.rejectedProps).toEqual([])

    const activity = await em.repo(GameActivity).findOneOrFail({
      type: GameActivityType.PLAYER_PROPS_UPDATED,
      game: apiKey.game,
      adminAPIKey: apiKey,
    })
    expect(activity.adminAPIKey?.id).toBe(apiKey.id)
  })

  it('should toggle dev build', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .patch(`/admin/v1/players/${player.id}`)
      .send({ devBuild: true })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.devBuild).toBe(true)
    expect(res.body.rejectedProps).toEqual([])

    const activity = await em.repo(GameActivity).findOneOrFail({
      type: GameActivityType.PLAYER_DEV_BUILD_TOGGLED,
      game: apiKey.game,
      adminAPIKey: apiKey,
    })
    expect(activity.adminAPIKey?.id).toBe(apiKey.id)
  })

  it('should unset dev build', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).devBuild().one()
    await em.persist(player).flush()

    const res = await request(app)
      .patch(`/admin/v1/players/${player.id}`)
      .send({ devBuild: false })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.devBuild).toBe(false)
    expect(res.body.rejectedProps).toEqual([])

    await em.refresh(player)
    expect(player.devBuild).toBe(false)
    expect(player.props.getItems().some((p) => p.key === DEV_BUILD_META_KEY)).toBe(false)

    const activity = await em.repo(GameActivity).findOneOrFail({
      type: GameActivityType.PLAYER_DEV_BUILD_TOGGLED,
      game: apiKey.game,
      adminAPIKey: apiKey,
    })
    expect(activity.adminAPIKey?.id).toBe(apiKey.id)
  })

  it('should update props and toggle dev build in the same request', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .patch(`/admin/v1/players/${player.id}`)
      .send({
        props: [{ key: 'currentLevel', value: '72' }],
        devBuild: true,
      })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.devBuild).toBe(true)
    // the dev build prop must survive the props merge
    expect(res.body.player.props).toEqual(
      expect.arrayContaining([
        { key: 'currentLevel', value: '72' },
        { key: DEV_BUILD_META_KEY, value: '1' },
      ]),
    )
  })

  it('should return 403 for a key missing the write:players scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .patch(`/admin/v1/players/${player.id}`)
      .send({
        props: [{ key: 'currentLevel', value: '72' }],
      })
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('write:players')
  })

  it('should return 404 for a non-existent player', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_PLAYERS])

    const res = await request(app)
      .patch('/admin/v1/players/non-existent-id')
      .send({})
      .auth(keyString, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should return 404 for a player in another game', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_PLAYERS])
    const { apiKey: otherKey } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([otherKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .patch(`/admin/v1/players/${player.id}`)
      .send({
        props: [{ key: 'currentLevel', value: '72' }],
      })
      .auth(keyString, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })
})
