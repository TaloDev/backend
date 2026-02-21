import { randText } from '@ngneat/falso'
import Player from '../../../src/entities/player'
import PlayerGroupRule, {
  PlayerGroupRuleCastType,
  PlayerGroupRuleName,
} from '../../../src/entities/player-group-rule'
import { createPlayer, PlayerCreationError } from '../../../src/lib/players/createPlayer'
import PlayerFactory from '../../fixtures/PlayerFactory'
import PlayerGroupFactory from '../../fixtures/PlayerGroupFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'

describe('createPlayer', () => {
  it('should create a player', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await createPlayer(em, game, {})

    expect(player).toBeTruthy()
    expect(player.devBuild).toBe(false)
  })

  it('should create a player with aliases', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await createPlayer(em, game, {
      aliases: [
        {
          service: 'steam',
          identifier: '12345',
        },
      ],
    })

    expect(player).toBeTruthy()
    expect(player.aliases).toHaveLength(1)
    expect(player.aliases[0].service).toBe('steam')
    expect(player.aliases[0].identifier).toBe('12345')
  })

  it('should create a player with props', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await createPlayer(em, game, {
      props: [
        {
          key: 'characterName',
          value: 'Bob John',
        },
      ],
    })

    expect(player.props[0].key).toBe('characterName')
    expect(player.props[0].value).toBe('Bob John')
  })

  it('should put the newly created player in the correct groups', async () => {
    const [, game] = await createOrganisationAndGame()

    const rule = new PlayerGroupRule(PlayerGroupRuleName.LT, 'props.currentLevel')
    rule.castType = PlayerGroupRuleCastType.DOUBLE
    rule.operands = ['60']

    const group = await new PlayerGroupFactory()
      .construct(game)
      .state(() => ({ rules: [rule] }))
      .one()
    await em.persistAndFlush(group)
    await group.checkMembership(em)

    const player = await createPlayer(em, game, {
      props: [
        {
          key: 'currentLevel',
          value: '1',
        },
      ],
    })

    expect(player.groups.getItems().map((g) => ({ id: g.id, name: g.name }))).toStrictEqual([
      {
        id: group.id,
        name: group.name,
      },
    ])
  })

  it('should create a player with devBuild set to true', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await createPlayer(em, game, {
      aliases: [
        {
          service: 'steam',
          identifier: randText(),
        },
      ],
      devBuild: true,
    })

    expect(player).toBeTruthy()
    expect(player.aliases).toHaveLength(1)
    expect(player.props.map((p) => ({ key: p.key, value: p.value }))).toContainEqual({
      key: 'META_DEV_BUILD',
      value: '1',
    })
    expect(player.devBuild).toBe(true)
  })

  it('should not create duplicate player aliases', async () => {
    const [, game] = await createOrganisationAndGame()

    const existingPlayer = await new PlayerFactory([game]).one()
    await em.persistAndFlush(existingPlayer)

    try {
      await createPlayer(em, game, {
        aliases: [
          {
            service: existingPlayer.aliases[0].service,
            identifier: existingPlayer.aliases[0].identifier,
          },
        ],
      })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(PlayerCreationError)
      const error = err as PlayerCreationError
      expect(error.statusCode).toBe(400)
      expect(error.errorCode).toBe('IDENTIFIER_TAKEN')
      expect(error.field).toBe('aliases')
      expect(error.message).toBe(
        `Player with identifier '${existingPlayer.aliases[0].identifier}' already exists`,
      )
    }
  })

  it('should reject props where the key is greater than 128 characters', async () => {
    const [, game] = await createOrganisationAndGame()

    try {
      await createPlayer(em, game, {
        props: [
          {
            key: randText({ charCount: 129 }),
            value: '1',
          },
        ],
      })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(PlayerCreationError)
      const error = err as PlayerCreationError
      expect(error.statusCode).toBe(400)
      expect(error.field).toBe('props')
      expect(error.message).toBe('Prop key length (129) exceeds 128 characters')
    }
  })

  it('should reject props where the value is greater than 512 characters', async () => {
    const [, game] = await createOrganisationAndGame()

    try {
      await createPlayer(em, game, {
        props: [
          {
            key: 'bio',
            value: randText({ charCount: 513 }),
          },
        ],
      })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(PlayerCreationError)
      const error = err as PlayerCreationError
      expect(error.statusCode).toBe(400)
      expect(error.field).toBe('props')
      expect(error.message).toBe('Prop value length (513) exceeds 512 characters')
    }
  })

  it('should reject props if an unknown error occurs', async () => {
    vi.spyOn(Player.prototype, 'setProps').mockImplementation(() => {
      throw new Error('Unknown error')
    })

    const [, game] = await createOrganisationAndGame()

    try {
      await createPlayer(em, game, {
        props: [
          {
            key: 'bio',
            value: randText({ charCount: 500 }),
          },
        ],
      })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(PlayerCreationError)
      const error = err as PlayerCreationError
      expect(error.statusCode).toBe(400)
      expect(error.field).toBe('props')
      expect(error.message).toBe('Unknown error')
    }

    vi.restoreAllMocks()
  })
})
