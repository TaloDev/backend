import { HasPermission, Request, Response, Validate, Docs } from 'koa-clay'
import GameSaveAPIPolicy from '../../policies/api/game-save-api.policy'
import APIService from './api-service'
import GameSave from '../../entities/game-save'
import { EntityManager } from '@mikro-orm/mysql'
import GameSaveAPIDocs from '../../docs/game-save-api.docs'

function decodeContent(content: unknown) {
  return typeof content === 'string' ? JSON.parse(content) : content
}

export default class GameSaveAPIService extends APIService {
  @Validate({
    headers: ['x-talo-player']
  })
  @HasPermission(GameSaveAPIPolicy, 'index')
  @Docs(GameSaveAPIDocs.index)
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

  @Validate({
    headers: ['x-talo-player'],
    body: ['name', 'content']
  })
  @HasPermission(GameSaveAPIPolicy, 'post')
  @Docs(GameSaveAPIDocs.post)
  async post(req: Request): Promise<Response> {
    const { name, content } = req.body

    const em: EntityManager = req.ctx.em

    const save = new GameSave(name, req.ctx.state.player)
    save.content = decodeContent(content)

    await em.persistAndFlush(save)

    return {
      status: 200,
      body: {
        save
      }
    }
  }

  @Validate({
    headers: ['x-talo-player'],
    body: ['content']
  })
  @HasPermission(GameSaveAPIPolicy, 'patch')
  @Docs(GameSaveAPIDocs.patch)
  async patch(req: Request): Promise<Response> {
    const { name, content } = req.body

    const em: EntityManager = req.ctx.em

    const save = req.ctx.state.save
    if (name) save.name = name
    save.content = decodeContent(content)

    await em.flush()

    return {
      status: 200,
      body: {
        save
      }
    }
  }

  @Validate({
    headers: ['x-talo-player']
  })
  @HasPermission(GameSaveAPIPolicy, 'delete')
  @Docs(GameSaveAPIDocs.delete)
  async delete(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const save = req.ctx.state.save
    await em.removeAndFlush(save)

    return {
      status: 204
    }
  }
}
