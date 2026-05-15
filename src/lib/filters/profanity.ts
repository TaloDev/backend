import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity'

let matcher: RegExpMatcher | null = null

function getMatcher() {
  if (!matcher) {
    matcher = new RegExpMatcher({
      ...englishDataset.build(),
      ...englishRecommendedTransformers,
    })
  }
  return matcher
}

export function hasProfanity(text: string) {
  return getMatcher().hasMatch(text)
}
