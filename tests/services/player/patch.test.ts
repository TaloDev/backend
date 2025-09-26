import { Collection } from '@mikro-orm/mysql'
import request from 'supertest'
import { UserType } from '../../../src/entities/user'
import PlayerFactory from '../../fixtures/PlayerFactory'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'
import userPermissionProvider from '../../utils/userPermissionProvider'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import PlayerProp from '../../../src/entities/player-prop'
import { randText, randWord } from '@ngneat/falso'

describe('Player service - patch', () => {
  it.each(userPermissionProvider([
    UserType.ADMIN,
    UserType.DEV
  ]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type }, organisation)

    const player = await new PlayerFactory([game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'collectibles', '0'),
        new PlayerProp(player, 'zonesExplored', '1')
      ])
    })).one()

    await em.persistAndFlush(player)

    const res = await request(app)
      .patch(`/games/${game.id}/players/${player.id}`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '1'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.PLAYER_PROPS_UPDATED,
      extra: {
        playerId: player.id
      }
    })

    if (statusCode === 200) {
      expect(res.body.player.props).toEqual(expect.arrayContaining(
        [
          {
            key: 'collectibles',
            value: '1'
          },
          {
            key: 'zonesExplored',
            value: '1'
          }
        ]
      ))

      expect(activity).not.toBeNull()
    } else {
      expect(activity).toBeNull()
    }
  })

  it('should delete null player properties', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'collectibles', '1'),
        new PlayerProp(player, 'zonesExplored', '1')
      ])
    })).one()

    await em.persistAndFlush(player)

    const res = await request(app)
      .patch(`/games/${game.id}/players/${player.id}`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '1'
          },
          {
            key: 'zonesExplored',
            value: null
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.props).toStrictEqual([
      {
        key: 'collectibles',
        value: '1'
      }
    ])
  })

  it('should throw an error if props are present but aren\'t an array', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .patch(`/games/${game.id}/players/${player.id}`)
      .send({
        props: {
          collectibles: '3'
        }
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        props: ['Props must be an array']
      }
    })
  })

  it('should not update a non-existent player\'s properties', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
      .patch(`/games/${game.id}/players/2313`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '2'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not update a player\'s properties for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({})

    const player = await new PlayerFactory([otherGame]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .patch(`/games/${otherGame.id}/players/${player.id}`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '2'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should filter out props with no keys', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [])
    })).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .patch(`/games/${game.id}/players/${player.id}`)
      .send({
        props: [
          {
            key: '',
            value: ''
          },
          {
            key: 'zonesExplored',
            value: '3'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.props).toStrictEqual([
      {
        key: 'zonesExplored',
        value: '3'
      }
    ])
  })

  it('should reject keys starting with META_', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    await em.persistAndFlush(player)

    const propsLength = player.props.length

    const res = await request(app)
      .patch(`/games/${game.id}/players/${player.id}`)
      .send({
        props: [
          {
            key: randWord(),
            value: randWord()
          },
          {
            key: 'META_BREAK_THINGS',
            value: 'true'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        props: ['Prop keys starting with \'META_\' are reserved for internal systems, please use another key name']
      }
    })

    await em.refresh(player)
    expect(player.props.length).toBe(propsLength)
  })

  it('should reject props where the key is greater than 128 characters', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()

    await em.persistAndFlush(player)

    const res = await request(app)
      .patch(`/games/${game.id}/players/${player.id}`)
      .send({
        props: [
          {
            key: randText({ charCount: 129 }),
            value: '1'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        props: ['Prop key length (129) exceeds 128 characters']
      }
    })
  })

  it('should reject props where the value is greater than 512 characters', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()

    await em.persistAndFlush(player)

    const res = await request(app)
      .patch(`/games/${game.id}/players/${player.id}`)
      .send({
        props: [
          {
            key: 'bio',
            value: randText({ charCount: 513 })
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        props: ['Prop value length (513) exceeds 512 characters']
      }
    })
  })

  it('should de-dupe props and take the latest updates', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [])
    })).one()
    await em.persistAndFlush(player)

    await Promise.all(['1', '2', '3'].map((value) => {
      return request(app)
        .patch(`/games/${game.id}/players/${player.id}`)
        .send({
          props: [
            {
              key: 'zonesExplored',
              value: value
            }
          ]
        })
        .auth(token, { type: 'bearer' })
        .expect(200)
    }).concat(
      request(app)
        .patch(`/games/${game.id}/players/${player.id}`)
        .send({
          props: [
            {
              key: 'treasuresDiscovered',
              value: '12'
            }
          ]
        })
        .auth(token, { type: 'bearer' })
        .expect(200)
    ))

    const props = await em.repo(PlayerProp).find({ player }, { refresh: true })
    expect(props).toHaveLength(2)

    const serialised = props.map(({ key, value }) => ({ key, value }))
    expect(serialised).toEqual(expect.arrayContaining([
      // this API is not linearisable — simultaneous requests may be applied out of order
      { key: 'zonesExplored', value: expect.any(String) },
      { key: 'treasuresDiscovered', value: '12' }
    ]))
  })
})
