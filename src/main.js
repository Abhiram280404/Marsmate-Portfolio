// main.js - Coordinator entrypoint for Marsmate BI portfolio site

import { threeScene } from './threeScene.js';
import { interactions } from './interactions.js';
import { spaceSynth } from './synth.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize 3D graphics (Starfield, Mars shader globe, network graph nodes)
  // Ensure DOM is parsed before targeting elements
  threeScene.init('bg-canvas-container', 'about-canvas-target');

  // 2. Initialize layout animations & micro-interactions (GSAP reveals, card tilt, filters, forms)
  interactions.init();

  // 3. Audio Ambient Synth Toggle
  const soundToggleBtn = document.getElementById('sound-toggle');
  if (soundToggleBtn) {
    const soundOffIcon = soundToggleBtn.querySelector('.sound-off-icon');
    const soundOnIcon = soundToggleBtn.querySelector('.sound-on-icon');

    soundToggleBtn.addEventListener('click', () => {
      const isPlaying = spaceSynth.toggle();
      
      if (isPlaying) {
        // Audio turned ON
        soundOffIcon.style.display = 'none';
        soundOnIcon.style.display = 'block';
        soundToggleBtn.classList.add('playing');
        soundToggleBtn.title = 'Mute Soundtrack';
      } else {
        // Audio turned OFF
        soundOffIcon.style.display = 'block';
        soundOnIcon.style.display = 'none';
        soundToggleBtn.classList.remove('playing');
        soundToggleBtn.title = 'Play Soundtrack';
      }
    });
  }
});
