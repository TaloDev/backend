import User from '../../entities/user.js'
import UserRecoveryCode from '../../entities/user-recovery-code.js'

export default function generateRecoveryCodes(user: User): UserRecoveryCode[] {
  return [...new Array(8)].map(() => new UserRecoveryCode(user))
}
