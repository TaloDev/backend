import { Collection } from '@mikro-orm/mysql'
import { randUuid } from '@ngneat/falso'
import axios from 'axios'
import AxiosMockAdapter from 'axios-mock-adapter'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import { IntegrationType } from '../../../../src/entities/integration'
import { PlayerAliasService } from '../../../../src/entities/player-alias'
import PlayerProp from '../../../../src/entities/player-prop'
import IntegrationFactory from '../../../fixtures/IntegrationFactory'
import PlayerAliasFactory from '../../../fixtures/PlayerAliasFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

const clientId = 'test-client-id'
const clientSecret = 'test-client-secret'

function makeGPGIntegration(game: Awaited<ReturnType<typeof createAPIKeyAndToken>>[0]['game']) {
  return new IntegrationFactory()
    .construct(IntegrationType.GOOGLE_PLAY_GAMES, game, { clientId, clientSecret })
    .one()
}

describe('Player API - Google Play Games identify', () => {
  const axiosMock = new AxiosMockAdapter(axios)

  afterEach(async () => {
    axiosMock.reset()
  })

  it('should identify a google play games player', async () => {
    const authCode = 'valid-auth-code'
    const playerId = randUuid()
    const displayName = 'TestPlayer'
    const avatarImageUrl = 'https://example.com/avatar.png'
    const accessToken = 'ya29.access-token'

    const tokenMock = vi.fn(() => [
      200,
      {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
      },
    ])
    axiosMock.onPost('https://oauth2.googleapis.com/token').reply(tokenMock)

    const playerMeMock = vi.fn(() => [
      200,
      {
        playerId,
        displayName,
        avatarImageUrl,
      },
    ])
    axiosMock.onGet('https://www.googleapis.com/games/v1/players/me').reply(playerMeMock)

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const player = await new PlayerFactory([apiKey.game])
      .state(async (p) => {
        const alias = await new PlayerAliasFactory(p)
          .state(() => ({
            service: PlayerAliasService.GOOGLE_PLAY_GAMES,
            identifier: playerId,
          }))
          .one()
        return {
          aliases: new Collection(p, [alias]),
          props: new Collection<PlayerProp>(p, [
            new PlayerProp(p, 'META_GOOGLE_PLAY_GAMES_DISPLAY_NAME', 'OldName'),
          ]),
        }
      })
      .one()

    const integration = await makeGPGIntegration(apiKey.game)
    await em.persist([integration, player]).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.GOOGLE_PLAY_GAMES, identifier: authCode })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(tokenMock).toHaveBeenCalledOnce()
    expect(playerMeMock).toHaveBeenCalledOnce()

    expect(res.body.alias.identifier).toBe(playerId)
    expect(res.body.alias.player.id).toBe(player.id)

    const displayNameProp = res.body.alias.player.props.find(
      (p: { key: string }) => p.key === 'META_GOOGLE_PLAY_GAMES_DISPLAY_NAME',
    )
    expect(displayNameProp?.value).toBe(displayName)
  })

  it('should identify a non-existent google play games player by creating a new player with the write scope', async () => {
    const authCode = 'valid-auth-code'
    const playerId = randUuid()
    const displayName = 'NewPlayer'
    const avatarImageUrl = 'https://example.com/avatar.png'
    const accessToken = 'ya29.access-token'

    const tokenMock = vi.fn(() => [
      200,
      {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
      },
    ])
    axiosMock.onPost('https://oauth2.googleapis.com/token').reply(tokenMock)

    const playerMeMock = vi.fn(() => [
      200,
      {
        playerId,
        displayName,
        avatarImageUrl,
      },
    ])
    axiosMock.onGet('https://www.googleapis.com/games/v1/players/me').reply(playerMeMock)

    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const integration = await makeGPGIntegration(apiKey.game)
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.GOOGLE_PLAY_GAMES, identifier: authCode })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(tokenMock).toHaveBeenCalledOnce()
    expect(playerMeMock).toHaveBeenCalledOnce()

    expect(res.body.alias.identifier).toBe(playerId)
    expect(res.body.alias.player.props).toStrictEqual([
      { key: 'META_GOOGLE_PLAY_GAMES_PLAYER_ID', value: playerId },
      { key: 'META_GOOGLE_PLAY_GAMES_DISPLAY_NAME', value: displayName },
      { key: 'META_GOOGLE_PLAY_GAMES_AVATAR_URL', value: avatarImageUrl },
    ])
  })

  it('should identify a new player without an avatar url', async () => {
    const authCode = 'valid-auth-code'
    const playerId = randUuid()
    const displayName = 'NewPlayer'
    const accessToken = 'ya29.access-token'

    axiosMock.onPost('https://oauth2.googleapis.com/token').reply(200, {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
    })

    axiosMock.onGet('https://www.googleapis.com/games/v1/players/me').reply(200, {
      playerId,
      displayName,
    })

    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const integration = await makeGPGIntegration(apiKey.game)
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.GOOGLE_PLAY_GAMES, identifier: authCode })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias.identifier).toBe(playerId)
    expect(res.body.alias.player.props).toStrictEqual([
      { key: 'META_GOOGLE_PLAY_GAMES_PLAYER_ID', value: playerId },
      { key: 'META_GOOGLE_PLAY_GAMES_DISPLAY_NAME', value: displayName },
    ])
  })

  it('should handle token exchange 5xx errors', async () => {
    const authCode = 'valid-auth-code'

    axiosMock.onPost('https://oauth2.googleapis.com/token').reply(500, {})

    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const integration = await makeGPGIntegration(apiKey.game)
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.GOOGLE_PLAY_GAMES, identifier: authCode })
      .auth(token, { type: 'bearer' })
      .expect(503)

    expect(res.body).toStrictEqual({
      message: 'Failed to exchange Google Play Games auth code: service unavailable',
    })
  })

  it('should handle invalid token exchange responses', async () => {
    const authCode = 'valid-auth-code'

    axiosMock.onPost('https://oauth2.googleapis.com/token').reply(400, { error: 'invalid_grant' })

    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const integration = await makeGPGIntegration(apiKey.game)
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.GOOGLE_PLAY_GAMES, identifier: authCode })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      message: 'Failed to exchange Google Play Games auth code: invalid response from Google',
    })
  })

  it('should handle player info 5xx errors', async () => {
    const authCode = 'valid-auth-code'
    const accessToken = 'ya29.access-token'

    axiosMock.onPost('https://oauth2.googleapis.com/token').reply(200, {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
    })

    axiosMock.onGet('https://www.googleapis.com/games/v1/players/me').reply(500, {})

    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const integration = await makeGPGIntegration(apiKey.game)
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.GOOGLE_PLAY_GAMES, identifier: authCode })
      .auth(token, { type: 'bearer' })
      .expect(503)

    expect(res.body).toStrictEqual({
      message: 'Failed to get Google Play Games player info: service unavailable',
    })
  })

  it('should use the raw identifier when no google play games integration exists for the game', async () => {
    const authCode = 'valid-auth-code'

    const [, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.GOOGLE_PLAY_GAMES, identifier: authCode })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias.identifier).toBe(authCode)
  })

  it('should handle invalid player info responses', async () => {
    const authCode = 'valid-auth-code'
    const accessToken = 'ya29.access-token'

    axiosMock.onPost('https://oauth2.googleapis.com/token').reply(200, {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
    })

    axiosMock.onGet('https://www.googleapis.com/games/v1/players/me').reply(200, {
      // missing playerId
    })

    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const integration = await makeGPGIntegration(apiKey.game)
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.GOOGLE_PLAY_GAMES, identifier: authCode })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      message: 'Failed to get Google Play Games player info: invalid response from Google',
    })
  })
})
