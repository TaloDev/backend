import compose from 'koa-compose'
import Router from 'koa-tree-router'

export class RouterGroup {
  constructor(private readonly routers: Router[]) {}

  routes() {
    return compose(this.routers.map((router) => router.routes()))
  }
}
