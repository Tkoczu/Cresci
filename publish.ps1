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

try {
    Write-Host ""
    Write-Host "======================================"
    Write-Host "        CRESCI Publisher"
    Write-Host "======================================"
    Write-Host ""

    if (-not (Test-Path ".\package.json")) {
        Fail "Nie znaleziono package.json. Uruchom skrypt z glownego katalogu CRESCI."
    }

    if (-not (Test-Path ".\.git")) {
        Fail "Ten katalog nie wyglada na repozytorium Git."
    }

    $packagePath = Resolve-Path ".\package.json"
    $originalPackageJson = Get-Content $packagePath -Raw

    $package = $originalPackageJson | ConvertFrom-Json
    $currentVersion = $package.version

    Write-Host "Aktualna wersja: $currentVersion"
    Write-Host ""

    $newVersion = Read-Host "Podaj nowa wersje, np. 1.0.3"

    if ($newVersion -notmatch '^\d+\.\d+\.\d+$') {
        Fail "Nieprawidlowa wersja. Uzyj formatu X.Y.Z, np. 1.0.3."
    }

    if ($newVersion -eq $currentVersion) {
        Fail "Nowa wersja jest taka sama jak aktualna: $currentVersion"
    }

    $newTag = "v$newVersion"

    $existingTag = git tag -l $newTag

    if ($LASTEXITCODE -ne 0) {
        Fail "Nie udalo sie sprawdzic tagow Git."
    }

    if ($existingTag) {
        Fail "Tag $newTag juz istnieje."
    }

    Write-Host ""
    Write-Host "======================================"
    Write-Host "           OPIS ZMIAN"
    Write-Host "======================================"
    Write-Host ""
    Write-Host "Wpisuj po jednej zmianie w linii."
    Write-Host "Nie wpisuj numerow 1., 2., 3. - skrypt sam zrobi liste."
    Write-Host "Pusta linia konczy wpisywanie."
    Write-Host ""

    $descriptionLines = @()

    while ($true) {
        $line = Read-Host

        if ([string]::IsNullOrWhiteSpace($line)) {
            break
        }

        $descriptionLines += $line.Trim()
    }

    if ($descriptionLines.Count -eq 0) {
        Fail "Opis zmian nie moze byc pusty."
    }

    $description = ($descriptionLines | ForEach-Object { "- $_" }) -join "`n"

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
        Write-Host "Anulowano."
        Pause-OnExit
        exit 0
    }

    Write-Host ""
    Write-Host "[1/9] Aktualizacja package.json..."

    $package.version = $newVersion

    $json = $package | ConvertTo-Json -Depth 20

    [System.IO.File]::WriteAllText(
        $packagePath,
        $json,
        (New-Object System.Text.UTF8Encoding($false))
    )

    Write-Host "[2/9] Uruchamianie testow..."

    npm test

    if ($LASTEXITCODE -ne 0) {
        [System.IO.File]::WriteAllText(
            $packagePath,
            $originalPackageJson,
            (New-Object System.Text.UTF8Encoding($false))
        )

        Fail "Testy nie przeszly. package.json zostal przywrocony do wersji $currentVersion."
    }

    Write-Host "[3/9] Dodawanie zmian do Git..."

    git add -A

    if ($LASTEXITCODE -ne 0) {
        [System.IO.File]::WriteAllText(
            $packagePath,
            $originalPackageJson,
            (New-Object System.Text.UTF8Encoding($false))
        )

        Fail "git add nie powiodl sie. package.json zostal przywrocony do wersji $currentVersion."
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
        Fail "Nie udalo sie odczytac staged files."
    }

    if (-not $stagedFiles) {
        [System.IO.File]::WriteAllText(
            $packagePath,
            $originalPackageJson,
            (New-Object System.Text.UTF8Encoding($false))
        )

        Fail "Brak zmian do opublikowania. package.json zostal przywrocony."
    }

    $confirmFiles = Read-Host "Kontynuowac z tymi plikami? [y/N]"

    if ($confirmFiles -notmatch '^(y|Y|yes|YES)$') {
        git reset

        [System.IO.File]::WriteAllText(
            $packagePath,
            $originalPackageJson,
            (New-Object System.Text.UTF8Encoding($false))
        )

        Fail "Publikacja anulowana. Staging i package.json zostaly przywrocone."
    }

    Write-Host ""
    Write-Host "[4/9] Tworzenie commita..."

    git commit -m "CRESCI $newTag - release"

    if ($LASTEXITCODE -ne 0) {
        Fail "Nie udalo sie utworzyc commita."
    }

    Write-Host "[5/9] Push main..."

    git push origin main

    if ($LASTEXITCODE -ne 0) {
        Fail "Push main nie powiodl sie."
    }

    Write-Host "[6/9] Tworzenie taga..."

    git tag -a $newTag -m "CRESCI $newTag"

    if ($LASTEXITCODE -ne 0) {
        Fail "Nie udalo sie utworzyc taga."
    }

    Write-Host "[7/9] Push taga..."

    git push origin $newTag

    if ($LASTEXITCODE -ne 0) {
        Fail "Push taga nie powiodl sie."
    }

    Write-Host "[8/9] Tworzenie GitHub Release..."

    $gh = Get-Command gh -ErrorAction SilentlyContinue

    if (-not $gh) {
        Fail @"
GitHub CLI 'gh' nie jest zainstalowane.

Commit, push i tag sa juz gotowe, ale GitHub Release nie zostal utworzony.

Zainstaluj GitHub CLI i wykonaj:

gh auth login

Potem:

gh release create $newTag --repo Tkoczu/Cresci --title "CRESCI $newTag"
"@
    }

    gh auth status | Out-Null

    if ($LASTEXITCODE -ne 0) {
        Fail "GitHub CLI nie jest zalogowane. Uruchom: gh auth login"
    }

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
    }
    finally {
        Remove-Item $notesFile -ErrorAction SilentlyContinue
    }

    if ($LASTEXITCODE -ne 0) {
        Fail "Nie udalo sie utworzyc GitHub Release."
    }

    Write-Host "[9/9] Weryfikacja GitHub Release..."

    $releaseTag = gh release view $newTag `
        --repo "Tkoczu/Cresci" `
        --json tagName `
        --jq '.tagName'

    if ($LASTEXITCODE -ne 0 -or $releaseTag -ne $newTag) {
        Fail "Release nie zostal poprawnie zweryfikowany."
    }

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
    Write-Host ""
    Write-Host "======================================"
    Write-Host "               BLAD"
    Write-Host "======================================"
    Write-Host ""
    Write-Host $_.Exception.Message
    Write-Host ""
}

Pause-OnExit