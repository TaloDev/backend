import { EntityManager } from '@mikro-orm/mysql'
import { Request, Response, Route, Validate, HasPermission, ForwardTo, forwardRequest, ValidationCondition } from 'koa-clay'
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
import { validateAuthSessionToken } from '../../middleware/player-auth-middleware'
import { setCurrentPlayerState } from '../../middleware/current-player-middleware'
import { ClickHouseClient } from '@clickhouse/client'
import { TraceService } from '../../lib/tracing/trace-service'
import { getResultCacheOptions } from '../../lib/perf/getResultCacheOptions'

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
    ...(getResultCacheOptions(`identify-${service}-${identifier}`) ?? {}),
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
    const res = await forwardRequest<{ player: Player }>(req, {
      body: {
        aliases: [{ service, identifier: await getRealIdentifier(req, key, service, identifier) }],
        props: req.ctx.state.initialPlayerProps
      }
    })

    return res.body!.player
  } else {
    req.ctx.throw(404, 'Player not found. Use an access key with the write:players scope to automatically create players')
  }
}

function validateIdentifyQueryParam(param: 'service' | 'identifier') {
  return async (val?: unknown): Promise<ValidationCondition[]> => [
    {
      check: typeof val === 'string' && val.trim().length > 0,
      error: `Invalid ${param}, must be a non-empty string`
    }
  ]
}

@TraceService()
export default class PlayerAPIService extends APIService {
  @Route({
    method: 'GET',
    path: '/identify',
    docs: PlayerAPIDocs.identify
  })
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
    let alias: PlayerAlias | null = null

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

    const socketToken = await alias.createSocketToken(req.ctx.redis)

    return {
      status: 200,
      body: {
        alias,
        socketToken
      }
    }
  }

  @Route({
    method: 'GET',
    path: '/:id',
    docs: PlayerAPIDocs.get
  })
  @HasPermission(PlayerAPIPolicy, 'get')
  async get(req: Request): Promise<Response> {
    const { id } = req.params
    const em: EntityManager = req.ctx.em
    const key = await this.getAPIKey(req.ctx)

    const player = await em.getRepository(Player).findOne({
      id,
      game: key.game
    }, {
      populate: ['aliases']
    })

    if (!player) {
      req.ctx.throw(404, 'Player not found')
    }

    return {
      status: 200,
      body: {
        player
      }
    }
  }

  @Route({
    method: 'PATCH',
    path: '/:id',
    docs: PlayerAPIDocs.patch
  })
  @HasPermission(PlayerAPIPolicy, 'patch')
  @ForwardTo('games.players', 'patch')
  async patch(req: Request): Promise<Response> {
    return await forwardRequest(req)
  }

  @Route({
    method: 'POST',
    path: '/merge',
    docs: PlayerAPIDocs.merge
  })
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

    const clickhouse: ClickHouseClient = req.ctx.clickhouse
    await clickhouse.exec({ query: `DELETE FROM player_sessions WHERE player_id = '${player2.id}'` })

    return {
      status: 200,
      body: {
        player: player1
      }
    }
  }
}
