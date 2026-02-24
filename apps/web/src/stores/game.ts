import { defineStore } from 'pinia';
import {
    GameSettings,
    Player,
    ServerMessage,
    ClientMessage,
    GameSummary
} from '@hangman/shared';

export const useGameStore = defineStore('game', {
    state: () => ({
        playerId: null as string | null,
        role: null as 'host' | 'guest' | null,
        settings: null as GameSettings | null,
        players: [] as Player[],

        currentRound: null as {
            index: number;
            maskedWord: string;
            allowedLetters: string[];
            guessedLetters: string[];
            timeLimitSec: number;
            serverNowMs: number;
        } | null,

        mistakesByPlayer: {} as Record<string, number>,
        timeLeftSecByPlayer: {} as Record<string, number>,
        opponentLastAction: undefined as string | undefined,

        gameStatus: 'waiting' as 'waiting' | 'playing' | 'round_ended' | 'finished',
        summary: null as GameSummary | null,
        winner: null as string | null,

        ws: null as WebSocket | null,
    }),

    actions: {
        connect(wsUrl: string) {
            if (this.ws) this.ws.close();

            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                this.send({ type: 'client_hello', roomId: '' }); // RoomId in URL
            };

            this.ws.onmessage = (event) => {
                const msg: ServerMessage = JSON.parse(event.data);
                this.handleMessage(msg);
            };
        },

        send(msg: ClientMessage) {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(msg));
            }
        },

        handleMessage(msg: ServerMessage) {
            switch (msg.type) {
                case 'server_welcome':
                    this.playerId = msg.playerId;
                    this.role = msg.role;
                    this.settings = msg.settings;
                    this.players = msg.players;
                    break;
                case 'player_joined':
                    this.players.push(msg.player);
                    break;
                case 'round_start':
                    this.gameStatus = 'playing';
                    this.currentRound = {
                        index: msg.roundIndex,
                        maskedWord: msg.maskedWord,
                        allowedLetters: msg.allowedLetters,
                        guessedLetters: [],
                        timeLimitSec: msg.timeLimitSec,
                        serverNowMs: msg.serverNowMs
                    };
                    this.mistakesByPlayer = {};
                    break;
                case 'round_update':
                    if (this.currentRound) {
                        this.currentRound.maskedWord = msg.maskedWord;
                        this.currentRound.guessedLetters = msg.guessedLetters;
                    }
                    this.mistakesByPlayer = msg.mistakesByPlayer;
                    break;
                case 'round_end':
                    this.gameStatus = 'round_ended';
                    // maybe show correct word
                    break;
                case 'game_end':
                    this.gameStatus = 'finished';
                    this.summary = msg.summary;
                    this.winner = msg.winner;
                    break;
            }
        }
    }
});
