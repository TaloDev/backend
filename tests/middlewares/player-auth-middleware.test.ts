import request from 'supertest';
import createAPIKeyAndToken from '../utils/createAPIKeyAndToken';
import { APIKeyScope } from '../../src/entities/api-key';
import GameStatFactory from '../fixtures/GameStatFactory';
import PlayerFactory from '../fixtures/PlayerFactory';
import PlayerAliasFactory from '../fixtures/PlayerAliasFactory';
import { EntityManager } from '@mikro-orm/core'; // Assuming you are using MikroORM

describe('Player auth middleware', () => {
  let apiKey: any; // Replace 'any' with the actual type if available
  let token: string;
  let stat: any; // Replace 'any' with the actual type
  let player: any; // Replace 'any' with the actual type
  let em: EntityManager; // Replace 'EntityManager' with the actual type of your entity manager
  let app: any; // Replace 'any' with the actual type of your application object

  beforeEach(async () => {
    [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS]);
    stat = await new GameStatFactory([apiKey.game]).state(() => ({
      defaultValue: 0,
      maxChange: 1,
      maxValue: 1000,
    })).one();
    player = await new PlayerFactory([apiKey.game]).one();

    // Assuming 'em' and 'app' are available in the test scope
    await em.persistAndFlush([stat, player]);
  });

  it('should allow access to api endpoints when valid session headers are provided', async () => {
    player = await new PlayerFactory([apiKey.game]).withTaloAlias().one();
    await em.persistAndFlush(player);
    const sessionToken = await player.auth!.createSession(player.aliases[0]);
    await em.flush();

    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-session', sessionToken)
      .expect(200);
  });

  it('should allow access to api endpoints if the alias service is not Talo', async () => {
    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200);
  });

  it('should block access if the alias service is Talo and the x-talo-session header is not set', async () => {
    player = await new PlayerFactory([apiKey.game]).withTaloAlias().one();
    await em.persistAndFlush(player);

    const res = await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(401);

    expect(res.body).toStrictEqual({
      message: 'The x-talo-session header is required for this player',
      errorCode: 'MISSING_SESSION',
    });
  });

  it('should block access if the player has an alias where the service is Talo and the x-talo-session header is not set', async () => {
    player = await new PlayerFactory([apiKey.game]).withTaloAlias().one();
    await em.persistAndFlush(player);

    const res = await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .expect(401);

    expect(res.body).toStrictEqual({
      message: 'The x-talo-session header is required for this player',
      errorCode: 'MISSING_SESSION',
    });
  });

  it('should block access if the session token is invalid', async () => {
    player = await new PlayerFactory([apiKey.game]).withTaloAlias().one();
    await em.persistAndFlush(player);
    const oldSessionToken = await player.auth!.createSession(player.aliases[0]);

    await player.auth!.createSession(player.aliases[0]);
    await em.flush();

    const res = await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-session', oldSessionToken)
      .expect(401);

    expect(res.body).toStrictEqual({
      message: 'The x-talo-session header is invalid',
      errorCode: 'INVALID_SESSION',
    });
  });

  it('should block access if the session token does not match the alias', async () => {
    player = await new PlayerFactory([apiKey.game]).withTaloAlias().one();
    player.aliases.add(await new PlayerAliasFactory(player).one());
    await em.persistAndFlush(player);
    const sessionToken = await player.auth!.createSession(player.aliases[0]);
    await em.flush();

    const res = await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', '2')
      .set('x-talo-session', sessionToken)
      .expect(401);

    expect(res.body).toStrictEqual({
      message: 'The x-talo-session header is invalid',
      errorCode: 'INVALID_SESSION',
    });
  });

  it('should block access if the session token does not match the player', async () => {
    const otherPlayer = await new PlayerFactory([apiKey.game]).withTaloAlias().one();
    await em.persistAndFlush(otherPlayer);
    const sessionToken = await player.auth!.createSession(player.aliases[0]);
    await otherPlayer.auth!.createSession(otherPlayer.aliases[0]);
    await em.flush();

    const res = await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', otherPlayer.id)
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-session', sessionToken)
      .expect(401);

    expect(res.body).toStrictEqual({
      message: 'The x-talo-session header is invalid',
      errorCode: 'INVALID_SESSION',
    });
  });
});
