#!/usr/bin/env bash
# Clones or updates all 7 Jira AI microservice repositories for team onboarding.
set -euo pipefail

GITHUB_USER="${1:-ElMatsiii}"
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

REPOS=(
  "jira-contracts"
  "jira-issues-go"
  "jira-sprints-nestjs"
  "jira-analytics-dotnet"
  "jira-mcp-agent"
  "jira-bff"
  "jira-web"
)

echo "============================================================"
echo "  Jira AI Platform - Team Workspace Initializer (Bash)"
echo "============================================================"

for repo in "${REPOS[@]}"; do
  target_path="$BASE_DIR/$repo"
  if [ -d "$target_path/.git" ]; then
    echo "Updating $repo..."
    git -C "$target_path" pull origin main
  else
    echo "Cloning $repo from https://github.com/$GITHUB_USER/$repo.git..."
    git clone "https://github.com/$GITHUB_USER/$repo.git" "$target_path"
  fi
done

echo ""
echo "All 7 repositories are ready in $BASE_DIR"
echo "Run 'docker compose up -d' to start the entire ecosystem."
