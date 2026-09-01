import { vi, type Mock } from 'vitest'

export const mockTransport: { verify: Mock; sendMail: Mock } = {
  verify: vi.fn().mockResolvedValue(true),
  sendMail: vi.fn().mockResolvedValue(true),
}

const createTransport: Mock = vi.fn(() => mockTransport)

export default { createTransport }
