<#
.SYNOPSIS
    Clones or updates all 7 Jira AI microservice repositories.
.DESCRIPTION
    Helper script for team onboarding to sync all submodules and repositories.
#>

param(
    [string]$GithubUser = "ElMatsiii"
)

$ErrorActionPreference = "Stop"

$repos = @(
    "jira-contracts",
    "jira-issues-go",
    "jira-sprints-nestjs",
    "jira-analytics-dotnet",
    "jira-mcp-agent",
    "jira-bff",
    "jira-web"
)

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Jira AI Platform - Team Workspace Initializer" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

foreach ($repo in $repos) {
    $targetPath = Join-Path $PSScriptRoot $repo
    if (Test-Path (Join-Path $targetPath ".git")) {
        Write-Host "Updating $repo..." -ForegroundColor Yellow
        git -C $targetPath pull origin main
    } else {
        Write-Host "Cloning $repo from https://github.com/$GithubUser/$repo.git..." -ForegroundColor Green
        git clone "https://github.com/$GithubUser/$repo.git" $targetPath
    }
}

Write-Host "`nAll 7 repositories are ready in $PSScriptRoot" -ForegroundColor Green
Write-Host "Run 'docker compose up -d' to start the entire ecosystem." -ForegroundColor Cyan
