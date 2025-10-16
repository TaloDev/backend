export class LeaderboardEntryPropsChangedError extends Error {
  constructor() {
    super('Leaderboard entry props do not match incoming props')
    this.name = 'LeaderboardEntryPropsChangedError'
  }
}
