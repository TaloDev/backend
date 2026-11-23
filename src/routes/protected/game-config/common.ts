import { buildErrorResponse } from '../../../lib/errors/buildErrorResponse.js'
import {
  RESERVED_PROP_KEY_ERROR,
  RESERVED_PROP_KEY_MESSAGE,
  type RejectedProp,
} from '../../../lib/props/sanitiseProps.js'

export function buildPropsError(rejected: RejectedProp[]) {
  if (rejected.some((prop) => prop.error === RESERVED_PROP_KEY_ERROR)) {
    return buildErrorResponse({ props: [RESERVED_PROP_KEY_MESSAGE] })
  }

  if (rejected.length > 0) {
    return buildErrorResponse(
      { props: ['One or more props are invalid, see rejectedProps'] },
      { rejectedProps: rejected },
    )
  }

  return null
}
