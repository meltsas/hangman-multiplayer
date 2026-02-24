<template>
  <div class="container flex-center">
    <div class="card animate-fade-in text-center">
      <h1 class="title">Hangman Realtime</h1>
      <p class="subtitle">Solo play or challenge your friends in real-time!</p>

      <div class="actions">
        <div class="cta-group">
          <button @click="playSingle" class="primary big">
            <span class="icon">👤</span>
            Play Single-player
          </button>
          <p class="hint">No login required</p>
        </div>

        <div class="divider">
          <span>OR</span>
        </div>

        <div class="cta-group">
          <button @click="createMulti" class="secondary big">
            <span class="icon">👥</span>
            Create Multiplayer
          </button>
          <p class="hint">Requires Google Login</p>
        </div>

        <div class="join-section card mt-2">
          <h3>Join Game</h3>
          <div class="join-input">
            <input v-model="roomId" placeholder="Enter Room ID" />
            <button @click="joinGame" class="primary" :disabled="!roomId">Join</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const roomId = ref('');

const playSingle = async () => {
  // Call backend to create a single player room
  const res = await fetch('/api/games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: 'en',
      timeLimitSec: 60,
      wordLengthMin: 5,
      wordLengthMax: 10,
      roundsCount: 5
    })
  });
  const data = await res.json();
  router.push(`/game/${data.roomId}`);
};

const createMulti = () => {
  // Logic for Google login and then creation
  // For now simple placeholder
  playSingle(); // Placeholder
};

const joinGame = () => {
  if (roomId.value) {
    router.push(`/game/${roomId.value}`);
  }
};
</script>

<style scoped>
.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
}

.text-center {
  text-align: center;
}

.title {
  font-size: 3rem;
  font-weight: 800;
  margin-bottom: 0.5rem;
  background: linear-gradient(to right, #818cf8, #c084fc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  color: var(--text-muted);
  font-size: 1.125rem;
  margin-bottom: 3rem;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 400px;
  margin: 0 auto;
}

.cta-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

button.big {
  padding: 1.25rem;
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.hint {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.divider {
  display: flex;
  align-items: center;
  gap: 1rem;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.divider::before, .divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background-color: #334155;
}

.join-section {
  padding: 1.25rem;
  background-color: rgba(255, 255, 255, 0.02);
}

.join-section h3 {
  margin-bottom: 1rem;
  font-size: 1rem;
}

.join-input {
  display: flex;
  gap: 0.5rem;
}

.join-input input {
  flex: 1;
}

.mt-2 {
  margin-top: 2rem;
}
</style>
