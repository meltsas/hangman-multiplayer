import { GameSettings } from '@hangman/shared';

export interface WordData {
    en: string[];
    et: string[];
}

export function filterWords(words: string[], settings: GameSettings): string[] {
    const { language, wordLengthMin, wordLengthMax } = settings;
    const allowedChars = language === 'et'
        ? "abdefghijklmnoprsšzžtuvõäöü".split("")
        : "abcdefghijklmnopqrstuvwxyz".split("");

    const charSet = new Set(allowedChars);

    return words
        .map(w => w.trim().toLowerCase())
        .filter(w => {
            if (w.length < wordLengthMin || w.length > wordLengthMax) return false;
            return [...w].every(char => charSet.has(char));
        });
}

export function selectRandomWords(filteredWords: string[], count: number): string[] {
    const shuffled = [...filteredWords].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}
