// ═══════════════════════════════════════════════════════════════
// src/core/game.js
//
// MUDANÇAS (suporte a fases infinitas):
//   · advanceLevel() substitui winGame() na condição de vitória.
//     Chama LevelSystem.nextLevel() e define STATE_LEVEL_TRANSITION.
//   · update() lida com STATE_LEVEL_TRANSITION: atualiza o timer do
//     LevelSystem e, quando ele sinaliza "pronto", spawna a próxima
//     wave com os parâmetros da nova fase.
//   · kills agora é o acumulado total (killsAtLevelStart + wave atual).
//     killsAtLevelStart é incrementado em advanceLevel().
//   · resetAll() reseta LevelSystem e killsAtLevelStart.
//   · render() passa STATE_RUNNING ao HUD durante a transição (para
//     manter score/lives visíveis) e depois desenha o overlay de
//     transição por cima via renderLevelTransition().
//   · handleStateInputs() ignora input de movimento durante a transição.
//   · winGame() mantida mas não é mais chamada automaticamente —
//     o jogo é agora teoricamente infinito.
//
// Dependências adicionadas:
//   LevelSystem      (systems/levelSystem.js)
//   STATE_LEVEL_TRANSITION (definido em levelSystem.js)
// ═══════════════════════════════════════════════════════════════
"use strict";

const Game = (() => {
  let lastTime  = 0;
  let kills     = 0;  // Total acumulado de kills (todas as fases)
  let rafId     = 0;
  let lives     = 3;

  // kills das fases anteriores — somado ao atual para formar o score total
  let killsAtLevelStart = 0;

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

  function getMouseCanvasX() {
    const canvas = document.getElementById('glCanvas');
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    return (Input.getMouseRawX() - rect.left) * scaleX;
  }

  // ── Reset completo (novo jogo desde o menu) ───────────────────
  function resetAll() {
    kills             = 0;
    killsAtLevelStart = 0;
    lives             = 3;
    damageCooldown    = 0;

    // Reseta o LevelSystem para fase 1 antes de resetar o EnemySystem,
    // pois EnemySystem.reset() usa as constantes base (fase 1) por padrão.
    LevelSystem.reset();

    Player.reset();
    Bullet.reset();
    ShootingSystem.reset();
    EnemySystem.reset(); // sem params → constantes da fase 1

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
    kills = (killsAtLevelStart + (EnemySystem.totalEnemies - EnemySystem.aliveList().length));
    checkAndSaveHighScore(kills * 100);
  }

  // Mantida para compatibilidade; não é mais chamada automaticamente
  // no loop principal (o jogo é infinito — termina só com game over).
  function winGame() {
    GameState.set(STATE_WIN);
    AudioSystem.stopBackgroundMusic();
    kills = (killsAtLevelStart + (EnemySystem.totalEnemies - EnemySystem.aliveList().length));
    checkAndSaveHighScore(kills * 100);
  }

  /**
   * Chamada quando todos os inimigos da wave atual são eliminados.
   * Em vez de ir para STATE_WIN, avança para a próxima fase.
   */
  function advanceLevel() {
    checkAndSaveHighScore(kills * 100);
    // Acumula os kills desta wave no total histórico antes de resetar
    killsAtLevelStart += EnemySystem.totalEnemies;

    AudioSystem.stopBackgroundMusic();
    LevelSystem.nextLevel();
    GameState.set(STATE_LEVEL_TRANSITION);

    console.log(
      `[Game] Wave completa! Total kills acumulado: ${killsAtLevelStart} → fase ${LevelSystem.current}`
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Overlay de transição entre fases (desenhado sobre o HUD)
  // ─────────────────────────────────────────────────────────────

  function renderLevelTransition() {
    const hudCanvas = document.getElementById('hud');
    const ctx       = hudCanvas.getContext('2d');
    const level     = LevelSystem.current;
    const progress  = LevelSystem.timerProgress;

    // Fade-in rápido (primeiro quarto da duração) → permanece visível
    const alpha = Math.min(progress * 4, 1);
    const p     = LevelSystem.params(); // parâmetros da nova fase

    ctx.save();

    // ── Fundo escuro semi-transparente ────────────────────────
    ctx.fillStyle = `rgba(0, 2, 20, ${0.82 * alpha})`;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.globalAlpha  = alpha;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // ── Título: fase anterior completa ────────────────────────
    ctx.font      = `bold 38px "Courier New", monospace`;
    ctx.fillStyle = '#00e5ff';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur  = 24;
    ctx.fillText(`✦  FASE ${level - 1} COMPLETA!  ✦`, CANVAS_W / 2, CANVAS_H / 2 - 52);

    // ── Próxima fase ──────────────────────────────────────────
    ctx.shadowBlur  = 0;
    ctx.font        = `bold 26px "Courier New", monospace`;
    ctx.fillStyle   = '#ffffff';
    ctx.fillText(`PREPARANDO FASE ${level}`, CANVAS_W / 2, CANVAS_H / 2);

    // ── Dica dos parâmetros da próxima fase ───────────────────
    ctx.font      = `14px "Courier New", monospace`;
    ctx.fillStyle = '#80ffee';

    const speedPct = Math.round((p.enemySpeed / 80 - 1) * 100);
    const info     = `${p.rows} × ${p.cols} inimigos  |  velocidade +${speedPct}%  |  ${p.maxBullets} projéteis`;
    ctx.fillText(info, CANVAS_W / 2, CANVAS_H / 2 + 42);

    // ── Barra de progresso (timer visual) ────────────────────
    const barW = 260;
    const barH = 6;
    const barX = CANVAS_W / 2 - barW / 2;
    const barY = CANVAS_H / 2 + 76;

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(barX, barY, barW, barH);

    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(barX, barY, barW * progress, barH);

    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────
  // Indicador de fase (canto superior direito durante o jogo)
  // ─────────────────────────────────────────────────────────────

  function renderLevelBadge() {
    const hudCanvas = document.getElementById('hud');
    const ctx       = hudCanvas.getContext('2d');

    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.font         = `bold 13px "Courier New", monospace`;
    ctx.fillStyle    = '#00e5ff';
    ctx.globalAlpha  = 0.85;

    ctx.fillText(`FASE ${LevelSystem.current}`, hudCanvas.width / 2, 10);

    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────
  // Configuração de callbacks e eventos (inalterado)
  // ─────────────────────────────────────────────────────────────

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

  function setupMouseEvents() {
    const canvas    = document.getElementById('glCanvas');
    const hudCanvas = document.getElementById('hud');

    function onMouseMove(e) {
      const { x, y } = windowToCanvas(e.clientX, e.clientY);
      HUD.updateHover(x, y);
    }

    canvas.addEventListener('mousemove',    onMouseMove);
    hudCanvas.addEventListener('mousemove', onMouseMove);

    function onMouseDown(e) {
      const { x, y } = windowToCanvas(e.clientX, e.clientY);

      if (remappingAction) return;

      const handledByHUD = HUD.handleClick(x, y, {});
      if (handledByHUD) return;

      if (
        GameState.is(STATE_RUNNING) &&
        SettingsSystem.get('mouseControl') &&
        (e.button === 0 || e.button === 2)
      ) {
        const fired = ShootingSystem.tryShoot();
        if (fired) AudioSystem.playPlayerShoot();
      }
    }

    canvas.addEventListener('mousedown',    onMouseDown);
    hudCanvas.addEventListener('mousedown', onMouseDown);
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
  // Input por estado
  // ─────────────────────────────────────────────────────────────

  function handleStateInputs() {
    const state = GameState.get();

    if (remappingAction) return;

    // Durante a transição de fase: ignora todo input do jogo.
    // O jogador não pode mover, atirar ou pausar nesse intervalo.
    if (state === STATE_LEVEL_TRANSITION) return;

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
      const popupOpen   = typeof HUD.isPopupOpen   === 'function' && HUD.isPopupOpen();
      const optionsOpen = typeof HUD.isOptionsOpen === 'function' && HUD.isOptionsOpen();
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

  // ─────────────────────────────────────────────────────────────
  // Update principal
  // ─────────────────────────────────────────────────────────────

  function update(dt) {
    const state = GameState.get();

    // ── Transição de fase ─────────────────────────────────────
    // O LevelSystem atualiza seu timer e sinaliza quando a transição
    // termina. Quando isso ocorre, spawna a wave com os novos params.
    if (state === STATE_LEVEL_TRANSITION) {
      const waveReady = LevelSystem.update(dt);
      if (waveReady) {
        const p = LevelSystem.params();
        EnemySystem.reset(p);
        Bullet.reset();
        GameState.set(STATE_RUNNING);
        AudioSystem.startBackgroundMusic();
        console.log('[Game] Nova wave iniciada com', p.rows * p.cols, 'inimigos.');
      }
      return; // nada mais roda durante a transição
    }

    // ── Jogo em execução ──────────────────────────────────────
    if (state === STATE_RUNNING) {

      if (SettingsSystem.get('mouseControl')) {
        const canvasX = getMouseCanvasX();
        Player.setX(Math.max(PLAYER_MIN_X, Math.min(canvasX - PLAYER_W / 2, PLAYER_MAX_X)));
      }

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
        
        if(hit?.type === "death"){
          Player.kill();
          gameOver();
          return;

        } else {
          Player.setHit(true);
          lives--;
          damageCooldown = DAMAGE_COOLDOWN;
          HUD.setLives(lives);
          AudioSystem.playDamage();

          if (lives <= 0) {
            Player.kill(); 
            gameOver(); 
          }
        }
      }

      // Score total = kills das fases anteriores + kills desta wave
      kills = killsAtLevelStart + (EnemySystem.totalEnemies - EnemySystem.aliveList().length);
      // Todos os inimigos da wave atual foram eliminados → avança fase
      if (EnemySystem.aliveList().length === 0) advanceLevel();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Renderização
  // ─────────────────────────────────────────────────────────────

  function render() {
    const { gl } = GL;
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    drawSprite(TEX.background, 0, 0, CANVAS_W, CANVAS_H);

    const state = GameState.get();

    // Sprites de jogo: visíveis durante o jogo ativo e na transição
    if (
      state === STATE_RUNNING        ||
      state === STATE_PAUSED         ||
      state === STATE_GAMEOVER       ||
      state === STATE_WIN            ||
      state === STATE_CONFIRM        ||
      state === STATE_LEVEL_TRANSITION
    ) {
      EnemySystem.draw();
      Bullet.draw();
      Player.draw();
    }

    // Passa STATE_RUNNING ao HUD quando estamos em transição para que
    // o score e as vidas continuem visíveis durante a tela intermediária.
    const hudState = state === STATE_LEVEL_TRANSITION ? STATE_RUNNING : state;
    HUD.render(hudState, kills, lives, highScore);

    // Indicador de fase no canto durante o jogo e a transição
    if (state === STATE_RUNNING || state === STATE_LEVEL_TRANSITION) {
      renderLevelBadge();
    }

    // Overlay de transição: desenhado POR CIMA do HUD
    if (state === STATE_LEVEL_TRANSITION) {
      renderLevelTransition();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Game loop
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
