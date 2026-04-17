// ═══════════════════════════════════════════════════════════════
// src/core/game.js
//
// MUDANÇAS:
//   - setupMouseEvents(): separado em mousemove (posição) e
//     mousedown (tiro). Click direito agora também atira.
//     Conversão de coordenadas centralizada em uma função.
//   - update(): movimento por mouse usa Input.getMouseRawX()
//     com conversão de escala, em vez de variável local mouseX.
//   - handleStateInputs(): Enter no menu bloqueado quando HUD
//     tem popup ou options aberto (fix do bug de créditos).
//   - Tiro por mouse integrado ao ShootingSystem sem duplicar lógica.
// ═══════════════════════════════════════════════════════════════
"use strict";

const Game = (() => {
  let lastTime  = 0;
  let kills     = 0;
  let rafId     = 0;
  let lives     = 3;

  let highScore = (() => {
    try {
      const stored = localStorage.getItem('galaxian_highscore');
      const parsed = stored ? parseInt(stored, 10) : 0;
      return isNaN(parsed) ? 0 : parsed;
    } catch (e) {
      console.warn('[Game] localStorage indisponível:', e);
      return 0;
    }
  })();

  let damageCooldown = 0;
  const DAMAGE_COOLDOWN = 1.8;

  let hasShownTutorial = localStorage.getItem(TUTORIAL_COMPLETED_KEY) === 'true';
  let remappingAction  = null;

  const PLAYER_MIN_X = 0;
  const PLAYER_MAX_X = CANVAS_W - PLAYER_W;

  // ── Utilitário: converte coordenadas da janela → canvas ───────
  // Centralizado aqui para ser reutilizado por mousemove e mousedown.
  // Necessário porque o canvas pode estar escalado via CSS (fullscreen).
  function windowToCanvas(clientX, clientY) {
    const canvas = document.getElementById('glCanvas');
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top)  * scaleY,
    };
  }

  // ── Converte posição bruta do Input para X no canvas ─────────
  // Chamado a cada frame no update() quando mouseControl = true.
  function getMouseCanvasX() {
    const canvas = document.getElementById('glCanvas');
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    return (Input.getMouseRawX() - rect.left) * scaleX;
  }

  // ────────────────────────────────────────────────────────────
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
      try {
        localStorage.setItem('galaxian_highscore', String(highScore));
      } catch (e) {
        console.error('[Game] Erro ao salvar high score:', e);
      }
      HUD.setHighScore(highScore);
      HUD.setNewRecord(true);
      return true;
    }
    return false;
  }

  function gameOver() {
    setTimeout(() => GameState.set(STATE_GAMEOVER), 600);
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
        // NOVO: keyboardControl: ativa teclado, desativa mouse
        keyboardControl: () => {
          SettingsSystem.set('keyboardControl', !SettingsSystem.get('keyboardControl'));
        },

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

    // ── Hover do HUD (mousemove) ──────────────────────────────
    // Separado do tiro: mousemove só atualiza o hover do HUD.
    // O Input já rastreia a posição bruta via seu próprio listener.
    function onMouseMove(e) {
      const { x, y } = windowToCanvas(e.clientX, e.clientY);
      HUD.updateHover(x, y);
    }

    canvas.addEventListener('mousemove',    onMouseMove);
    hudCanvas.addEventListener('mousemove', onMouseMove);

    // ── Clique do HUD / Tiro (mousedown) ─────────────────────
    // Usamos mousedown (não 'click') porque:
    //   1. Captura botão direito (button=2), que 'click' ignora
    //   2. Resposta mais imediata para o tiro
    //   3. Botão direito com preventDefault no 'contextmenu' (input.js)
    //      impede o menu nativo mas não impede o mousedown
    function onMouseDown(e) {
      const { x, y } = windowToCanvas(e.clientX, e.clientY);

      // Em remapping, nenhum clique deve passar para o jogo
      if (remappingAction) return;

      // Tenta consumir o clique no HUD primeiro.
      // Se o HUD tratou o clique (retornou true), não atira.
      const handledByHUD = HUD.handleClick(x, y, {});
      if (handledByHUD) return;

      // Tiro por mouse: só dispara se mouseControl estiver ativo
      // e o jogo estiver rodando. Botão esquerdo (0) ou direito (2).
      if (
        GameState.is(STATE_RUNNING) &&
        SettingsSystem.get('mouseControl') &&
        (e.button === 0 || e.button === 2)
      ) {
        // Reutiliza ShootingSystem — sem duplicar lógica de cooldown
        const fired = ShootingSystem.tryShoot();
        if (fired) AudioSystem.playPlayerShoot();
      }
    }

    canvas.addEventListener('mousedown',    onMouseDown);
    hudCanvas.addEventListener('mousedown', onMouseDown);

    // Mantém o 'click' apenas para compatibilidade com teclado ativo
    // (modo teclado usa click para atirar via HUD, se aplicável)
    // Removido: o mousedown já cobre tudo. Não duplicar.
  }

  function setupKeyboardRemapping() {
    document.addEventListener('keydown', (e) => {
      if (!remappingAction) return;
      e.preventDefault();

      if (e.code === 'Escape') {
        Input.suppress(e.code);
        remappingAction = null;
        HUD.cancelRemapping();
        return;
      }

      SettingsSystem.setKeyMapping(remappingAction, e.code);
      Input.suppress(e.code);
      remappingAction = null;
      HUD.cancelRemapping();
    });
  }

  function handleStateInputs() {
    const state = GameState.get();

    if (remappingAction) return;

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

    // Movimento por teclado no loop (complementa o player.update())
    // player.update() já tem o guard de mouseControl, mas aqui
    // também guardamos para consistência e para evitar duplo movimento.
    if (state === STATE_RUNNING && !SettingsSystem.get('mouseControl')) {
      const dt = 0.016;
      if (isLeftPressed)  Player.setX(Math.max(PLAYER_MIN_X, Math.min(Player.x - PLAYER_SPEED * dt, PLAYER_MAX_X)));
      if (isRightPressed) Player.setX(Math.max(PLAYER_MIN_X, Math.min(Player.x + PLAYER_SPEED * dt, PLAYER_MAX_X)));
    }

    // ── FIX DO BUG: Enter no menu ─────────────────────────────
    // Antes, Enter iniciava o jogo mesmo com popup/options aberto.
    // Agora verificamos se o HUD está "ocupado" antes de processar.
    // HUD.isPopupOpen() e HUD.isOptionsOpen() devem existir no HUD
    // (veja hudRenderer.js — adicionamos essas funções).
    if (state === STATE_MENU && Input.wasPressed('Enter')) {
      const popupOpen   = typeof HUD.isPopupOpen   === 'function' && HUD.isPopupOpen();
      const optionsOpen = typeof HUD.isOptionsOpen === 'function' && HUD.isOptionsOpen();

      // Só inicia o jogo se nenhuma camada de UI estiver aberta
      if (!popupOpen && !optionsOpen) {
        hasShownTutorial ? startGame() : goToTutorial();
      }
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
      // ── Movimento por mouse ───────────────────────────────────
      // Convertemos a posição bruta do Input para coordenadas do canvas
      // aqui no update(), a cada frame, garantindo responsividade.
      if (SettingsSystem.get('mouseControl')) {
        const canvasX = getMouseCanvasX();
        // Centraliza o player no cursor (subtrai metade da largura)
        Player.setX(Math.max(PLAYER_MIN_X, Math.min(canvasX - PLAYER_W / 2, PLAYER_MAX_X)));
      }

      // ── Tiro por teclado (apenas se mouseControl = false) ────
      // O tiro por mouse é tratado no mousedown (setupMouseEvents),
      // não aqui, para evitar processar no update() e no evento
      // simultaneamente (duplicação de tiros).
      if (!SettingsSystem.get('mouseControl')) {
        const keyShoot = SettingsSystem.get('keyShoot') || ['Space'];
        if (Input.wasPressedAny(keyShoot)) {
          const fired = ShootingSystem.tryShoot();
          if (fired) AudioSystem.playPlayerShoot();
        }
      }

      Player.update(dt);
      ShootingSystem.update(dt);
      Bullet.update(dt);
      EnemySystem.update(dt);

      if (damageCooldown > 0) damageCooldown -= dt;

      const hit = CollisionSystem.check();

      if (hit && Player.alive && damageCooldown <= 0) {
        Player.setHit(true);
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

    SettingsSystem.load();

    if (typeof AudioSystem !== 'undefined') {
      AudioSystem.init();
      AudioSystem.updateSettings(SettingsSystem.getAll());
    }

    rafId = requestAnimationFrame(ts => { lastTime = ts; loop(ts); });
  }

  return { start };
})();