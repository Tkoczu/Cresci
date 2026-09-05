
# 🟠 CRESCI
![CRESCI](cresci-banner.png)

### Grow. Progress. Repeat.

**Self-hosted gym progress tracker with optional gamification.**

🇵🇱 [Polski](#-polski) • 🇬🇧 [English](#-english)

> 🚧 CRESCI jest obecnie aktywnie rozwijane.  
> 🚧 CRESCI is currently under active development.

---

# 🇵🇱 Polski

## 🟠 Czym jest CRESCI?

**CRESCI** to self-hosted aplikacja do śledzenia progresu na siłowni.

Pozwala zapisywać treningi, obserwować progres, śledzić rekordy i — opcjonalnie — zamienić trening w grę dzięki modułowi **CRESCI GAME**.

Twoje dane znajdują się na **Twoim serwerze**.

---

## 🚀 Szybka instalacja — Proxmox VE

CRESCI możesz zainstalować jedną komendą.

Uruchom ją w konsoli **hosta Proxmox VE jako root**:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/Tkoczu/Cresci/main/scripts/install-proxmox.sh)"
```

I tyle. ☕️

Instalator automatycznie:

- tworzy nowy kontener LXC
- instaluje Debian 13
- instaluje Node.js 22
- pobiera najnowsze stabilne wydanie CRESCI
- konfiguruje usługę systemową
- konfiguruje system aktualizacji
- uruchamia CRESCI
- wyświetla adres nowej instancji

**Docker nie jest wymagany.**

---

## 📋 Wymagania

Aktualnie wspierane środowisko:

- Proxmox VE
- host x86_64 / amd64
- dostęp do internetu
- mostek sieciowy `vmbr0`
- storage obsługujący kontenery LXC
- dostęp `root` do hosta Proxmox

Instalator automatycznie wybiera wolny numer CT oraz pobiera wymagany template Debiana.

---

## 🏋️ CRESCI CORE

CRESCI CORE odpowiada za podstawowe funkcje związane z treningiem i progresem.

### Progres treningowy

CRESCI umożliwia między innymi:

- tworzenie własnych ćwiczeń
- zapisywanie ciężaru i powtórzeń
- przechowywanie historii treningów
- śledzenie rekordów
- przeglądanie wykresów progresu
- personalizację dashboardu

---

## 👥 Profile

CRESCI obsługuje oddzielne profile użytkowników.

Każdy profil posiada własne:

- ćwiczenia
- wyniki
- rekordy
- historię
- progres
- dane CRESCI GAME

System profili będzie dalej rozwijany wraz z systemem logowania i kont użytkowników.

---

## 🎮 CRESCI GAME

**CRESCI GAME jest całkowicie opcjonalne.**

Jeżeli chcesz korzystać wyłącznie z klasycznego trackera treningowego, możesz pozostawić grywalizację wyłączoną.

Po jej aktywowaniu CRESCI otrzymuje dodatkową warstwę inspirowaną grami RPG.

### ⭐ XP i poziomy

Trenuj, zdobywaj XP i rozwijaj swój poziom.

### 🪙 Waluta PR

Zdobywaj **PR** między innymi za:

- treningi
- pobijanie rekordów
- zdobywanie osiągnięć
- wykonywanie specjalnych wyzwań

PR może być wykorzystywane do zdobywania przedmiotów kosmetycznych.

### 🧍 Avatar

Stwórz własną postać w stylu pixel-art.

System avatara obsługuje między innymi:

- ciało
- kolor skóry
- oczy
- fryzurę
- kolor włosów
- koszulki
- spodnie
- buty
- nakrycia głowy
- akcesoria

---

## 🏆 Osiągnięcia

CRESCI posiada system osiągnięć związanych z treningiem i korzystaniem z aplikacji.

Przykładowe wyzwania:

- pierwszy trening
- 10 treningów
- 50 treningów
- 100 treningów
- pierwszy rekord
- seria rekordów
- serie regularnych treningów
- odkrywanie nowych funkcji
- trening późnym wieczorem
- trening wcześnie rano
- powrót po dłuższej przerwie
- gromadzenie PR

Niektóre osiągnięcia mogą być **ukryte aż do momentu ich zdobycia**.

---

## 💾 Twoje dane należą do Ciebie

CRESCI jest projektowane jako aplikacja **self-hosted**.

Baza danych znajduje się na Twoim własnym serwerze.

CRESCI wykorzystuje **SQLite** do przechowywania danych aplikacji.

Dostępne są lokalne backupy, a integracja backupu z Google Drive jest częścią rozwijanego systemu kopii zapasowych.

---

## 🔄 Aktualizacje

CRESCI posiada własny system aktualizacji.

Kiedy pojawi się nowa stabilna wersja, przejdź do:

**Ustawienia → System → Sprawdź aktualizacje**

CRESCI może automatycznie:

1. sprawdzić najnowszy GitHub Release
2. wyświetlić dostępną wersję
3. pokazać listę zmian
4. poprosić o zgodę na instalację
5. utworzyć backup
6. pobrać nowe wydanie
7. zainstalować aktualizację
8. ponownie uruchomić CRESCI
9. sprawdzić poprawność działania

Po restarcie przeglądarka automatycznie ponownie łączy się z CRESCI i odświeża aplikację.

### Model wydań

Nowe instalacje pobierają najnowszy stabilny **GitHub Release**.

Zmiany znajdujące się aktualnie na gałęzi `main` nie są automatycznie instalowane jako aktualizacje aplikacji.

Dzięki temu wersja produkcyjna pozostaje oddzielona od trwających prac developerskich.

---

## 🛠️ CRESCI CLI

Wewnątrz kontenera LXC dostępne są polecenia administracyjne.

Status:

```bash
cresci status
```

Wersja:

```bash
cresci version
```

Restart:

```bash
cresci restart
```

Logi:

```bash
cresci logs
```

Backup:

```bash
cresci backup
```

---

## 🧑‍💻 Uruchomienie lokalne

Sklonuj repozytorium:

```bash
git clone https://github.com/Tkoczu/Cresci.git
cd Cresci
```

Uruchom aplikację:

```bash
npm install
npm start
```

Następnie otwórz:

```text
http://localhost:4173
```

### Wymagania developerskie

```text
Node.js >= 22.5
```

Testy:

```bash
npm test
```

---

## 📦 Wydania

Stabilne wersje CRESCI publikowane są jako **GitHub Releases**.

Instalator Proxmox automatycznie wykrywa najnowsze stabilne wydanie.

https://github.com/Tkoczu/Cresci/releases

---

## ⚠️ Status projektu

CRESCI znajduje się obecnie na **wczesnym etapie rozwoju**.

Podstawowe funkcje oraz instalator Proxmox działają, ale podczas dalszego rozwoju aplikacji mogą pojawiać się zmiany.

Przed ważnymi aktualizacjami zalecane jest posiadanie aktualnej kopii zapasowej danych.

---

## 🐛 Znalazłeś błąd?

Utwórz nowe zgłoszenie:

https://github.com/Tkoczu/Cresci/issues

Warto podać:

- wersję CRESCI
- wersję Proxmox VE
- opis problemu
- komunikat błędu lub logi
- kroki pozwalające odtworzyć problem

---

## ❤️ Nazwa CRESCI

Nazwa **CRESCI** pochodzi od włoskiego słowa oznaczającego:

**„rośnij” / „rozwijaj się”.**

Idea jest prosta:

### Trenuj. Śledź progres. Rozwijaj się.

---

# 🇬🇧 English

## 🟠 What is CRESCI?

**CRESCI** is a self-hosted gym progress tracker.

It allows you to track your workouts, monitor progress, beat personal records and — optionally — turn your training into a game with **CRESCI GAME**.

Your data stays on **your server**.

---

## 🚀 Quick Install — Proxmox VE

Install CRESCI with a single command.

Run it in the **Proxmox VE host shell as root**:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/Tkoczu/Cresci/main/scripts/install-proxmox.sh)"
```

That's it. ☕️

The installer automatically:

- creates a new LXC container
- installs Debian 13
- installs Node.js 22
- downloads the latest stable CRESCI release
- configures the system service
- configures the update system
- starts CRESCI
- displays the address of your new instance

**Docker is not required.**

---

## 📋 Requirements

Currently supported:

- Proxmox VE
- x86_64 / amd64 host
- internet access
- `vmbr0` network bridge
- LXC-compatible storage
- root access to the Proxmox host

The installer automatically selects an available CT ID and downloads the required Debian template.

---

## 🏋️ CRESCI CORE

CRESCI CORE provides the main workout and progress tracking functionality.

### Training progress

CRESCI allows you to:

- create custom exercises
- record weight and repetitions
- keep workout history
- track personal records
- view progress charts
- customize your dashboard

---

## 👥 Profiles

CRESCI supports separate user profiles.

Each profile has its own:

- exercises
- results
- records
- history
- progression
- CRESCI GAME data

The profile system will continue to evolve together with a complete authentication and user account system.

---

## 🎮 CRESCI GAME

**CRESCI GAME is completely optional.**

If you only want a clean workout tracker, gamification can remain disabled.

When enabled, CRESCI gains an additional RPG-inspired layer.

### ⭐ XP & Levels

Train, earn XP and increase your level.

### 🪙 PR Currency

Earn **PR** for activities such as:

- completing workouts
- beating personal records
- unlocking achievements
- completing special challenges

PR can be used to obtain cosmetic items.

### 🧍 Avatar

Create your own pixel-art character.

The avatar system supports:

- body
- skin tone
- eyes
- hairstyle
- hair color
- tops
- bottoms
- shoes
- headwear
- accessories

---

## 🏆 Achievements

CRESCI includes an achievement system connected to training and application usage.

Example challenges include:

- first workout
- 10 workouts
- 50 workouts
- 100 workouts
- first personal record
- record streaks
- regular training streaks
- exploring CRESCI features
- late-night workouts
- early-morning workouts
- returning after a long break
- collecting PR

Some achievements may remain **hidden until unlocked**.

---

## 💾 Your data stays yours

CRESCI is designed as a **self-hosted application**.

The database stays on your own server.

CRESCI uses **SQLite** for application data.

Local backups are supported, and Google Drive integration is part of the developing backup system.

---

## 🔄 Updates

CRESCI includes its own update system.

When a new stable version becomes available, go to:

**Settings → System → Check for updates**

CRESCI can automatically:

1. check the latest GitHub Release
2. display the available version
3. show the changelog
4. ask for installation confirmation
5. create a backup
6. download the new release
7. install the update
8. restart CRESCI
9. verify that the application is running

After the restart, the browser automatically reconnects and refreshes CRESCI.

### Release model

New installations download the latest stable **GitHub Release**.

Development changes currently present on `main` are not automatically installed as application updates.

This keeps production installations separated from ongoing development.

---

## 🛠️ CRESCI CLI

Administrative commands are available inside the LXC container.

Status:

```bash
cresci status
```

Version:

```bash
cresci version
```

Restart:

```bash
cresci restart
```

Logs:

```bash
cresci logs
```

Backup:

```bash
cresci backup
```

---

## 🧑‍💻 Local development

Clone the repository:

```bash
git clone https://github.com/Tkoczu/Cresci.git
cd Cresci
```

Start CRESCI:

```bash
npm install
npm start
```

Then open:

```text
http://localhost:4173
```

### Development requirements

```text
Node.js >= 22.5
```

Run tests:

```bash
npm test
```

---

## 📦 Releases

Stable CRESCI versions are published using **GitHub Releases**.

The Proxmox installer automatically detects the latest stable release.

https://github.com/Tkoczu/Cresci/releases

---

## ⚠️ Project status

CRESCI is currently an **early-stage project under active development**.

The core functionality and Proxmox installer are working, but changes should be expected as development continues.

Keeping an up-to-date backup is recommended before important updates.

---

## 🐛 Found a bug?

Open an issue:

https://github.com/Tkoczu/Cresci/issues

Please include:

- CRESCI version
- Proxmox VE version
- description of the problem
- error message or logs
- steps required to reproduce the problem

---

## ❤️ The name CRESCI

**CRESCI** comes from the Italian word meaning:

**“grow”.**

The idea is simple:

### Train. Track your progress. Keep growing.

---

## 🟠 CRESCI

**Grow. Progress. Repeat.**
