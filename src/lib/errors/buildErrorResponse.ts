export function buildErrorResponse(
  errors: Record<string, string[]>,
  extraProperties?: Record<string, unknown>,
) {
  return {
    status: 400,
    body: {
      errors,
      ...extraProperties,
    },
  }
}
