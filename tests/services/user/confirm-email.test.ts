import request from 'supertest'
import UserAccessCode from '../../../src/entities/user-access-code'
import createUserAndToken from '../../utils/createUserAndToken'

describe('User service - confirm email', () => {
  it('should let a user confirm their email', async () => {
    const [token, user] = await createUserAndToken()

    const date = new Date()
    date.setDate(date.getDate() + 1)
    const accessCode = new UserAccessCode(user, date)
    await global.em.persistAndFlush(accessCode)

    const res = await request(global.app)
      .post('/users/confirm_email')
      .send({ code: accessCode.code })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.user.emailConfirmed).toBe(true)

    const updatedAccessCode = await global.em.getRepository(UserAccessCode).findOne({ code: accessCode.code })
    expect(updatedAccessCode).toBeNull()
  })

  it('should not let a user confirm their email with an expired code', async () => {
    const [token, user] = await createUserAndToken()

    const date = new Date()
    date.setDate(date.getDate() - 1)
    const accessCode = new UserAccessCode(user, date)
    await global.em.persistAndFlush(accessCode)

    const res = await request(global.app)
      .post('/users/confirm_email')
      .send({ code: accessCode.code })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Invalid or expired code' })
  })

  it('should not let a user confirm their email with an invalid code', async () => {
    const [token] = await createUserAndToken()

    const res = await request(global.app)
      .post('/users/confirm_email')
      .send({ code: '312321' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Invalid or expired code' })
  })
})
