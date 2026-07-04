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
  return getMatcher().hasMatch(text)
}
