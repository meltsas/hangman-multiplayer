import { z } from 'zod';

export const GameSettingsSchema = z.object({
    language: z.enum(['en', 'et']),
    timeLimitSec: z.number().min(10).max(180),
    wordLengthMin: z.number().min(3),
    wordLengthMax: z.number().max(20),
    maxMistakes: z.number().min(1).max(15).default(8),
    roundsCount: z.number().min(1).max(20).default(5),
});

export type GameSettings = z.infer<typeof GameSettingsSchema>;

export interface Player {
    id: string;
    name: string;
    role: 'host' | 'guest';
}

export interface RoundResult {
    word: string;
    solved: boolean;
    mistakes: number;
    timeSpentMs: number;
}

export interface GameSummary {
    rounds: {
        word: string;
        players: Record<string, RoundResult>;
    }[];
    totals: Record<string, {
        totalMistakes: number;
        totalTimeMs: number;
        solvedCount: number;
    }>;
    winnerId: string | null;
}

// WebSocket Protocol
export type ClientMessage =
    | { type: 'client_hello'; roomId: string; session?: string }
    | { type: 'guess_letter'; roundIndex: number; letter: string }
    | { type: 'guess_word'; roundIndex: number; word: string }
    | { type: 'request_rematch' };

export type ServerMessage =
    | { type: 'server_welcome'; playerId: string; role: 'host' | 'guest'; settings: GameSettings; players: Player[] }
    | { type: 'player_joined'; player: Player }
    | { type: 'player_left'; playerId: string }
    | { type: 'round_start'; roundIndex: number; maskedWord: string; allowedLetters: string[]; timeLimitSec: number; serverNowMs: number }
    | { type: 'round_update'; roundIndex: number; maskedWord: string; guessedLetters: string[]; mistakesByPlayer: Record<string, number>; timeLeftSecByPlayer: Record<string, number>; opponentLastAction?: string }
    | { type: 'opponent_mistake'; roundIndex: number; guessType: 'letter' | 'word'; guessValue: string; mistakesTotal: number }
    | { type: 'round_end'; roundIndex: number; correctWord: string; solvedByPlayer: Record<string, boolean>; timeSpentMsByPlayer: Record<string, number>; mistakesThisRoundByPlayer: Record<string, number> }
    | { type: 'game_end'; summary: GameSummary; winner: string | null };
