---
name: review-pr-feedback
description: Review and analyze PR feedback comments from Claude bot on the current branch's PR
argument-hint: '[--all]'
disable-model-invocation: true
---

<review-pr-feedback>

# Review PR Feedback from Claude

You are analyzing code review feedback from the Claude bot on a GitHub Pull Request. Your job is to critically evaluate each piece of feedback and determine what actions, if any, should be taken.

## Context

Current branch: !`git branch --show-current`
PR number and title: !`gh pr view --json number,title --jq '"#\(.number): \(.title)"' 2>/dev/null || echo "No PR found for current branch"`

## PR Comments from Claude

!`gh api repos/{owner}/{repo}/pulls/$(gh pr view --json number --jq '.number' 2>/dev/null)/comments --jq '[.[] | select(.user.login == "claude[bot]")] | if length == 0 then "No inline review comments from Claude found." else .[] | "### Comment on \(.path):\(.line // .original_line // "file-level")\n\n\(.body)\n\n---" end' 2>/dev/null || echo "Could not fetch PR review comments"`

!`gh api repos/{owner}/{repo}/issues/$(gh pr view --json number --jq '.number' 2>/dev/null)/comments --jq '[.[] | select(.user.login == "claude[bot]")] | if length == 0 then "No general PR comments from Claude found." else .[] | "### General Comment\n\n\(.body)\n\n---" end' 2>/dev/null || echo "Could not fetch PR issue comments"`

## Your Analysis Process

For each piece of feedback from Claude, you must think deeply and pragmatically:

### 1. Validity Assessment

- Is the claim technically accurate?
- Does it correctly understand the code context and intent?
- Are there any misunderstandings about the codebase patterns or conventions?

### 2. Actionability Assessment

- Is this feedback specific enough to act on?
- Does it point to a clear problem with a clear solution?
- Or is it vague/general advice that doesn't lead to concrete changes?

### 3. Value Assessment

- Does implementing this change provide meaningful benefit?
- Is it worth the time and effort to implement?
- Does it align with the project's priorities and coding standards?
- Could it introduce new problems or complexity?

### 4. Decision Framework

For each piece of feedback, categorize it as:

- **IMPLEMENT**: Valid, actionable, and worth doing. Explain what change to make.
- **ACKNOWLEDGE**: Valid observation but no action needed (e.g., noting intentional design decisions).
- **DEFER**: Potentially valid but not appropriate for this PR scope. Note for future consideration.
- **REJECT**: Invalid, not actionable, or not worth implementing. Explain why.

## Output Format

After analyzing all feedback, provide:

1. **Summary**: Brief overview of the feedback quality and key themes
2. **Analysis**: For each piece of feedback:
   - Quote the relevant feedback
   - Your assessment (validity, actionability, value)
   - Decision (IMPLEMENT/ACKNOWLEDGE/DEFER/REJECT) with reasoning
3. **Action Items**: Consolidated list of changes to implement (if any)

## Important Notes

- Be skeptical of AI feedback, including from Claude. AI reviewers can misunderstand context, miss nuances, or apply generic "best practices" that don't fit the specific situation.
- Don't implement changes just because they were suggested. Each change must earn its place.
- Consider the cognitive load of changes - sometimes "good enough" code that's simple is better than "perfect" code that's complex.
- If the feedback points out genuine bugs or security issues, prioritize those.
- Style suggestions and minor refactors should have a high bar for implementation.

</review-pr-feedback>
