export default function buildErrorResponse(errors: Record<string, string[]>) {
  return {
    status: 400,
    body: {
      errors,
    },
  }
}
