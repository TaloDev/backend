import { EntityManager, raw } from '@mikro-orm/mysql'
import assert from 'node:assert'
import LeaderboardEntry from '../../entities/leaderboard-entry.js'
import Leaderboard, { LeaderboardSortMode } from '../../entities/leaderboard.js'

type ScoreGroup = {
  score: number
  createdAt: number
  count: number
}

type ScoreBlock = {
  start: number
  end: number
}

// positions for a batch of entries in one grouped query
// entries sharing their exact score and createdAt with other entries
// need one extra count for the id tie-break
export async function getEntryPositions({
  em,
  leaderboard,
  entries,
  includeDevData,
}: {
  em: EntityManager
  leaderboard: Leaderboard
  entries: LeaderboardEntry[]
  includeDevData: boolean
}): Promise<number[]> {
  if (entries.length === 0) {
    return []
  }

  const filters = leaderboard.getBaseEntryFilters(includeDevData)

  // entry counts per (score, createdAt) across the leaderboard
  const rows = await em
    .qb(LeaderboardEntry)
    .select(['score', 'createdAt', raw('count(*)').as('count')])
    .where(filters)
    .groupBy(['score', 'createdAt'])
    .execute<{ score: number; createdAt: Date; count: number }[]>('all')

  // ascending by (score, createdAt); the id tie-break is resolved per entry below
  const groups: ScoreGroup[] = rows
    .map((row) => ({
      score: Number(row.score),
      createdAt: new Date(row.createdAt).getTime(),
      count: Number(row.count),
    }))
    .sort((a, b) => a.score - b.score || a.createdAt - b.createdAt)

  // cumulative count of entries up to (but excluding) each group
  const totals = [0]
  groups.forEach((group, idx) => totals.push(totals[idx] + group.count))
  const total = totals[groups.length]

  const scoreBlocks = new Map<number, ScoreBlock>()
  const groupIndexes = new Map<string, number>()
  groups.forEach((group, idx) => {
    const block = scoreBlocks.get(group.score)
    if (block) {
      block.end = idx + 1
    } else {
      scoreBlocks.set(group.score, { start: idx, end: idx + 1 })
    }

    groupIndexes.set(`${group.score}:${group.createdAt}`, idx)
  })

  const asc = leaderboard.sortMode === LeaderboardSortMode.ASC

  return Promise.all(
    entries.map(async (entry) => {
      const score = entry.score
      const createdAt = entry.createdAt.getTime()
      const block = scoreBlocks.get(score)
      const groupIdx = groupIndexes.get(`${score}:${createdAt}`)

      // in-memory entries aren't in the histogram yet - they must be persisted first
      assert(block)
      assert(groupIdx !== undefined)

      // lower scores rank first on asc leaderboards, last on desc ones
      const betterScore = asc ? totals[block.start] : total - totals[block.end]

      // same-score groups with an earlier createdAt rank first on both sort modes
      let earlier = block.start
      while (groups[earlier].createdAt < createdAt) {
        earlier++
      }
      const sameScoreEarlier = totals[earlier] - totals[block.start]

      let position = betterScore + sameScoreEarlier

      // entries sharing the exact score and createdAt need the id tie-break
      if (groups[groupIdx].count > 1) {
        position += await em.repo(LeaderboardEntry).count({
          ...filters,
          score,
          createdAt: entry.createdAt,
          id: { $lt: entry.id },
        })
      }

      return position
    }),
  )
}
