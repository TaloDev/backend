import { HasPermission, Request, Response, Validate } from 'koa-clay'
import GameSaveAPIPolicy from '../../policies/api/game-save-api.policy'
import APIService from './api-service'
import GameSave from '../../entities/game-save'
import { EntityManager } from '@mikro-orm/core'

export default class GameSaveAPIService extends APIService {
  @Validate({
    query: ['aliasId']
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

  @Validate({
    body: ['name', 'content', 'aliasId']
  })
  @HasPermission(GameSaveAPIPolicy, 'post')
  async post(req: Request): Promise<Response> {
    const { name, content } = req.body

    const em: EntityManager = req.ctx.em

    const save = new GameSave(name, req.ctx.state.player)
    save.content = content

    await em.persistAndFlush(save)

    return {
      status: 200,
      body: {
        save
      }
    }
  }

  @Validate({
    body: ['content', 'aliasId']
  })
  @HasPermission(GameSaveAPIPolicy, 'patch')
  async patch(req: Request): Promise<Response> {
    const { name, content } = req.body

    const em: EntityManager = req.ctx.em

    const save = req.ctx.state.save
    if (name) save.name = name
    save.content = content

    await em.flush()

    return {
      status: 200,
      body: {
        save
      }
    }
  }
}
