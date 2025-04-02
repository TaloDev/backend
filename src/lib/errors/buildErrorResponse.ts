import { Response } from 'koa-clay'

type ErrorResponse = {
  errors: Record<string, string[]>
}

export default function buildErrorResponse(errors: Record<string, string[]>): Response<ErrorResponse> {
  return {
    status: 400,
    body: {
      errors
    }
  }
}
