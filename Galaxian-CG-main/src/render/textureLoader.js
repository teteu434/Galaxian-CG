// ═══════════════════════════════════════════════════════════════
// src/render/textureLoader.js
// Geração procedural de texturas via Canvas 2D → GPU.
//
// Por que procedural em vez de arquivos PNG externos?
//   - Funciona sem servidor HTTP (sem CORS ao abrir file://)
//   - Zero dependências de assets externos
//   - Facilidade de ajuste de visual direto no código
//
// Fluxo: draw(ctx) → <canvas> temporário → gl.texImage2D → WebGLTexture
//
// Dependências: GL (glContext.js)
//               PLAYER_W/H, ENEMY_W/H, BULLET_W/H,
//               EBULLET_W/H, CANVAS_W/H  (constants.js)
// Exporta (global): TEX
// ═══════════════════════════════════════════════════════════════
"use strict";

/**
 * Cria uma WebGLTexture a partir de uma função de desenho 2D.
 * @param {function} draw  Recebe (ctx, w, h) e desenha no canvas
 * @param {number}   w     Largura do canvas temporário
 * @param {number}   h     Altura do canvas temporário
 */
function makeTexture(draw, w, h) {
  const { gl } = GL;

  // Canvas temporário — descartado após upload à GPU
  const c   = document.createElement('canvas');
  c.width   = w;
  c.height  = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  // NEAREST: preserva aparência pixelada / retro (sem interpolação bilinear)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  // CLAMP_TO_EDGE: evita artefatos de borda em quads alinhados à pixel grid
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  return tex;
}

// ── Funções de desenho de cada sprite ────────────────────────

function drawPlayer(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  // Corpo principal (triângulo futurista)
  ctx.fillStyle = '#00e5ff';
  ctx.beginPath();
  ctx.moveTo(w/2, 2);
  ctx.lineTo(w-4, h-4);
  ctx.lineTo(w/2, h-12);
  ctx.lineTo(4, h-4);
  ctx.closePath();
  ctx.fill();
  // Motor / glow traseiro
  ctx.fillStyle = '#fff';
  ctx.fillRect(w/2-4, h-14, 8, 6);
  // Asas escuras
  ctx.fillStyle = '#0088aa';
  ctx.beginPath();
  ctx.moveTo(4, h-4); ctx.lineTo(w/2-4, h-14); ctx.lineTo(w/2, h-4);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w-4, h-4); ctx.lineTo(w/2+4, h-14); ctx.lineTo(w/2, h-4);
  ctx.closePath(); ctx.fill();
  // Cockpit
  ctx.fillStyle = '#80ffff';
  ctx.beginPath();
  ctx.ellipse(w/2, h/2-2, 5, 8, 0, 0, Math.PI*2);
  ctx.fill();
}

function drawEnemy(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  // Cabeça
  ctx.fillStyle = '#ff3d00';
  ctx.beginPath();
  ctx.ellipse(w/2, h/2-4, 10, 8, 0, 0, Math.PI*2);
  ctx.fill();
  // Olhos amarelos
  ctx.fillStyle = '#ffeb3b';
  ctx.beginPath(); ctx.arc(w/2-4, h/2-6, 3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(w/2+4, h/2-6, 3, 0, Math.PI*2); ctx.fill();
  // Patas
  ctx.strokeStyle = '#ff7043'; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const py = h/2 - 2 + i * 5;
    ctx.beginPath(); ctx.moveTo(w/2-10, py); ctx.lineTo(w/2-16, py+4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w/2+10, py); ctx.lineTo(w/2+16, py+4); ctx.stroke();
  }
  // Corpo
  ctx.fillStyle = '#b71c1c';
  ctx.beginPath();
  ctx.ellipse(w/2, h/2+4, 7, 8, 0, 0, Math.PI*2);
  ctx.fill();
}

function drawBullet(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  // Gradiente verde-ciano de baixo para cima (sobe na tela)
  const grad = ctx.createLinearGradient(0, h, 0, 0);
  grad.addColorStop(0,   'rgba(0,255,200,0)');
  grad.addColorStop(0.5, 'rgba(0,255,200,1)');
  grad.addColorStop(1,   '#ffffff');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(1, 0, w-2, h, 3);
  ctx.fill();
}

function drawEnemyBullet(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  // Gradiente vermelho-laranja de cima para baixo (desce na tela)
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0,   '#ff1744');
  grad.addColorStop(0.5, '#ff6d00');
  grad.addColorStop(1,   'rgba(255,23,68,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(1, 0, w-2, h, 3);
  ctx.fill();
}

function drawBackground(ctx, w, h) {
  ctx.fillStyle = '#000814';
  ctx.fillRect(0, 0, w, h);
  // Estrelas com seed LCG determinístico — mesma aparência a cada reinício
  let s = 42;
  function rng() {
    // Linear Congruential Generator simples
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  }
  for (let i = 0; i < 180; i++) {
    ctx.fillStyle = `rgba(200,220,255,${rng() * 0.8 + 0.2})`;
    ctx.beginPath();
    ctx.arc(rng() * w, rng() * h, rng() * 1.5 + 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Nebulosa roxa sutil para dar profundidade
  const g = ctx.createRadialGradient(w*0.5, h*0.3, 0, w*0.5, h*0.3, w*0.5);
  g.addColorStop(0, 'rgba(30,0,60,0.4)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// ── Objeto de texturas — criado uma única vez na inicialização ─
const TEX = {
  player:      makeTexture(drawPlayer,      PLAYER_W,  PLAYER_H),
  enemy:       makeTexture(drawEnemy,       ENEMY_W,   ENEMY_H),
  bullet:      makeTexture(drawBullet,      BULLET_W,  BULLET_H),
  enemyBullet: makeTexture(drawEnemyBullet, EBULLET_W, EBULLET_H),
  background:  makeTexture(drawBackground,  CANVAS_W,  CANVAS_H),
};