$ErrorActionPreference = "Stop"

function Pause-OnExit {
    Write-Host ""
    Read-Host "Nacisnij Enter, aby zamknac"
}

function Fail {
    param(
        [string]$Message
    )

    throw $Message
}

$packageChanged = $false
$commitCreated = $false
$originalPackageJson = $null
$packagePath = $null

try {
    Write-Host ""
    Write-Host "======================================"
    Write-Host "        CRESCI Publisher"
    Write-Host "======================================"
    Write-Host ""

    # ---------------------------------------
    # Kontrola projektu
    # ---------------------------------------

    if (-not (Test-Path ".\package.json")) {
        Fail "Nie znaleziono package.json. Uruchom skrypt z glownego katalogu CRESCI."
    }

    if (-not (Test-Path ".\.git")) {
        Fail "Ten katalog nie wyglada na repozytorium Git."
    }

    # ---------------------------------------
    # Kontrola GitHub CLI PRZED publikacja
    # ---------------------------------------

    Write-Host "Sprawdzanie GitHub CLI..."

    $gh = Get-Command gh -ErrorAction SilentlyContinue

    if (-not $gh) {
        Fail @"
GitHub CLI 'gh' nie jest zainstalowane.

Zainstaluj je poleceniem:

winget install --id GitHub.cli

Potem uruchom:

gh auth login
"@
    }

    gh auth status | Out-Null

    if ($LASTEXITCODE -ne 0) {
        Fail "GitHub CLI nie jest zalogowane. Uruchom: gh auth login"
    }

    Write-Host "GitHub CLI: OK"
    Write-Host ""

    # ---------------------------------------
    # Aktualna wersja
    # ---------------------------------------

    $packagePath = (Resolve-Path ".\package.json").Path
    $originalPackageJson = Get-Content $packagePath -Raw

    $package = $originalPackageJson | ConvertFrom-Json
    $currentVersion = $package.version

    Write-Host "Aktualna wersja: $currentVersion"
    Write-Host ""

    # ---------------------------------------
    # Nowa wersja
    # ---------------------------------------

    $newVersion = Read-Host "Podaj nowa wersje, np. 1.0.4"

    if ($newVersion -notmatch '^\d+\.\d+\.\d+$') {
        Fail "Nieprawidlowa wersja. Uzyj formatu X.Y.Z, np. 1.0.4."
    }

    if ($newVersion -eq $currentVersion) {
        Fail "Nowa wersja jest taka sama jak aktualna: $currentVersion"
    }

    $newTag = "v$newVersion"

    $existingLocalTag = git tag -l $newTag

    if ($LASTEXITCODE -ne 0) {
        Fail "Nie udalo sie sprawdzic lokalnych tagow Git."
    }

    if ($existingLocalTag) {
        Fail "Tag $newTag juz istnieje lokalnie."
    }

    $existingRemoteTag = git ls-remote --tags origin "refs/tags/$newTag"

    if ($LASTEXITCODE -ne 0) {
        Fail "Nie udalo sie sprawdzic tagow na GitHubie."
    }

    if ($existingRemoteTag) {
        Fail "Tag $newTag juz istnieje na GitHubie."
    }

    # ---------------------------------------
    # Changelog
    # ---------------------------------------

    Write-Host ""
    Write-Host "======================================"
    Write-Host "           OPIS ZMIAN"
    Write-Host "======================================"
    Write-Host ""
    Write-Host "Wpisz lub wklej liste zmian."
    Write-Host "Kazda zmiana powinna byc w osobnej linii."
    Write-Host "Nie wpisuj numerow ani myslnikow."
    Write-Host "Pusta linia konczy wpisywanie."
    Write-Host ""

    $descriptionLines = @()

    while ($true) {
        $line = [Console]::ReadLine()

        if ($null -eq $line -or [string]::IsNullOrWhiteSpace($line)) {
            break
        }

        $descriptionLines += $line.Trim()
    }

    if ($descriptionLines.Count -eq 0) {
        Fail "Opis zmian nie moze byc pusty."
    }

    $description = (
        $descriptionLines |
        ForEach-Object { "- $_" }
    ) -join "`n"

    # ---------------------------------------
    # Podsumowanie
    # ---------------------------------------

    Write-Host ""
    Write-Host "======================================"
    Write-Host "       PODSUMOWANIE RELEASE"
    Write-Host "======================================"
    Write-Host ""
    Write-Host "Aktualna wersja: $currentVersion"
    Write-Host "Nowa wersja:     $newVersion"
    Write-Host "Tag:              $newTag"
    Write-Host ""
    Write-Host "Zmiany:"
    Write-Host ""

    foreach ($line in $descriptionLines) {
        Write-Host "  - $line"
    }

    Write-Host ""

    $confirm = Read-Host "Publikowac $newTag? [y/N]"

    if ($confirm -notmatch '^(y|Y|yes|YES)$') {
        Write-Host ""
        Write-Host "Anulowano."
        Pause-OnExit
        exit 0
    }

    # ---------------------------------------
    # package.json
    # ---------------------------------------

    Write-Host ""
    Write-Host "[1/9] Aktualizacja package.json..."

    $package.version = $newVersion

    $json = $package | ConvertTo-Json -Depth 20

    [System.IO.File]::WriteAllText(
        $packagePath,
        $json,
        (New-Object System.Text.UTF8Encoding($false))
    )

    $packageChanged = $true

    # ---------------------------------------
    # Testy
    # ---------------------------------------

    Write-Host "[2/9] Uruchamianie testow..."

    npm test

    if ($LASTEXITCODE -ne 0) {
        Fail "Testy nie przeszly."
    }

    # ---------------------------------------
    # Git add
    # ---------------------------------------

    Write-Host "[3/9] Dodawanie zmian do Git..."

    git add -A

    if ($LASTEXITCODE -ne 0) {
        Fail "git add nie powiodl sie."
    }

    Write-Host ""
    Write-Host "======================================"
    Write-Host "      BEDZIE OPUBLIKOWANE"
    Write-Host "======================================"
    Write-Host ""

    git status --short

    if ($LASTEXITCODE -ne 0) {
        Fail "Nie udalo sie odczytac statusu Git."
    }

    Write-Host ""

    $stagedFiles = git diff --cached --name-only

    if ($LASTEXITCODE -ne 0) {
        Fail "Nie udalo sie odczytac plikow przygotowanych do publikacji."
    }

    if (-not $stagedFiles) {
        Fail "Brak zmian do opublikowania."
    }

    $confirmFiles = Read-Host "Kontynuowac z tymi plikami? [y/N]"

    if ($confirmFiles -notmatch '^(y|Y|yes|YES)$') {
        git reset | Out-Null
        Fail "Publikacja anulowana przed commitem."
    }

    # ---------------------------------------
    # Commit
    # ---------------------------------------

    Write-Host ""
    Write-Host "[4/9] Tworzenie commita..."

    git commit -m "CRESCI $newTag - release"

    if ($LASTEXITCODE -ne 0) {
        Fail "Nie udalo sie utworzyc commita."
    }

    $commitCreated = $true

    # ---------------------------------------
    # Push main
    # ---------------------------------------

    Write-Host "[5/9] Push main..."

    git push origin main

    if ($LASTEXITCODE -ne 0) {
        Fail "Push main nie powiodl sie."
    }

    # ---------------------------------------
    # Tag
    # ---------------------------------------

    Write-Host "[6/9] Tworzenie taga..."

    git tag -a $newTag -m "CRESCI $newTag"

    if ($LASTEXITCODE -ne 0) {
        Fail "Nie udalo sie utworzyc taga."
    }

    # ---------------------------------------
    # Push tag
    # ---------------------------------------

    Write-Host "[7/9] Push taga..."

    git push origin $newTag

    if ($LASTEXITCODE -ne 0) {
        Fail "Push taga nie powiodl sie."
    }

    # ---------------------------------------
    # GitHub Release
    # ---------------------------------------

    Write-Host "[8/9] Tworzenie GitHub Release..."

    $notesFile = [System.IO.Path]::GetTempFileName()

    [System.IO.File]::WriteAllText(
        $notesFile,
        $description,
        (New-Object System.Text.UTF8Encoding($false))
    )

    try {
        gh release create $newTag `
            --repo "Tkoczu/Cresci" `
            --title "CRESCI $newTag" `
            --notes-file $notesFile

        if ($LASTEXITCODE -ne 0) {
            Fail "Nie udalo sie utworzyc GitHub Release."
        }
    }
    finally {
        Remove-Item $notesFile -Force -ErrorAction SilentlyContinue
    }

    # ---------------------------------------
    # Weryfikacja
    # ---------------------------------------

    Write-Host "[9/9] Weryfikacja GitHub Release..."

    $releaseTag = gh release view $newTag `
        --repo "Tkoczu/Cresci" `
        --json tagName `
        --jq '.tagName'

    if ($LASTEXITCODE -ne 0) {
        Fail "Nie udalo sie zweryfikowac GitHub Release."
    }

    if ($releaseTag.Trim() -ne $newTag) {
        Fail "GitHub Release nie zostal poprawnie zweryfikowany."
    }

    # ---------------------------------------
    # Sukces
    # ---------------------------------------

    Write-Host ""
    Write-Host "======================================"
    Write-Host "      CRESCI $newTag OPUBLIKOWANE"
    Write-Host "======================================"
    Write-Host ""
    Write-Host "package.json:   $newVersion"
    Write-Host "Testy:          OK"
    Write-Host "Commit:         OK"
    Write-Host "Push main:      OK"
    Write-Host "Tag:            $newTag"
    Write-Host "GitHub Release: OK"
    Write-Host ""
    Write-Host "Changelog:"
    Write-Host ""

    foreach ($line in $descriptionLines) {
        Write-Host "  - $line"
    }

    Write-Host ""
    Write-Host "Istniejace instalacje:"
    Write-Host "  Ustawienia -> Sprawdz aktualizacje"
    Write-Host ""
    Write-Host "Nowa instalacja Proxmox:"
    Write-Host ""
    Write-Host '  bash -c "$(curl -fsSL https://raw.githubusercontent.com/Tkoczu/Cresci/main/scripts/install-proxmox.sh)"'
    Write-Host ""
}
catch {

    # ---------------------------------------
    # Automatyczne cofniecie package.json,
    # ale tylko zanim powstanie commit.
    # ---------------------------------------

    if (
        $packageChanged -and
        -not $commitCreated -and
        $null -ne $originalPackageJson -and
        $null -ne $packagePath
    ) {
        try {
            git reset | Out-Null

            [System.IO.File]::WriteAllText(
                $packagePath,
                $originalPackageJson,
                (New-Object System.Text.UTF8Encoding($false))
            )

            Write-Host ""
            Write-Host "package.json zostal przywrocony do poprzedniej wersji."
        }
        catch {
            Write-Host ""
            Write-Host "UWAGA: Nie udalo sie automatycznie przywrocic package.json."
        }
    }

    Write-Host ""
    Write-Host "======================================"
    Write-Host "               BLAD"
    Write-Host "======================================"
    Write-Host ""
    Write-Host $_.Exception.Message
    Write-Host ""
}

Pause-OnExit