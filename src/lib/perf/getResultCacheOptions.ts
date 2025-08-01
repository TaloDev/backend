type CacheKey = { cache: [string, number] } | undefined

export function getResultCacheOptions(key: string, cacheExpiration = 10_000): CacheKey {
  /* v8 ignore next 5 */
  if (process.env.NODE_ENV !== 'test') {
    return {
      cache: [key, cacheExpiration]
    }
  }
}
