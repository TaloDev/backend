import { vi } from 'vitest'

export const mockTransport = {
  verify: vi.fn().mockResolvedValue(true),
  sendMail: vi.fn().mockResolvedValue(true),
}

export default {
  createTransport: vi.fn(() => mockTransport),
}
