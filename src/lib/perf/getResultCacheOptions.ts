type CacheKey = { cache: [string, number] } | undefined

export function getResultCacheOptions(key: string, cacheExpiration = 60_000): CacheKey {
  return {
    cache: [key, cacheExpiration],
  }
}
