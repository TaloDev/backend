import type { RejectedProp } from '../props/sanitiseProps.js'

export class PropRejectionError extends Error {
  rejected: RejectedProp[]

  constructor(rejected: RejectedProp[]) {
    super('One or more props are invalid, see rejectedProps')
    this.name = 'PropRejectionError'
    this.rejected = rejected
  }
}
