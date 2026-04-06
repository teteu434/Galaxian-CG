// ═══════════════════════════════════════════════════════════════
// src/core/game.js
// Loop principal do jogo - VERSÃO CORRIGIDA
//
// CORREÇÕES APLICADAS:
//   - Cooldown de dano (invencibilidade temporária) → 3 vidas reais
//   - Troca de abas usa HUD.setTab() em vez de atribuir HUD.optionsTab
//   - HUD.setNewRecord() chamado ao salvar high score
//   - High score persiste corretamente no localStorage
//   - damageCooldown zerado no resetAll()
// ═══════════════════════════════════════════════════════════════
"use strict";

const Game = (() => {
  let lastTime  = 0;
  let kills     = 0;
  let rafId     = 0;
  let lives     = 3;

  // ─── High Score ───────────────────────────────────────────────
  // Carregado do localStorage na inicialização.
  // Salvo sempre que um novo recorde é batido.
  let highScore = parseInt(localStorage.getItem('galaxian_highscore') || '0');

  // ─── Cooldown de dano (invencibilidade temporária) ────────────
  // Sem esse cooldown, múltiplos projéteis consecutivos drenam as
  // 3 vidas em milissegundos, dando a impressão de 1 vida só.
  let damageCooldown = 0;
  const DAMAGE_COOLDOWN = 1.8; // segundos de invencibilidade após levar dano

  let hasShownTutorial = localStorage.getItem(TUTORIAL_COMPLETED_KEY) === 'true';

  let mouseX = CANVAS_W / 2;
  let mouseY = CANVAS_H / 2;

  let remappingAction = null;

  const PLAYER_MIN_X = 0;
  const PLAYER_MAX_X = CANVAS_W - PLAYER_W;

  // ─────────────────────────────────────────────────────────────
  // RESET COMPLETO
  // ─────────────────────────────────────────────────────────────
  function resetAll() {
    kills          = 0;
    lives          = 3;
    damageCooldown = 0;      // ← zerar cooldown ao reiniciar
    Player.reset();
    Bullet.reset();
    ShootingSystem.reset();
    EnemySystem.reset();
    HUD.setLives(lives);
    HUD.setHighScore(highScore);
    HUD.setNewRecord(false);  // ← limpar flag de recorde
    AudioSystem.stopBackgroundMusic();
  }

  // ─────────────────────────────────────────────────────────────
  // INICIAR JOGO
  // ─────────────────────────────────────────────────────────────
  function startGame() {
    resetAll();
    GameState.set(STATE_RUNNING);
    AudioSystem.startBackgroundMusic();

    if (!hasShownTutorial) {
      hasShownTutorial = true;
      localStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SALVAR HIGH SCORE (helper interno)
  // ─────────────────────────────────────────────────────────────
  function checkAndSaveHighScore(finalScore) {
    if (finalScore > highScore) {
      highScore = finalScore;
      localStorage.setItem('galaxian_highscore', highScore); // persistência
      HUD.setHighScore(highScore);
      HUD.setNewRecord(true);   // ← informa o HUD que é um novo recorde
      return true;
    }
    return false;
  }

  // ─────────────────────────────────────────────────────────────
  // GAME OVER
  // ─────────────────────────────────────────────────────────────
  function gameOver() {
    GameState.set(STATE_GAMEOVER);
    AudioSystem.stopBackgroundMusic();
    AudioSystem.playGameOver();
    checkAndSaveHighScore(kills * 100);
  }

  // ─────────────────────────────────────────────────────────────
  // VITÓRIA
  // ─────────────────────────────────────────────────────────────
  function winGame() {
    GameState.set(STATE_WIN);
    AudioSystem.stopBackgroundMusic();
    checkAndSaveHighScore(kills * 100);
  }

  // ─────────────────────────────────────────────────────────────
  // VOLTAR AO MENU
  // ─────────────────────────────────────────────────────────────
  function goToMenu() {
    resetAll();
    GameState.set(STATE_MENU);
    AudioSystem.stopBackgroundMusic();
    HUD.closeOptions();
    HUD.closePopup();
  }

  function goToTutorial() {
    GameState.set(STATE_TUTORIAL);
  }

  // ─────────────────────────────────────────────────────────────
  // CRIA INPUT PARA UPLOAD DE ARQUIVO DE ÁUDIO
  // ─────────────────────────────────────────────────────────────
  function createFileUpload(soundName, callback) {
    const input  = document.createElement('input');
    input.type   = 'file';
    input.accept = 'audio/mpeg, audio/wav, audio/ogg';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) callback(soundName, file);
    };
    input.click();
  }

  // ─────────────────────────────────────────────────────────────
  // CONFIGURA CALLBACKS DO HUD
  // ─────────────────────────────────────────────────────────────
  function setupHUDCallbacks() {
    const originalHandleClick = HUD.handleClick;

    HUD.handleClick = (mx, my, _externalCallbacks) => {
      if (HUD.isRemapping && HUD.isRemapping()) return false;

      return originalHandleClick(mx, my, {
        // Menu principal
        play: () => { hasShownTutorial ? startGame() : goToTutorial(); },
        options: () => { HUD.showOptions(); },
        credits: () => { HUD.showPopup('credits'); },

        // Tutorial
        start: () => { startGame(); },
        skip:  () => { startGame(); },

        // Pós-jogo (game over / vitória)
        restart: () => { startGame(); },
        menu:    () => { goToMenu();  },

        // Fechar popups
        close_popup:    () => { HUD.closePopup();   },
        close_options:  () => { HUD.closeOptions(); remappingAction = null; },

        // Abas de opções — usa HUD.setTab() para alterar a variável interna do HUD
        tabGameplay: () => { HUD.setTab('gameplay'); },
        tabSound:    () => { HUD.setTab('sound');    },

        // Jogabilidade
        mouseControl: () => {
          SettingsSystem.set('mouseControl', !SettingsSystem.get('mouseControl'));
        },
        resetControls: () => {
          SettingsSystem.set('keyLeft',    ['ArrowLeft',  'KeyA']);
          SettingsSystem.set('keyRight',   ['ArrowRight', 'KeyD']);
          SettingsSystem.set('keyShoot',   ['Space']);
          SettingsSystem.set('keyPause',   ['KeyP', 'Escape']);
          SettingsSystem.set('keyRestart', ['KeyR']);
        },

        // Remapeamento
        remapLeft:  () => { remappingAction = 'keyLeft';  HUD.startRemapping('keyLeft');  },
        remapRight: () => { remappingAction = 'keyRight'; HUD.startRemapping('keyRight'); },
        remapShoot: () => { remappingAction = 'keyShoot'; HUD.startRemapping('keyShoot'); },

        // Upload de áudio personalizado
        uploadShoot:      () => { createFileUpload('playerShoot',     (n, f) => AudioSystem.loadCustomSound(n, f)); },
        uploadEnemyShoot: () => { createFileUpload('enemyShoot',      (n, f) => AudioSystem.loadCustomSound(n, f)); },
        uploadExplosion:  () => { createFileUpload('explosion',        (n, f) => AudioSystem.loadCustomSound(n, f)); },
        uploadDamage:     () => { createFileUpload('damage',           (n, f) => AudioSystem.loadCustomSound(n, f)); },
        uploadGameOver:   () => { createFileUpload('gameOver',         (n, f) => AudioSystem.loadCustomSound(n, f)); },
        uploadMusic:      () => { createFileUpload('backgroundMusic',  (n, f) => AudioSystem.loadCustomSound(n, f)); }
      });
    };
  }

  // ─────────────────────────────────────────────────────────────
  // EVENTOS DO MOUSE
  // ─────────────────────────────────────────────────────────────
  function setupMouseEvents() {
    const canvas    = document.getElementById('glCanvas');
    const hudCanvas = document.getElementById('hud');

    function updateMousePosition(e) {
      const rect   = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / rect.width;
      const scaleY = canvas.height / rect.height;
      mouseX = (e.clientX - rect.left) * scaleX;
      mouseY = (e.clientY - rect.top)  * scaleY;
      HUD.updateHover(mouseX, mouseY);
    }

    canvas.addEventListener('mousemove',    updateMousePosition);
    hudCanvas.addEventListener('mousemove', updateMousePosition);

    canvas.addEventListener('click', (e) => {
      const rect   = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / rect.width;
      const scaleY = canvas.height / rect.height;
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top)  * scaleY;

      if (remappingAction) return; // ignorar cliques durante remapeamento

      const handled = HUD.handleClick(cx, cy, {});
      if (!handled && GameState.is(STATE_RUNNING)) {
        ShootingSystem.shoot();
        AudioSystem.playPlayerShoot();
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // REMAPEAMENTO DE TECLAS (via teclado)
  // ─────────────────────────────────────────────────────────────
  function setupKeyboardRemapping() {
    document.addEventListener('keydown', (e) => {
      if (!remappingAction) return;
      e.preventDefault();

      if (e.code === 'Escape') {
        remappingAction = null;
        HUD.cancelRemapping();
        return;
      }

      const currentKeys = SettingsSystem.get(remappingAction) || [];
      if (!currentKeys.includes(e.code)) {
        SettingsSystem.setKeyMapping(remappingAction, e.code);
      }

      remappingAction = null;
      HUD.cancelRemapping();
    });
  }

  // ─────────────────────────────────────────────────────────────
  // INPUTS DO TECLADO POR ESTADO DO JOGO
  // ─────────────────────────────────────────────────────────────
  function handleStateInputs() {
    const state    = GameState.get();
    const settings = SettingsSystem.getAll();

    if (remappingAction) return;

    const isLeftPressed  = settings.keyLeft?.some(k => Input.isDown(k))    || false;
    const isRightPressed = settings.keyRight?.some(k => Input.isDown(k))   || false;
    const isShootPressed = Input.wasPressedAny(settings.keyShoot   || ['Space']);
    const isPausePressed = Input.wasPressedAny(settings.keyPause   || ['KeyP', 'Escape']);
    const isRestartPressed = Input.wasPressedAny(settings.keyRestart || ['KeyR']);

    // Movimento via teclado
    if (state === STATE_RUNNING && !settings.mouseControl) {
      const dt = 0.016;
      if (isLeftPressed)  Player.setX(Math.max(PLAYER_MIN_X, Math.min(Player.x - PLAYER_SPEED * dt, PLAYER_MAX_X)));
      if (isRightPressed) Player.setX(Math.max(PLAYER_MIN_X, Math.min(Player.x + PLAYER_SPEED * dt, PLAYER_MAX_X)));
    }

    if (state === STATE_MENU && (isShootPressed || Input.wasPressed('Enter'))) {
      hasShownTutorial ? startGame() : goToTutorial();
      return;
    }

    if (state === STATE_TUTORIAL) {
      if (isShootPressed || Input.wasPressed('Enter')) { startGame(); return; }
      if (isPausePressed) { goToMenu(); return; }
    }

    if (state === STATE_RUNNING && isPausePressed) {
      GameState.set(STATE_PAUSED);
      AudioSystem.stopBackgroundMusic();
      return;
    }

    if (state === STATE_PAUSED && isPausePressed) {
      GameState.set(STATE_RUNNING);
      AudioSystem.startBackgroundMusic();
      return;
    }

    if ((state === STATE_GAMEOVER || state === STATE_WIN) && isRestartPressed) {
      startGame();
      return;
    }

    if (state === STATE_CONFIRM) {
      if (isRestartPressed || Input.wasPressed('Enter') || Input.wasPressed('KeyY')) startGame();
      else if (isPausePressed || Input.wasPressed('KeyN')) GameState.set(STATE_RUNNING);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // UPDATE DA LÓGICA
  // ─────────────────────────────────────────────────────────────
  function update(dt) {
    const state    = GameState.get();
    const settings = SettingsSystem.getAll();

    if (state === STATE_RUNNING) {
      // Controle por mouse
      if (settings.mouseControl && mouseX >= 0 && mouseX <= CANVAS_W) {
        let targetX = Math.max(PLAYER_MIN_X, Math.min(mouseX - PLAYER_W / 2, PLAYER_MAX_X));
        Player.setX(targetX);
      }

      Player.update(dt);
      ShootingSystem.update(dt);
      Bullet.update(dt);
      EnemySystem.update(dt);

      // ── Cooldown de dano ──────────────────────────────────────
      // Impede que múltiplas colisões simultâneas ou em frames
      // consecutivos drenem todas as vidas de uma vez.
      if (damageCooldown > 0) {
        damageCooldown -= dt;
      }

      const hit = CollisionSystem.check();
      if (hit && Player.alive && damageCooldown <= 0) {
        lives--;
        damageCooldown = DAMAGE_COOLDOWN; // invencibilidade temporária
        HUD.setLives(lives);
        AudioSystem.playDamage();

        if (lives <= 0) {
          Player.kill();
          gameOver();
        }
      }

      // Pontuação
      kills = ENEMY_COLS * ENEMY_ROWS - EnemySystem.aliveList().length;

      // Vitória
      if (EnemySystem.aliveList().length === 0) winGame();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  function render() {
    const { gl } = GL;
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    drawSprite(TEX.background, 0, 0, CANVAS_W, CANVAS_H);

    const state = GameState.get();

    if (state === STATE_RUNNING || state === STATE_PAUSED ||
        state === STATE_GAMEOVER || state === STATE_WIN || state === STATE_CONFIRM) {
      EnemySystem.draw();
      Bullet.draw();
      Player.draw();
    }

    HUD.render(state, kills, lives, highScore);
  }

  // ─────────────────────────────────────────────────────────────
  // LOOP PRINCIPAL
  // ─────────────────────────────────────────────────────────────
  function loop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    handleStateInputs();
    update(dt);
    render();

    Input.clearFrame();
    rafId = requestAnimationFrame(loop);
  }

  // ─────────────────────────────────────────────────────────────
  // INICIALIZAÇÃO
  // ─────────────────────────────────────────────────────────────
  function start() {
    setupMouseEvents();
    setupKeyboardRemapping();
    setupHUDCallbacks();

    resetAll();
    GameState.set(STATE_MENU);

    if (typeof SettingsSystem !== 'undefined') SettingsSystem.load();

    if (typeof AudioSystem !== 'undefined') {
      AudioSystem.init();
      const settings = SettingsSystem ? SettingsSystem.getAll() : DEFAULT_SETTINGS;
      AudioSystem.updateSettings(settings);
    }

    rafId = requestAnimationFrame(ts => { lastTime = ts; loop(ts); });
  }

  return { start };
})();