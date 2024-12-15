import { EntityManager } from '@mikro-orm/mysql'
import { Request, Response, Routes, Validate, HasPermission, ForwardTo, forwardRequest, ValidationCondition } from 'koa-clay'
import APIKey, { APIKeyScope } from '../../entities/api-key'
import Player from '../../entities/player'
import GameSave from '../../entities/game-save'
import PlayerAlias, { PlayerAliasService } from '../../entities/player-alias'
import PlayerAPIPolicy from '../../policies/api/player-api.policy'
import APIService from './api-service'
import { uniqWith } from 'lodash'
import PlayerAPIDocs from '../../docs/player-api.docs'
import PlayerProp from '../../entities/player-prop'
import PlayerGameStat from '../../entities/player-game-stat'
import checkScope from '../../policies/checkScope'
import Integration, { IntegrationType } from '../../entities/integration'
import { validateAuthSessionToken } from '../../middlewares/player-auth-middleware'
import { setCurrentPlayerState } from '../../middlewares/current-player-middleware'
import { createRedisConnection } from '../../config/redis.config'

async function getRealIdentifier(
  req: Request,
  key: APIKey,
  service: string,
  identifier: string
): Promise<string> {
  if (service === PlayerAliasService.STEAM) {
    const integration = await (req.ctx.em as EntityManager).getRepository(Integration).findOne({
      game: key.game,
      type: IntegrationType.STEAMWORKS
    })

    if (integration) {
      return integration.getPlayerIdentifier(req, identifier)
    }
  }

  return identifier
}

export async function findAliasFromIdentifyRequest(
  req: Request,
  key: APIKey,
  service: string,
  identifier: string
): Promise<PlayerAlias | null> {
  return (req.ctx.em as EntityManager).getRepository(PlayerAlias).findOne({
    service,
    identifier: await getRealIdentifier(req, key, service, identifier),
    player: {
      game: key.game
    }
  }, {
    populate: ['player.auth']
  })
}

export async function createPlayerFromIdentifyRequest(
  req: Request,
  key: APIKey,
  service: string,
  identifier: string
): Promise<Player> {
  if (checkScope(key, APIKeyScope.WRITE_PLAYERS)) {
    const res = await forwardRequest(req, {
      body: {
        aliases: [{ service, identifier: await getRealIdentifier(req, key, service, identifier) }],
        props: req.ctx.state.initialPlayerProps
      }
    })

    return res.body.player
  } else {
    req.ctx.throw(404, 'Player not found. Use an access key with the write:players scope to automatically create players')
  }
}

function validateIdentifyQueryParam(param: 'service' | 'identifier') {
  return async (val?: string): Promise<ValidationCondition[]> => [
    {
      check: val.trim().length > 0,
      error: `Invalid ${param}, must be a non-empty string`
    }
  ]
}

@Routes([
  {
    method: 'GET',
    path: '/identify',
    handler: 'identify',
    docs: PlayerAPIDocs.identify
  },
  {
    method: 'PATCH',
    docs: PlayerAPIDocs.patch
  },
  {
    method: 'POST',
    path: '/merge',
    handler: 'merge',
    docs: PlayerAPIDocs.merge
  }
])
export default class PlayerAPIService extends APIService {
  @Validate({
    query: {
      service: {
        required: true,
        validation: validateIdentifyQueryParam('service')
      },
      identifier: {
        required: true,
        validation: validateIdentifyQueryParam('identifier')
      }
    }
  })
  @HasPermission(PlayerAPIPolicy, 'identify')
  @ForwardTo('games.players', 'post')
  async identify(req: Request): Promise<Response> {
    const { service, identifier } = req.query
    const em: EntityManager = req.ctx.em

    const key = await this.getAPIKey(req.ctx)
    let alias: PlayerAlias = null

    try {
      alias = await findAliasFromIdentifyRequest(req, key, service, identifier)
      if (!alias) {
        if (service === PlayerAliasService.TALO) {
          req.ctx.throw(404, 'Player not found: Talo aliases must be created using the /v1/players/auth API')
        } else {
          const player = await createPlayerFromIdentifyRequest(req, key, service, identifier)
          alias = player?.aliases[0]
        }
      } else if (alias.service === PlayerAliasService.TALO) {
        setCurrentPlayerState(req.ctx, alias.player.id, alias.id)
        await validateAuthSessionToken(req.ctx, alias)
      }
    } catch (err) {
      if (err instanceof Error && err.cause === 400) {
        req.ctx.throw(400, err.message)
      } else {
        throw err
      }
    }

    alias.lastSeenAt = alias.player.lastSeenAt = new Date()
    await em.flush()

    const socketToken = await alias.createSocketToken(createRedisConnection(req.ctx))

    return {
      status: 200,
      body: {
        alias,
        socketToken
      }
    }
  }

  @HasPermission(PlayerAPIPolicy, 'patch')
  @ForwardTo('games.players', 'patch')
  async patch(req: Request): Promise<Response> {
    return await forwardRequest(req)
  }

  @Validate({
    body: ['playerId1', 'playerId2']
  })
  @HasPermission(PlayerAPIPolicy, 'merge')
  async merge(req: Request): Promise<Response> {
    const { playerId1, playerId2 } = req.body
    const em: EntityManager = req.ctx.em

    const key = await this.getAPIKey(req.ctx)

    const player1 = await em.getRepository(Player).findOne({
      id: playerId1,
      game: key.game
    }, {
      populate: ['auth']
    })

    if (!player1) req.ctx.throw(404, `Player ${playerId1} does not exist`)
    if (player1.auth) req.ctx.throw(400, `Player ${playerId1} has authentication enabled and cannot be merged`)

    const player2 = await em.getRepository(Player).findOne({
      id: playerId2,
      game: key.game
    }, {
      populate: ['aliases', 'auth']
    })

    if (!player2) req.ctx.throw(404, `Player ${playerId2} does not exist`)
    if (player2.auth) req.ctx.throw(400, `Player ${playerId2} has authentication enabled and cannot be merged`)

    const mergedProps: PlayerProp[] = uniqWith([
      ...player2.props.getItems(),
      ...player1.props.getItems()
    ], (a, b) => a.key === b.key)

    player1.setProps(mergedProps.map((prop) => ({ key: prop.key, value: prop.value })))
    player2.aliases.getItems().forEach((alias) => alias.player = player1)
    player2.setProps([])
    await em.flush()

    const saves = await em.getRepository(GameSave).find({ player: player2 })
    saves.forEach((save) => save.player = player1)

    const stats = await em.getRepository(PlayerGameStat).find({ player: player2 })
    stats.forEach((stat) => stat.player = player1)

    await em.flush()
    await em.getRepository(Player).nativeDelete(player2)

    return {
      status: 200,
      body: {
        player: player1
      }
    }
  }
}
