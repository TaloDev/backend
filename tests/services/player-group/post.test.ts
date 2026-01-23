import { Collection } from '@mikro-orm/mysql'
import request from 'supertest'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import userPermissionProvider from '../../utils/userPermissionProvider'
import { UserType } from '../../../src/entities/user'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'
import PlayerGroupRule, { PlayerGroupRuleCastType, PlayerGroupRuleName } from '../../../src/entities/player-group-rule'
import PlayerProp from '../../../src/entities/player-prop'
import PlayerFactory from '../../fixtures/PlayerFactory'

describe('Player group service - post', () => {
  it.each(userPermissionProvider([
    UserType.DEV,
    UserType.ADMIN
  ], 200))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type }, organisation)

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
      .post(`/games/${game.id}/player-groups`)
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
      type: GameActivityType.PLAYER_GROUP_CREATED,
      game
    })

    if (statusCode === 200) {
      expect(res.body.group.name).toBe('Winners')
      expect(res.body.group.description).toBe('People who have completed the game')
      expect(res.body.group.rules).toStrictEqual(rules)
      expect(res.body.group.count).toBe(0)

      expect(activity!.extra.groupName).toBe(res.body.group.name)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to create groups' })

      expect(activity).toBeNull()
    }
  })

  it('should immediately add valid players to the created group', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

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

    const res = await request(app)
      .post(`/games/${game.id}/player-groups`)
      .send({
        name: 'Winners',
        description: 'People who have completed the game',
        ruleMode: '$and',
        rules,
        membersVisible: false
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.group.count).toBe(1)
  })

  it('should require a valid ruleMode', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
      .post(`/games/${game.id}/player-groups`)
      .send({
        name: 'Winners',
        description: 'People who have completed the game',
        ruleMode: '$not',
        rules: [],
        membersVisible: false
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        ruleMode: ['Invalid enum value. Expected \'$and\' | \'$or\', received \'$not\'']
      }
    })
  })

  it('should require rules to be an array', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
      .post(`/games/${game.id}/player-groups`)
      .send({
        name: 'Winners',
        description: 'People who have completed the game',
        ruleMode: '$and',
        rules: {},
        membersVisible: false
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        rules: ['Expected array, received object']
      }
    })
  })

  it('should require all rules to have a valid name', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
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
        ],
        membersVisible: false
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        'rules.0.name': ['Invalid enum value. Expected \'EQUALS\' | \'SET\' | \'GT\' | \'GTE\' | \'LT\' | \'LTE\', received \'DROP\'']
      }
    })
  })

  it('should require all rules to have a valid castType', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
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
        ],
        membersVisible: false
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        'rules.0.castType': ['Invalid enum value. Expected \'CHAR\' | \'DOUBLE\' | \'DATETIME\', received \'VARCHAR\'']
      }
    })
  })

  it('should require all rules to have a boolean value for negate', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
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
        ],
        membersVisible: false
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        'rules.0.negate': ['Expected boolean, received string']
      }
    })
  })

  it('should require all rules to have a valid field', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
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
        ],
        membersVisible: false
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

    const res = await request(app)
      .post(`/games/${otherGame.id}/player-groups`)
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

  it('should not create a group for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    const res = await request(app)
      .post('/games/345431/player-groups')
      .send({
        name: 'Winners',
        description: 'People who have completed the game',
        ruleMode: '$and',
        rules: [],
        membersVisible: false
      })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })
})
