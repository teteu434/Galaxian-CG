// ═══════════════════════════════════════════════════════════════
// src/render/glContext.js
// Inicialização do contexto WebGL, compilação dos shaders,
// linkagem do programa e criação dos VBOs compartilhados.
//
// Encapsulado no objeto GL para não poluir o escopo global com
// dezenas de variáveis soltas.
//
// Dependências: VERT_SRC, FRAG_SRC (shaders.js)
//               CANVAS_W, CANVAS_H  (constants.js)
// Exporta (global): GL
// ═══════════════════════════════════════════════════════════════
"use strict";

const GL = (() => {
  const canvas = document.getElementById('glCanvas');
  const gl     = canvas.getContext('webgl', { alpha: false });
  if (!gl) throw new Error('WebGL não disponível neste navegador.');

  // ── Compilação de um shader individual ───────────────────────
  function compileShader(type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  // ── Linkagem do programa WebGL ────────────────────────────────
  const vert    = compileShader(gl.VERTEX_SHADER,   VERT_SRC);
  const frag    = compileShader(gl.FRAGMENT_SHADER, FRAG_SRC);
  const program = gl.createProgram();
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
  }
  gl.useProgram(program);

  // ── Localização de atributos e uniformes ─────────────────────
  // Resolvidos UMA VEZ na inicialização — evita lookups custosos por frame.
  const locs = {
    aPosition:   gl.getAttribLocation(program,  'aPosition'),
    aTexCoord:   gl.getAttribLocation(program,  'aTexCoord'),
    uResolution: gl.getUniformLocation(program, 'uResolution'),
    uTransform:  gl.getUniformLocation(program, 'uTransform'),
    uTexture:    gl.getUniformLocation(program, 'uTexture'),
    uTint:       gl.getUniformLocation(program, 'uTint'),
    uAlpha:      gl.getUniformLocation(program, 'uAlpha'),
  };

  // ── VBOs do quad compartilhado ────────────────────────────────
  // Todos os sprites são um quad 2D normalizado [0,1]×[0,1].
  // A geometria nunca muda — apenas uTransform muda por sprite.
  // Criar os buffers aqui uma única vez evita alocações por frame.

  const posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0, 0,   1, 0,   0, 1,   1, 1,  // TRIANGLE_STRIP: 2 triângulos = 1 quad
  ]), gl.STATIC_DRAW);

  const uvBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0, 0,   1, 0,   0, 1,   1, 1,  // UVs correspondentes aos vértices
  ]), gl.STATIC_DRAW);

  // ── Configurações globais ─────────────────────────────────────
  // Alpha blending: permite transparência nas texturas PNG
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // Resolução definida uma única vez (canvas não é redimensionado)
  gl.uniform2f(locs.uResolution, CANVAS_W, CANVAS_H);
  // Textura sempre na unit 0
  gl.uniform1i(locs.uTexture, 0);

  return { gl, locs, posBuffer, uvBuffer };
})();