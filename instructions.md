Agent Brief: Hangman (Single + Multiplayer) Cloudflare (TS Monorepo)
0) Eesmärk

Loo veebipõhine Hangman mäng, mida saab mängida:

Single-player: mängija mängib üksi

Multiplayer: 2 mängijat (minimaalne), kus mõlemad lahendavad samu sõnu sama reeglistiku alusel ja näevad reaalajas teineteise vigu ja progressi (vähemalt “vale pakkumine” sündmused)

Mängu looja peab saama valida reeglid:

Sõnade keel (alguses en, et)

Ajalimiit sõna kohta (sekundites)

Sõna pikkuse vahemik (nt 5–9)

Sõnade allikas:

repo data/words_eng.json ja data/words_est.json

mõlemad on JSON array (stringid)

Mängu lõpus kuvada kokkuvõte:

kes võitis (multiplayeris)

mitu viga tegi kumbki

millised sõnad olid mängus

kui palju aega kulus iga sõna lahendamiseks (per player)

UI peab olema selge ja intuitiivne.

1) Stack ja arhitektuur (Cloudflare-friendly)
   1.1 Monorepo struktuur (TypeScript)

Kasuta monorepo tööriista (pnpm workspaces või npm workspaces). Soovituslik struktuur:

apps/web/ — Vue 3 + Vite SPA (TypeScript)

apps/realtime/ — Cloudflare Worker (TypeScript) + Durable Objects

packages/shared/ — jagatud TypeScript tüübid: protokoll, eventid, DTOd, valideerimisskeemid, constants

data/ — words_eng.json, words_est.json

1.2 Deploy

Frontend deploy: Cloudflare Pages (build from apps/web)

Backend deploy: Cloudflare Worker + Durable Objects (deploy from apps/realtime wrangleriga)

1.3 Multiplayer state

Iga multiplayer game = üks Room Durable Object instance

DO hoiab:

mängureeglid

valitud sõnade järjekorra

mõlema mängija state’i

timers/round info

WebSocket connections

1.4 Transport

Reaalajas suhtlus: WebSockets (DO sees)

HTTP endpointid (Worker):

auth

create game

join game (võib olla anonüümne või samuti auth; nõue on create peab olema auth)

2) Auth: Google login ainult Create Game jaoks
   2.1 Kliendi login

Frontend kasutab Google Identity Services’i (GIS) login nuppu.

Client saab Google ID token (JWT)

2.2 Worker verifitseerib ID tokeni ja teeb sessioni

Worker endpoint:

POST /api/auth/google

sisend: { idToken: string }

server kontrollib ID tokeni:

signature (Google JWKS)

aud = sinu Google OAuth client_id

iss, exp, sub

kui ok:

loo app session (nt KV/D1/DO storage; hobi-projektil KV ok)

tagasta Set-Cookie: session=...; HttpOnly; Secure; SameSite=Lax

2.3 Create Game endpoint nõuab sessionit

POST /api/games

nõuab session cookie’t

kui puudub → 401 Unauthorized

kui olemas → loob roomi ja tagastab roomId + wsUrl

Märkus: Ära kasuta Cloudflare Accessi selle avaliku tarbija-case’i jaoks; tee klassikaline “ID token → server verify → session” lahendus.

3) Game mode’id ja reeglid
   3.1 Game modes

Single-player: mängija mängib lokaalselt UI-s või serveriga (soovitus: sama backend kasutamine annab ühtlase loogika ja lihtsustab tulemusraporteid)

lihtsaim: single-player kasutab Workeri “single game” endpointi, mis ei vaja DO-d

alternatiiv: single-player kasutab samuti DO-d, aga 1 mängija (lihtsustab protokolli, kuid suurendab DO usage’t)

Multiplayer:

“Create game” loob DO roomi

“Join” liitub roomiga WebSocketiga

3.2 Reeglid (GameSettings)

language: "en" | "et"

timeLimitSec: number (nt 10–180)

wordLengthMin: number

wordLengthMax: number

(valikuline) maxMistakes: number (klassikaline hangman 6–10)

3.3 Word selection

Word list tuleb data/*.json failidest

filtreeri sõnad:

normalize: trim, lowercase

ainult a–z / eesti tähed (täpsusta, et UI kuvab tähed vastavalt keelele; eesti keeles: a b d e f g h i j k l m n o p r s š z ž t u v õ ä ö ü)

pikkus vahemikus [min,max]

valitud sõnad:

multiplayeris peavad mõlemad mängijad saama sama sõna järjekorra (DO valib)

vali X sõna (nt 5 või 10; tee see kas konstant või setting)

ära korda sõna sama mängu sees

4) Multiplayer: nähtavus “vastane tegi vea”

Nõue: multiplayeris peab nägema, kui vastane teeb vea.

Minimaalne:

kui mängija teeb vale tähe/word guess’i → DO broadcastib event’i teisele:

opponent_mistake (sisaldab milline round, mis guess tüüp, timestamp)

UI näitab seda reaalajas (nt “Opponent guessed ‘K’ – wrong!” + opponent mistakes counter)

Soovituslik lisaks:

näita ka “opponent progress”: mitu tähte avatud, mis mistakes count, palju aega järel, kas round solved

5) Game flow ja state (server authoritative)
   5.1 Round flow

Iga word = üks “round”.

Per round:

DO seab roundStartTs

DO saadab mõlemale klientidele round_start (maskitud sõna, allowedLetters, timeLimit)

klient saadab guess’e:

guess_letter

(valikuline) guess_word (lubada “täis vastus” pakkumine)

DO valideerib:

kas round on aktiivne

kas letter juba guessed

update state

kui vale → increment mistakes

kui sõna solved või time läbi → round lõpetatud

DO saadab round_update pärast igat guess’i (mõlemale)

DO saadab round_end koos tulemusega:

solved?, mistakesThisRound, timeSpentMs, finalMask, correctWord (võid näidata alles end-of-round)

5.2 Time limit

Time limit on per word.
Server peab olema “source of truth”:

DO hoiab start time

kui klient hilineb: DO otsustab time-out’i

DO võib “tickida” (nt setTimeout DO-s) või arvutada time left iga update’iga; vali lihtne ja deterministlik lahendus:

“server checks on each incoming message + scheduled alarm” (Cloudflare DO-l on alarms/cron võimalused; vali DO alarm või periodic check)

UI näitab countdown’i (timeLeftSec), aga lõplik otsus serveril.

5.3 Score ja winner

Defineeri selge võidutingimus:

variant 1: rohkem solved sõnu võidab; tie-breaker: vähem mistakes; tie: vähem total time

variant 2: points: solved = +1, mistake = -0.1, time = -x
Vali lihtne ja seletatav (nt variant 1).

5.4 Endgame summary

DO koondab summary:

list of rounds: word, timeSpentMsByPlayer, mistakesByPlayer, solvedByPlayer

totals: totalMistakes, totalTimeMs, solvedCount

winner + reason (nt “Solved more words”, “Same solved, fewer mistakes”, jne)

6) Protokoll (shared package)

Kõik eventid ja payloadid peavad olema TypeScript tüüpidena packages/shared all.

6.1 HTTP endpointid

POST /api/auth/google → sets session cookie

POST /api/games (auth required) → create multiplayer game

request body: GameSettings

response: { roomId, wsUrl, joinUrl }

POST /api/games/:roomId/join (võib olla public) → tagastab wsUrl (või UI arvutab wsUrl otse)

6.2 WebSocket eventid (näited)

Client → Server

client_hello { roomId, session?: ... } (kui tahad host identityt näidata)

guess_letter { roundIndex, letter }

guess_word { roundIndex, word }

request_rematch (optional)

Server → Client

server_welcome { playerId, role: host|guest, settings, players }

round_start { roundIndex, maskedWord, allowedLetters, timeLimitSec, serverNowMs }

round_update { roundIndex, maskedWord, guessedLetters, mistakesByPlayer, timeLeftSecByPlayer?, opponentLastAction? }

opponent_mistake { roundIndex, guessType, guessValue, mistakesTotal }

round_end { roundIndex, correctWord, solvedByPlayer, timeSpentMsByPlayer, mistakesThisRoundByPlayer }

game_end { summary, winner }

Agent võib protokolli lihtsustada, aga peab katma: reeglid, guess’id, opponent mistake, timer, summary.

6.3 Valideerimine

Kasuta runtime validationit (Zod või Valibot) packages/shared sees:

kaitse WS ja HTTP sisendeid

logi ja dropi vigased payloadid

7) UI nõuded (Vue SPA)
   7.1 Peamised vaated

Home

“Single-player”

“Multiplayer: Create game”

“Join game” (roomId sisestus või join link)

Create Game Modal/Page

Language: EN/ET select

Time limit: slider/input (sec)

Word length range: min/max

Create nupp: nõuab Google sign-in’i; kui pole, näita “Sign in with Google to create”

Game Room

Hangman display (lihtne tekst/ASCII või minimal UI)

Maskitud sõna (nt _ _ A _ _)

Klaviatuur / tähtede valik (keelepõhine)

Timer

Oma vead / vastase vead (reaalajas)

Toast/Feed: “Opponent guessed X (wrong)”

Summary

Winner

tabel roundide kaupa:

sõna

player A time, mistakes

player B time, mistakes

“Play again” (optional)

7.2 UX detailid

Selge state: “Waiting for opponent”, “Round 2/5”, “Time’s up”

Blokeeri input kui round ended või time up

Näita, millised tähed on juba guessed (disable)

Multiplayeris näita vastase ühenduse staatust

8) Word listide kasutamine Workeris

Agent peab otsustama, kuidas Worker sõnu loeb:

Variant A: bundleda JSON failid Worker buildi sisse (import JSON build-time)

Variant B: hoida sõnu KV-s või R2-s (hilisem scale)
Hobiprojektil: build-time import on ok.

Oluline:

DO peab saama sõnade listile ligi (kas:

DO-l on sama bundle ja importib sama words listi

või Worker annab DO-le juba valitud sõnad create ajal)

Soovitus: Worker valib sõnad create ajal ja annab DO-le selectedWords[] (nii DO ei pea suurt sõnastikku hoidma).

9) “Create game” endpoint käitumine (kohustuslik)

Agent peab implementeerima täpselt selle loogika:

“Create game” endpoint:

kontrollib auth’i (session cookie)

genereerib roomId

“initialiseerib” DO (või annab room URL’i; vähemalt peab DO olema leitav roomId järgi)

tagastab { roomId, wsUrl }

wsUrl kuju:

sama domeen, wss://<domain>/ws/rooms/<roomId> (näide)

Worker route suunab selle DO-le

10) Mittefunktsionaalsed nõuded

Kõik TypeScript

Striktne typing (shared event tüübid)

Server authoritative reeglid (timer, mistakes, win)

Logimine:

Worker/DO logs sisaldab roomId ja playerId

Turvalisus:

session cookie HttpOnly + Secure

rate limit “create game” (minimaalne, nt 1/sec per session) – optional, aga soovituslik

Testimine (optional, aga hea):

shared validation unit test

word filtering test

11) Done / Acceptance Criteria

Projekt loetakse valmis, kui:

Single-player mäng töötab algusest lõpuni (timer, mistakes, summary)

Multiplayer:

host saab luua mängu ainult peale Google login’i

teine mängija saab joinida roomId või linkiga

mõlemad näevad reaalajas vastase vigu

roundid ja timer käituvad serveri järgi

lõpus kuvatakse summary koos ajakuluga per sõna per player

Deploy:

apps/web läheb Pages’i

apps/realtime läheb Worker + DO’na üles

readme sisaldab setup ja deploy käske
