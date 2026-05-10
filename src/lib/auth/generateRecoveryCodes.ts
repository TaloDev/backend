import UserRecoveryCode from '../../entities/user-recovery-code.js'
import User from '../../entities/user.js'

export default function generateRecoveryCodes(user: User): UserRecoveryCode[] {
  return Array.from({ length: 8 }).map(() => new UserRecoveryCode(user))
}
