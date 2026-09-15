import { addDays, addMinutes, subDays } from 'date-fns'
import request from 'supertest'
import Prop from '../../../../../src/entities/prop.js'
import ScheduledGameConfigChange from '../../../../../src/entities/scheduled-game-config-change.js'
import { UserType } from '../../../../../src/entities/user.js'
import createOrganisationAndGame from '../../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../../utils/createUserAndToken.js'
import userPermissionProvider from '../../../../utils/userPermissionProvider.js'

describe('Scheduled game config change - create', () => {
  it.each(userPermissionProvider([UserType.ADMIN]))(
    'should return a %i for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token] = await createUserAndToken({ type }, organisation)

      const res = await request(app)
        .post(`/games/${game.id}/game-config/scheduled-changes`)
        .send({
          changes: [{ key: 'xpRate', value: '3', applyAt: addDays(new Date(), 1).toISOString() }],
        })
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      const changes = await em.repo(ScheduledGameConfigChange).find({ game })
      expect(changes).toHaveLength(statusCode === 200 ? 1 : 0)

      if (statusCode === 200) {
        expect(res.body.changes).toHaveLength(1)
      }
    },
  )

  it('should schedule multiple changes to the same key', async () => {
    const [organisation, game] = await createOrganisationAndGame(
      {},
      { props: [new Prop('xpRate', '1')] },
    )
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    await request(app)
      .post(`/games/${game.id}/game-config/scheduled-changes`)
      .send({
        changes: [
          { key: 'xpRate', value: '2', applyAt: addDays(new Date(), 1).toISOString() },
          { key: 'xpRate', value: '3', applyAt: addDays(new Date(), 2).toISOString() },
        ],
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const changes = await em
      .repo(ScheduledGameConfigChange)
      .find({ game }, { orderBy: { applyAt: 'ASC' } })
    expect(changes.map((change) => change.value)).toStrictEqual(['2', '3'])
  })

  it('should reject keys starting with META_', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .post(`/games/${game.id}/game-config/scheduled-changes`)
      .send({
        changes: [
          {
            key: 'META_BREAK_THINGS',
            value: 'true',
            applyAt: addDays(new Date(), 1).toISOString(),
          },
        ],
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body.errors.props).toStrictEqual([
      "Prop keys starting with 'META_' are reserved for internal systems, please use another key name",
    ])
  })

  it('should reject an applyAt in the past', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    await request(app)
      .post(`/games/${game.id}/game-config/scheduled-changes`)
      .send({
        changes: [{ key: 'xpRate', value: '3', applyAt: subDays(new Date(), 1).toISOString() }],
      })
      .auth(token, { type: 'bearer' })
      .expect(400)
  })

  it('should reject a value longer than the game config limit', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .post(`/games/${game.id}/game-config/scheduled-changes`)
      .send({
        changes: [
          { key: 'bio', value: 'a'.repeat(4097), applyAt: addMinutes(new Date(), 5).toISOString() },
        ],
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body.rejectedProps[0].error).toBe('PROP_VALUE_TOO_LONG')
  })

  it('should reject a change that would be rejected when applied', async () => {
    const [organisation, game] = await createOrganisationAndGame(
      {},
      { props: [new Prop('legacy', 'a'.repeat(4097))] },
    )
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    await request(app)
      .post(`/games/${game.id}/game-config/scheduled-changes`)
      .send({
        changes: [{ key: 'xpRate', value: '3', applyAt: addDays(new Date(), 1).toISOString() }],
      })
      .auth(token, { type: 'bearer' })
      .expect(400)
  })

  it('should not schedule changes for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    await request(app)
      .post(`/games/${otherGame.id}/game-config/scheduled-changes`)
      .send({
        changes: [{ key: 'xpRate', value: '3', applyAt: addDays(new Date(), 1).toISOString() }],
      })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
