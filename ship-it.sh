#!/bin/bash

VERSION=$(jq -r '.version' package.json)
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

gh pr create \
  --repo "$REPO" \
  --base main \
  --head develop \
  --title "Release $VERSION" \
  --label "release" \
  --body ""
