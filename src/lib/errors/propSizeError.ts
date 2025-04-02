export class PropSizeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PropSizeError'
  }
}
