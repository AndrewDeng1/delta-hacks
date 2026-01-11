/**
 * Audio feedback utilities using Web Audio API
 * Generates simple, pleasant audio signals for user feedback
 */

let audioContext: AudioContext | null = null;

// Initialize audio context (lazy initialization)
function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Play a sound for rep completion
 * Simple, quick "tick" sound
 */
export function playRepSound() {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Quick, high-pitched beep
    oscillator.frequency.value = 800; // 800 Hz
    oscillator.type = 'sine';

    // Quick fade out
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
  } catch (error) {
    console.error('Failed to play rep sound:', error);
  }
}

/**
 * Play a sound for reward/contribution earned
 * Pleasant, ascending "success" chime
 */
export function playRewardSound() {
  try {
    const ctx = getAudioContext();

    // Play two notes in quick succession for a "chime" effect
    const notes = [
      { freq: 523.25, time: 0 },      // C5
      { freq: 659.25, time: 0.08 },   // E5
    ];

    notes.forEach(({ freq, time }) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = freq;
      oscillator.type = 'sine';

      const startTime = ctx.currentTime + time;
      gainNode.gain.setValueAtTime(0.25, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

      oscillator.start(startTime);
      oscillator.stop(startTime + 0.15);
    });
  } catch (error) {
    console.error('Failed to play reward sound:', error);
  }
}

/**
 * Play a sound for session start
 * Energetic, motivational tone
 */
export function playSessionStartSound() {
  try {
    const ctx = getAudioContext();

    // Ascending three-note fanfare
    const notes = [
      { freq: 392.00, time: 0 },      // G4
      { freq: 523.25, time: 0.1 },    // C5
      { freq: 659.25, time: 0.2 },    // E5
    ];

    notes.forEach(({ freq, time }) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = freq;
      oscillator.type = 'sine';

      const startTime = ctx.currentTime + time;
      gainNode.gain.setValueAtTime(0.2, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

      oscillator.start(startTime);
      oscillator.stop(startTime + 0.2);
    });
  } catch (error) {
    console.error('Failed to play session start sound:', error);
  }
}
