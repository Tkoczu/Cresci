$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "======================================"
Write-Host "        CRESCI Publisher"
Write-Host "======================================"
Write-Host ""

if (-not (Test-Path ".\package.json")) {
    Write-Host "ERROR: package.json not found."
    exit 1
}

if (-not (Test-Path ".\scripts\install-proxmox.sh")) {
    Write-Host "ERROR: scripts\install-proxmox.sh not found."
    exit 1
}

$package = Get-Content ".\package.json" -Raw | ConvertFrom-Json
$currentVersion = $package.version

if ($currentVersion -notmatch '^(\d+)\.(\d+)\.(\d+)$') {
    Write-Host "ERROR: Invalid version in package.json: $currentVersion"
    exit 1
}

$major = [int]$Matches[1]
$minor = [int]$Matches[2]
$patch = [int]$Matches[3]

Write-Host "Current version: $currentVersion"
Write-Host ""
Write-Host "Choose release type:"
Write-Host "1. Patch  -> bugfix / small change"
Write-Host "2. Minor  -> new feature"
Write-Host "3. Major  -> breaking / major release"
Write-Host ""

$choice = Read-Host "Selection [1-3]"

switch ($choice) {
    "1" {
        $patch++
    }
    "2" {
        $minor++
        $patch = 0
    }
    "3" {
        $major++
        $minor = 0
        $patch = 0
    }
    default {
        Write-Host "Cancelled."
        exit 0
    }
}

$newVersion = "$major.$minor.$patch"
$newTag = "v$newVersion"

Write-Host ""
$description = Read-Host "Short description of changes"

if ([string]::IsNullOrWhiteSpace($description)) {
    Write-Host "ERROR: Description cannot be empty."
    exit 1
}

Write-Host ""
Write-Host "Release summary:"
Write-Host "  Current: $currentVersion"
Write-Host "  New:     $newVersion"
Write-Host "  Tag:     $newTag"
Write-Host "  Changes: $description"
Write-Host ""

$untracked = git ls-files --others --exclude-standard

if ($untracked) {
    Write-Host "WARNING: Untracked files detected:"
    Write-Host ""

    foreach ($file in $untracked) {
        Write-Host "  $file"
    }

    Write-Host ""
    Write-Host "These files will NOT be added automatically."
    Write-Host ""
}

$confirm = Read-Host "Publish $newTag? [y/N]"

if ($confirm -notmatch '^(y|Y|yes|YES)$') {
    Write-Host "Cancelled."
    exit 0
}

Write-Host ""
Write-Host "[1/8] Updating version..."

$package.version = $newVersion
$package |
    ConvertTo-Json -Depth 10 |
    Set-Content ".\package.json" -Encoding UTF8

$installer = Get-Content ".\scripts\install-proxmox.sh" -Raw

$installer = $installer -replace `
    'APP_VERSION="v\d+\.\d+\.\d+"', `
    "APP_VERSION=`"$newTag`""

Set-Content ".\scripts\install-proxmox.sh" $installer -Encoding UTF8

Write-Host "[2/8] Staging tracked changes..."

git add -u

git add ".\package.json"
git add ".\scripts\install-proxmox.sh"

Write-Host ""
Write-Host "Files to be committed:"
git status --short

Write-Host ""

$confirmFiles = Read-Host "Continue with these files? [y/N]"

if ($confirmFiles -notmatch '^(y|Y|yes|YES)$') {
    Write-Host "Cancelled before commit."
    exit 0
}

Write-Host ""
Write-Host "[3/8] Creating commit..."

git commit -m "CRESCI $newTag - $description"

Write-Host "[4/8] Pushing main..."

git push origin main

Write-Host "[5/8] Creating tag..."

git tag -a $newTag -m "CRESCI $newTag"

Write-Host "[6/8] Pushing tag..."

git push origin $newTag

Write-Host "[7/8] Creating GitHub Release..."

$gh = Get-Command gh -ErrorAction SilentlyContinue

if ($gh) {

    try {
        gh auth status | Out-Null

        gh release create $newTag `
            --repo "Tkoczu/Cresci" `
            --title "CRESCI $newTag" `
            --notes $description

        Write-Host "GitHub Release created."
    }
    catch {
        Write-Host ""
        Write-Host "GitHub CLI is installed, but release creation failed."
        Write-Host "Create the release manually for tag $newTag."
    }

}
else {

    Write-Host ""
    Write-Host "GitHub CLI (gh) is not installed."
    Write-Host "Commit, push and tag are already done."
    Write-Host "Create GitHub Release manually for:"
    Write-Host "  $newTag"
}

Write-Host ""
Write-Host "[8/8] Done."
Write-Host ""
Write-Host "======================================"
Write-Host "      CRESCI $newTag published"
Write-Host "======================================"
Write-Host ""
Write-Host "On the LXC run:"
Write-Host ""
Write-Host "  cresci update"
Write-Host ""