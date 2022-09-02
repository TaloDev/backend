import upperFirst from '../../../src/lib/lang/upperFirst'

describe('upperFirst', () => {
  it('should uppercase the first character in a string', () => {
    expect(upperFirst('steamworks')).toBe('Steamworks')
  })
})
