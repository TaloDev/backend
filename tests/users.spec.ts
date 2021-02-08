import chai from 'chai'
import http from 'chai-http'
import server from '../src/index'
const expect = chai.expect

chai.use(http)

describe('Users public server', () => {
  it('should work', (done: Function) => {
    expect(true).to.be.true
    done()
  })
})
