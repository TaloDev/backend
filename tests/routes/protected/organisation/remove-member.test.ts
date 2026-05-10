import assert from 'node:assert'
import request from 'supertest'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity'
import Invite from '../../../../src/entities/invite'
import { UserType } from '../../../../src/entities/user'
import UserPinnedGroup from '../../../../src/entities/user-pinned-group'
import UserSession from '../../../../src/entities/user-session'
import InviteFactory from '../../../fixtures/InviteFactory'
import PlayerGroupFactory from '../../../fixtures/PlayerGroupFactory'
import UserFactory from '../../../fixtures/UserFactory'
import { clearEntities } from '../../../utils/clearEntities'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'
import userPermissionProvider from '../../../utils/userPermissionProvider'

describe('Organisation - remove member', () => {
  beforeEach(async () => {
    await clearEntities([GameActivity, UserSession, UserPinnedGroup, Invite])
  })

  it.each(userPermissionProvider([], 204))(
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
        .delete(`/organisations/members/${target.id}`)
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      if (statusCode !== 204) {
        expect(res.body).toStrictEqual({
          message: 'You do not have permissions to remove organisation members',
        })
      }
    },
  )

  it('should move the removed user into a new personal organisation', async () => {
    const [organisation] = await createOrganisationAndGame()
    const [token] = await createUserAndToken(
      { type: UserType.OWNER, emailConfirmed: true },
      organisation,
    )

    const target = await new UserFactory()
      .loginable()
      .state(() => ({ organisation, type: UserType.ADMIN }))
      .one()
    await em.persist(target).flush()

    await request(app)
      .delete(`/organisations/members/${target.id}`)
      .auth(token, { type: 'bearer' })
      .expect(204)

    await em.refresh(target)
    expect(target.organisation.id).not.toBe(organisation.id)
    expect(target.organisation.name).toBe(target.username)
    expect(target.type).toBe(UserType.OWNER)
  })

  it("should delete the removed user's sessions", async () => {
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

    const session = new UserSession(target)
    await em.persist(session).flush()

    await request(app)
      .delete(`/organisations/members/${target.id}`)
      .auth(token, { type: 'bearer' })
      .expect(204)

    const sessions = await em.repo(UserSession).find({ user: target })
    expect(sessions).toHaveLength(0)
  })

  it("should delete the removed user's pinned groups", async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken(
      { type: UserType.OWNER, emailConfirmed: true },
      organisation,
    )

    const target = await new UserFactory()
      .loginable()
      .state(() => ({ organisation, type: UserType.DEV }))
      .one()
    await em.persist(target).flush()

    const group = await new PlayerGroupFactory().state(() => ({ game })).one()
    const pinnedGroup = new UserPinnedGroup(target, group)
    await em.persist(pinnedGroup).flush()

    await request(app)
      .delete(`/organisations/members/${target.id}`)
      .auth(token, { type: 'bearer' })
      .expect(204)

    const remainingPinnedGroups = await em.repo(UserPinnedGroup).find({ user: target })
    expect(remainingPinnedGroups).toHaveLength(0)
  })

  it('should create a game activity for the removal', async () => {
    const [organisation] = await createOrganisationAndGame()
    const [token, caller] = await createUserAndToken(
      { type: UserType.OWNER, emailConfirmed: true },
      organisation,
    )

    const target = await new UserFactory()
      .loginable()
      .state(() => ({ organisation, type: UserType.DEV }))
      .one()
    await em.persist(target).flush()

    await request(app)
      .delete(`/organisations/members/${target.id}`)
      .auth(token, { type: 'bearer' })
      .expect(204)

    const activity = await em.repo(GameActivity).findOne({
      type: GameActivityType.ORGANISATION_MEMBER_REMOVED,
    })

    assert(activity)
    expect(activity.user.id).toBe(caller.id)
    expect(activity.extra.removedUsername).toBe(target.username)
  })

  it('should not remove the owner themselves', async () => {
    const [organisation] = await createOrganisationAndGame()
    const [token, caller] = await createUserAndToken(
      { type: UserType.OWNER, emailConfirmed: true },
      organisation,
    )

    const res = await request(app)
      .delete(`/organisations/members/${caller.id}`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({
      message: 'You cannot remove yourself from your organisation',
    })
  })

  it('should return 404 for a user that does not exist', async () => {
    const [token] = await createUserAndToken({ type: UserType.OWNER, emailConfirmed: true })

    const res = await request(app)
      .delete('/organisations/members/99999999')
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'User not found' })
  })

  it('should return 404 for a user belonging to another organisation', async () => {
    const [token] = await createUserAndToken({ type: UserType.OWNER, emailConfirmed: true })

    const otherOrgUser = await new UserFactory().loginable().one()
    await em.persist(otherOrgUser).flush()

    const res = await request(app)
      .delete(`/organisations/members/${otherOrgUser.id}`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'User not found' })
  })

  it('should delete pending invites created by the removed user', async () => {
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

    const invite = await new InviteFactory()
      .construct(organisation)
      .state(() => ({ invitedByUser: target }))
      .one()
    await em.persist(invite).flush()

    await request(app)
      .delete(`/organisations/members/${target.id}`)
      .auth(token, { type: 'bearer' })
      .expect(204)

    const remainingInvites = await em.repo(Invite).find({ invitedByUser: target })
    expect(remainingInvites).toHaveLength(0)
  })

  it('should return 400 for a non-numeric userId', async () => {
    const [token] = await createUserAndToken({ type: UserType.OWNER, emailConfirmed: true })

    await request(app)
      .delete('/organisations/members/abc')
      .auth(token, { type: 'bearer' })
      .expect(400)
  })

  it("should not remove a member if the caller's email is not confirmed", async () => {
    const [organisation] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    const target = await new UserFactory()
      .loginable()
      .state(() => ({ organisation, type: UserType.DEV }))
      .one()
    await em.persist(target).flush()

    const res = await request(app)
      .delete(`/organisations/members/${target.id}`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({
      message: 'You need to confirm your email address to remove organisation members',
    })
  })
})
