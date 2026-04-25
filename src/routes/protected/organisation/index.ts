import { protectedRouter } from '../../../lib/routing/router'
import { currentRoute } from './current'
import { removeMemberRoute } from './remove-member'

export function organisationRouter() {
  return protectedRouter('/organisations', ({ route }) => {
    route(currentRoute)
    route(removeMemberRoute)
  })
}
