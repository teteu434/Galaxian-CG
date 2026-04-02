// ═══════════════════════════════════════════════════════════════
// src/render/hudRenderer.js
// HUD renderizado em Canvas 2D sobre o canvas WebGL.
//
// Por que Canvas 2D para texto e não WebGL puro?
//   WebGL não tem suporte nativo a texto vetorial. Implementar
//   fontes em WebGL exigiria um font atlas (bitmap de glifos) +
//   geometria por caractere — complexidade desnecessária para um HUD.
//   Canvas 2D é a solução prática e idiomática neste contexto.
//
// O canvas #hud fica sobreposto ao #glCanvas via CSS (position:absolute).
// pointer-events:none garante que cliques passem para o canvas WebGL.
//
// Dependências:
//   CANVAS_W, CANVAS_H, STATE_* (constants.js)
// Exporta (global): HUD
// ═══════════════════════════════════════════════════════════════
"use strict";

const HUD = (() => {
  const canvas = document.getElementById('hud');
  const ctx    = canvas.getContext('2d');
  let score    = 0;

  /** Limpa todo o canvas do HUD. */
  function clear() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  }

  /**
   * Desenha texto simples.
   * @param {string} text
   * @param {number} x
   * @param {number} y
   * @param {number} size   Tamanho da fonte em px
   * @param {string} color  Cor CSS
   * @param {string} align  'left' | 'center' | 'right'
   */
  function drawText(text, x, y, size, color, align = 'center') {
    ctx.font      = `bold ${size}px "Courier New", monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  }

  /**
   * Desenha texto com sombra deslocada (legibilidade sobre qualquer fundo).
   */
  function drawShadowText(text, x, y, size, color, shadow = '#000') {
    ctx.font      = `bold ${size}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = shadow;
    ctx.fillText(text, x + 2, y + 2); // sombra deslocada 2px
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  /**
   * Renderiza o HUD completo para o estado atual.
   * @param {string} state  Estado atual do jogo (STATE_*)
   * @param {number} kills  Número de inimigos eliminados
   */
  function render(state, kills) {
    clear();

    // ── Pontuação (sempre visível) ────────────────────────────
    score = kills * 100;
    drawText(`PONTOS: ${score}`, 16, 22, 14, '#0ff', 'left');

    // Linha separadora na parte inferior
    ctx.strokeStyle = '#0ff3';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_H - 45);
    ctx.lineTo(CANVAS_W, CANVAS_H - 45);
    ctx.stroke();

    // ── Overlay de PAUSADO ────────────────────────────────────
    if (state === STATE_PAUSED) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      drawShadowText('⏸  PAUSADO', CANVAS_W / 2, CANVAS_H / 2 - 16, 32, '#ffff00');
      drawText('Pressione P ou ESC para continuar', CANVAS_W / 2, CANVAS_H / 2 + 24, 13, 'rgba(255,255,255,0.6)');
    }

    // ── Overlay de GAME OVER ──────────────────────────────────
    if (state === STATE_GAMEOVER) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      drawShadowText('GAME OVER', CANVAS_W / 2, CANVAS_H / 2 - 30, 42, '#ff1744');
      drawText(`PONTOS FINAIS: ${score}`, CANVAS_W / 2, CANVAS_H / 2 + 14, 18, '#fff');
      drawText('Pressione R para reiniciar', CANVAS_W / 2, CANVAS_H / 2 + 44, 14, '#aaa');
    }

    // ── Overlay de VITÓRIA ────────────────────────────────────
    if (state === STATE_WIN) {
      ctx.fillStyle = 'rgba(0,0,40,0.75)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      drawShadowText('VOCÊ VENCEU!', CANVAS_W / 2, CANVAS_H / 2 - 30, 38, '#00e676');
      drawText(`PONTOS: ${score}`, CANVAS_W / 2, CANVAS_H / 2 + 14, 18, '#fff');
      drawText('Pressione R para reiniciar', CANVAS_W / 2, CANVAS_H / 2 + 44, 14, '#aaa');
    }

    // ── Overlay de CONFIRMAÇÃO DE REINÍCIO ────────────────────
    if (state === STATE_CONFIRM) {
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Caixa de diálogo com borda ciano
      ctx.fillStyle   = '#000122';
      ctx.strokeStyle = '#0ff';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.roundRect(CANVAS_W / 2 - 160, CANVAS_H / 2 - 70, 320, 140, 8);
      ctx.fill();
      ctx.stroke();

      drawShadowText('Deseja reiniciar?', CANVAS_W / 2, CANVAS_H / 2 - 28, 24, '#fff');
      drawText('[ ENTER ] Sim     [ ESC ] Não', CANVAS_W / 2, CANVAS_H / 2 + 14, 15, '#0ff');
    }
  }

  return {
    render,
    get score() { return score; },
  };
})();