import request from 'supertest'
import bcrypt from 'bcrypt'
import createUserAndToken from '../../utils/createUserAndToken'

describe('User service - change password', () => {
  it('should let users change their password', async () => {
    const [token, user] = await createUserAndToken()

    user.password = await bcrypt.hash('password', 10)
    await global.em.flush()

    const res = await request(global.app)
      .post('/users/change_password')
      .send({ currentPassword: 'password', newPassword: 'mynewpassword' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.accessToken).toBeTruthy()
  })

  it('should not let users change their password if their current password is wrong', async () => {
    const [token, user] = await createUserAndToken()

    user.password = await bcrypt.hash('password', 10)
    await global.em.flush()

    const res = await request(global.app)
      .post('/users/change_password')
      .send({ currentPassword: 'passw0rd', newPassword: 'password2' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Current password is incorrect' })
  })

  it('should not let users change their password to the same one', async () => {
    const [token, user] = await createUserAndToken()

    user.password = await bcrypt.hash('password', 10)
    await global.em.flush()

    const res = await request(global.app)
      .post('/users/change_password')
      .send({ currentPassword: 'password', newPassword: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Please choose a different password' })
  })
})
