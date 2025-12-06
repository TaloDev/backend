import { HasPermission, Request, Response, Route, Validate } from 'koa-clay'
import GameSaveAPIPolicy from '../../policies/api/game-save-api.policy'
import APIService from './api-service'
import GameSave from '../../entities/game-save'
import { EntityManager } from '@mikro-orm/mysql'
import { GameSaveAPIDocs } from '../../docs/game-save-api.docs'
import handleSQLError from '../../lib/errors/handleSQLError'

function decodeContent(content: unknown) {
  return typeof content === 'string' ? JSON.parse(content) : content
}

export default class GameSaveAPIService extends APIService {
  @Route({
    method: 'GET',
    docs: GameSaveAPIDocs.index
  })
  @Validate({
    headers: ['x-talo-player']
  })
  @HasPermission(GameSaveAPIPolicy, 'index')
  async index(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const saves = await em.getRepository(GameSave).find({
      player: req.ctx.state.player
    })

    return {
      status: 200,
      body: {
        saves
      }
    }
  }

  @Route({
    method: 'POST',
    docs: GameSaveAPIDocs.post
  })
  @Validate({
    headers: ['x-talo-player'],
    body: ['name', 'content']
  })
  @HasPermission(GameSaveAPIPolicy, 'post')
  async post(req: Request): Promise<Response> {
    const { name, content } = req.body
    const em: EntityManager = req.ctx.em

    const save = new GameSave(name, req.ctx.state.player)
    save.content = decodeContent(content)

    try {
      await em.persistAndFlush(save)
    } catch (err) {
      return handleSQLError(err as Error)
    }

    return {
      status: 200,
      body: {
        save
      }
    }
  }

  @Route({
    method: 'PATCH',
    path: '/:id',
    docs: GameSaveAPIDocs.patch
  })
  @Validate({
    headers: ['x-talo-player'],
    body: ['content']
  })
  @HasPermission(GameSaveAPIPolicy, 'patch')
  async patch(req: Request): Promise<Response> {
    const { name, content } = req.body
    const em: EntityManager = req.ctx.em

    const save = req.ctx.state.save
    if (name) save.name = name
    save.content = decodeContent(content)

    try {
      await em.flush()
    } catch (err) {
      return handleSQLError(err as Error)
    }

    return {
      status: 200,
      body: {
        save
      }
    }
  }

  @Route({
    method: 'DELETE',
    path: '/:id',
    docs: GameSaveAPIDocs.delete
  })
  @Validate({
    headers: ['x-talo-player']
  })
  @HasPermission(GameSaveAPIPolicy, 'delete')
  async delete(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const save = req.ctx.state.save
    await em.removeAndFlush(save)

    return {
      status: 204
    }
  }
}
