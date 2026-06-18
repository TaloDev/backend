import PlayerAuthCode from '../../src/emails/player-auth-code-mail.js'
import PlayerAuthFactory from '../fixtures/PlayerAuthFactory.js'
import PlayerFactory from '../fixtures/PlayerFactory.js'
import createOrganisationAndGame from '../utils/createOrganisationAndGame.js'

describe('PlayerAuthCode mail', () => {
  async function buildAlias({
    logoUrl,
    website,
  }: {
    logoUrl: string | null
    website: string | null
  }) {
    const [, game] = await createOrganisationAndGame()
    game.logoUrl = logoUrl
    game.website = website

    const player = await new PlayerFactory([game])
      .withTaloAlias()
      .state(async () => ({
        auth: await new PlayerAuthFactory().state(() => ({ email: 'boz@mail.com' })).one(),
      }))
      .one()

    const alias = player.aliases[0]
    await em.persist(player).flush()

    return alias
  }

  it('shows the game logo and links to the game website when both are set', async () => {
    const alias = await buildAlias({
      logoUrl: 'https://example.com/logo.png',
      website: 'https://example.com',
    })

    const mail = new PlayerAuthCode(alias, '123456')

    expect(mail.logoUrl).toBe('https://example.com/logo.png')
    expect(mail.logoLink).toBe('https://example.com')

    const { html } = mail.getConfig()
    expect(html).toContain('<img src="https://example.com/logo.png"')
    expect(html).toContain('href="https://example.com"')
  })

  it('hides the logo when logoUrl is not set', async () => {
    const alias = await buildAlias({
      logoUrl: null,
      website: 'https://example.com',
    })

    const mail = new PlayerAuthCode(alias, '123456')

    expect(mail.logoUrl).toBe('')

    const { html } = mail.getConfig()
    expect(html).not.toContain('<img')
  })

  it('hides the logo when website is not set', async () => {
    const alias = await buildAlias({
      logoUrl: 'https://example.com/logo.png',
      website: null,
    })

    const mail = new PlayerAuthCode(alias, '123456')

    expect(mail.logoLink).toBe('')

    const { html } = mail.getConfig()
    expect(html).not.toContain('<img')
  })

  it('sets the recipient, subject, title and main text from the alias and game', async () => {
    const alias = await buildAlias({
      logoUrl: null,
      website: null,
    })

    const code = '123456'
    const mail = new PlayerAuthCode(alias, code)

    expect(mail.to).toBe('boz@mail.com')
    expect(mail.subject).toBe(`Your ${alias.player.game.name} verification code`)
    expect(mail.title).toBe(`Login to ${alias.player.game.name}`)
    expect(mail.mainText).toContain(alias.identifier)
    expect(mail.mainText).toContain(code)

    expect(mail.fromName).toBe(alias.player.game.name)
    expect(mail.getConfig().from.name).toBe(alias.player.game.name)

    expect(mail.why).toBe('')
    const { html } = mail.getConfig()
    expect(html).not.toContain('contact us')
    expect(html).not.toContain("If something doesn't look right")
  })
})
