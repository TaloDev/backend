export function getMetricFlushInterval() {
  const flushInterval = process.env.GAME_METRICS_FLUSH_INTERVAL
    ? Number(process.env.GAME_METRICS_FLUSH_INTERVAL)
    : 10_000

  return flushInterval
}
