// ═══════════════════════════════════════════════════════════════
// src/systems/audioSystem.js
// Sistema de áudio usando Web Audio API para efeitos e música.
//
// Sons procedurais embutidos (não dependem de arquivos externos).
// O usuário pode substituir qualquer som via upload de MP3/WAV/OGG
// na aba "Som" do menu de Opções.
//
// ─── ONDE INSERIR ÁUDIOS PADRÃO ────────────────────────────────
//
// Se quiser usar arquivos de áudio reais em vez dos sons procedurais,
// substitua 'null' pelos caminhos dos seus arquivos nas constantes
// DEFAULT_AUDIO_FILES logo abaixo. Exemplo:
//
//   playerShoot:     'assets/audio/shoot.mp3',
//   enemyShoot:      'assets/audio/enemy_shoot.mp3',
//   explosion:       'assets/audio/explosion.mp3',
//   damage:          'assets/audio/damage.mp3',
//   gameOver:        'assets/audio/game_over.mp3',
//   backgroundMusic: 'assets/audio/music.mp3',
//
// Com null, o sistema usa a síntese procedural (Web Audio API).
// ═══════════════════════════════════════════════════════════════
"use strict";

// ─── PONTO DE INSERÇÃO DE ÁUDIOS PADRÃO ──────────────────────
// Substitua null pelo caminho do arquivo desejado.
// Se deixar null, o som procedural correspondente será usado.
const DEFAULT_AUDIO_FILES = {
  playerShoot:     null,   // ← insira 'assets/audio/shoot.mp3' aqui
  enemyShoot:      null,   // ← insira 'assets/audio/enemy_shoot.mp3' aqui
  explosion:       null,   // ← insira 'assets/audio/explosion.mp3' aqui
  damage:          null,   // ← insira 'assets/audio/damage.mp3' aqui
  gameOver:        null,   // ← insira 'assets/audio/game_over.mp3' aqui
  backgroundMusic: null    // ← insira 'assets/audio/music.mp3' aqui
};

const AudioSystem = (() => {
  let audioContext  = null;
  let masterGain    = null;
  let musicGain     = null;
  let sfxGain       = null;
  let backgroundMusic = null;
  let musicLoopInterval = null;
  let isInitialized = false;
  let settings      = { ...DEFAULT_SETTINGS };

  // Sons personalizados (upload do usuário sobrepõe DEFAULT_AUDIO_FILES)
  let customSounds = { ...DEFAULT_AUDIO_FILES };

  // ─────────────────────────────────────────────────────────────
  // INICIALIZAÇÃO
  // ─────────────────────────────────────────────────────────────
  function init() {
    if (isInitialized) return;
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      masterGain   = audioContext.createGain();
      musicGain    = audioContext.createGain();
      sfxGain      = audioContext.createGain();

      musicGain.connect(masterGain);
      sfxGain.connect(masterGain);
      masterGain.connect(audioContext.destination);

      isInitialized = true;
      updateVolume();
    } catch (e) {
      console.warn('Web Audio API não disponível:', e);
    }
  }

  // Garante que o AudioContext seja retomado após gesto do usuário
  // (política de autoplay dos navegadores modernos)
  function ensureResumed() {
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
  }

  function updateVolume() {
    if (!isInitialized) return;
    masterGain.gain.value = settings.masterVolume ?? 0.7;
    musicGain.gain.value  = (settings.musicEnabled !== false) ? (settings.musicVolume ?? 0.5) : 0;
    sfxGain.gain.value    = (settings.sfxEnabled   !== false) ? (settings.sfxVolume   ?? 0.8) : 0;
  }

  // ─────────────────────────────────────────────────────────────
  // HELPERS DE REPRODUÇÃO
  // ─────────────────────────────────────────────────────────────

  /** Toca um arquivo de áudio (URL ou data-URL) com volume combinado */
  function playAudioFile(url) {
    const audio = new Audio(url);
    audio.volume = Math.min(1, (settings.sfxVolume ?? 0.8) * (settings.masterVolume ?? 0.7));
    audio.play().catch(() => {});
    return audio;
  }

  /** Cria oscilador simples e o conecta ao sfxGain */
  function createOsc(freq, endFreq, duration, gainValue) {
    if (!isInitialized) return;
    ensureResumed();
    const osc  = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(sfxGain);
    osc.frequency.value = freq;
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, audioContext.currentTime + duration);
    gain.gain.value = gainValue;
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    osc.start();
    osc.stop(audioContext.currentTime + duration);
  }

  // ─────────────────────────────────────────────────────────────
  // EFEITOS SONOROS
  // ─────────────────────────────────────────────────────────────

  /** Tiro do jogador: laser agudo descendente */
  function playPlayerShoot() {
    if (settings.sfxEnabled === false) return;
    // ← Se DEFAULT_AUDIO_FILES.playerShoot tiver um arquivo, será usado aqui
    if (customSounds.playerShoot) { playAudioFile(customSounds.playerShoot); return; }
    if (!isInitialized) return;
    createOsc(880, 440, 0.18, 0.3);
  }

  /** Tiro do inimigo: laser grave */
  function playEnemyShoot() {
    if (settings.sfxEnabled === false) return;
    // ← Se DEFAULT_AUDIO_FILES.enemyShoot tiver um arquivo, será usado aqui
    if (customSounds.enemyShoot) { playAudioFile(customSounds.enemyShoot); return; }
    if (!isInitialized) return;
    createOsc(330, 220, 0.22, 0.22);
  }

  /** Explosão: ruído branco amortecido */
  function playExplosion() {
    if (settings.sfxEnabled === false) return;
    // ← Se DEFAULT_AUDIO_FILES.explosion tiver um arquivo, será usado aqui
    if (customSounds.explosion) { playAudioFile(customSounds.explosion); return; }
    if (!isInitialized) return;
    ensureResumed();

    const bufferSize = 4096;
    const buffer     = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data       = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
    }

    const noise = audioContext.createBufferSource();
    const gain  = audioContext.createGain();
    noise.buffer = buffer;
    noise.connect(gain);
    gain.connect(sfxGain);
    gain.gain.value = 0.4;
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
    noise.start();
    noise.stop(audioContext.currentTime + 0.5);
  }

  /** Dano: impacto grave curto */
  function playDamage() {
    if (settings.sfxEnabled === false) return;
    // ← Se DEFAULT_AUDIO_FILES.damage tiver um arquivo, será usado aqui
    if (customSounds.damage) { playAudioFile(customSounds.damage); return; }
    if (!isInitialized) return;
    createOsc(150, null, 0.3, 0.5);
  }

  /** Game Over: sequência descendente */
  function playGameOver() {
    if (settings.sfxEnabled === false) return;
    // ← Se DEFAULT_AUDIO_FILES.gameOver tiver um arquivo, será usado aqui
    if (customSounds.gameOver) { playAudioFile(customSounds.gameOver); return; }
    if (!isInitialized) return;
    ensureResumed();

    const freqs = [440, 330, 220, 165];
    freqs.forEach((freq, i) => {
      const osc  = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(sfxGain);
      osc.frequency.value = freq;
      gain.gain.value = 0.3;
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.45 + i * 0.2);
      osc.start(audioContext.currentTime + i * 0.2);
      osc.stop (audioContext.currentTime + 0.45 + i * 0.2);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // MÚSICA DE FUNDO
  // ─────────────────────────────────────────────────────────────

  function startBackgroundMusic() {
    if (settings.musicEnabled === false) return;

    // ← Se DEFAULT_AUDIO_FILES.backgroundMusic tiver um arquivo, será usado aqui
    if (customSounds.backgroundMusic) {
      stopBackgroundMusic();
      backgroundMusic = new Audio(customSounds.backgroundMusic);
      backgroundMusic.loop   = true;
      backgroundMusic.volume = Math.min(1, (settings.musicVolume ?? 0.5) * (settings.masterVolume ?? 0.7));
      backgroundMusic.play().catch(() => {});
      return;
    }

    if (!isInitialized) return;
    stopBackgroundMusic();
    ensureResumed();

    function playNote(freq, duration, time) {
      const osc  = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(musicGain);
      osc.frequency.value = freq;
      gain.gain.value = 0.12;
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      osc.start(time);
      osc.stop (time + duration);
    }

    const melody = [
      [262, 0.3], [294, 0.3], [330, 0.3], [349, 0.3],
      [392, 0.3], [349, 0.3], [330, 0.3], [294, 0.3],
      [262, 0.6]
    ];

    function playMelody() {
      if (!isInitialized) return;
      let t = audioContext.currentTime;
      melody.forEach(([freq, dur]) => { playNote(freq, dur, t); t += dur; });
    }

    playMelody();
    musicLoopInterval = setInterval(() => {
      if (settings.musicEnabled === false || GameState.get() !== STATE_RUNNING) {
        clearInterval(musicLoopInterval);
        musicLoopInterval = null;
        return;
      }
      playMelody();
    }, 3000);
  }

  function stopBackgroundMusic() {
    if (backgroundMusic) {
      backgroundMusic.pause();
      backgroundMusic = null;
    }
    if (musicLoopInterval) {
      clearInterval(musicLoopInterval);
      musicLoopInterval = null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // UPLOAD DE SOM PERSONALIZADO
  // ─────────────────────────────────────────────────────────────
  function loadCustomSound(soundName, file) {
    return new Promise((resolve, reject) => {
      if (!file) { resolve(null); return; }

      const reader  = new FileReader();
      reader.onload = (e) => {
        const url  = e.target.result;
        customSounds[soundName] = url;

        const test = new Audio(url);
        test.addEventListener('canplaythrough', () => resolve(url),  { once: true });
        test.addEventListener('error',          () => reject(new Error(`Erro ao carregar ${soundName}`)), { once: true });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // CONFIGURAÇÕES
  // ─────────────────────────────────────────────────────────────
  function updateSettings(newSettings) {
    settings = { ...settings, ...newSettings };
    updateVolume();

    if (settings.musicEnabled === false) {
      stopBackgroundMusic();
    } else if (GameState && GameState.get() === STATE_RUNNING) {
      startBackgroundMusic();
    }
  }

  function getSettings()    { return { ...settings };      }
  function getCustomSounds(){ return { ...customSounds };  }

  // Inicializa ao primeiro gesto do usuário (exigência dos navegadores)
  document.addEventListener('click', () => { if (!isInitialized) init(); }, { once: true });

  return {
    init,
    playPlayerShoot,
    playEnemyShoot,
    playExplosion,
    playDamage,
    playGameOver,
    startBackgroundMusic,
    stopBackgroundMusic,
    loadCustomSound,
    updateSettings,
    getSettings,
    getCustomSounds,
    updateVolume
  };
})();