import Redis from 'ioredis'

export async function clearCachePattern(redis: Redis, pattern: string) {
  const script = `
    local cursor = "0"
    local deleted = 0
    
    repeat
      local result = redis.call('SCAN', cursor, 'MATCH', ARGV[1], 'COUNT', 1000)
      cursor = result[1]
      local keys = result[2]
      
      if #keys > 0 then
        deleted = deleted + redis.call('DEL', unpack(keys))
      end
    until cursor == "0"
    
    return deleted
  `

  try {
    return await redis.eval(script, 0, pattern) as number
  } catch {
    return 0
  }
}
