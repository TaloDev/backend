export type WorkerDatabaseConfig = {
  mysqlDatabase: string
  redisKeyPrefix: string
  clickhouseDatabase: string
}

export function getWorkerId() {
  const poolId = process.env.VITEST_POOL_ID
  if (!poolId) {
    throw new Error('VITEST_POOL_ID not set - are you running tests with Vitest?')
  }
  return parseInt(poolId, 10)
}

export function getWorkerDatabaseConfig() {
  const workerId = getWorkerId()
  return {
    mysqlDatabase: `gs_test_w${workerId}`,
    redisKeyPrefix: `worker:${workerId}:`,
    clickhouseDatabase: `gs_ch_test_w${workerId}`
  } satisfies WorkerDatabaseConfig
}
