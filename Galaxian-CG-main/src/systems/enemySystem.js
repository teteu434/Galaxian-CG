// ═══════════════════════════════════════════════════════════════
// src/systems/enemySystem.js
// Sistema de inimigos: formação em bloco, movimento lateral,
// descida nas bordas e disparo automático.
//
// Arquitetura de posição:
//   posição absoluta = (blockX + relX,  blockY + relY)
//   blockX/blockY → offset do bloco inteiro (atualizado a cada frame)
//   relX/relY     → posição relativa fixa de cada inimigo no bloco
//
//   Vantagem: atualizar apenas blockX/blockY é O(1) independente
//   do número de inimigos, em vez de O(N) se cada um tivesse
//   sua própria posição absoluta.
//
// Dependências:
//   drawSprite  (render/renderer.js)
//   TEX         (render/textureLoader.js)
//   CANVAS_W, CANVAS_H, ENEMY_*, EBULLET_* (constants.js)
// Exporta (global): EnemySystem
// ═══════════════════════════════════════════════════════════════
"use strict";

const EnemySystem = (() => {
  let enemies    = []; // [{col, row, relX, relY, alive}]
  let blockX     = 0;  // offset X do bloco em px
  let blockY     = 0;  // offset Y do bloco em px
  let dir        = 1;  // direção atual: 1=direita, -1=esquerda
  let speed      = ENEMY_SPEED_INIT;
  let eBullets   = []; // [{x, y, active}]
  let shootTimer = 0;

  // Largura total da formação (calculada uma vez — não muda)
  const FORMATION_W = ENEMY_COLS * (ENEMY_W + ENEMY_PAD_X) - ENEMY_PAD_X;
  // Margem interna antes de considerar que bateu na borda
  const BORDER_MARGIN = 10;

  function reset() {
    enemies    = [];
    speed      = ENEMY_SPEED_INIT;
    dir        = 1;
    blockX     = (CANVAS_W - FORMATION_W) / 2; // centraliza
    blockY     = ENEMY_START_Y;
    eBullets   = [];
    shootTimer = 0;

    // Cria a grade de inimigos com posições relativas fixas
    for (let row = 0; row < ENEMY_ROWS; row++) {
      for (let col = 0; col < ENEMY_COLS; col++) {
        enemies.push({
          col,
          row,
          relX:  col * (ENEMY_W + ENEMY_PAD_X), // posição X relativa ao bloco
          relY:  row * (ENEMY_H + ENEMY_PAD_Y), // posição Y relativa ao bloco
          alive: true,
        });
      }
    }
  }

  /** Retorna apenas os inimigos ainda vivos. */
  function aliveList() {
    return enemies.filter(e => e.alive);
  }

  function update(dt) {
    // ── Movimento lateral do bloco ────────────────────────────
    blockX += dir * speed * dt;

    const alive = aliveList();
    if (!alive.length) return;

    // Determina as bordas reais do bloco (apenas inimigos vivos)
    // para que a detecção de borda seja precisa após mortes nas pontas
    let minRelX = Infinity, maxRelX = -Infinity;
    for (const e of alive) {
      if (e.relX < minRelX) minRelX = e.relX;
      if (e.relX > maxRelX) maxRelX = e.relX;
    }
    const leftEdge  = blockX + minRelX;
    const rightEdge = blockX + maxRelX + ENEMY_W;

    // Borda direita: inverte direção e desce
    if (dir === 1 && rightEdge >= CANVAS_W - BORDER_MARGIN) {
      dir     = -1;
      blockY += ENEMY_DROP;
    }
    // Borda esquerda: inverte direção e desce
    else if (dir === -1 && leftEdge <= BORDER_MARGIN) {
      dir     = 1;
      blockY += ENEMY_DROP;
    }

    // ── Disparo automático dos inimigos ───────────────────────
    shootTimer += dt;
    const activeBullets = eBullets.filter(b => b.active).length;

    if (shootTimer >= EBULLET_INTERVAL && activeBullets < EBULLET_MAX) {
      shootTimer = 0;

      // Cada coluna dispara pelo inimigo mais à frente (maior row vivo)
      // — o que estiver mais próximo do jogador na coluna
      const frontEnemies = [];
      for (let col = 0; col < ENEMY_COLS; col++) {
        const colAlive = alive
          .filter(e => e.col === col)
          .sort((a, b) => b.row - a.row); // decrescente por row
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
      b.y += EBULLET_SPEED * dt; // desce
      if (b.y > CANVAS_H) b.active = false;
    }
    // Limpeza periódica do array para não crescer indefinidamente
    if (eBullets.length > 50) eBullets = eBullets.filter(b => b.active);
  }

  function draw() {
    // Inimigos vivos
    for (const e of enemies) {
      if (!e.alive) continue;
      drawSprite(TEX.enemy, blockX + e.relX, blockY + e.relY, ENEMY_W, ENEMY_H);
    }
    // Tiros inimigos
    for (const b of eBullets) {
      if (b.active) drawSprite(TEX.enemyBullet, b.x, b.y, EBULLET_W, EBULLET_H);
    }
  }

  /**
   * Mata um inimigo e acelera o bloco (tensão cresce conforme menos inimigos).
   * @param {object} e  Referência ao inimigo no array enemies
   */
  function killEnemy(e) {
    e.alive = false;
    speed  += ENEMY_SPEED_INC; // bloco acelera a cada morte
  }

  return {
    reset,
    update,
    draw,
    aliveList,
    killEnemy,
    get blockX()   { return blockX; },
    get blockY()   { return blockY; },
    get eBullets() { return eBullets; },
    /** Posição absoluta de um inimigo — usada pelo sistema de colisão. */
    absPos: e => ({ x: blockX + e.relX, y: blockY + e.relY }),
  };
})();