import { protectedRoute } from '../../../lib/routing/router'

export const meRoute = protectedRoute({
  method: 'get',
  path: '/me',
  handler: (ctx) => {
    return {
      status: 200,
      body: {
        user: ctx.state.user,
      },
    }
  },
})
