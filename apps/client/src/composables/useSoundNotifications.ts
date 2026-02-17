import { ref, watch, type Ref } from 'vue';
import type { HookEvent } from '../types';

export function useSoundNotifications(events: Ref<HookEvent[]>) {
  const isMuted = ref(true); // Muted by default
  let audioCtx: AudioContext | null = null;

  const getAudioContext = (): AudioContext => {
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
    return audioCtx;
  };

  const playTone = (frequency: number, duration: number, type: OscillatorType = 'sine', ramp?: number) => {
    if (isMuted.value) return;
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      if (ramp) {
        osc.frequency.linearRampToValueAtTime(ramp, ctx.currentTime + duration);
      }

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio API not available or blocked
    }
  };

  // Ascending chime for SubagentStart
  const playSubagentStart = () => {
    playTone(523, 0.12, 'sine'); // C5
    setTimeout(() => playTone(659, 0.12, 'sine'), 80); // E5
    setTimeout(() => playTone(784, 0.15, 'sine'), 160); // G5
  };

  // Alert tone for HITL pending
  const playHITLAlert = () => {
    playTone(880, 0.15, 'triangle'); // A5
    setTimeout(() => playTone(880, 0.15, 'triangle'), 200);
    setTimeout(() => playTone(1047, 0.25, 'triangle'), 400); // C6
  };

  // Success chime for SessionEnd/Stop
  const playSessionEnd = () => {
    playTone(784, 0.1, 'sine'); // G5
    setTimeout(() => playTone(988, 0.1, 'sine'), 100); // B5
    setTimeout(() => playTone(1175, 0.2, 'sine'), 200); // D6
  };

  const toggleMute = () => {
    isMuted.value = !isMuted.value;
    // Resume audio context on unmute (browser requires user gesture)
    if (!isMuted.value && audioCtx?.state === 'suspended') {
      audioCtx.resume();
    }
  };

  // Watch for new events and play appropriate sounds
  watch(events, (evts) => {
    if (evts.length === 0 || isMuted.value) return;
    const latest = evts[evts.length - 1];

    if (latest.humanInTheLoop) {
      playHITLAlert();
    } else if (latest.hook_event_type === 'SubagentStart') {
      playSubagentStart();
    } else if (latest.hook_event_type === 'SessionEnd' || latest.hook_event_type === 'Stop') {
      playSessionEnd();
    }
  }, { deep: false });

  return {
    isMuted,
    toggleMute,
  };
}
