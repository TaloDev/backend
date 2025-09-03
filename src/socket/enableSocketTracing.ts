import { metrics } from '@opentelemetry/api'
import { WebSocket } from 'ws'
import Socket from '.'

export function enableSocketTracing(socket: Socket) {
  if (process.env.NODE_ENV === 'test') {
    return
  }

  const socketMonitorMeter = metrics.getMeter('socket-monitor-meter')

  const openGauge = socketMonitorMeter.createObservableGauge('talo.socket.connections.open')
  openGauge.addCallback((result) => {
    const allClients = Array.from(socket.getServer().clients.values())
    result.observe(allClients.filter((c) => c.readyState === WebSocket.OPEN).length)
  })

  const closedGauge = socketMonitorMeter.createObservableGauge('talo.socket.connections.not-open')
  closedGauge.addCallback((result) => {
    const allClients = Array.from(socket.getServer().clients.values())
    result.observe(allClients.filter((c) => c.readyState !== WebSocket.OPEN).length)
  })

  const ticketedGauge = socketMonitorMeter.createObservableGauge('talo.socket.connections.ticketed')
  ticketedGauge.addCallback((result) => {
    const allClients = socket.findConnections(() => true)
    result.observe(allClients.length)
  })
}
