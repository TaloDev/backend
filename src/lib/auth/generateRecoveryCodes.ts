import User from '../../entities/user'
import UserRecoveryCode from '../../entities/user-recovery-code'

export default function generateRecoveryCodes(user: User): UserRecoveryCode[] {
  return [...new Array(8)].map(() => new UserRecoveryCode(user))
}
