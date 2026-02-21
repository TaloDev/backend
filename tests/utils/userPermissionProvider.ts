import { UserType } from '../../src/entities/user'

type UserTypeStatusCodeProvider = [number, string, UserType][]

export default function userPermissionProvider(
  allowedUserTypes: UserType[] = [],
  successCode = 200,
): UserTypeStatusCodeProvider {
  const userTypeMap: Record<UserType, string> = {
    [UserType.OWNER]: 'owner',
    [UserType.ADMIN]: 'admin',
    [UserType.DEV]: 'dev',
    [UserType.DEMO]: 'demo',
  }

  const provider: UserTypeStatusCodeProvider = [
    [successCode, userTypeMap[UserType.OWNER], UserType.OWNER],
  ]

  allowedUserTypes.forEach((userType) =>
    provider.push([successCode, userTypeMap[userType], userType]),
  )

  Object.keys(userTypeMap)
    .map((key) => Number(key) as UserType)
    .filter((userType) => {
      return !provider.find((providerItem) => providerItem[1] === userTypeMap[userType])
    })
    .forEach((userType) => {
      provider.push([403, userTypeMap[userType], userType])
    })

  return provider
}
