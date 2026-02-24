<template>
  <div class="container">
    <div v-if="gameStore.gameStatus === 'waiting'" class="card text-center">
      <h2>Waiting for game to start...</h2>
      <p v-if="gameStore.players.length < 2 && gameStore.role === 'host'">
        Share this ID to invite friends: <strong>{{ id }}</strong>
      </p>
    </div>

    <div v-else-if="gameStore.gameStatus === 'playing' || gameStore.gameStatus === 'round_ended'" class="game-layout">
      <!-- Main Game Area -->
      <div class="main-area card">
        <div class="header">
          <div class="round-info">Round {{ (gameStore.currentRound?.index || 0) + 1 }}</div>
          <div class="timer" :class="{ 'warning': gameTimeLeft < 10 }">
            {{ gameTimeLeft }}s
          </div>
        </div>

        <div class="hangman-display">
          <pre class="ascii-art">{{ asciiHangman }}</pre>
        </div>

        <div class="word-display">
          <span v-for="(char, i) in gameStore.currentRound?.maskedWord" :key="i" class="char">
            {{ char === '_' ? '' : char }}
          </span>
        </div>

        <div class="keyboard">
          <button 
            v-for="char in gameStore.currentRound?.allowedLetters" 
            :key="char"
            @click="guess(char)"
            :disabled="gameStore.currentRound?.guessedLetters.includes(char) || gameStore.gameStatus === 'round_ended'"
            :class="{ 'used': gameStore.currentRound?.guessedLetters.includes(char) }"
          >
            {{ char.toUpperCase() }}
          </button>
        </div>
      </div>

      <!-- Sidebar Area (Opponents / Feed) -->
      <div class="sidebar">
        <div class="card players-card">
          <h3>Players</h3>
          <div v-for="player in gameStore.players" :key="player.id" class="player-row">
            <span class="player-name">{{ player.name }} <small v-if="player.id === gameStore.playerId">(You)</small></span>
            <span class="mistakes">Mismatches: {{ gameStore.mistakesByPlayer[player.id] || 0 }} / {{ gameStore.settings?.maxMistakes }}</span>
          </div>
        </div>

        <div v-if="gameStore.players.length > 1" class="card feed-card">
          <h3>Live Feed</h3>
          <div class="feed-items">
             <!-- Realtime feed of opponent mistakes -->
          </div>
        </div>
      </div>
    </div>

    <!-- Summary screen -->
    <div v-else-if="gameStore.gameStatus === 'finished'" class="card summary-card">
       <h2>Game Over!</h2>
       <div v-if="gameStore.winner === gameStore.playerId" class="winner-announcement">
         🏆 You Won!
       </div>
       <!-- ... table of rounds ... -->
       <button @click="router.push('/')" class="primary mt-2">Back Home</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, ref, onUnmounted } from 'vue';
import { useGameStore } from '../stores/game';
import { useRouter } from 'vue-router';

const props = defineProps<{ id: string }>();
const gameStore = useGameStore();
const router = useRouter();
const timerInterval = ref<any>(null);

onMounted(() => {
  const wsUrl = `ws://${window.location.host}/ws/rooms/${props.id}`;
  gameStore.connect(wsUrl);
});

onUnmounted(() => {
  if (timerInterval.value) clearInterval(timerInterval.value);
});

const gameTimeLeft = computed(() => {
  if (!gameStore.currentRound) return 0;
  // Simplified countdown - server is authority anyway
  return Math.max(0, gameStore.currentRound.timeLimitSec);
});

const guess = (letter: string) => {
  if (gameStore.currentRound) {
    gameStore.send({ 
      type: 'guess_letter', 
      roundIndex: gameStore.currentRound.index, 
      letter 
    });
  }
};

const asciiHangman = computed(() => {
  const mistakes = gameStore.mistakesByPlayer[gameStore.playerId!] || 0;
  const stages = [
    "  +---+\n      |\n      |\n      |\n      |\n      |\n=========",
    "  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========",
    "  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========",
    "  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========",
    "  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========",
    "  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========",
    "  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========",
    "  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n========="
  ];
  return stages[Math.min(mistakes, stages.length - 1)];
});
</script>

<style scoped>
.game-layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 1.5rem;
  margin-top: 2rem;
}

.main-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
}

.header {
  display: flex;
  justify-content: space-between;
  width: 100%;
  font-weight: 700;
}

.timer {
  color: var(--success);
  font-family: monospace;
  font-size: 1.5rem;
}

.timer.warning {
  color: var(--danger);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.ascii-art {
  font-family: monospace;
  font-size: 1.25rem;
  line-height: 1.2;
  color: var(--text-muted);
}

.word-display {
  display: flex;
  gap: 0.5rem;
}

.char {
  width: 3rem;
  height: 3.5rem;
  border-bottom: 3px solid var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 800;
  text-transform: uppercase;
}

.keyboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(40px, 1fr));
  gap: 0.5rem;
  width: 100%;
}

.keyboard button {
  padding: 0.75rem 0.25rem;
  background-color: var(--surface);
  border: 1px solid #334155;
  color: var(--text);
  font-weight: 700;
}

.keyboard button:hover:not(:disabled) {
  background-color: #334155;
}

.keyboard button.used {
  opacity: 0.3;
  cursor: not-allowed;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.player-row {
  display: flex;
  flex-direction: column;
  padding: 0.75rem 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.player-name {
  font-weight: 700;
}

.mistakes {
  font-size: 0.825rem;
  color: var(--text-muted);
}

.winner-announcement {
  font-size: 2rem;
  margin: 2rem 0;
  color: var(--warning);
}
</style>
