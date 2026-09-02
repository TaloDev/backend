import request from 'supertest'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity.js'
import Invite from '../../../../src/entities/invite.js'
import OrganisationMember from '../../../../src/entities/organisation-member.js'
import { UserType } from '../../../../src/entities/user.js'
import InviteFactory from '../../../fixtures/InviteFactory.js'
import { clearEntities } from '../../../utils/clearEntities.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'

describe('Organisation - join via invite', () => {
  beforeEach(async () => {
    await clearEntities([GameActivity, Invite])
  })

  it('should add the user to the organisation and make it their current organisation', async () => {
    const [token, user] = await createUserAndToken({ emailConfirmed: true })
    const [organisation] = await createOrganisationAndGame()

    const invite = await new InviteFactory()
      .construct(organisation)
      .state(() => ({ email: user.email, type: UserType.ADMIN }))
      .one()
    await em.persist(invite).flush()

    const res = await request(app)
      .post('/organisations/join')
      .send({ token: invite.token })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.user.organisation.id).toBe(organisation.id)
    expect(res.body.user.type).toBe(UserType.ADMIN)

    const membership = await em.repo(OrganisationMember).findOneOrFail({
      user,
      organisation,
    })
    expect(membership.type).toBe(UserType.ADMIN)

    const remainingInvites = await em.repo(Invite).count({ token: invite.token })
    expect(remainingInvites).toBe(0)

    const activity = await em.repo(GameActivity).findOneOrFail({
      type: GameActivityType.INVITE_ACCEPTED,
    })
    expect(activity.user?.id).toBe(user.id)
  })

  it('should allow a user to be a member of multiple organisations', async () => {
    const [token, user] = await createUserAndToken({ emailConfirmed: true })
    const [secondOrg] = await createOrganisationAndGame()

    const invite = await new InviteFactory()
      .construct(secondOrg)
      .state(() => ({ email: user.email }))
      .one()
    await em.persist(invite).flush()

    await request(app)
      .post('/organisations/join')
      .send({ token: invite.token })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const memberships = await em.repo(OrganisationMember).find({ user })
    expect(memberships).toHaveLength(2)
    expect(memberships.map((member) => member.organisation.id)).toContain(secondOrg.id)
    expect(memberships.map((member) => member.organisation.id)).toContain(user.organisation.id)
  })

  it('should consume the invite if the user is already a member', async () => {
    const [organisation] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({ emailConfirmed: true }, organisation)

    const invite = await new InviteFactory()
      .construct(organisation)
      .state(() => ({ email: user.email }))
      .one()
    await em.persist(invite).flush()

    await request(app)
      .post('/organisations/join')
      .send({ token: invite.token })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const remainingInvites = await em.repo(Invite).count({ token: invite.token })
    expect(remainingInvites).toBe(0)
  })

  it('should return 404 when the invite email does not match the user', async () => {
    const [token] = await createUserAndToken({ emailConfirmed: true })
    const [organisation] = await createOrganisationAndGame()

    const invite = await new InviteFactory().construct(organisation).one()
    await em.persist(invite).flush()

    const res = await request(app)
      .post('/organisations/join')
      .send({ token: invite.token })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Invite not found' })
  })

  it('should return 404 for a missing invite', async () => {
    const [token] = await createUserAndToken({ emailConfirmed: true })

    const res = await request(app)
      .post('/organisations/join')
      .send({ token: 'abc123' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Invite not found' })
  })
})
