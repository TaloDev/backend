import { protectedRouter } from '../../../lib/routing/router.js'
import { currentRoute } from './current.js'
import { removeMemberRoute } from './remove-member.js'

export function organisationRouter() {
  return protectedRouter('/organisations', ({ route }) => {
    route(currentRoute)
    route(removeMemberRoute)
  })
}
