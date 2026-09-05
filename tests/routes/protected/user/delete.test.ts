import bcrypt from 'bcrypt'
import Stripe from 'stripe'
import request from 'supertest'
import { getGlobalQueue } from '../../../../src/config/global-queues.js'
import AdminAPIKey from '../../../../src/entities/admin-api-key.js'
import APIKey from '../../../../src/entities/api-key.js'
import Invite from '../../../../src/entities/invite.js'
import { PlayerToDelete } from '../../../../src/entities/player-to-delete.js'
import UserAccessCode from '../../../../src/entities/user-access-code.js'
import UserRecoveryCode from '../../../../src/entities/user-recovery-code.js'
import UserSession from '../../../../src/entities/user-session.js'
import UserTwoFactorAuth from '../../../../src/entities/user-two-factor-auth.js'
import User, { UserType } from '../../../../src/entities/user.js'
import generateRecoveryCodes from '../../../../src/lib/auth/generateRecoveryCodes.js'
import { stripeVersion } from '../../../../src/lib/billing/initStripe.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'

describe('User - delete', () => {
  it('should anonymise a non-owner user and delete their sessions and codes', async () => {
    const [organisation] = await createOrganisationAndGame()

    const twoFactorAuth = new UserTwoFactorAuth('secret')
    twoFactorAuth.enabled = true

    const [token, user] = await createUserAndToken(
      { type: UserType.DEV, twoFactorAuth },
      organisation,
    )

    user.password = await bcrypt.hash('password', 10)
    await em.flush()

    const session = new UserSession(user)
    const accessCode = new UserAccessCode(user, null)
    user.recoveryCodes.set(generateRecoveryCodes(user))
    await em.persist([session, accessCode]).flush()

    await request(app)
      .post('/users/delete')
      .send({ password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(204)

    const deletedUser = await em.refreshOrFail(user, { filters: false })
    expect(deletedUser.deletedAt).not.toBeNull()
    expect(deletedUser.email).toBe(`${user.id}@deleted.invalid`)
    expect(deletedUser.username).toBe(`${user.id}`)
    expect(deletedUser.emailConfirmed).toBe(false)
    expect(await bcrypt.compare('password', deletedUser.password)).toBe(false)

    expect(await em.repo(UserSession).count({ user })).toBe(0)
    expect(await em.repo(UserAccessCode).count({ user })).toBe(0)
    expect(await em.repo(UserRecoveryCode).count({ user })).toBe(0)
    expect(await em.repo(UserTwoFactorAuth).count({ user })).toBe(0)

    const stillActive = await em.repo(User).find({ id: user.id })
    expect(stillActive).toHaveLength(0)
  })

  it('should return 403 for incorrect password', async () => {
    const [token, user] = await createUserAndToken()
    user.password = await bcrypt.hash('password', 10)
    await em.flush()

    const res = await request(app)
      .post('/users/delete')
      .send({ password: 'wrongpassword' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Incorrect password' })
  })

  it('should anonymise the entire organisation when owner deletes their account', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [ownerToken, owner] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    owner.password = await bcrypt.hash('password', 10)
    await em.flush()

    const [, otherUser] = await createUserAndToken({ type: UserType.DEV }, organisation)
    otherUser.password = await bcrypt.hash('otherpass', 10)
    await em.flush()

    const player = await new PlayerFactory([game]).one()
    await em.persist(player).flush()

    const gameAPIKey = new APIKey(game, owner)
    const adminAPIKey = new AdminAPIKey({
      game,
      createdByUser: owner,
      keyHash: 'hash',
      keyEnding: 'ending',
    })
    const invite = new Invite(organisation)
    invite.email = 'someone@example.com'
    invite.invitedByUser = owner
    await em.persist([gameAPIKey, adminAPIKey, invite]).flush()

    await request(app)
      .post('/users/delete')
      .send({ password: 'password' })
      .auth(ownerToken, { type: 'bearer' })
      .expect(204)

    await em.refresh(gameAPIKey)
    await em.refresh(adminAPIKey)
    expect(gameAPIKey.revokedAt).not.toBeNull()
    expect(adminAPIKey.revokedAt).not.toBeNull()

    const deletedOrg = await em.refreshOrFail(organisation, { filters: false })
    expect(deletedOrg.deletedAt).not.toBeNull()
    expect(deletedOrg.name).toBe(`${organisation.id}`)
    expect(deletedOrg.email).toBe(`${organisation.id}@deleted.invalid`)

    const deletedOwner = await em.refreshOrFail(owner, { filters: false })
    expect(deletedOwner.deletedAt).not.toBeNull()
    expect(deletedOwner.email).toBe(`${owner.id}@deleted.invalid`)

    const deletedOther = await em.refreshOrFail(otherUser, { filters: false })
    expect(deletedOther.deletedAt).not.toBeNull()
    expect(deletedOther.email).toBe(`${otherUser.id}@deleted.invalid`)

    const queuedForDeletion = await em.repo(PlayerToDelete).find({ player: { id: player.id } })
    expect(queuedForDeletion).toHaveLength(1)

    expect(await em.repo(Invite).count({ organisation })).toBe(0)

    const refreshedGame = await em.refreshOrFail(game, { filters: false })
    expect(refreshedGame.purgeDevPlayers).toBe(true)
    expect(refreshedGame.purgeLivePlayers).toBe(true)
  })

  it('should clear the refreshToken cookie', async () => {
    const [token, user] = await createUserAndToken()
    user.password = await bcrypt.hash('password', 10)
    await em.flush()

    const res = await request(app)
      .post('/users/delete')
      .send({ password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(204)

    const setCookie = res.headers['set-cookie']
    expect(setCookie).toBeDefined()
    expect(String(setCookie)).toContain('refreshToken=;')
  })

  it('should continue deletion when cancelling the organisation subscription fails', async () => {
    const [organisation] = await createOrganisationAndGame()
    const [ownerToken, owner] = await createUserAndToken({ type: UserType.OWNER }, organisation)
    owner.password = await bcrypt.hash('password', 10)
    await em.flush()

    const stripe = new Stripe('sk_test_mock', { apiVersion: stripeVersion })
    const subscriptions = Object.getPrototypeOf(stripe.subscriptions)

    const listSpy = vi
      .spyOn(subscriptions, 'list')
      .mockResolvedValue({ data: [{ id: 'sub_test', customer: 'cus_test' }] })

    const cancelSpy = vi
      .spyOn(subscriptions, 'cancel')
      .mockRejectedValueOnce(new Error('stripe is down'))

    organisation.pricingPlan.stripeCustomerId = 'cus_test'
    await em.flush()

    await request(app)
      .post('/users/delete')
      .send({ password: 'password' })
      .auth(ownerToken, { type: 'bearer' })
      .expect(204)

    expect(listSpy).toHaveBeenCalled()
    expect(cancelSpy).toHaveBeenCalled()

    const deletedOrg = await em.refreshOrFail(organisation, { filters: false })
    expect(deletedOrg.deletedAt).not.toBeNull()
  })

  it('should return 204 even if the player deletion job fails to queue', async () => {
    const [organisation] = await createOrganisationAndGame()
    const [ownerToken, owner] = await createUserAndToken({ type: UserType.OWNER }, organisation)
    owner.password = await bcrypt.hash('password', 10)
    await em.flush()

    const queue = getGlobalQueue('delete-organisation')
    const addSpy = vi.spyOn(queue, 'add').mockRejectedValueOnce(new Error('redis is down'))

    await request(app)
      .post('/users/delete')
      .send({ password: 'password' })
      .auth(ownerToken, { type: 'bearer' })
      .expect(204)

    expect(addSpy).toHaveBeenCalled()

    const deletedOrg = await em.refreshOrFail(organisation, { filters: false })
    expect(deletedOrg.deletedAt).not.toBeNull()
  })
})
