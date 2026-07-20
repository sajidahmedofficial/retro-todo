// Web Audio API Synthesizer for Retro Skeuomorphic Planner
import { getSettings } from './state.js';

let audioCtx = null;
let noiseBuffer = null;

function initAudio() {
  if (audioCtx) return;
  
  // Create AudioContext, supporting prefix
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioContext();
  
  // Create a 2-second white noise buffer for scratch and crumble sounds
  const bufferSize = audioCtx.sampleRate * 2;
  noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
}

// Helper to get master gain node or settings
function createSoundChain(duration) {
  initAudio();
  
  // Resume context if suspended (autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  const settings = getSettings();
  if (settings.muted) return null;
  
  const oscVolume = settings.volume !== undefined ? settings.volume : 0.5;
  
  const masterGain = audioCtx.createGain();
  masterGain.gain.setValueAtTime(oscVolume, audioCtx.currentTime);
  masterGain.connect(audioCtx.destination);
  
  return masterGain;
}

// 1. Page Flip Sound (Soft sliding paper rustle)
export function playPageFlip() {
  const dest = createSoundChain();
  if (!dest) return;
  
  const now = audioCtx.currentTime;
  const duration = 0.35;
  
  // Create a noise source
  const noise = audioCtx.createBufferSource();
  noise.buffer = noiseBuffer;
  
  // Filter for paper sliding texture
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.setValueAtTime(2.0, now);
  // Sweep frequency down to simulate page moving
  filter.frequency.setValueAtTime(1200, now);
  filter.frequency.exponentialRampToValueAtTime(300, now + duration);
  
  // Gain envelope
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.2, now + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  
  noise.start(now);
  noise.stop(now + duration);
}

// 2. Pencil Scribble Sound (Writing single quick line)
export function playScribble() {
  const dest = createSoundChain();
  if (!dest) return;
  
  const now = audioCtx.currentTime;
  const duration = 0.15;
  
  const noise = audioCtx.createBufferSource();
  noise.buffer = noiseBuffer;
  
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(2500, now);
  filter.frequency.linearRampToValueAtTime(1800, now + duration);
  
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.08, now + 0.03);
  gain.gain.linearRampToValueAtTime(0.04, now + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  
  noise.start(now);
  noise.stop(now + duration);
}

// 3. Checkmark Scribble & Bell Sound (Quick scribble + satisfying metallic ding)
export function playCheck() {
  const dest = createSoundChain();
  if (!dest) return;
  
  const now = audioCtx.currentTime;
  
  // PART A: Double scribble
  const scribbleDuration = 0.25;
  const noise = audioCtx.createBufferSource();
  noise.buffer = noiseBuffer;
  
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.setValueAtTime(3.0, now);
  filter.frequency.setValueAtTime(2000, now);
  filter.frequency.linearRampToValueAtTime(3500, now + 0.1);
  filter.frequency.linearRampToValueAtTime(2000, now + scribbleDuration);
  
  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.001, now);
  noiseGain.gain.linearRampToValueAtTime(0.06, now + 0.05);
  noiseGain.gain.linearRampToValueAtTime(0.01, now + 0.12);
  noiseGain.gain.linearRampToValueAtTime(0.05, now + 0.18);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + scribbleDuration);
  
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(dest);
  
  noise.start(now);
  noise.stop(now + scribbleDuration);
  
  // PART B: Metallic chime "Ding" (slightly delayed, starting mid-scribble)
  const chimeDelay = 0.12;
  const chimeTime = now + chimeDelay;
  
  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  
  // Bell frequencies: fundamental + high inharmonic overtone
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(880, chimeTime); // A5
  
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(2210, chimeTime); // high metallic ring
  
  const chimeGain = audioCtx.createGain();
  chimeGain.gain.setValueAtTime(0.001, chimeTime);
  chimeGain.gain.linearRampToValueAtTime(0.15, chimeTime + 0.02);
  chimeGain.gain.exponentialRampToValueAtTime(0.001, chimeTime + 0.6);
  
  osc1.connect(chimeGain);
  osc2.connect(chimeGain);
  chimeGain.connect(dest);
  
  osc1.start(chimeTime);
  osc2.start(chimeTime);
  
  osc1.stop(chimeTime + 0.6);
  osc2.stop(chimeTime + 0.6);
}

// 4. Paper Crumple (Delete Task)
export function playCrumple() {
  const dest = createSoundChain();
  if (!dest) return;
  
  const now = audioCtx.currentTime;
  const duration = 0.55;
  
  // Create paper crunching by triggering short bursts of filtered noise
  for (let i = 0; i < 7; i++) {
    const burstStart = now + i * 0.07 + Math.random() * 0.02;
    const burstDuration = 0.08 + Math.random() * 0.06;
    
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000 + Math.random() * 3000, burstStart);
    filter.Q.setValueAtTime(1.5, burstStart);
    
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.001, burstStart);
    gain.gain.linearRampToValueAtTime(0.08 + Math.random() * 0.06, burstStart + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, burstStart + burstDuration);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    
    noise.start(burstStart);
    noise.stop(burstStart + burstDuration);
  }
}

// 5. Ink Stamp Sound (Heavy dull impact + wet squish)
export function playStamp() {
  const dest = createSoundChain();
  if (!dest) return;
  
  const now = audioCtx.currentTime;
  
  // Heavy low thud
  const thud = audioCtx.createOscillator();
  thud.type = 'triangle';
  thud.frequency.setValueAtTime(120, now);
  thud.frequency.exponentialRampToValueAtTime(45, now + 0.15);
  
  const thudGain = audioCtx.createGain();
  thudGain.gain.setValueAtTime(0.2, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  
  thud.connect(thudGain);
  thudGain.connect(dest);
  
  thud.start(now);
  thud.stop(now + 0.15);
  
  // Small wet ink stamp suction
  const noise = audioCtx.createBufferSource();
  noise.buffer = noiseBuffer;
  
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(300, now);
  filter.frequency.exponentialRampToValueAtTime(1200, now + 0.12);
  filter.Q.setValueAtTime(2.0, now);
  
  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.03, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(dest);
  
  noise.start(now);
  noise.stop(now + 0.12);
}

// 6. Alarm Clock Bell ringing state
let alarmInterval = null;
let alarmOscs = [];
let alarmGains = [];

export function startAlarm() {
  const dest = createSoundChain();
  if (!dest) return;
  
  // Prevent duplicate alarm schedules
  if (alarmInterval) return;
  
  initAudio();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  const playBellStroke = () => {
    const settings = getSettings();
    if (settings.muted) return;
    
    const now = audioCtx.currentTime;
    const strokeDur = 0.18;
    
    // Create twin bell bells: 1200Hz and 1220Hz (creates beating effect)
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1150, now);
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1175, now);
    
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.12 * settings.volume, now + 0.01);
    
    // Fast ringing flutter modulation (16Hz)
    const tremolo = audioCtx.createGain();
    tremolo.gain.setValueAtTime(0.8, now);
    
    osc1.connect(tremolo);
    osc2.connect(tremolo);
    tremolo.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc1.start(now);
    osc2.start(now);
    
    // Ramp out
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + strokeDur);
    
    osc1.stop(now + strokeDur);
    osc2.stop(now + strokeDur);
  };
  
  // Ring the bells rapidly (every 220ms)
  alarmInterval = setInterval(playBellStroke, 220);
}

export function stopAlarm() {
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }
}

// 7. Typewriter Key click (Satisfying mechanical strike)
export function playTypewriterKey() {
  const dest = createSoundChain();
  if (!dest) return;

  const now = audioCtx.currentTime;
  
  // Randomize key click slightly to make typing feel organic
  const pitchOffset = Math.random() * 40 - 20; 
  const duration = 0.03 + Math.random() * 0.02;

  // PART A: Key contact metal strike (highpass noise)
  const noiseSource = audioCtx.createBufferSource();
  noiseSource.buffer = noiseBuffer;

  const noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = 'highpass';
  noiseFilter.frequency.setValueAtTime(3000 + pitchOffset * 10, now);

  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.001, now);
  noiseGain.gain.linearRampToValueAtTime(0.08, now + 0.002);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(dest);

  noiseSource.start(now);
  noiseSource.stop(now + duration);

  // PART B: Mechanical wooden/metal typewriter body thud (Triangle pitch sweep)
  const thudOsc = audioCtx.createOscillator();
  thudOsc.type = 'triangle';
  thudOsc.frequency.setValueAtTime(180 + pitchOffset, now);
  thudOsc.frequency.exponentialRampToValueAtTime(80, now + 0.04);

  const thudGain = audioCtx.createGain();
  thudGain.gain.setValueAtTime(0.12, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

  thudOsc.connect(thudGain);
  thudGain.connect(dest);

  thudOsc.start(now);
  thudOsc.stop(now + 0.045);
}

// 8. Typewriter Carriage Return Bell (Satisfying high-pitched chime)
export function playTypewriterBell() {
  const dest = createSoundChain();
  if (!dest) return;

  const now = audioCtx.currentTime;
  const chimeDuration = 0.5;

  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();

  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(1568, now); // G6 note
  
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(2352, now); // high overtone

  const chimeGain = audioCtx.createGain();
  chimeGain.gain.setValueAtTime(0.001, now);
  chimeGain.gain.linearRampToValueAtTime(0.12, now + 0.015);
  chimeGain.gain.exponentialRampToValueAtTime(0.001, now + chimeDuration);

  osc1.connect(chimeGain);
  osc2.connect(chimeGain);
  chimeGain.connect(dest);

  osc1.start(now);
  osc2.start(now);

  osc1.stop(now + chimeDuration);
  osc2.stop(now + chimeDuration);
}

