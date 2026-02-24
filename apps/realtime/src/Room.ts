import {
    GameSettings,
    Player,
    ClientMessage,
    ServerMessage,
    RoundResult,
    GameSummary
} from '@hangman/shared';

export class Room {
    state: DurableObjectState;
    env: any;
    sessions: Map<WebSocket, { playerId: string; player: Player }> = new Map();

    settings?: GameSettings;
    players: Player[] = [];
    words: string[] = [];
    currentRoundIndex: number = -1;

    // Game state per round
    roundStartTime: number = 0;
    guessedLetters: Set<string> = new Set();
    mistakesByPlayer: Map<string, number> = new Map();
    solvedByPlayer: Map<string, boolean> = new Map();
    timeSpentByPlayer: Map<string, number> = new Map();

    // History
    gameSummary: GameSummary = { rounds: [], totals: {}, winnerId: null };

    constructor(state: DurableObjectState, env: any) {
        this.state = state;
        this.env = env;
    }

    async fetch(request: Request) {
        const url = new URL(request.url);
        if (url.pathname.includes('/ws')) {
            const upgradeHeader = request.headers.get('Upgrade');
            if (!upgradeHeader || upgradeHeader !== 'websocket') {
                return new Response('Expected Upgrade: websocket', { status: 426 });
            }

            const [client, server] = new WebSocketPair();
            await this.handleSession(server);
            return new Response(null, { status: 101, webSocket: client });
        }

        // Initialize room via internal API
        if (url.pathname === '/init' && request.method === 'POST') {
            const data = await request.json() as { settings: GameSettings; words: string[] };
            this.settings = data.settings;
            this.words = data.words;
            return new Response('OK');
        }

        return new Response('Not Found', { status: 404 });
    }

    async handleSession(ws: WebSocket) {
        ws.accept();

        ws.addEventListener('message', async (msg) => {
            try {
                const data: ClientMessage = JSON.parse(msg.data as string);
                await this.handleMessage(ws, data);
            } catch (err) {
                console.error('WS Error:', err);
            }
        });

        ws.addEventListener('close', () => {
            const session = this.sessions.get(ws);
            if (session) {
                this.broadcast({ type: 'player_left', playerId: session.playerId });
                this.sessions.delete(ws);
            }
        });
    }

    async handleMessage(ws: WebSocket, msg: ClientMessage) {
        switch (msg.type) {
            case 'client_hello': {
                const playerId = `p_${Math.random().toString(36).substr(2, 9)}`;
                const role = this.players.length === 0 ? 'host' : 'guest';
                const player: Player = { id: playerId, name: role === 'host' ? 'Host' : 'Guest', role };

                this.players.push(player);
                this.sessions.set(ws, { playerId, player });

                ws.send(JSON.stringify({
                    type: 'server_welcome',
                    playerId,
                    role,
                    settings: this.settings!,
                    players: this.players
                }));

                this.broadcast({ type: 'player_joined', player }, playerId);

                // Start first round if enough players (or single player case)
                if (this.currentRoundIndex === -1) {
                    if (this.players.length >= (this.settings?.maxMistakes ? 1 : 2)) {
                        // NOTE: Actually requirement said 2 players min for MP, but let's allow starting
                        // In MP, host might wait for guest.
                    }
                    // For now, auto-start when first player joins if single player or 2nd if MP
                    const isSingle = this.words.length > 0; // Simple check
                    if (isSingle && this.players.length === 1) {
                        this.startRound(0);
                    } else if (this.players.length === 2 && this.currentRoundIndex === -1) {
                        this.startRound(0);
                    }
                }
                break;
            }

            case 'guess_letter': {
                const session = this.sessions.get(ws);
                if (!session || this.currentRoundIndex !== msg.roundIndex) return;

                const letter = msg.letter.toLowerCase();
                if (this.guessedLetters.has(letter)) return;

                this.guessedLetters.add(letter);
                const correctWord = this.words[this.currentRoundIndex];
                const isCorrect = correctWord.includes(letter);

                if (!isCorrect) {
                    const m = (this.mistakesByPlayer.get(session.playerId) || 0) + 1;
                    this.mistakesByPlayer.set(session.playerId, m);

                    this.broadcast({
                        type: 'opponent_mistake',
                        roundIndex: this.currentRoundIndex,
                        guessType: 'letter',
                        guessValue: letter,
                        mistakesTotal: m
                    }, session.playerId);

                    if (m >= this.settings!.maxMistakes) {
                        this.solvedByPlayer.set(session.playerId, false);
                        this.checkRoundEnd();
                    }
                } else {
                    // Check if word solved
                    const masked = this.getMaskedWord();
                    if (!masked.includes('_')) {
                        this.solvedByPlayer.set(session.playerId, true);
                        this.timeSpentByPlayer.set(session.playerId, Date.now() - this.roundStartTime);
                        this.checkRoundEnd();
                    }
                }

                this.broadcastRoundUpdate();
                break;
            }

            // ... handle guess_word, request_rematch etc.
        }
    }

    startRound(index: number) {
        if (index >= this.words.length) {
            this.endGame();
            return;
        }

        this.currentRoundIndex = index;
        this.roundStartTime = Date.now();
        this.guessedLetters.clear();
        this.mistakesByPlayer.clear();
        this.solvedByPlayer.clear();
        this.timeSpentByPlayer.clear();

        const word = this.words[index];
        const allowedLetters = this.settings?.language === 'et'
            ? "abdefghijklmnoprsšzžtuvõäöü".split("")
            : "abcdefghijklmnopqrstuvwxyz".split("");

        this.broadcast({
            type: 'round_start',
            roundIndex: index,
            maskedWord: this.getMaskedWord(),
            allowedLetters,
            timeLimitSec: this.settings!.timeLimitSec,
            serverNowMs: Date.now()
        });
    }

    getMaskedWord() {
        const word = this.words[this.currentRoundIndex];
        return [...word].map(c => this.guessedLetters.has(c) ? c : '_').join('');
    }

    broadcast(msg: ServerMessage, skipPlayerId?: string) {
        const msgStr = JSON.stringify(msg);
        for (const [ws, session] of this.sessions.entries()) {
            if (session.playerId !== skipPlayerId) {
                ws.send(msgStr);
            }
        }
    }

    broadcastRoundUpdate() {
        const mistakesObj: Record<string, number> = {};
        this.mistakesByPlayer.forEach((v, k) => mistakesObj[k] = v);

        this.broadcast({
            type: 'round_update',
            roundIndex: this.currentRoundIndex,
            maskedWord: this.getMaskedWord(),
            guessedLetters: Array.from(this.guessedLetters),
            mistakesByPlayer: mistakesObj,
            timeLeftSecByPlayer: {} // calculate
        });
    }

    checkRoundEnd() {
        // Round ends if all active players finished (solved or max mistakes)
        if (this.solvedByPlayer.size === this.players.length) {
            this.endRound();
        }
    }

    endRound() {
        const results: Record<string, any> = {};
        this.players.forEach(p => {
            results[p.id] = {
                solved: this.solvedByPlayer.get(p.id) || false,
                mistakes: this.mistakesByPlayer.get(p.id) || 0,
                timeSpentMs: this.timeSpentByPlayer.get(p.id) || this.settings!.timeLimitSec * 1000
            };
        });

        this.broadcast({
            type: 'round_end',
            roundIndex: this.currentRoundIndex,
            correctWord: this.words[this.currentRoundIndex],
            solvedByPlayer: Object.fromEntries(this.solvedByPlayer),
            timeSpentMsByPlayer: Object.fromEntries(this.timeSpentByPlayer),
            mistakesThisRoundByPlayer: Object.fromEntries(this.mistakesByPlayer)
        });

        // Record for summary
        this.gameSummary.rounds.push({
            word: this.words[this.currentRoundIndex],
            players: results as any
        });

        setTimeout(() => this.startRound(this.currentRoundIndex + 1), 5000);
    }

    endGame() {
        // Calculate totals and winner
        this.players.forEach(p => {
            let solvedCount = 0;
            let totalMistakes = 0;
            let totalTime = 0;

            this.gameSummary.rounds.forEach(r => {
                const res = r.players[p.id];
                if (res.solved) solvedCount++;
                totalMistakes += res.mistakes;
                totalTime += res.timeSpentMs;
            });

            this.gameSummary.totals[p.id] = { solvedCount, totalMistakes, totalTimeMs: totalTime };
        });

        // Simple winner logic: variant 1 from prompt
        let winnerId: string | null = null;
        let maxSolved = -1;
        let minMistakes = Infinity;

        this.players.forEach(p => {
            const stats = this.gameSummary.totals[p.id];
            if (stats.solvedCount > maxSolved) {
                maxSolved = stats.solvedCount;
                winnerId = p.id;
                minMistakes = stats.totalMistakes;
            } else if (stats.solvedCount === maxSolved) {
                if (stats.totalMistakes < minMistakes) {
                    minMistakes = stats.totalMistakes;
                    winnerId = p.id;
                }
            }
        });

        this.gameSummary.winnerId = winnerId;
        this.broadcast({ type: 'game_end', summary: this.gameSummary, winner: winnerId });
    }
}
