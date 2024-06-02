import { EntityManager } from '@mikro-orm/mysql'
import Organisation from '../../src/entities/organisation.js'
import User from '../../src/entities/user.js'
import { genAccessToken } from '../../src/lib/auth/buildTokenPair.js'
import UserFactory from '../fixtures/UserFactory.js'

export default async function createUserAndToken(partial?: Partial<User>, organisation?: Organisation): Promise<[string, User]> {
  const user = await new UserFactory().state('loginable').with(() => partial).one()
  if (organisation) user.organisation = organisation
  await (<EntityManager>global.em).persistAndFlush(user)

  const token = await genAccessToken(user)
  return [token, user]
}
