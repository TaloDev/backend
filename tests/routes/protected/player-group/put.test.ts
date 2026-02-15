import { Collection } from '@mikro-orm/mysql'
import request from 'supertest'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'
import userPermissionProvider from '../../../utils/userPermissionProvider'
import { UserType } from '../../../../src/entities/user'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity'
import PlayerGroupRule, { PlayerGroupRuleCastType, PlayerGroupRuleName } from '../../../../src/entities/player-group-rule'
import PlayerProp from '../../../../src/entities/player-prop'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerGroupFactory from '../../../fixtures/PlayerGroupFactory'

describe('Player group - put', () => {
  it.each(userPermissionProvider([
    UserType.DEV,
    UserType.ADMIN
  ], 200))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type }, organisation)

    const group = await new PlayerGroupFactory().construct(game).one()
    await em.persistAndFlush(group)

    const rules: Partial<PlayerGroupRule & { namespaced: boolean }>[] = [
      {
        name: PlayerGroupRuleName.SET,
        field: 'props.hasWon',
        operands: [],
        negate: false,
        castType: PlayerGroupRuleCastType.CHAR,
        namespaced: true
      }
    ]

    const res = await request(app)
      .put(`/games/${game.id}/player-groups/${group.id}`)
      .send({
        name: 'Winners',
        description: 'People who have completed the game',
        ruleMode: '$and',
        rules,
        membersVisible: false
      })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.PLAYER_GROUP_UPDATED,
      game
    })

    if (statusCode === 200) {
      expect(res.body.group.name).toBe('Winners')
      expect(res.body.group.description).toBe('People who have completed the game')
      expect(res.body.group.rules).toStrictEqual(rules)

      expect(activity!.extra.groupName).toBe(res.body.group.name)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to update groups' })

      expect(activity).toBeNull()
    }
  })

  it('should immediately add valid players to the updated group', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const group = await new PlayerGroupFactory().construct(game).one()
    await em.persistAndFlush(group)

    const player1 = await new PlayerFactory([game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'hasWon', '1')
      ])
    })).one()
    const player2 = await new PlayerFactory([game]).one()
    await em.persistAndFlush([player1, player2])

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.SET,
        field: 'props.hasWon',
        operands: [],
        negate: false,
        castType: PlayerGroupRuleCastType.CHAR
      }
    ]

    await request(app)
      .put(`/games/${game.id}/player-groups/${group.id}`)
      .send({
        name: 'Winners',
        description: 'People who have completed the game',
        ruleMode: '$and',
        rules,
        membersVisible: false
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const count = await group.members.loadCount()
    expect(count).toBe(1)
  })

  it('should not update a group for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const group = await new PlayerGroupFactory().construct(otherGame).one()
    await em.persistAndFlush(group)

    const res = await request(app)
      .put(`/games/${otherGame.id}/player-groups/${group.id}`)
      .send({
        name: 'Winners',
        description: 'People who have completed the game',
        ruleMode: '$and',
        rules: [],
        membersVisible: false
      })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should not update a non-existent group', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
      .put(`/games/${game.id}/player-groups/4324234`)
      .send({
        name: 'Winners',
        description: 'People who have completed the game',
        ruleMode: '$and',
        rules: [],
        membersVisible: false
      })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Group not found' })
  })
})
