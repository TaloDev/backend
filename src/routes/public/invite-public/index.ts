import type Router from 'koa-tree-router'
import Invite from '../../../entities/invite.js'
import { publicRouter } from '../../../lib/routing/router.js'

export function invitePublicRouter(router: Router) {
  publicRouter(
    '/public/invites',
    ({ route }) => {
      route({
        method: 'get',
        path: '/:id',
        handler: async (ctx) => {
          const { id } = ctx.params
          const em = ctx.em

          const invite = await em.repo(Invite).findOne(
            {
              token: id,
            },
            {
              populate: ['organisation', 'invitedByUser'],
            },
          )

          if (!invite) {
            return ctx.throw(404, 'Invite not found')
          }

          return {
            status: 200,
            body: {
              invite,
            },
          }
        },
      })
    },
    { router },
  )
}
