import User from '../../entities/user'
import UserRecoveryCode from '../../entities/user-recovery-code'

export default function generateRecoveryCodes(user: User): UserRecoveryCode[] {
  return Array.from({ length: 8 }).map(() => new UserRecoveryCode(user))
}
