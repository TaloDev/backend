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
import PlayerGameStat from '../../entities/player-game-stat'
import checkScope from '../../policies/checkScope'
import Integration, { IntegrationType } from '../../entities/integration'
import { validateAuthSessionToken } from '../../middleware/player-auth-middleware'
import { setCurrentPlayerState } from '../../middleware/current-player-middleware'
import { ClickHouseClient } from '@clickhouse/client'

async function getRealIdentifier(
  req: Request,
  key: APIKey,
  service: string,
  identifier: string
): Promise<string> {
  if (service === PlayerAliasService.STEAM) {
    const integration = await (req.ctx.em as EntityManager).repo(Integration).findOne({
      game: key.game,
      type: IntegrationType.STEAMWORKS
    })

    if (integration) {
      return integration.getPlayerIdentifier(req, identifier)
    }
  }

  return identifier.trim()
}

export async function findAliasFromIdentifyRequest(
  req: Request,
  key: APIKey,
  service: string,
  identifier: string
) {
  return (req.ctx.em as EntityManager).repo(PlayerAlias).findOne({
    service: service.trim(),
    identifier: await getRealIdentifier(req, key, service, identifier),
    player: {
      game: key.game
    }
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

async function findMergeAliasServiceConflicts(
  em: EntityManager,
  player1: Player,
  player2: Player
) {
  const player1Aliases = await em.repo(PlayerAlias).find({ player: player1 }, { fields: ['service'] })
  const player2Aliases = await em.repo(PlayerAlias).find({ player: player2 }, { fields: ['service'] })

  const player1Services = new Set(player1Aliases.map((a) => a.service))
  const player2Services = new Set(player2Aliases.map((a) => a.service))

  return player1Services.intersection(player2Services)
}

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
    let justCreated = false

    try {
      alias = await findAliasFromIdentifyRequest(req, key, service, identifier)
      if (!alias) {
        if (service === PlayerAliasService.TALO) {
          req.ctx.throw(404, 'Player not found: Talo aliases must be created using the /v1/players/auth API')
        } else {
          const player = await createPlayerFromIdentifyRequest(req, key, service, identifier)
          alias = player?.aliases[0]
          justCreated = true
        }
      } else if (alias.service === PlayerAliasService.TALO) {
        setCurrentPlayerState(req.ctx, alias.player.id, alias.id)
        await em.populate(alias, ['player.auth'])
        await validateAuthSessionToken(req.ctx, alias)
      }
    } catch (err) {
      if (err instanceof Error && err.cause === 400) {
        req.ctx.throw(400, err.message)
      } else {
        throw err
      }
    }

    if (!justCreated) {
      alias.lastSeenAt = alias.player.lastSeenAt = new Date()
      await em.flush()
      await alias.player.checkGroupMemberships(em)
    }

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
    path: '/search',
    docs: PlayerAPIDocs.search
  })
  @Validate({
    query: {
      query: {
        required: true,
        validation: async (val): Promise<ValidationCondition[]> => [
          {
            check: typeof val === 'string' && val.trim().replace('-', '').length > 0, // remove - so it doesn't match every uuid
            error: 'Query must be a non-empty string'
          }
        ]
      }
    }
  })
  @HasPermission(PlayerAPIPolicy, 'search')
  @ForwardTo('games.players', 'index')
  async search(req: Request): Promise<Response> {
    const { query } = req.query
    return await forwardRequest(req, {
      query: {
        search: query
      }
    })
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
    const em = (req.ctx.em as EntityManager).fork()

    if (playerId1 === playerId2) {
      req.ctx.throw(400, 'Cannot merge a player into itself')
    }

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
      populate: ['auth']
    })

    if (!player2) req.ctx.throw(404, `Player ${playerId2} does not exist`)
    if (player2.auth) req.ctx.throw(400, `Player ${playerId2} has authentication enabled and cannot be merged`)

    const sharedServices = await findMergeAliasServiceConflicts(em, player1, player2)
    if (sharedServices.size > 0) {
      req.ctx.throw(400, `Cannot merge players: both players have aliases with the following service(s): ${Array.from(sharedServices).join(', ')}`)
    }

    const updatedPlayer = await em.transactional(async (trx) => {
      const player1Props = player1.props.getItems().map(({ key, value }) => ({ key, value }))
      const player2Props = player2.props.getItems().map(({ key, value }) => ({ key, value }))
      const mergedProps = uniqWith([...player2Props, ...player1Props], (a, b) => a.key === b.key)

      em.remove(player1.props)
      em.remove(player2.props)
      player1.setProps(mergedProps)

      await trx.repo(PlayerAlias).nativeUpdate({ player: player2 }, { player: player1 })
      await trx.repo(GameSave).nativeUpdate({ player: player2 }, { player: player1 })
      await trx.repo(PlayerGameStat).nativeUpdate({ player: player2 }, { player: player1 })
      await trx.repo(Player).nativeDelete(player2)

      const clickhouse: ClickHouseClient = req.ctx.clickhouse
      await clickhouse.exec({
        query: 'DELETE FROM player_sessions WHERE player_id = {playerId:String}',
        query_params: { playerId: player2.id }
      })
      return player1
    })

    return {
      status: 200,
      body: {
        player: updatedPlayer
      }
    }
  }

  @Route({
    method: 'POST',
    path: '/socket-token',
    docs: PlayerAPIDocs.socketToken
  })
  @Validate({
    headers: ['x-talo-alias']
  })
  @HasPermission(PlayerAPIPolicy, 'socketToken')
  async socketToken(req: Request): Promise<Response> {
    const alias: PlayerAlias = req.ctx.state.alias
    const socketToken = await alias.createSocketToken(req.ctx.redis)

    return {
      status: 200,
      body: {
        socketToken
      }
    }
  }
}
