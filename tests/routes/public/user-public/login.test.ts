import request from 'supertest'
import UserFactory from '../../../fixtures/UserFactory'
import { differenceInMinutes, sub } from 'date-fns'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'

describe('User public  - login', () => {
  it('should let a user login', async () => {
    const [organisation] = await createOrganisationAndGame()
    const user = await new UserFactory().loginable().state(() => ({
      organisation,
      lastSeenAt: new Date(2020, 1, 1)
    })).one()
    await em.persistAndFlush(user)

    const res = await request(app)
      .post('/public/users/login')
      .send({ email: user.email, password: 'password' })
      .expect(200)

    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.user).toBeTruthy()
    expect(res.body.user.organisation).toBeTruthy()
    expect(res.body.user.organisation.games).toHaveLength(1)
    expect(new Date(res.body.user.lastSeenAt).getDay()).toEqual(new Date().getDay())
  })

  it('should not let a user login with the wrong password', async () => {
    const user = await new UserFactory().one()
    await em.persistAndFlush(user)

    const res = await request(app)
      .post('/public/users/login')
      .send({ email: user.email, password: 'asdasdadasd' })
      .expect(401)

    expect(res.body).toStrictEqual({ message: 'Incorrect email address or password' })
  })

  it('should not let a user login with the wrong email', async () => {
    const res = await request(app)
      .post('/public/users/login')
      .send({ email: 'dev@trytal0.com', password: 'password' })
      .expect(401)

    expect(res.body).toStrictEqual({ message: 'Incorrect email address or password' })
  })

  it('should not update the last seen at if the user was last seen today', async () => {
    const lastSeenAt = sub(new Date(), { hours: 1 })

    const user = await new UserFactory().loginable().state(() => ({ lastSeenAt })).one()
    await em.persistAndFlush(user)

    const res = await request(app)
      .post('/public/users/login')
      .send({ email: user.email, password: 'password' })
      .expect(200)

    expect(Math.abs(differenceInMinutes(new Date(res.body.user.lastSeenAt), lastSeenAt))).toBe(0)
  })

  it('should initialise the 2fa flow if it is enabled', async () => {
    const user = await new UserFactory().loginable().has2fa().one()
    await em.persistAndFlush(user)

    const res = await request(app)
      .post('/public/users/login')
      .send({ email: user.email, password: 'password' })
      .expect(200)

    expect(res.body).toStrictEqual({
      twoFactorAuthRequired: true,
      userId: user.id
    })

    const hasSession = await redis.get(`2fa:${user.id}`)
    expect(hasSession).toBe('true')
  })
})
