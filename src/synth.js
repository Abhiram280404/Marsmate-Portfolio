// synth.js - Procedural Space Ambient Synthesizer using Web Audio API

class SpaceSynth {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.oscillators = [];
    this.lfo = null;
    this.noiseNode = null;
    this.isPlaying = false;
  }

  init() {
    // Create AudioContext (standard and webkit prefix)
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    
    this.ctx = new AudioContextClass();
    
    // Master Gain for smooth fade-in/fade-out
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
    
    // Setup drone voices
    this.createDroneVoice(55.0, 'triangle', 0.25); // A1 base drone
    this.createDroneVoice(55.4, 'sawtooth', 0.08); // Detuned voice for beating/warmth
    this.createDroneVoice(82.4, 'sine', 0.15);     // E2 perfect fifth
    this.createDroneVoice(110.0, 'sine', 0.05);    // A2 octave overtone
    
    // Setup deep space wind (Low-pass filtered white noise)
    this.createSpaceWind();
    
    // Setup Low-Frequency Filter Sweep (LFO)
    this.createFilterSweep();
    
    return true;
  }

  createDroneVoice(freq, type, gainVal) {
    if (!this.ctx) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    
    osc.connect(gain);
    // Connect to master gain through a filter (we'll query filters during LFO setup)
    gain.connect(this.masterGain);
    
    osc.start(0);
    this.oscillators.push(osc);
  }

  createSpaceWind() {
    if (!this.ctx) return;

    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    
    // Fill the buffer with white noise
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    
    // Bandpass filter to make it sound like wind
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(150, this.ctx.currentTime);
    filter.Q.setValueAtTime(1.0, this.ctx.currentTime);
    
    const windGain = this.ctx.createGain();
    windGain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    
    noiseSource.connect(filter);
    filter.connect(windGain);
    windGain.connect(this.masterGain);
    
    noiseSource.start(0);
    this.noiseNode = noiseSource;
  }

  createFilterSweep() {
    if (!this.ctx) return;
    
    // We construct a filter and insert it into the audio chain if we want,
    // or we can modulate a BiquadFilter targeting the master mix. Let's do that!
    const mainFilter = this.ctx.createBiquadFilter();
    mainFilter.type = 'lowpass';
    mainFilter.frequency.setValueAtTime(250, this.ctx.currentTime);
    mainFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);
    
    // Break original path and insert main filter
    this.masterGain.disconnect();
    this.masterGain.connect(mainFilter);
    mainFilter.connect(this.ctx.destination);
    
    // LFO to sweep filter frequency
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.05, this.ctx.currentTime); // 20 seconds sweep cycle
    
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(120, this.ctx.currentTime); // sweep bounds
    
    lfo.connect(lfoGain);
    lfoGain.connect(mainFilter.frequency); // Modulate the filter frequency
    
    lfo.start(0);
    this.lfo = lfo;
  }

  start() {
    if (!this.ctx) {
      const initialized = this.init();
      if (!initialized) return;
    }
    
    // Resume context if suspended (browser safety policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    // Smooth fade in
    this.masterGain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 2.0);
    this.isPlaying = true;
  }

  stop() {
    if (!this.ctx || !this.isPlaying) return;
    
    // Smooth fade out
    this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.0);
    this.isPlaying = false;
  }

  toggle() {
    if (this.isPlaying) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }
}

export const spaceSynth = new SpaceSynth();
