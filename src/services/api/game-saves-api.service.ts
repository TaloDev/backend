import { HasPermission, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import GameSavesAPIPolicy from '../../policies/api/game-saves-api.policy'
import APIService from './api-service'
import GameSave from '../../entities/game-save'
import { EntityManager } from '@mikro-orm/core'

export default class GameSaveAPIService extends APIService<void> {
  constructor() {
    super('game-saves')
  }

  @Validate({
    query: ['aliasId']
  })
  @HasPermission(GameSavesAPIPolicy, 'index')
  async index(req: ServiceRequest): Promise<ServiceResponse> {
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
  @HasPermission(GameSavesAPIPolicy, 'post')
  async post(req: ServiceRequest): Promise<ServiceResponse> {
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
  @HasPermission(GameSavesAPIPolicy, 'patch')
  async patch(req: ServiceRequest): Promise<ServiceResponse> {
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
