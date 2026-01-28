import { EntityManager } from '@mikro-orm/mysql'
import { Request, Response, Route, Validate, HasPermission, ValidationCondition } from 'koa-clay'
import Player from '../../entities/player'
import GameSave from '../../entities/game-save'
import PlayerAlias, { PlayerAliasService } from '../../entities/player-alias'
import PlayerAPIPolicy from '../../policies/api/player-api.policy'
import APIService from './api-service'
import { uniqWith } from 'lodash'
import { PlayerAPIDocs } from '../../docs/player-api.docs'
import PlayerGameStat from '../../entities/player-game-stat'
import { validateAuthSessionToken } from '../../middleware/player-auth-middleware'
import { setCurrentPlayerState } from '../../middleware/current-player-middleware'
import { ClickHouseClient } from '@clickhouse/client'
import { createPlayerFromIdentifyRequest, PlayerCreationError } from '../../lib/players/createPlayer'
import { PricingPlanLimitError } from '../../lib/billing/checkPricingPlanPlayerLimit'
import { listPlayersHandler } from '../../routes/protected/player/list'
import { updatePlayerHandler } from '../../routes/protected/player/update'
import { findAliasFromIdentifyRequest } from '../../lib/players/findAlias'

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
  async identify(req: Request): Promise<Response> {
    const { service, identifier } = req.query
    const em: EntityManager = req.ctx.em

    const key = await this.getAPIKey(req.ctx)
    let alias: PlayerAlias | null = null
    let justCreated = false

    try {
      const realIdentifier = await PlayerAlias.resolveIdentifier({
        req,
        game: key.game,
        service,
        identifier
      })

      alias = await findAliasFromIdentifyRequest({ em, key, service, identifier: realIdentifier })
      if (!alias) {
        if (service === PlayerAliasService.TALO) {
          req.ctx.throw(404, 'Player not found: Talo aliases must be created using the /v1/players/auth API')
        } else {
          const devBuild = req.ctx.request.headers['x-talo-dev-build'] === '1'
          const player = await createPlayerFromIdentifyRequest({
            em,
            key,
            service,
            identifier: realIdentifier,
            initialProps: req.ctx.state.initialPlayerProps,
            devBuild
          })
          alias = player?.aliases[0]
          justCreated = true
        }
      } else if (alias.service === PlayerAliasService.TALO) {
        setCurrentPlayerState(req.ctx, alias.player.id, alias.id)
        await em.populate(alias, ['player.auth'])
        await validateAuthSessionToken(req.ctx, alias)
      }
    } catch (err) {
      if (err instanceof PlayerCreationError) {
        req.ctx.throw(err.statusCode, {
          message: err.message,
          errorCode: err.errorCode
        })
      }
      if (err instanceof PricingPlanLimitError) {
        req.ctx.throw(402, err.message)
      }
      // catches steam integration errors
      if (err instanceof Error && err.cause === 400) {
        req.ctx.throw(400, err.message)
      }
      throw err
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
  async search(req: Request): Promise<Response> {
    const { query } = req.query
    const key = await this.getAPIKey(req.ctx)

    return listPlayersHandler({
      em: req.ctx.em,
      game: key.game,
      search: query as string,
      page: 0,
      includeDevData: req.ctx.state.includeDevData,
      forwarded: true
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
  patch(req: Request): Promise<Response> {
    const { props } = req.body
    const em: EntityManager = req.ctx.em

    return updatePlayerHandler({
      em,
      player: req.ctx.state.player,
      props,
      forwarded: true
    })
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

      trx.remove(player1.props)
      trx.remove(player2.props)
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

    await em.populate(updatedPlayer, ['aliases'])

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
