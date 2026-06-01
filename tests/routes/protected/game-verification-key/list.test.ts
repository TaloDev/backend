import request from 'supertest'
import GameVerificationKey from '../../../../src/entities/game-verification-key.js'
import Game from '../../../../src/entities/game.js'
import GameVerificationKeyFactory from '../../../fixtures/GameVerificationKeyFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'

async function createEncryptedKey(game: Game, version: string, value: string) {
  const key = await new GameVerificationKeyFactory(game).version(version).value(value).one()
  key.value = GameVerificationKey.encryptValue(value, game.apiSecret)
  return key
}

describe('Game verification key - list', () => {
  it('should list verification keys for the game', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ emailConfirmed: true }, organisation)

    const key1 = await createEncryptedKey(game, '1', 'key-one')
    const key2 = await createEncryptedKey(game, '2', 'key-two')
    await em.persist([key1, key2]).flush()

    const res = await request(app)
      .get(`/games/${game.id}/verification-keys`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.verificationKeys).toHaveLength(2)
  })

  it('should not return keys from other games', async () => {
    const [org1, game1] = await createOrganisationAndGame()
    const [_org2, _game2] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ emailConfirmed: true }, org1)

    const key = await createEncryptedKey(game1, '1', 'key-one')
    await em.persist(key).flush()

    const res = await request(app)
      .get(`/games/${game1.id}/verification-keys`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.verificationKeys).toHaveLength(1)
  })
})
