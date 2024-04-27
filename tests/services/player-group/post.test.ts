import { Collection, EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import userPermissionProvider from '../../utils/userPermissionProvider'
import { UserType } from '../../../src/entities/user'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'
import PlayerGroupRule, { PlayerGroupRuleCastType, PlayerGroupRuleName } from '../../../src/entities/player-group-rule'
import PlayerProp from '../../../src/entities/player-prop'
import PlayerFactory from '../../fixtures/PlayerFactory'
import PlayerGroup from '../../../src/entities/player-group'

describe('Player group service - post', () => {
  it.each(userPermissionProvider([
    UserType.DEV,
    UserType.ADMIN
  ], 200))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type }, organisation)

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.SET,
        field: 'props.hasWon',
        operands: [],
        negate: false,
        castType: PlayerGroupRuleCastType.CHAR
      }
    ]

    const res = await request(global.app)
      .post(`/games/${game.id}/player-groups`)
      .send({
        name: 'Winners',
        description: 'People who have completed the game',
        ruleMode: '$and',
        rules
      })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await (<EntityManager>global.em).getRepository(GameActivity).findOne({
      type: GameActivityType.PLAYER_GROUP_CREATED,
      game
    })

    if (statusCode === 200) {
      expect(res.body.group.name).toBe('Winners')
      expect(res.body.group.description).toBe('People who have completed the game')
      expect(res.body.group.rules).toStrictEqual(rules)

      expect(activity.extra.groupName).toBe(res.body.group.name)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to create groups' })

      expect(activity).toBeNull()
    }
  })

  it('should immediately add valid players to the created group', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game]).with((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'hasWon', '1')
      ])
    })).one()
    const player2 = await new PlayerFactory([game]).one()
    await (<EntityManager>global.em).persistAndFlush([player1, player2])

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.SET,
        field: 'props.hasWon',
        operands: [],
        negate: false,
        castType: PlayerGroupRuleCastType.CHAR
      }
    ]

    const res = await request(global.app)
      .post(`/games/${game.id}/player-groups`)
      .send({
        name: 'Winners',
        description: 'People who have completed the game',
        ruleMode: '$and',
        rules
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const newGroupId = res.body.group.id
    const group = await (<EntityManager>global.em).getRepository(PlayerGroup).findOne(newGroupId)
    const count = await group.members.loadCount()
    expect(count).toBe(1)
  })

  it('should require a valid ruleMode', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .post(`/games/${game.id}/player-groups`)
      .send({
        name: 'Winners',
        description: 'People who have completed the game',
        ruleMode: '$not',
        rules: []
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        ruleMode: ['PlayerGroupRule mode must be one of $and, $or']
      }
    })
  })

  it('should require rules to be an array', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .post(`/games/${game.id}/player-groups`)
      .send({
        name: 'Winners',
        description: 'People who have completed the game',
        ruleMode: '$and',
        rules: {}
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        rules: ['Rules must be an array']
      }
    })
  })

  it('should require all rules to have a valid name', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .post(`/games/${game.id}/player-groups`)
      .send({
        name: 'Winners',
        description: 'People who have completed the game',
        ruleMode: '$and',
        rules: [
          {
            name: 'DROP',
            field: 'props.hasWon',
            operands: [],
            negate: false,
            castType: PlayerGroupRuleCastType.CHAR
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        rules: ['Invalid rule name(s) provided']
      }
    })
  })

  it('should require all rules to have a valid castType', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .post(`/games/${game.id}/player-groups`)
      .send({
        name: 'Winners',
        description: 'People who have completed the game',
        ruleMode: '$and',
        rules: [
          {
            name: PlayerGroupRuleName.SET,
            field: 'props.hasWon',
            operands: [],
            negate: false,
            castType: 'VARCHAR'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        rules: ['Invalid rule type(s) provided']
      }
    })
  })

  it('should require all rules to have a boolean value for negate', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .post(`/games/${game.id}/player-groups`)
      .send({
        name: 'Winners',
        description: 'People who have completed the game',
        ruleMode: '$and',
        rules: [
          {
            name: PlayerGroupRuleName.SET,
            field: 'props.hasWon',
            operands: [],
            negate: 'no',
            castType: PlayerGroupRuleCastType.CHAR
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        rules: ['Missing rule type(s)']
      }
    })
  })

  it('should require all rules to have a valid field', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .post(`/games/${game.id}/player-groups`)
      .send({
        name: 'Winners',
        description: 'People who have completed the game',
        ruleMode: '$and',
        rules: [
          {
            name: PlayerGroupRuleName.SET,
            field: 'password',
            operands: [],
            negate: false,
            castType: PlayerGroupRuleCastType.CHAR
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        rules: ['Invalid rule field(s) provided']
      }
    })
  })

  it('should not create a group for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    const res = await request(global.app)
      .post(`/games/${otherGame.id}/player-groups`)
      .send({
        name: 'Winners',
        description: 'People who have completed the game',
        ruleMode: '$and',
        rules: []
      })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should not create a group for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    const res = await request(global.app)
      .post('/games/345431/player-groups')
      .send({
        name: 'Winners',
        description: 'People who have completed the game',
        ruleMode: '$and',
        rules: []
      })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })
})
