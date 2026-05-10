import Organisation from '../../src/entities/organisation.js'
import User from '../../src/entities/user.js'
import { genAccessToken } from '../../src/lib/auth/buildTokenPair.js'
import UserFactory from '../fixtures/UserFactory.js'

export default async function createUserAndToken(
  partial?: Partial<User>,
  organisation?: Organisation,
): Promise<[string, User]> {
  const user = await new UserFactory()
    .loginable()
    .state(() => partial ?? {})
    .one()
  if (organisation) {
    user.organisation = organisation
  }

  await em.persist(user).flush()

  const token = await genAccessToken(user)
  return [token, user]
}
