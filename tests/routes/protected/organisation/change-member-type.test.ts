import request from 'supertest'
import { UserType } from '../../../../src/entities/user.js'
import UserFactory from '../../../fixtures/UserFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'
import userPermissionProvider from '../../../utils/userPermissionProvider.js'

describe('Organisation - change member type', () => {
  it.each(userPermissionProvider([], 200))(
    'should return a %i for a %s user',
    async (statusCode, _, type) => {
      const [organisation] = await createOrganisationAndGame()
      const [token] = await createUserAndToken({ type, emailConfirmed: true }, organisation)

      const target = await new UserFactory()
        .loginable()
        .state(() => ({ organisation, type: UserType.DEV }))
        .one()
      await em.persist(target).flush()

      const res = await request(app)
        .patch(`/organisations/members/${target.id}`)
        .send({ type: UserType.ADMIN })
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      if (statusCode !== 200) {
        expect(res.body).toStrictEqual({
          message: 'You do not have permissions to change member user types',
        })
      }
    },
  )

  it('should change the member user type', async () => {
    const [organisation] = await createOrganisationAndGame()
    const [token] = await createUserAndToken(
      { type: UserType.OWNER, emailConfirmed: true },
      organisation,
    )

    const target = await new UserFactory()
      .loginable()
      .state(() => ({ organisation, type: UserType.DEV }))
      .one()
    await em.persist(target).flush()

    const res = await request(app)
      .patch(`/organisations/members/${target.id}`)
      .send({ type: UserType.ADMIN })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.user.type).toBe(UserType.ADMIN)

    await em.refresh(target)
    expect(target.type).toBe(UserType.ADMIN)
  })

  it('should not allow changing to owner', async () => {
    const [organisation] = await createOrganisationAndGame()
    const [token] = await createUserAndToken(
      { type: UserType.OWNER, emailConfirmed: true },
      organisation,
    )

    const target = await new UserFactory()
      .loginable()
      .state(() => ({ organisation, type: UserType.DEV }))
      .one()
    await em.persist(target).flush()

    const res = await request(app)
      .patch(`/organisations/members/${target.id}`)
      .send({ type: UserType.OWNER })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        type: ['User type must be admin or developer'],
      },
    })
  })

  it('should not allow the owner to change their own type', async () => {
    const [organisation] = await createOrganisationAndGame()
    const [token, caller] = await createUserAndToken(
      { type: UserType.OWNER, emailConfirmed: true },
      organisation,
    )

    const res = await request(app)
      .patch(`/organisations/members/${caller.id}`)
      .send({ type: UserType.DEV })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'You cannot change your own user type' })
  })

  it('should return 404 for a user that does not exist', async () => {
    const [token] = await createUserAndToken({ type: UserType.OWNER, emailConfirmed: true })

    const res = await request(app)
      .patch('/organisations/members/99999999')
      .send({ type: UserType.DEV })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'User not found' })
  })

  it('should return 404 for a user belonging to another organisation', async () => {
    const [token] = await createUserAndToken({ type: UserType.OWNER, emailConfirmed: true })

    const otherOrgUser = await new UserFactory().loginable().one()
    await em.persist(otherOrgUser).flush()

    const res = await request(app)
      .patch(`/organisations/members/${otherOrgUser.id}`)
      .send({ type: UserType.DEV })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'User not found' })
  })

  it("should not change a member type if the caller's email is not confirmed", async () => {
    const [organisation] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    const target = await new UserFactory()
      .loginable()
      .state(() => ({ organisation, type: UserType.DEV }))
      .one()
    await em.persist(target).flush()

    const res = await request(app)
      .patch(`/organisations/members/${target.id}`)
      .send({ type: UserType.ADMIN })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({
      message: 'You need to confirm your email address to change member user types',
    })
  })
})
