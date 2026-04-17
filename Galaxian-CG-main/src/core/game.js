// ═══════════════════════════════════════════════════════════════
// src/core/game.js
// Mudanças:
//   - resetControls usa SettingsSystem.reset() (não mais manual)
//   - start() remove fallback direto a DEFAULT_SETTINGS
//   - handleStateInputs() lê sempre do SettingsSystem
// ═══════════════════════════════════════════════════════════════
"use strict";

const Game = (() => {
  let lastTime  = 0;
  let kills     = 0;
  let rafId     = 0;
  let lives     = 3;

  let highScore = parseInt(localStorage.getItem('galaxian_highscore') || '0');
  let damageCooldown = 0;
  const DAMAGE_COOLDOWN = 1.8;

  let hasShownTutorial = localStorage.getItem(TUTORIAL_COMPLETED_KEY) === 'true';
  let mouseX = CANVAS_W / 2;
  let mouseY = CANVAS_H / 2;
  let remappingAction = null;

  const PLAYER_MIN_X = 0;
  const PLAYER_MAX_X = CANVAS_W - PLAYER_W;

  function resetAll() {
    kills          = 0;
    lives          = 3;
    damageCooldown = 0;
    Player.reset();
    Bullet.reset();
    ShootingSystem.reset();
    EnemySystem.reset();
    HUD.setLives(lives);
    HUD.setHighScore(highScore);
    HUD.setNewRecord(false);
    AudioSystem.stopBackgroundMusic();
  }

  function startGame() {
    resetAll();
    GameState.set(STATE_RUNNING);
    AudioSystem.startBackgroundMusic();
    if (!hasShownTutorial) {
      hasShownTutorial = true;
      localStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
    }
  }

  function checkAndSaveHighScore(finalScore) {
    if (finalScore > highScore) {
      highScore = finalScore;
      localStorage.setItem('galaxian_highscore', highScore);
      HUD.setHighScore(highScore);
      HUD.setNewRecord(true);
      return true;
    }
    return false;
  }

  function gameOver() {
    GameState.set(STATE_GAMEOVER);
    AudioSystem.stopBackgroundMusic();
    AudioSystem.playGameOver();
    checkAndSaveHighScore(kills * 100);
  }

  function winGame() {
    GameState.set(STATE_WIN);
    AudioSystem.stopBackgroundMusic();
    checkAndSaveHighScore(kills * 100);
  }

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

  function setupHUDCallbacks() {
    const originalHandleClick = HUD.handleClick;

    HUD.handleClick = (mx, my, _externalCallbacks) => {
      if (HUD.isRemapping && HUD.isRemapping()) return false;

      return originalHandleClick(mx, my, {
        play:    () => { hasShownTutorial ? startGame() : goToTutorial(); },
        options: () => { HUD.showOptions(); },
        credits: () => { HUD.showPopup('credits'); },

        start: () => { startGame(); },
        skip:  () => { startGame(); },

        restart: () => { startGame(); },
        menu:    () => { goToMenu();  },

        close_popup:   () => { HUD.closePopup();   },
        close_options: () => { HUD.closeOptions(); remappingAction = null; },

        tabGameplay: () => { HUD.setTab('gameplay'); },
        tabSound:    () => { HUD.setTab('sound');    },

        mouseControl: () => {
          SettingsSystem.set('mouseControl', !SettingsSystem.get('mouseControl'));
        },

        // ⚠️  Reset centralizado via SettingsSystem — não mais manual
        resetControls: () => { SettingsSystem.reset(); },

        remapLeft:  () => { remappingAction = 'keyLeft';  HUD.startRemapping('keyLeft');  },
        remapRight: () => { remappingAction = 'keyRight'; HUD.startRemapping('keyRight'); },
        remapShoot: () => { remappingAction = 'keyShoot'; HUD.startRemapping('keyShoot'); },

        uploadShoot:      () => { createFileUpload('playerShoot',    (n, f) => AudioSystem.loadCustomSound(n, f)); },
        uploadEnemyShoot: () => { createFileUpload('enemyShoot',     (n, f) => AudioSystem.loadCustomSound(n, f)); },
        uploadExplosion:  () => { createFileUpload('explosion',       (n, f) => AudioSystem.loadCustomSound(n, f)); },
        uploadDamage:     () => { createFileUpload('damage',          (n, f) => AudioSystem.loadCustomSound(n, f)); },
        uploadGameOver:   () => { createFileUpload('gameOver',        (n, f) => AudioSystem.loadCustomSound(n, f)); },
        uploadMusic:      () => { createFileUpload('backgroundMusic', (n, f) => AudioSystem.loadCustomSound(n, f)); },
      });
    };
  }

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

      if (remappingAction) return;

      const handled = HUD.handleClick(cx, cy, {});
      if (!handled && GameState.is(STATE_RUNNING)) {
        ShootingSystem.shoot();
        AudioSystem.playPlayerShoot();
      }
    });
  }

  function setupKeyboardRemapping() {
    document.addEventListener('keydown', (e) => {
      if (!remappingAction) return;
      e.preventDefault();

      if (e.code === 'Escape') {
        Input.suppress(e.code);   // ← Escape também pode acionar isPausePressed
        remappingAction = null;
        HUD.cancelRemapping();
        return;
      }

      // ⚠️  setKeyMapping garante unicidade: remove conflitos automaticamente
      SettingsSystem.setKeyMapping(remappingAction, e.code);
      Input.suppress(e.code);    // ← remove do buffer ANTES de zerar o guard
      remappingAction = null;
      HUD.cancelRemapping();
    });
  }

  function handleStateInputs() {
    const state    = GameState.get();

    if (remappingAction) return;

    // Toda leitura de teclas passa pelo SettingsSystem
    const keyLeft    = SettingsSystem.get('keyLeft')    || [];
    const keyRight   = SettingsSystem.get('keyRight')   || [];
    const keyShoot   = SettingsSystem.get('keyShoot')   || ['Space'];
    const keyPause   = SettingsSystem.get('keyPause')   || ['KeyP', 'Escape'];
    const keyRestart = SettingsSystem.get('keyRestart') || ['KeyR'];

    const isLeftPressed    = keyLeft.some(k  => Input.isDown(k));
    const isRightPressed   = keyRight.some(k => Input.isDown(k));
    const isShootPressed   = Input.wasPressedAny(keyShoot);
    const isPausePressed   = Input.wasPressedAny(keyPause);
    const isRestartPressed = Input.wasPressedAny(keyRestart);

    if (state === STATE_RUNNING && !SettingsSystem.get('mouseControl')) {
      const dt = 0.016;
      if (isLeftPressed)  Player.setX(Math.max(PLAYER_MIN_X, Math.min(Player.x - PLAYER_SPEED * dt, PLAYER_MAX_X)));
      if (isRightPressed) Player.setX(Math.max(PLAYER_MIN_X, Math.min(Player.x + PLAYER_SPEED * dt, PLAYER_MAX_X)));
    }

    if (state === STATE_MENU && Input.wasPressed('Enter')) {
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

  function update(dt) {
    const state = GameState.get();

    if (state === STATE_RUNNING) {
      if (SettingsSystem.get('mouseControl') && mouseX >= 0 && mouseX <= CANVAS_W) {
        Player.setX(Math.max(PLAYER_MIN_X, Math.min(mouseX - PLAYER_W / 2, PLAYER_MAX_X)));
      }

      Player.update(dt);
      ShootingSystem.update(dt);
      Bullet.update(dt);
      EnemySystem.update(dt);

      if (damageCooldown > 0) damageCooldown -= dt;

      const hit = CollisionSystem.check();
      if (hit && Player.alive && damageCooldown <= 0) {
        lives--;
        damageCooldown = DAMAGE_COOLDOWN;
        HUD.setLives(lives);
        AudioSystem.playDamage();
        if (lives <= 0) { Player.kill(); gameOver(); }
      }

      kills = ENEMY_COLS * ENEMY_ROWS - EnemySystem.aliveList().length;
      if (EnemySystem.aliveList().length === 0) winGame();
    }
  }

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

  function loop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;
    handleStateInputs();
    update(dt);
    render();
    Input.clearFrame();
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    setupMouseEvents();
    setupKeyboardRemapping();
    setupHUDCallbacks();

    resetAll();
    GameState.set(STATE_MENU);

    // ⚠️  SettingsSystem.load() aplica dados salvos sobre NEW_SETTINGS
    //     Nenhum fallback direto a DEFAULT_SETTINGS aqui.
    SettingsSystem.load();

    if (typeof AudioSystem !== 'undefined') {
      AudioSystem.init();
      AudioSystem.updateSettings(SettingsSystem.getAll());
    }

    rafId = requestAnimationFrame(ts => { lastTime = ts; loop(ts); });
  }

  return { start };
})();