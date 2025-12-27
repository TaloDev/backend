#!/bin/bash

if [ -n "$1" ]; then
  VERSION_TYPE=$1

  if [[ "$VERSION_TYPE" != "major" && "$VERSION_TYPE" != "minor" && "$VERSION_TYPE" != "patch" ]]; then
    echo "Error: version type must be major, minor, or patch"
    exit 1
  fi

  npm version "$VERSION_TYPE"
  git push
fi

VERSION=$(jq -r '.version' package.json)
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

gh pr create \
  --repo "$REPO" \
  --base main \
  --head develop \
  --title "Release $VERSION" \
  --label "release" \
  --body ""
