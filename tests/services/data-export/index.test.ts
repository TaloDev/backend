import request from 'supertest'
import DataExportFactory from '../../fixtures/DataExportFactory'
import { UserType } from '../../../src/entities/user'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'

describe('Data export service - index', () => {
  it('should return a list of data exports', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN, emailConfirmed: true }, organisation)

    const exports = await new DataExportFactory(game).many(5)
    await global.em.persistAndFlush(exports)

    const res = await request(global.app)
      .get(`/games/${game.id}/data-exports`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.dataExports).toHaveLength(exports.length)
  })

  it('should not return data exports for dev users', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.DEV, emailConfirmed: true }, organisation)

    const res = await request(global.app)
      .get(`/games/${game.id}/data-exports`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'You do not have permissions to view data exports' })
  })
})
