import Organisation from '../../src/entities/organisation'
import User from '../../src/entities/user'
import { genAccessToken } from '../../src/lib/auth/buildTokenPair'
import UserFactory from '../fixtures/UserFactory'

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
