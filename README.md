# Verify-Bot mit Auto-Rejoin und Dashboard

Discord-Bot mit drei Funktionen:
- ✅ **Verify-System** per Discord-Login (nicht nur ein Button) – erlaubt automatisches Wieder-Hinzufügen
- 🖐️ **Willkommensnachricht** – wird erst NACH erfolgreicher Verifizierung gesendet
- 🔄 **Rollen-Tausch**: Unverified → Verified + Member/Bürger-Rolle
- 🌐 **Web-Dashboard** mit Discord-Login zum Einstellen von Kanälen/Rollen per Dropdown

## Wie der Ablauf funktioniert

1. Jemand joint dem Server → bekommt automatisch die **Unverified**-Rolle
2. Er sieht (dank Rechte-Einstellungen, die du selbst in Discord setzt) nur den Verify-Channel
3. Er klickt auf "Verifizieren" → wird zu Discord weitergeleitet → loggt sich ein und erlaubt dem Bot, ihn bei Bedarf automatisch wieder hinzuzufügen (`guilds.join`-Berechtigung)
4. Der Bot entfernt **Unverified**, vergibt **Verified** + **Member/Bürger**-Rolle, postet die Willkommensnachricht
5. Verlässt die Person den Server **freiwillig** später wieder → der Bot fügt sie automatisch erneut hinzu (mit denselben Rollen)
6. Wird sie **gekickt oder gebannt** → **kein** automatisches Wieder-Hinzufügen

## 1. Discord Application einrichten

Im [Discord Developer Portal](https://discord.com/developers/applications), bei deiner Anwendung:

1. **Bot** → Token kopieren → `DISCORD_TOKEN`
   Unter "Privileged Gateway Intents": **Server Members Intent** aktivieren
2. **General Information** → Application ID → `CLIENT_ID`
3. **OAuth2** → **Client Secret** → "Reset Secret" falls nötig → kopieren → `CLIENT_SECRET`
   ⚠️ Das ist NICHT der Bot-Token! Beide sind unterschiedliche geheime Werte.
4. **OAuth2** → **Redirects** → füge BEIDE URLs hinzu (mit deiner echten PUBLIC_URL):
   - `https://deine-domain:port/verify/callback`
   - `https://deine-domain:port/dashboard/callback`

## 2. Bot einladen

OAuth2 URL Generator: Scopes `bot` + `applications.commands`, Bot-Permission `Manage Roles` (mindestens). Bot-Rolle danach in den Server-Einstellungen über die Rollen Unverified/Verified/Member ziehen.

## 3. Umgebungsvariablen

```bash
cp .env.example .env
```

Alle Werte ausfüllen. **`PUBLIC_URL` ist entscheidend** – das ist die öffentliche Adresse, unter der dein Hosting-Panel den Bot erreichbar macht (z.B. `https://45.131.65.244:30299` bei host-ship.com, oder eine echte Domain bei Railway). Ohne exakt passende `PUBLIC_URL` (inkl. Port!) funktioniert der Login nicht, weil Discord die Redirect-URL exakt mit dem abgleicht, was im Developer Portal hinterlegt ist.

## 4. Installation & Start

```bash
npm install
npm start
```

## 5. Rollen in Discord vorbereiten

Erstelle (falls noch nicht vorhanden) die Rollen **Unverified**, **Verified**, **Member/Bürger** in Discord. Setze die Server-Berechtigungen so, dass **Unverified** nur den Verify-Channel sehen kann (wie beim letzten Bot: bei jedem anderen Kanal "Kanal anzeigen" für Unverified auf verboten stellen).

## 6. Dashboard öffnen

Gehe zu `PUBLIC_URL/dashboard` (z.B. `https://45.131.65.244:30299/dashboard`), logg dich mit Discord ein (nur Server-Owner oder Administratoren kommen rein). Wähle dort per Dropdown:
- Verify-Channel
- Willkommens-Channel
- Unverified-Rolle
- Verified-Rolle
- Member/Bürger-Rolle

Sobald du speicherst, postet der Bot automatisch das Verify-Panel in den gewählten Channel.

## Daten & Persistenz

Alle Daten liegen in `data/` (config.json, verified-users.json, log.json). **Wichtig:** Falls dein Hosting bei jedem Neu-Deploy die Dateien zurücksetzt (wie bei Railway ohne Volume), brauchst du dauerhaften Speicher – siehe die Volume-Anleitung, die du schon kennst. Bei den meisten Pterodactyl-artigen Panels (wie host-ship.com) bleiben Dateien normalerweise von selbst erhalten.
