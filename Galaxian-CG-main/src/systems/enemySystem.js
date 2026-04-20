// ═══════════════════════════════════════════════════════════════
// src/systems/enemySystem.js
// Sistema de inimigos: formação em bloco, movimento lateral,
// descida nas bordas e disparo automático.
//
// MUDANÇAS (suporte a fases infinitas):
//   · reset(params) agora aceita parâmetros dinâmicos do LevelSystem,
//     substituindo as constantes fixas por um objeto `config` local.
//   · `config` é recriado a cada reset() — todas as chamadas internas
//     passaram a usar config.* em vez das constantes globais.
//   · Velocidade intra-fase (aceleração por morte) tem teto em
//     config.speedCap para nunca ultrapassar um valor razoável.
//   · Expõe `totalEnemies` para que game.js possa acumular kills
//     corretamente entre fases.
//
// Arquitetura de posição (inalterada):
//   posição absoluta = (blockX + relX, blockY + relY)
//   blockX/blockY → offset do bloco inteiro (O(1) por frame)
//   relX/relY     → posição relativa fixa de cada inimigo no bloco
//
// Dependências:
//   drawSprite  (render/renderer.js)
//   TEX         (render/textureLoader.js)
//   CANVAS_W, CANVAS_H, ENEMY_*, EBULLET_* (constants.js)
// Exporta (global): EnemySystem
// ═══════════════════════════════════════════════════════════════
"use strict";

const EnemySystem = (() => {
  // ── Estado interno ────────────────────────────────────────────
  let enemies      = []; // [{col, row, relX, relY, alive}]
  let blockX       = 0;  // offset X do bloco em px
  let blockY       = 0;  // offset Y do bloco em px
  let dir          = 1;  // direção atual: 1=direita, -1=esquerda
  let speed        = 0;  // velocidade atual (aumenta a cada morte)
  let eBullets     = []; // [{x, y, active}]
  let shootTimer   = 0;
  let totalEnemies = 0;  // quantidade de inimigos no início desta wave

  // ── Configuração da wave atual ────────────────────────────────
  // Preenchida em reset(). Separa completamente a lógica de "o que fazer"
  // (update/draw) da lógica de "quão difícil" (LevelSystem).
  let config = {};

  const BORDER_MARGIN = 10; // px de margem antes de considerar borda atingida

  // ─────────────────────────────────────────────────────────────
  // Inicialização / reset
  // ─────────────────────────────────────────────────────────────

  /**
   * Reinicia a wave de inimigos, opcionalmente com parâmetros dinâmicos.
   *
   * @param {object} [params]               Parâmetros de dificuldade do LevelSystem.
   *                                        Se omitido, usa as constantes da fase 1.
   * @param {number} [params.enemySpeed]    Velocidade inicial do bloco (px/s)
   * @param {number} [params.speedInc]      Aceleração por morte (px/s)
   * @param {number} [params.fireInterval]  Intervalo entre disparos (s)
   * @param {number} [params.maxBullets]    Projéteis simultâneos máximos
   * @param {number} [params.rows]          Linhas de inimigos
   * @param {number} [params.cols]          Colunas de inimigos
   * @param {number} [params.dropAmount]    Pixels descidos ao bater na borda
   */
  function reset(params = {}) {
    // Monta a configuração da wave, caindo para constantes originais se parâmetro ausente.
    // Isso garante que a fase 1 (sem params) se comporte exatamente como antes.
    const speedInit = params.enemySpeed   ?? ENEMY_SPEED_INIT;

    config = {
      speedInit,
      // Teto da aceleração intra-fase: 3× a velocidade inicial desta fase.
      // Evita que as últimas mortes da wave tornem o bloco inacessível.
      speedCap:     Math.min(speedInit * 3.0, 500),
      speedInc:     params.speedInc      ?? ENEMY_SPEED_INC,
      fireInterval: params.fireInterval  ?? EBULLET_INTERVAL,
      maxBullets:   params.maxBullets    ?? EBULLET_MAX,
      rows:         params.rows          ?? ENEMY_ROWS,
      cols:         params.cols          ?? ENEMY_COLS,
      dropAmount:   params.dropAmount    ?? ENEMY_DROP,
    };

    speed      = config.speedInit;
    dir        = 1;
    enemies    = [];
    eBullets   = [];
    shootTimer = 0;

    // Centraliza a formação no canvas com base nas colunas desta wave
    const formationW = config.cols * (ENEMY_W + ENEMY_PAD_X) - ENEMY_PAD_X;
    blockX = (CANVAS_W - formationW) / 2;
    blockY = ENEMY_START_Y;

    // Cria a grade de inimigos com posições relativas fixas
    for (let row = 0; row < config.rows; row++) {
      for (let col = 0; col < config.cols; col++) {
        enemies.push({
          col,
          row,
          relX:  col * (ENEMY_W + ENEMY_PAD_X),
          relY:  row * (ENEMY_H + ENEMY_PAD_Y),
          alive: true,
        });
      }
    }

    totalEnemies = enemies.length;
  }

  // ─────────────────────────────────────────────────────────────
  // Lógica de update
  // ─────────────────────────────────────────────────────────────

  /** Retorna apenas os inimigos ainda vivos. */
  function aliveList() {
    return enemies.filter(e => e.alive);
  }

  function update(dt) {
    // ── Movimento lateral do bloco ────────────────────────────
    blockX += dir * speed * dt;

    const alive = aliveList();
    if (!alive.length) return;

    // Determina as bordas reais do bloco (usando apenas inimigos vivos)
    // para que a detecção de borda seja precisa após mortes nas pontas
    let minRelX = Infinity, maxRelX = -Infinity;
    for (const e of alive) {
      if (e.relX < minRelX) minRelX = e.relX;
      if (e.relX > maxRelX) maxRelX = e.relX;
    }
    const leftEdge  = blockX + minRelX;
    const rightEdge = blockX + maxRelX + ENEMY_W;

    // Inversão de direção nas bordas + descida
    if (dir === 1 && rightEdge >= CANVAS_W - BORDER_MARGIN) {
      dir    = -1;
      blockY += config.dropAmount;
    } else if (dir === -1 && leftEdge <= BORDER_MARGIN) {
      dir    = 1;
      blockY += config.dropAmount;
    }

    // ── Disparo automático dos inimigos ───────────────────────
    shootTimer += dt;
    const activeBullets = eBullets.filter(b => b.active).length;

    if (shootTimer >= config.fireInterval && activeBullets < config.maxBullets) {
      shootTimer = 0;

      // Cada coluna dispara pelo inimigo mais à frente (maior row vivo)
      const frontEnemies = [];
      for (let col = 0; col < config.cols; col++) {
        const colAlive = alive
          .filter(e => e.col === col)
          .sort((a, b) => b.row - a.row);
        if (colAlive.length) frontEnemies.push(colAlive[0]);
      }

      if (frontEnemies.length) {
        const shooter = frontEnemies[Math.floor(Math.random() * frontEnemies.length)];
        eBullets.push({
          x:      blockX + shooter.relX + ENEMY_W / 2 - EBULLET_W / 2,
          y:      blockY + shooter.relY + ENEMY_H,
          active: true,
        });
      }
    }

    // ── Atualiza posição dos tiros inimigos ───────────────────
    for (const b of eBullets) {
      if (!b.active) continue;
      b.y += EBULLET_SPEED * dt;
      if (b.y > CANVAS_H) b.active = false;
    }
    // Limpeza periódica do array para não crescer indefinidamente
    if (eBullets.length > 50) eBullets = eBullets.filter(b => b.active);
  }

  // ─────────────────────────────────────────────────────────────
  // Renderização
  // ─────────────────────────────────────────────────────────────

  function draw() {
    for (const e of enemies) {
      if (!e.alive) continue;
      drawSprite(TEX.enemy, blockX + e.relX, blockY + e.relY, ENEMY_W, ENEMY_H);
    }
    for (const b of eBullets) {
      if (b.active) drawSprite(TEX.enemyBullet, b.x, b.y, EBULLET_W, EBULLET_H);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Morte de inimigo
  // ─────────────────────────────────────────────────────────────

  /**
   * Mata um inimigo e acelera o bloco (tensão cresce conforme menos inimigos).
   * A velocidade é limitada em config.speedCap para evitar absurdos.
   *
   * @param {object} e  Referência ao inimigo no array enemies
   */
  function killEnemy(e) {
    e.alive = false;
    // Aceleração intra-fase: quanto menos inimigos restam, mais urgente fica
    speed = Math.min(speed + config.speedInc, config.speedCap);
  }

  // ─────────────────────────────────────────────────────────────
  // API pública
  // ─────────────────────────────────────────────────────────────
  return {
    reset,
    update,
    draw,
    aliveList,
    killEnemy,

    get blockX()       { return blockX; },
    get blockY()       { return blockY; },
    get eBullets()     { return eBullets; },

    /**
     * Total de inimigos no início desta wave.
     * Usado por game.js para acumular kills corretamente entre fases.
     */
    get totalEnemies() { return totalEnemies; },

    /** Posição absoluta de um inimigo — usada pelo CollisionSystem. */
    absPos: e => ({ x: blockX + e.relX, y: blockY + e.relY }),
  };
})();
