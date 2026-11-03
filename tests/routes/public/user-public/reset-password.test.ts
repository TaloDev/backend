import bcrypt from 'bcrypt'
import request from 'supertest'
import {
  getHashFingerprint,
  getResetTokenKey,
  RESET_TOKEN_TTL_SECONDS,
} from '../../../../src/lib/auth/resetToken.js'
import UserFactory from '../../../fixtures/UserFactory.js'

describe('User public - reset password', () => {
  it('should let a user reset their password', async () => {
    const oldPassword = 'p4ssw0rd112233'
    const newPassword = 'my-new-passw0rd1!'
    const token = 'a-valid-reset-token'

    const password = await bcrypt.hash(oldPassword, 10)
    const user = await new UserFactory().state(() => ({ password })).one()
    await em.persist(user).flush()
    const value = `${user.id}:${getHashFingerprint(user.password)}`
    await redis.set(getResetTokenKey(token), value, 'EX', RESET_TOKEN_TTL_SECONDS)

    await request(app)
      .post('/public/users/reset_password')
      .send({ token, password: newPassword })
      .expect(204)

    await em.refresh(user)
    expect(await bcrypt.compare(newPassword, user.password)).toBe(true)
  })

  it('should not let a user reset their password if they supply the same one', async () => {
    const oldPassword = 'p4ssw0rd112233'
    const newPassword = 'p4ssw0rd112233'
    const token = 'a-valid-reset-token'

    const password = await bcrypt.hash(oldPassword, 10)
    const user = await new UserFactory().state(() => ({ password })).one()
    await em.persist(user).flush()
    const value = `${user.id}:${getHashFingerprint(user.password)}`
    await redis.set(getResetTokenKey(token), value, 'EX', RESET_TOKEN_TTL_SECONDS)

    const res = await request(app)
      .post('/public/users/reset_password')
      .send({ token, password: newPassword })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Please choose a different password' })
  })

  it('should let a user retry with the same token after supplying their current password', async () => {
    const oldPassword = 'p4ssw0rd112233'
    const newPassword = 'my-new-passw0rd1!'
    const token = 'a-valid-reset-token'

    const password = await bcrypt.hash(oldPassword, 10)
    const user = await new UserFactory().state(() => ({ password })).one()
    await em.persist(user).flush()
    const value = `${user.id}:${getHashFingerprint(user.password)}`
    await redis.set(getResetTokenKey(token), value, 'EX', RESET_TOKEN_TTL_SECONDS)

    await request(app)
      .post('/public/users/reset_password')
      .send({ token, password: oldPassword })
      .expect(400)

    // rejecting the same password must not burn the link
    await request(app)
      .post('/public/users/reset_password')
      .send({ token, password: newPassword })
      .expect(204)

    await em.refresh(user)
    expect(await bcrypt.compare(newPassword, user.password)).toBe(true)
  })

  it('should not let a user reset their password twice with the same token', async () => {
    const oldPassword = 'p4ssw0rd112233'
    const newPassword = 'my-new-passw0rd1!'
    const secondPassword = 'another-passw0rd1!'
    const token = 'a-valid-reset-token'

    const password = await bcrypt.hash(oldPassword, 10)
    const user = await new UserFactory().state(() => ({ password })).one()
    await em.persist(user).flush()
    const value = `${user.id}:${getHashFingerprint(user.password)}`
    await redis.set(getResetTokenKey(token), value, 'EX', RESET_TOKEN_TTL_SECONDS)

    await request(app)
      .post('/public/users/reset_password')
      .send({ token, password: newPassword })
      .expect(204)

    await request(app)
      .post('/public/users/reset_password')
      .send({ token, password: secondPassword })
      .expect(401)

    await em.refresh(user)
    expect(await bcrypt.compare(secondPassword, user.password)).toBe(false)
  })

  it('should not let a token reset the password if the password changed since it was sent', async () => {
    const oldPassword = 'p4ssw0rd112233'
    const changedPassword = 'changed-passw0rd1!'
    const newPassword = 'my-new-passw0rd1!'
    const token = 'a-valid-reset-token'

    const password = await bcrypt.hash(oldPassword, 10)
    const user = await new UserFactory().state(() => ({ password })).one()
    await em.persist(user).flush()
    const value = `${user.id}:${getHashFingerprint(user.password)}`
    await redis.set(getResetTokenKey(token), value, 'EX', RESET_TOKEN_TTL_SECONDS)

    // the owner changes their password while the link is still in their inbox
    user.password = await bcrypt.hash(changedPassword, 10)
    await em.flush()

    await request(app)
      .post('/public/users/reset_password')
      .send({ token, password: newPassword })
      .expect(401)

    await em.refresh(user)
    expect(await bcrypt.compare(changedPassword, user.password)).toBe(true)
  })

  it('should not let a user reset their password if the token is unknown', async () => {
    const newPassword = 'my-new-passw0rd1!'
    const token = 'not-a-real-token'

    const res = await request(app)
      .post('/public/users/reset_password')
      .send({ token, password: newPassword })
      .expect(401)

    expect(res.body).toStrictEqual({ message: 'Request expired', expired: true })
  })

  it('should not let a user reset their password if the token is expired', async () => {
    const oldPassword = 'p4ssw0rd112233'
    const newPassword = 'my-new-passw0rd1!'
    const token = 'an-expired-reset-token'

    const password = await bcrypt.hash(oldPassword, 10)
    const user = await new UserFactory().state(() => ({ password })).one()
    await em.persist(user).flush()
    const value = `${user.id}:${getHashFingerprint(user.password)}`
    await redis.set(getResetTokenKey(token), value, 'PX', 1)
    await new Promise((resolve) => setTimeout(resolve, 5))

    await request(app)
      .post('/public/users/reset_password')
      .send({ token, password: newPassword })
      .expect(401)
  })

  it('should not let a user reset their password if the user no longer exists', async () => {
    const newPassword = 'my-new-passw0rd1!'
    const token = 'a-reset-token-for-a-deleted-user'
    const missingUserId = 21313123
    const value = `${missingUserId}:${getHashFingerprint('whatever')}`

    await redis.set(getResetTokenKey(token), value, 'EX', RESET_TOKEN_TTL_SECONDS)

    const res = await request(app)
      .post('/public/users/reset_password')
      .send({ token, password: newPassword })
      .expect(401)

    expect(res.body).toStrictEqual({ message: 'Request expired', expired: true })
    expect(await redis.get(getResetTokenKey(token))).toBeNull()
  })
})
