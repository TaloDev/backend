import chai from 'chai'
import http from 'chai-http'
import { Server } from 'http'
import { init } from '../src/index'

chai.use(http)
const expect = chai.expect
const baseUrl = '/public/users'
let server: Server

before(async () => {
  server = await init()
})

after(() => {
  server.close()
})

describe('Users public server', () => {
  it('should work', (done: Function) => {
    chai
      .request(server)
      .post(`${baseUrl}/register`)
      .send({ email: 'tudor@sleepystudios.net', password: 'password' })
      .end((err, res) => {
        console.log(err)
        expect(res).to.have.status(200)
        expect(res.body).to.have.property('user')
        expect(res.body).to.have.property('token')
        done()
      })
  })
})
