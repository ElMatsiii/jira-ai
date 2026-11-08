param(
    [string]$GithubUser = "",
    [switch]$PushRemote = $false,
    [switch]$UseGitDirect = $false,
    [string]$Visibility = "public"
)

# Detect gh CLI path
$ghCmd = "gh"
if (-not (Get-Command "gh" -ErrorAction SilentlyContinue)) {
    if (Test-Path "C:\Program Files\GitHub CLI\gh.exe") {
        $ghCmd = "C:\Program Files\GitHub CLI\gh.exe"
    } elseif (Test-Path "$env:LOCALAPPDATA\Programs\GitHub CLI\gh.exe") {
        $ghCmd = "$env:LOCALAPPDATA\Programs\GitHub CLI\gh.exe"
    }
}

# Auto-detect logged-in GitHub user if gh is available
$authedUser = $null
try {
    $authedUser = (& $ghCmd api user --jq .login 2>$null)
} catch {}

if (-not $GithubUser -and $authedUser) {
    $GithubUser = $authedUser
    Write-Host "Auto-detected authenticated GitHub user: $GithubUser" -ForegroundColor Cyan
} elseif ($GithubUser -and $authedUser -and ($GithubUser -ne $authedUser)) {
    # If user provided a username with an underscore or typo that doesn't match
    if ($GithubUser.Replace("_", "").ToLower() -eq $authedUser.ToLower()) {
        Write-Host "Note: Correcting username from '$GithubUser' to '$authedUser' (GitHub account authenticated)" -ForegroundColor Yellow
        $GithubUser = $authedUser
    }
}

$repos = @(
    "jira-contracts",
    "jira-issues-go",
    "jira-sprints-nestjs",
    "jira-analytics-dotnet",
    "jira-mcp-agent",
    "jira-bff",
    "jira-web"
)

$rootDir = "C:\jira-ai"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "         Jira AI: Multi-Repository Git Setup Utility        " -ForegroundColor Cyan
Write-Host "  Target Account : $GithubUser" -ForegroundColor Cyan
Write-Host "  Visibility     : $Visibility" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

foreach ($repo in $repos) {
    $repoPath = Join-Path $rootDir $repo
    if (Test-Path $repoPath) {
        Write-Host "`nProcessing $repo at $repoPath..." -ForegroundColor Yellow
        Set-Location $repoPath

        if (-not (Test-Path (Join-Path $repoPath ".git"))) {
            git init -b main
            Write-Host "  Git repository initialized on branch main" -ForegroundColor Green
        }

        # Check status and commit any unstaged changes
        $status = git status --porcelain
        if ($status) {
            git add .
            git commit -m "docs: finalize repository specification and README" -q
            Write-Host "  Local commit created for $repo" -ForegroundColor Green
        } else {
            Write-Host "  Working tree clean for $repo" -ForegroundColor DarkGray
        }

        if ($PushRemote -and $GithubUser) {
            if ($UseGitDirect) {
                Write-Host "  Pushing to https://github.com/$GithubUser/$repo.git..." -ForegroundColor Cyan
                git remote remove origin 2>$null
                git remote add origin "https://github.com/$GithubUser/$repo.git"
                git branch -M main
                git push -u origin main
            } else {
                Write-Host "  Publishing $repo to GitHub via gh CLI ($Visibility)..." -ForegroundColor Cyan
                # If remote origin exists, check or remove to let gh re-create cleanly
                git remote remove origin 2>$null
                & $ghCmd repo create "$GithubUser/$repo" "--$Visibility" --source=. --remote=origin --push
            }
        }
    }
}

Set-Location $rootDir
Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "  Completed processing for all 7 repositories!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
