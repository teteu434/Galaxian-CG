// ═══════════════════════════════════════════════════════════════
// src/core/game.js
// Loop principal do jogo: update + render a cada frame.
//
// requestAnimationFrame é preferido a setInterval porque:
//   - Sincroniza com o vsync do monitor (sem tearing)
//   - Pausa automaticamente quando a aba fica oculta (economiza CPU)
//   - Fornece timestamp de alta precisão para delta time
//
// Delta time (dt): diferença de tempo entre frames em segundos.
//   Multiplicar todas as velocidades por dt garante que o jogo
//   rode na mesma velocidade em qualquer frame rate (30fps ou 144fps).
//   Clampar dt em 0.1s evita "explosão" de posição após alt+tab.
//
// Dependências:
//   GL              (render/glContext.js)
//   TEX             (render/textureLoader.js)
//   drawSprite      (render/renderer.js)
//   HUD             (render/hudRenderer.js)
//   Input           (systems/input.js)
//   GameState       (core/state.js)
//   Player          (entities/player.js)
//   Bullet          (entities/bullet.js)
//   EnemySystem     (systems/enemySystem.js)
//   CollisionSystem (systems/collision.js)
//   ShootingSystem  (systems/shootingSystem.js)
//   CANVAS_W/H, STATE_*, ENEMY_COLS, ENEMY_ROWS (constants.js)
// Exporta (global): Game
// ═══════════════════════════════════════════════════════════════
"use strict";

const Game = (() => {
  let lastTime = 0;
  let kills    = 0; // inimigos eliminados na partida atual
  let rafId    = 0; // ID do requestAnimationFrame (para cancelamento futuro)

  // ── Reset completo do estado do jogo ─────────────────────────
  function resetAll() {
    kills = 0;
    Player.reset();
    Bullet.reset();
    ShootingSystem.reset();
    EnemySystem.reset();
    GameState.set(STATE_RUNNING);
  }

  // ── Tratamento de inputs que afetam o estado global ──────────
  // Separado de update() para que funcione mesmo fora de STATE_RUNNING
  function handleStateInputs() {
    const state = GameState.get();

    // Pausa / retomar — disponível em running e paused
    if (
      (Input.wasPressed('KeyP') || Input.wasPressed('Escape')) &&
      state !== STATE_GAMEOVER &&
      state !== STATE_WIN      &&
      state !== STATE_CONFIRM
    ) {
      GameState.set(state === STATE_PAUSED ? STATE_RUNNING : STATE_PAUSED);
      return;
    }

    // Solicitar reinício — disponível em qualquer estado exceto dentro do próprio confirm
    if (Input.wasPressed('KeyR') && state !== STATE_CONFIRM) {
      GameState.savePrev();          // salva estado atual para restaurar se cancelar
      GameState.set(STATE_CONFIRM);
      return;
    }

    // Responder ao diálogo de confirmação
    if (state === STATE_CONFIRM) {
      if (Input.wasPressed('Enter') || Input.wasPressed('KeyY')) {
        resetAll();
      } else if (Input.wasPressed('Escape') || Input.wasPressed('KeyN')) {
        GameState.set(GameState.getPrev()); // cancela → volta ao estado anterior
      }
    }
  }

  // ── Atualização da lógica do jogo ─────────────────────────────
  function update(dt) {
    // Lógica só roda durante o estado ativo
    if (!GameState.is(STATE_RUNNING)) return;

    Player.update(dt);
    ShootingSystem.update(dt);
    Bullet.update(dt);
    EnemySystem.update(dt);
    CollisionSystem.check();

    // Pontuação = total de inimigos - vivos restantes
    kills = ENEMY_COLS * ENEMY_ROWS - EnemySystem.aliveList().length;
  }

  // ── Renderização ──────────────────────────────────────────────
  function render() {
    const { gl } = GL;

    // Limpa o framebuffer WebGL com preto antes de cada frame
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Ordem de desenho: fundo → inimigos → tiro → jogador → HUD
    drawSprite(TEX.background, 0, 0, CANVAS_W, CANVAS_H);
    EnemySystem.draw();
    Bullet.draw();
    Player.draw();

    // HUD é desenhado no Canvas 2D sobreposto (não interfere no WebGL)
    HUD.render(GameState.get(), kills);
  }

  // ── Loop principal ────────────────────────────────────────────
  function loop(timestamp) {
    // Delta time em segundos, clampeado para evitar saltos grandes
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    handleStateInputs();
    update(dt);
    render();

    // Limpa justPressed APÓS todo o processamento do frame,
    // garantindo que todos os sistemas possam ler os eventos
    Input.clearFrame();

    rafId = requestAnimationFrame(loop);
  }

  // ── Ponto de início ───────────────────────────────────────────
  function start() {
    resetAll();
    // Primeiro frame: inicializa lastTime antes de entrar no loop
    rafId = requestAnimationFrame(ts => {
      lastTime = ts;
      loop(ts);
    });
  }

  return { start };
})();