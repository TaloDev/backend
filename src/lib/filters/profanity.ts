import { DataSet, RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity'
import { portugueseDataset } from './datasets/portuguese.js'

let matcher: RegExpMatcher | null = null

function getMatcher() {
  if (!matcher) {
    const combined = new DataSet().addAll(englishDataset).addAll(portugueseDataset)

    matcher = new RegExpMatcher({
      ...combined.build(),
      ...englishRecommendedTransformers,
    })
  }
  return matcher
}

export function hasProfanity(text: string) {
  // numeric/punctuation values can leetspeak-decode into profane words (e.g. "460240" -> "goza").
  // skip the check unless the value contains any letter.
  if (!/\p{L}/u.test(text)) {
    return false
  }
  return getMatcher().hasMatch(text)
}
