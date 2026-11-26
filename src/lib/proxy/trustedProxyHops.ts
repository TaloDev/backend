const DEFAULT_TRUSTED_PROXY_HOPS = 1

// only read the last N addresses in X-Forwarded-For
export function trustedProxyHops() {
  const hops = Number(process.env.TRUSTED_PROXY_HOPS)
  return Number.isInteger(hops) && hops > 0 ? hops : DEFAULT_TRUSTED_PROXY_HOPS
}
