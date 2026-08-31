# CRESCI — self-hosted gym progress tracker

Działający prototyp aplikacji webowej do prowadzenia progresu treningowego dla wielu użytkowników (z zachowaniem profili **Marek** i **Domii**). Dane są przechowywane lokalnie w SQLite; aplikacja nie wysyła ich do internetu poza świadomie włączonym backupem Google Drive i katalogiem ćwiczeń.

## Funkcje MVP

- dashboard porównawczy — ciężary Marka i Domii widoczne równolegle na każdym kafelku,
- ćwiczenia użytkownika oraz dodawanie własnych lub pobieranie pozycji z katalogu wger,
- trzy sposoby opisu obciążenia: bezpośredni ciężar, sztanga/krążki, maszyna/stopnie,
- automatyczne wyliczanie starego ciężaru, przyrostu i typu zmiany,
- wspólna historia obu osób z opcjonalnym filtrem osoby i ćwiczenia,
- szczegóły wpisu po kliknięciu w historię oraz bezpieczna edycja i usuwanie z automatycznym przeliczeniem dalszego progresu,
- porównawczy wykres dla Marka i Domii oraz znormalizowany indeks całego planu,
- opcjonalny **CRESCI Score 0–100** liczony osobno dla każdego profilu z porównaniem dwóch okresów po 30 dni,
- opcjonalny **CRESCI GAME** per użytkownik: konfigurowalny avatar, codzienny meldunek, XP, poziomy, saldo PR i achievementy,
- jasny i ciemny motyw zapamiętywany na urządzeniu,
- pełny eksport i import danych w JSON,
- ręczne i automatyczne kopie lokalne, na Google Drive albo w obu miejscach,
- responsywny interfejs na telefon i komputer.

## Uruchomienie

Wymagany jest **Node.js 22.5 lub nowszy** (SQLite jest częścią Node, więc nie trzeba instalować pakietów).

Przy pierwszym uruchomieniu aplikacja prosi o utworzenie pierwszego użytkownika. Hasło jest opcjonalne. Kolejne konta można dodać na ekranie wyboru użytkownika albo w **Ustawienia → Ogólne → Konta użytkowników**, a przycisk **Wyloguj** wraca do wyboru konta. Profile istniejącej instalacji są zachowywane i po migracji można je wybrać bez hasła. Po zalogowaniu dashboard, historia, wykresy, Score i CRESCI GAME pokazują wyłącznie dane bieżącego `user_id`; backend odrzuca również próby zapisu lub edycji danych innego konta.

```bash
npm start
```

Otwórz `http://localhost:4173`. Przy pierwszym starcie baza i przykładowe ćwiczenia utworzą się automatycznie w `data/gym-progress.sqlite`.

Opcjonalne zmienne środowiskowe:

```text
PORT=4173
HOST=0.0.0.0
DATABASE_PATH=./data/gym-progress.sqlite
NODE_ENV=development
CRESCI_UPDATE_ENABLED=0
GOOGLE_CLIENT_ID=identyfikator-klienta-oauth
GOOGLE_CLIENT_SECRET=sekret-klienta-oauth
GOOGLE_REDIRECT_URI=http://localhost:4173/api/google-drive/callback
```

Najprościej skopiować `.env.example` jako `.env` i uzupełnić wartości. Aplikacja wczytuje ten plik automatycznie, a `.env` jest wykluczony z Git.

Testy uruchomisz przez `npm test`. Endpoint kontrolny: `GET /api/health`.

## Backup i migracja danych

Najwygodniej użyć w aplikacji zakładki **Ustawienia → Dane i backup → Eksportuj dane**. Powstaje jeden plik JSON zawierający konta (z hasłami wyłącznie w postaci hashy), ćwiczenia, historię, Score, GAME, PR, osiągnięcia i inventory wszystkich użytkowników. Aktywne sesje logowania nigdy nie trafiają do kopii. Import takiego pliku odtwarza komplet danych i zastępuje bieżącą zawartość.

Fizycznie CRESCI nadal używa jednej bazy `data/gym-progress.sqlite`. Jest to właściwy model także dla rozbudowanej aplikacji: relacje przez `user_id` zapewniają separację danych, a backup pozostaje atomowy i prosty do przywrócenia. Przy ręcznym kopiowaniu działającej bazy należy uwzględnić tryb SQLite WAL; dlatego zalecany jest eksport/backup z aplikacji albo zatrzymanie usługi przed skopiowaniem samego pliku `.sqlite`.

Można również zatrzymać aplikację i skopiować plik `data/gym-progress.sqlite`. Jeśli serwer działa, preferowany jest eksport JSON. Schemat ma własny numer wersji (`schema_meta`) i jest przygotowany pod kolejne migracje.

## Późniejsze wdrożenie do LXC

1. Utwórz kontener Debian/Ubuntu i zainstaluj Node.js LTS 22+.
2. Skopiuj katalog aplikacji np. do `/opt/gym-progress`.
3. Utwórz osobnego użytkownika systemowego i nadaj mu prawa zapisu tylko do katalogu `data`.
4. Uruchamiaj `node server.js` jako usługę systemd z `NODE_ENV=production`, `HOST=127.0.0.1` i wybranym portem.
5. Wystaw aplikację przez Caddy lub Nginx z HTTPS. W sieci domowej można ograniczyć dostęp firewallem/VPN-em.
6. Katalog `data` obejmij regularnym snapshotem Proxmox oraz niezależnym eksportem JSON.

Przed wystawieniem poza zaufaną sieć należy dodać logowanie. MVP celowo go nie zawiera, bo jest przeznaczone do lokalnego/self-hosted użycia.

## Konfiguracja Google Drive

Integracja używa OAuth 2.0 i ograniczonego zakresu `drive.file`. CRESCI może tworzyć i obsługiwać wyłącznie własny folder **CRESCI Backups** oraz utworzone w nim kopie — nie otrzymuje dostępu do pozostałych plików na Dysku.

W aplikacji przejdź do **Ustawienia → Dane i backup → Konfiguruj krok po kroku**. Trzyetapowy kreator otwiera właściwe strony Google Cloud, pokazuje dokładny adres przekierowania oraz przyjmuje `GOOGLE_CLIENT_ID` i `GOOGLE_CLIENT_SECRET`. Po zatwierdzeniu aktualizuje lokalny `.env`, przeładowuje konfigurację bez restartu i od razu rozpoczyna logowanie Google.

Kreator prowadzi przez wymagane czynności: utworzenie lub wybór projektu, włączenie **Google Drive API**, konfigurację ekranu zgody, dodanie konta jako użytkownika testowego i utworzenie klienta typu **Web application**. Przy wdrożeniu LXC adres `localhost` należy zastąpić publicznym adresem HTTPS instalacji.

W trybie publikacji OAuth **Testing** token do automatycznych kopii wygasa po 7 dniach. Po zakończeniu prób ustaw ekran zgody na **In production**, aby harmonogram nie wymagał cotygodniowego ponownego łączenia konta.

Dane klienta pozostają w lokalnym `.env`. Token offline jest zapisywany poza bazą w `data/google-drive-token.json`, nie trafia do eksportu i jest ignorowany przez Git. Na Linuksie oba pliki otrzymują uprawnienia `0600`. Ustawienia harmonogramu znajdują się w `data/backup-settings.json`, a dodatkowe lokalne kopie w `backups/automatic/`.

Można wybrać kopie lokalne, Google Drive lub oba miejsca oraz harmonogram od godziny do tygodnia. Opcja „tylko Google Drive” wyłącza dodatkowe lokalne pliki JSON; robocza baza SQLite nadal pozostaje na serwerze, bo aplikacja potrzebuje jej do działania. CRESCI zachowuje tylko trzy najnowsze kopie w każdym włączonym miejscu i nadaje im czytelne nazwy z rodzajem oraz datą, np. `CRESCI - ręczna - 27-08-2026, 09.14.03.013.json`.

W sekcji **Przywracanie kopii** można wybrać jedną z trzech ostatnich wersji i odtworzyć ją jednym przyciskiem. Przed zastąpieniem danych aplikacja zawsze tworzy dodatkową kopię bieżącego stanu oznaczoną „przed przywróceniem”, a import bazy odbywa się transakcyjnie.

## CRESCI Score v1

Funkcja jest domyślnie wyłączona. W **Ustawienia → Ogólne → CRESCI Score** można włączyć ją osobno dla Marka i Domii oraz ustawić cel od 1 do 7 treningów tygodniowo. Wyłączenie profilu usuwa jego Score z Dashboardu. Ustawienia są częścią eksportu i kopii zapasowych, a starsze kopie bez tych pól pozostają zgodne.

Score porównuje ostatnie 30 dni z poprzednimi 30 dniami i jest sumą czterech jawnych kategorii:

- progres siłowy: 0–40 pkt; utrzymanie ciężaru daje neutralne 20 pkt, a procentowa zmiana każdego ćwiczenia jest ograniczana do ±10% przed uśrednieniem,
- regularność względem celu treningów na tydzień: 0–25 pkt,
- odsetek aktywnych ćwiczeń danego profilu z progresem: 0–20 pkt,
- ciągłość zależna od najdłuższej przerwy i celu tygodniowego: 0–15 pkt.

Algorytm jest deterministyczny, nie korzysta z AI ani losowości. Szczegóły kategorii i powód zmiany są dostępne po kliknięciu karty Score na Dashboardzie. W v1 `profiles.id` jest używane jako `user_id`; obliczenia nie zakładają konkretnych identyfikatorów Marka i Domii, co ułatwia przyszłą migrację do kont użytkowników.

## Katalog ćwiczeń z zewnętrznego API

Źródłem katalogu jest **wger**. Projekt jest otwartoźródłowy, udostępnia publiczne endpointy REST bez logowania oraz zwraca kategorię, mięśnie główne i dodatkowe oraz sprzęt. W oknie **Nowe ćwiczenie → Pobierz z katalogu** CRESCI przeszukuje indeks nazw, pobiera szczegóły wybranego rekordu i uzupełnia lokalny formularz. Po zapisaniu ćwiczenie trafia do SQLite i nie wymaga internetu podczas treningu. Indeks nazw jest buforowany w pamięci serwera przez godzinę; samo wyszukiwanie wymaga dostępu serwera do `https://wger.de`.

Alternatywą jest **ExerciseDB**, które ma bogaty katalog z polami `bodyPart`, `target`, `secondaryMuscles`, sprzętem i instrukcjami, ale typowe użycie wymaga klucza RapidAPI. Z tego powodu wger jest lepszym domyślnym wyborem dla tej aplikacji.

Nazwy w katalogu wger są głównie angielskie, ale kategorię CRESCI mapuje na polską. Przed zapisem można poprawić wszystkie automatycznie uzupełnione pola.

## CRESCI GAME — fundament

GAME jest domyślnie wyłączony osobno dla każdego `user_id`. Pierwsze włączenie w **Ustawienia → Ogólne → CRESCI GAME** otwiera kreator avatara. Wybór bazy postaci, koloru skóry i oczu, włosów, góry i dołu stroju, butów, nakrycia głowy oraz akcesorium jest przechowywany w SQLite per użytkownik. Po aktywacji pojawia się ekran **Postać**.

Aktywnym zestawem jest **CRESCI Avatar HD Creator + Shop v4-production**. Główny ekran Postać składa dziewięć warstw PNG w wariancie `runtime` 512 × 768 px, natomiast kreator, inventory, sklep i małe podglądy używają wyłącznie warstw `compact` 256 × 384 px. Wariant `master` 1024 × 1536 pozostaje materiałem źródłowym i nie jest wybierany przez GUI. Kolejność pochodzi bezpośrednio z manifestu: `back → body → eyes → hair → bottom → top → shoes → headwear → accessories`. Wszystkie warstwy danego avatara mają jeden canvas, pozycję `(0,0)`, wspólną skalę `contain` i kotwicę `feet-center`; nie mają indywidualnych przesunięć ani filtrów. Aplikacja ładuje wyłącznie `public/assets/avatars/v4-production` z parametrem cache `?v=4`, a kreator i sklep korzystają z katalogów dostarczonych w tej samej paczce.

Przycisk **Zamelduj się** zapisuje niezależne zdarzenie GAME i przyznaje 25 XP raz dziennie. Nie rozpoczyna treningu i nie dopisuje nic do historii ciężarów. Poziom jest wyliczany deterministycznie z całkowitego XP: poziom 1 wymaga 100 XP, a koszt każdego kolejnego wzrasta o 25 XP. Wyłączenie GAME ukrywa jego interfejs, ale zachowuje avatar, XP i dane do późniejszego ponownego włączenia.

Przy aktywnym GAME faktyczne pobicie najwyższego ciężaru użytkownika w danym ćwiczeniu przyznaje **+1 PR**. Pierwszy wynik ustala rekord bazowy bez nagrody. Chroniony próg rekordu jest przechowywany osobno od edytowalnej historii, dlatego edycja lub usunięcie wpisu nie odbiera zdobytego PR ani nie pozwala zdobyć go ponownie przez dodanie tego samego ciężaru. Edycja wyniku w górę może podnieść chroniony próg, ale sama nie przyznaje PR. Gdy GAME jest wyłączony, rekordy nadal zabezpieczają próg, lecz nie naliczają waluty.

Ekran **Osiągnięcia** pokazuje 29 achievementów z kategorii Trening, Progres, Regularność, Eksploracja i Ukryte. Każdy jest odblokowywany tylko raz per `user_id`, zapisuje datę i może przyznać PR. Ukryte warunki pozostają oznaczone jako `???` do chwili zdobycia. Księga `pr_transactions` rozróżnia źródła `RECORD`, `ACHIEVEMENT` i `SHOP_PURCHASE`, a tabela `user_achievements` ma również pola na przyszłe nagrody-itemy.

Nawigacja GAME prowadzi przez **Postać | Ekwipunek | Sklep | Osiągnięcia**. Sklep obsługuje 35 produktów z paczki v21: katalog **CRESCI Core** oraz kolekcje **Ember Elite**, **Neon Night** i **Royal Crest** w sześciu slotach. Blokuje ponowny zakup i odejmuje cenę od `pr_balance`. Zakupiony item trafia do tabeli `user_items`; założenie nadal zapisuje odpowiednią warstwę w `game_profiles`, dlatego strój pozostaje po restarcie. W trybie testowym HD podgląd świadomie pokazuje kompletny master zależny tylko od płci; inventory, zakupy i zapisane wyposażenie pozostają aktywne i niezmienione.

Tabela `game_events` jest dziennikiem meldunków, zakupów i nagród, `game_records` przechowuje nieobniżalny rekord per użytkownik i ćwiczenie, a `game_profiles` zawiera `pr_balance`, `pr_total_earned` oraz wyposażone warstwy. Wszystkie te dane należą do eksportu JSON i backupu Google Drive. Starsze kopie bez inventory pozostają zgodne — posiadane elementy są odbudowywane z zapisanego avatara.

## Zaimportowana historia

Baza zawiera 14 ćwiczeń wynikających z przekazanej tabeli oraz 59 wpisów historii: 29 Marka i 30 Domii. Wariant pisowni „Domi” został połączony z profilem „Domii”. Oryginalne wartości starego i nowego ciężaru, przyrostu, krążków oraz typu zmiany zostały zachowane.

Skrypt `scripts/import-user-history.js` pozwala odtworzyć ten import. Kopia bazy sprzed zastąpienia przykładowych danych znajduje się w `backups/before-history-import-2026-08-26.sqlite`.

## API

W **Ustawienia → Aktualizacje** CRESCI pokazuje wersję odczytaną z `package.json` i sprawdza najnowszy publiczny GitHub Release repozytorium `Tkoczu/Cresci`. Gdy nowsze wydanie jest dostępne, można uruchomić aktualizację z UI. Przycisk nie wykonuje dowolnych poleceń: endpoint może jedynie zlecić systemd uruchomienie stałej usługi `cresci-update.service`. Helper pobiera wyłącznie tag wskazany przez najnowszy publiczny GitHub Release, tworzy backup, sprawdza zgodność wersji, restartuje usługę, wykonuje health check i w razie błędu przywraca poprzedni commit i dane.

Serwer aplikacji działa jako nieuprzywilejowany użytkownik `cresci`. Jedyny wpis sudoers pozwala mu wykonać dokładnie `/usr/bin/systemctl start --no-block cresci-update.service`; kod aplikacji i updater pozostają własnością `root`, a użytkownik `cresci` zapisuje tylko `.env`, `data/` i `backups/`. Status w `/var/lib/cresci-updater/status.json` przetrwa restart aplikacji. Ręczne `sudo cresci update` nadal działa i prosi o potwierdzenie.

Nowa instalacja przez `scripts/install-proxmox.sh` konfiguruje ten model automatycznie. Istniejącą instalację LXC, w której `cresci.service` nadal działa jako root, migruje idempotentne polecenie uruchomione wewnątrz kontenera:

```bash
sudo /opt/cresci/scripts/install-update-helper.sh
```

W zwykłym uruchomieniu lokalnym `CRESCI_UPDATE_ENABLED=0`, więc endpoint zwraca czytelny komunikat o niedostępnej instalacji. Samo sprawdzanie GitHub Releases nadal działa.

Kontrola konfiguracji na istniejącym LXC 102 z hosta Proxmox, bez uruchamiania aktualizacji:

```bash
pct exec 102 -- systemctl show cresci -p User -p Group -p Environment
pct exec 102 -- sudo -l -U cresci
pct exec 102 -- systemctl cat cresci-update.service
pct exec 102 -- curl -fsS http://127.0.0.1:4173/api/system/update-status
```

Po opublikowaniu zatwierdzonego release można użyć przycisku w UI i obserwować przebieg:

```bash
pct exec 102 -- journalctl -fu cresci-update.service
pct exec 102 -- cat /var/lib/cresci-updater/status.json
pct exec 102 -- curl -fsS http://127.0.0.1:4173/api/version
```

Nie testuj rollbacku przez ręczne uszkadzanie produkcyjnych danych. Do próby awarii użyj klona/snapshotu LXC 102 i kontrolowanego testowego release dopiero po jego osobnym zatwierdzeniu.

- `GET /api/version` — aktualnie zainstalowana wersja,
- `GET /api/updates/check` — porównanie z najnowszym publicznym GitHub Release,
- `POST /api/system/update` — zlecenie stałego helpera aktualizacji (tylko produkcyjny LXC),
- `GET /api/system/update-status` — trwały etap, wynik health checku i informacja o rollbacku,

- `GET /api/bootstrap` — profile, ćwiczenia, aktualne wyniki i statystyki,
- `POST /api/entries` — nowy wpis treningowy,
- `PUT /api/entries/:id`, `DELETE /api/entries/:id` — korekta lub usunięcie wpisu i przeliczenie dalszej historii,
- `GET /api/history` — historia z filtrami,
- `GET /api/progress` — punkty wykresu,
- `GET /api/overall-progress` — znormalizowany indeks całego planu,
- `GET /api/cresci-game`, `GET /api/cresci-game/settings` — stan postaci oraz ustawienia GAME,
- `PUT /api/cresci-game/settings/:userId` — włączenie, wyłączenie i zapis avatara,
- `POST /api/cresci-game/check-in/:userId` — dzienny meldunek i naliczenie XP,
- `GET /api/cresci-game/inventory?user_id=...`, `PUT /api/cresci-game/equipment/:userId` — inventory oraz założenie lub zdjęcie itemu,
- `GET /api/cresci-game/shop?user_id=...`, `POST /api/cresci-game/shop/:userId/purchase` — katalog sklepu i atomowy zakup za PR,
- `GET /api/cresci-game/achievements?user_id=...` — lista i progres achievementów,
- `GET /api/catalog/exercises?q=...` — wyszukiwanie publicznego katalogu wger,
- `GET /api/backup/status`, `PUT /api/backup/settings`, `POST /api/backup/run` — status, harmonogram i ręczna synchronizacja kopii,
- `GET /api/backup/files`, `POST /api/backup/restore` — lista trzech ostatnich kopii i bezpieczne przywracanie,
- `GET /api/google-drive/connect`, `GET /api/google-drive/callback`, `DELETE /api/google-drive/connection` — połączenie OAuth z Google Drive,
- `POST /api/exercises`, `PUT /api/exercises/:id` — zarządzanie ćwiczeniami,
- `GET /api/export`, `POST /api/import` — przenoszenie danych.
