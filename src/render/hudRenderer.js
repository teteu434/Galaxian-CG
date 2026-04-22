// ═══════════════════════════════════════════════════════════════
// src/render/hudRenderer.js
//
// MUDANÇAS NESTA VERSÃO:
//   - renderGameplayTab(): adicionado botão "Controle por Teclado"
//     e bloco de feedback visual (modo ativo) antes dos remaps.
//     Coordenadas Y ajustadas para acomodar o novo conteúdo.
//   - getButtonUnderMouse(): adicionada hit area para 'keyboardControl'
//   - clickCallbacks: adicionada entrada 'keyboardControl'
//   - API pública: adicionados isPopupOpen() e isOptionsOpen()
//     usados por game.js para bloquear Enter durante popups (fix bug).
// ═══════════════════════════════════════════════════════════════
"use strict";

const HUD = (() => {
  const canvas = document.getElementById('hud');
  const ctx    = canvas.getContext('2d');
  let score    = 0;
  let lives    = 3;
  let highScore = 0;
  let newRecord = false;

  let showingPopup  = null;
  let optionsActive = false;
  let optionsTab    = 'gameplay';
  let remappingAction = null;

  // ─── Botões do menu principal ───────────────────────────────
  const menuButtons = [
    { id: 'play',    x: CANVAS_W/2 - 100, y: 280, w: 200, h: 50, text: '▶ JOGAR',    color: '#0f0' },
    { id: 'options', x: CANVAS_W/2 - 100, y: 350, w: 200, h: 50, text: '⚙ OPÇÕES',  color: '#ff0' },
    { id: 'credits', x: CANVAS_W/2 - 100, y: 420, w: 200, h: 50, text: 'ℹ CRÉDITOS', color: '#0ff' }
  ];

  const tutorialButton     = { id: 'start', x: CANVAS_W/2 - 100, y: 520, w: 200, h: 50, text: '🚀 INICIAR JOGO',      color: '#0f0' };
  const skipTutorialButton = { id: 'skip',  x: CANVAS_W/2 -  80, y: 580, w: 160, h: 35, text: 'Pular (já sei jogar)', color: '#888' };

  const postGameButtons = {
    restart: { id: 'restart', x: CANVAS_W/2 - 115, y: CANVAS_H/2 + 75, w: 105, h: 42, text: 'REINICIAR', color: '#0f0' },
    menu:    { id: 'menu',    x: CANVAS_W/2 +  10, y: CANVAS_H/2 + 75, w: 105, h: 42, text: 'MENU',      color: '#0ff' }
  };

  // ─── Botões do menu de opções ────────────────────────────────
  // NOVO: adicionado keyboardControl logo abaixo de mouseControl.
  // Coordenadas Y do restante da aba foram deslocadas +50 para acomodar.
  const optionsButtons = {
    close:           { id: 'close_options',   x: CANVAS_W - 45,    y: 10,  w: 35,  h: 35, text: '✕',                color: '#f00' },
    tabGameplay:     { id: 'tabGameplay',      x: 80,               y: 60,  w: 150, h: 35, text: 'JOGABILIDADE',      color: '#0f0' },
    tabSound:        { id: 'tabSound',         x: 250,              y: 60,  w: 150, h: 35, text: 'SOM',               color: '#0ff' },
    // Botão mouse: mesma posição de antes
    mouseControl:    { id: 'mouseControl',     x: 280,              y: 110, w: 100, h: 30, text: '',                  color: '#ff0', type: 'toggle' },
    // NOVO: botão teclado, logo abaixo do mouse
    keyboardControl: { id: 'keyboardControl',  x: 280,              y: 150, w: 100, h: 30, text: '',                  color: '#ff0', type: 'toggle' },
    // resetControls deslocado +50 (era 330, agora 430) para dar espaço ao bloco de feedback
    resetControls:   { id: 'resetControls',    x: CANVAS_W/2 - 100, y: 430, w: 200, h: 35, text: 'Resetar Controles', color: '#ff0' }
  };

  const remapButtons = {
    keyLeft:  { id: 'remapLeft',  w: 180, h: 30, text: '', color: '#0ff' },
    keyRight: { id: 'remapRight', w: 180, h: 30, text: '', color: '#0ff' },
    keyShoot: { id: 'remapShoot', w: 180, h: 30, text: '', color: '#0ff' }
  };

  let hoveredButton = null;

  let clickCallbacks = {
    play: null, options: null, credits: null,
    start: null, skip: null,
    restart: null, menu: null,
    close_popup: null, close_options: null,
    tabGameplay: null, tabSound: null,
    mouseControl: null,
    keyboardControl: null,  // NOVO
    resetControls: null,
    remapLeft: null, remapRight: null, remapShoot: null,
    uploadShoot: null, uploadEnemyShoot: null, uploadExplosion: null,
    uploadDamage: null, uploadGameOver: null, uploadMusic: null
  };

  // ──────────────── HELPERS ────────────────────────────────────

  function clear() { ctx.clearRect(0, 0, CANVAS_W, CANVAS_H); }

  function drawText(text, x, y, size, color, align = 'center') {
    ctx.font      = `bold ${size}px "Courier New", monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  }

  function drawShadowText(text, x, y, size, color, shadow = '#000') {
    ctx.font      = `bold ${size}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = shadow;
    ctx.fillText(text, x + 2, y + 2);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function drawButton(btn, isHovered) {
    ctx.fillStyle   = isHovered ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.7)';
    ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
    ctx.strokeStyle = isHovered ? '#fff' : (btn.color || '#0ff');
    ctx.lineWidth   = isHovered ? 3 : 2;
    ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);
    drawText(btn.text, btn.x + btn.w / 2, btn.y + btn.h / 2 + 6,
             btn.h <= 35 ? 16 : 20, isHovered ? '#fff' : (btn.color || '#0ff'), 'center');
  }

  function drawHeart(x, y) {
    ctx.fillStyle = '#ff1744';
    ctx.font      = '20px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('❤', x, y + 15);
  }

  function renderSlider(x, y, width, value) {
    ctx.fillStyle = '#333';
    ctx.fillRect(x, y, width, 8);
    ctx.fillStyle = '#0f0';
    ctx.fillRect(x, y, width * value, 8);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + width * value, y + 4, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // ──────────────── ABA JOGABILIDADE ───────────────────────────
  //
  // Mapa de posições Y (nova disposição com botão teclado e feedback):
  //  y=110 : botão mouseControl
  //  y=150 : botão keyboardControl  ← NOVO
  //  y=200 : bloco de feedback visual (modo ativo, 3 linhas ~60px)  ← NOVO
  //  y=270 : título "MAPEAMENTO DE TECLAS"
  //  y=300 : botão remapLeft
  //  y=345 : botão remapRight
  //  y=390 : botão remapShoot
  //  y=430 : botão resetControls
  //
  function renderGameplayTab() {
    const settings = SettingsSystem.getAll();
    let y = 110;

    // ── Botão: Controle por Mouse ──────────────────────────────
    ctx.font      = '14px "Courier New", monospace';
    ctx.fillStyle = '#0ff';
    ctx.textAlign = 'left';
    ctx.fillText('Controle por Mouse:', 100, y + 20);
    const mouseBtn = {
      ...optionsButtons.mouseControl,
      y,
      text: settings.mouseControl ? 'ON' : 'OFF',
      // Verde quando ativo, cinza quando inativo — feedback visual imediato
      color: settings.mouseControl ? '#0f0' : '#888'
    };
    drawButton(mouseBtn, hoveredButton === 'mouseControl');
    y += 50; 

    // ── NOVO: Botão: Controle por Teclado ─────────────────────
    // Posicionado logo abaixo do mouse, mesma lógica de exclusividade.
    ctx.fillStyle = '#0ff';
    ctx.font      = '14px "Courier New", monospace';
    ctx.fillText('Controle por Teclado:', 170, y + 20);
    const keyboardBtn = {
      ...optionsButtons.keyboardControl,
      y,
      text: settings.keyboardControl ? 'ON' : 'OFF',
      color: settings.keyboardControl ? '#0f0' : '#888'
    };
    drawButton(keyboardBtn, hoveredButton === 'keyboardControl');
    y += 50; 

    // ── NOVO: Bloco de feedback visual (modo ativo) ────────────
    // Informa ao jogador quais controles estão em efeito agora.
    // Usa fonte menor para não ocupar muito espaço vertical.
    ctx.font      = '12px "Courier New", monospace';

    if (settings.mouseControl) {
      // Modo mouse ativo
      ctx.fillStyle = '#0f0';
      ctx.fillText('▶ Modo Mouse Ativo:', 225, y + 12);
      ctx.fillStyle = '#aaa';
      ctx.fillText('  • Movimento: siga a posição do mouse', 225, y + 28);
      ctx.fillText('  • Tiro: clique esquerdo ou direito',   225, y + 44);
    } else {
      // Modo teclado ativo
      const leftKeys  = (settings.keyLeft  || []).map(k => k.replace('Arrow','').replace('Key','')).join('/');
      const rightKeys = (settings.keyRight || []).map(k => k.replace('Arrow','').replace('Key','')).join('/');
      const shootKeys = (settings.keyShoot || []).map(k => k.replace('Key','').replace('Space','ESPAÇO')).join('/');

      ctx.fillStyle = '#0f0';
      ctx.fillText('▶ Modo Teclado Ativo:', 225, y + 12);
      ctx.fillStyle = '#aaa';
      ctx.fillText(`  • Movimento: [ ${leftKeys} ] / [ ${rightKeys} ]`, 225, y + 28);
      ctx.fillText(`  • Tiro: [ ${shootKeys} ]`,                         225, y + 44);
    }
    y += 75; 

    // ── Título remapeamento ────────────────────────────────────
    ctx.font      = '14px "Courier New", monospace';
    ctx.fillStyle = '#ff0';
    ctx.fillText('REMAPEAMENTO DE TECLAS', 225, y + 10);
    ctx.fillStyle = '#0ff';
    y += 30;

    // ── Botões de remapeamento ─────────────────────────────────
    // Desabilitados visualmente quando mouseControl está ativo,
    // pois remapear não faz sentido nesse modo.
    const remapColor = settings.mouseControl ? '#444' : '#0ff';

    ctx.fillText('Mover Esquerda:', 100, y + 20);
    const leftKeys  = (settings.keyLeft  || ['ArrowLeft','KeyA']).map(k => k.replace('Arrow','').replace('Key','')).join(' / ');
    remapButtons.keyLeft.x     = 260;
    remapButtons.keyLeft.y     = y;
    remapButtons.keyLeft.text  = leftKeys;
    remapButtons.keyLeft.color = remapColor;

    drawButton(remapButtons.keyLeft, !settings.mouseControl && hoveredButton === 'remapLeft');
    y += 45; // 

    ctx.fillText('Mover Direita:', 100, y + 20);
    const rightKeys = (settings.keyRight || ['ArrowRight','KeyD']).map(k => k.replace('Arrow','').replace('Key','')).join(' / ');
    const rightBtn  = { ...remapButtons.keyRight, x: 260, y, text: rightKeys, color: remapColor };
    drawButton(rightBtn, !settings.mouseControl && hoveredButton === 'remapRight');
    y += 45; // 

    ctx.fillText('Atirar:', 100, y + 20);
    const shootKeys = (settings.keyShoot || ['Space']).map(k => k.replace('Key','')).join(' / ');
    const shootBtn  = { ...remapButtons.keyShoot, x: 260, y, text: shootKeys, color: remapColor };
    drawButton(shootBtn, !settings.mouseControl && hoveredButton === 'remapShoot');
    y += 55; // 

    // ── Botão resetar ──────────────────────────────────────────
    const resetBtn = { ...optionsButtons.resetControls, y };
    drawButton(resetBtn, hoveredButton === 'resetControls');

    // ── Overlay de remapeamento ────────────────────────────────
    if (remappingAction) {
      const bw = 320, bh = 150;
      const bx = CANVAS_W / 2 - bw / 2;
      const by = CANVAS_H / 2 - bh / 2;

      ctx.fillStyle   = 'rgba(0,0,30,0.97)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = '#ff0';
      ctx.lineWidth   = 2;
      ctx.strokeRect(bx, by, bw, bh);

      const actionLabel = remappingAction === 'keyLeft'  ? 'Esquerda' :
                          remappingAction === 'keyRight' ? 'Direita'  : 'Atirar';
      drawShadowText('Pressione uma tecla...', CANVAS_W / 2, by + 48, 20, '#ff0');
      drawText(`Remapeando: ${actionLabel}`, CANVAS_W / 2, by + 84, 15, '#fff');
      drawText('ESC para cancelar',          CANVAS_W / 2, by + 118, 13, '#888');
    }
  }

  // ──────────────── ABA SOM ────────────────────────────────────
  // (sem alterações — mantida idêntica ao original)
  function renderSoundTab() {
    const settings     = SettingsSystem.getAll();
    const customSounds = window.AudioSystem ? AudioSystem.getCustomSounds() : {};
    let y = 100;

    ctx.font      = '14px "Courier New", monospace';
    ctx.fillStyle = '#0ff';
    ctx.textAlign = 'left';

    ctx.fillText('Volume Geral:', 100, y + 13);
    renderSlider(100, y + 20, 260, settings.masterVolume || 0.7);
    ctx.fillText(`${Math.round((settings.masterVolume || 0.7) * 100)}%`, 375, y + 14);
    y += 50;

    ctx.fillText('Volume da Música:', 100, y + 5);
    renderSlider(100, y + 12, 260, settings.musicVolume || 0.5);
    ctx.fillText(`${Math.round((settings.musicVolume || 0.5) * 100)}%`, 375, y + 14);
    y += 50;

    ctx.fillText('Volume dos Efeitos:', 100, y + 5);
    renderSlider(100, y + 12, 260, settings.sfxVolume || 0.8);
    ctx.fillText(`${Math.round((settings.sfxVolume || 0.8) * 100)}%`, 375, y + 14);
    y += 55;

    ctx.fillStyle = '#ff0';
    ctx.fillText('ÁUDIO PERSONALIZADO', 100, y + 5);
    y += 25;

    const uploadList = [
      { id: 'uploadShoot',      text: '🔫 Tiro do Jogador', soundKey: 'playerShoot'     },
      { id: 'uploadEnemyShoot', text: '👾 Tiro do Inimigo', soundKey: 'enemyShoot'      },
      { id: 'uploadExplosion',  text: '💥 Explosão',        soundKey: 'explosion'       },
      { id: 'uploadDamage',     text: '💔 Dano',            soundKey: 'damage'          },
      { id: 'uploadGameOver',   text: '💀 Game Over',       soundKey: 'gameOver'        },
      { id: 'uploadMusic',      text: '🎵 Música de Fundo', soundKey: 'backgroundMusic' }
    ];

    for (const item of uploadList) {
      const btn = { id: item.id, x: 100, y, w: 280, h: 32, text: item.text, color: '#0ff' };
      drawButton(btn, hoveredButton === item.id);
      if (customSounds[item.soundKey]) {
        ctx.fillStyle = '#0f0';
        ctx.font      = '11px "Courier New", monospace';
        ctx.textAlign = 'left';
        ctx.fillText('✓ Carregado', btn.x + btn.w + 8, y + 22);
      }
      y += 42;
    }
  }

  // ──────────────── MENU DE OPÇÕES ─────────────────────────────
  function renderOptionsMenu() {
    if (!optionsActive) return;
    ctx.fillStyle = 'rgba(0,0,0,0.95)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    drawShadowText('⚙ OPÇÕES', CANVAS_W / 2, 35, 28, '#ff0');
    drawButton({ ...optionsButtons.close }, hoveredButton === 'close_options');

    const isGameplay = optionsTab === 'gameplay';
    drawButton({ ...optionsButtons.tabGameplay, color: isGameplay  ? '#0f0' : '#888' }, hoveredButton === 'tabGameplay');
    drawButton({ ...optionsButtons.tabSound,    color: !isGameplay ? '#0f0' : '#888' }, hoveredButton === 'tabSound');

    if (isGameplay) renderGameplayTab();
    else            renderSoundTab();
  }

  // ──────────────── MENU PRINCIPAL ─────────────────────────────
  function renderMenu() {
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    drawShadowText('⚡ GALAXIAN WebGL ⚡', CANVAS_W / 2, 120, 36, '#ff0', '#00f');
    drawText('O Clássico Arcade', CANVAS_W / 2, 165, 16, '#0ff');
    drawText(`🏆 HIGH SCORE: ${highScore}`, CANVAS_W / 2, 210, 14, '#ff0');
    ctx.strokeStyle = '#0ff';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(80, 235);
    ctx.lineTo(CANVAS_W - 80, 235);
    ctx.stroke();
    for (const btn of menuButtons) drawButton(btn, hoveredButton === btn.id);
    drawText('Use o MOUSE para navegar', CANVAS_W / 2, CANVAS_H - 50, 12, '#888');
    drawText('versão 2.0', CANVAS_W - 60, CANVAS_H - 20, 10, '#555', 'right');
  }

  // ──────────────── TUTORIAL ───────────────────────────────────
  function renderTutorial() {
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    drawShadowText('📖 TUTORIAL', CANVAS_W / 2, 70, 32, '#ff0');
    ctx.font      = '15px "Courier New", monospace';
    ctx.fillStyle = '#0ff';
    ctx.textAlign = 'left';

    const instructions = [
      '🎮 CONTROLES:','',
      '• Movimento: ← → / A D ou Mouse',
      '• Atirar: ESPAÇO ou Clique',
      '• P ou ESC → Pausar',
      '• R → Reiniciar','',
      '🎯 OBJETIVO:','Destrua todos os inimigos!','',
      '⭐ DICA 1:','Use teclado OU mouse, não os dois.',
      '⭐ DICA 2:','Altere controles em Opções.'
    ];

    let y = 130;
    for (const line of instructions) {
      if (line === '') { y += 12; continue; }
      ctx.fillStyle = line.startsWith('🎮') || line.startsWith('🎯') || line.startsWith('⭐') ? '#ff0' : '#0ff';
      ctx.fillText(line, 60, y);
      y += 28;
    }
    drawButton(tutorialButton, hoveredButton === 'start');
    if (localStorage.getItem(TUTORIAL_COMPLETED_KEY) === 'true') {
      drawButton(skipTutorialButton, hoveredButton === 'skip');
    }
  }

  // ──────────────── HUD IN-GAME ────────────────────────────────
  function renderGameHUD(kills) {
    score = kills * 100;
    drawText(`PONTOS: ${score}`, 16, 22, 14, '#0ff', 'left');
    drawText(`🏆 RECORDE: ${highScore}`, 16, 42, 12, '#ff0', 'left');
    const heartX = CANVAS_W - 100;
    for (let i = 0; i < lives; i++) drawHeart(heartX + i * 25, 15);
  }

  // ──────────────── PAUSA ──────────────────────────────────────
  function renderPauseOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    drawShadowText('⏸  PAUSADO', CANVAS_W / 2, CANVAS_H / 2 - 16, 32, '#ffff00');
    drawText('Pressione P ou ESC para continuar', CANVAS_W / 2, CANVAS_H / 2 + 24, 13, 'rgba(255,255,255,0.6)');
    drawButton(postGameButtons.restart, hoveredButton === 'restart');
    drawButton(postGameButtons.menu,    hoveredButton === 'menu');
  }

  // ──────────────── CRÉDITOS ───────────────────────────────────
  function renderCreditsPopup() {
    ctx.fillStyle = 'rgba(0,0,0,0.95)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    drawShadowText('🌟 CRÉDITOS 🌟', CANVAS_W / 2, 150, 28, '#ff0');
    ctx.font      = '14px "Courier New", monospace';
    ctx.fillStyle = '#0ff';
    ctx.textAlign = 'center';
    ctx.fillText('Desenvolvido com WebGL e Canvas 2D', CANVAS_W / 2, 230);
    ctx.fillText('Inspirado no clássico GALAXIAN (1979)', CANVAS_W / 2, 270);
    ctx.fillText('Efeitos visuais: Shaders personalizados', CANVAS_W / 2, 310);
    ctx.fillText('Música e SFX: Síntese procedural', CANVAS_W / 2, 350);
    drawText('[ Clique para fechar ]', CANVAS_W / 2, 520, 14, '#888');
  }

  // ──────────────── GAME OVER ──────────────────────────────────
  function renderGameOverOverlay(kills) {
    score = kills * 100;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    drawShadowText('GAME OVER', CANVAS_W / 2, CANVAS_H / 2 - 60, 42, '#ff1744');
    drawText(`PONTOS FINAIS: ${score}`, CANVAS_W / 2, CANVAS_H / 2 - 10, 20, '#fff');
    drawText(`🏆 RECORDE: ${highScore}`,  CANVAS_W / 2, CANVAS_H / 2 + 25, 15, '#ff0');
    if (newRecord) drawShadowText('✨ NOVO RECORDE! ✨', CANVAS_W / 2, CANVAS_H / 2 + 55, 16, '#ff0');
    drawButton(postGameButtons.restart, hoveredButton === 'restart');
    drawButton(postGameButtons.menu,    hoveredButton === 'menu');
    drawText('ou pressione R para reiniciar', CANVAS_W / 2, CANVAS_H / 2 + 130, 12, '#555');
  }

  // ──────────────── VITÓRIA ────────────────────────────────────
  function renderWinOverlay(kills) {
    score = kills * 100;
    ctx.fillStyle = 'rgba(0,0,40,0.80)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    drawShadowText('VOCÊ VENCEU! 🏅', CANVAS_W / 2, CANVAS_H / 2 - 60, 38, '#00e676');
    drawText(`PONTOS: ${score}`,       CANVAS_W / 2, CANVAS_H / 2 - 10, 20, '#fff');
    drawText(`🏆 RECORDE: ${highScore}`, CANVAS_W / 2, CANVAS_H / 2 + 25, 15, '#ff0');
    if (newRecord) drawShadowText('✨ NOVO RECORDE! ✨', CANVAS_W / 2, CANVAS_H / 2 + 55, 16, '#ff0');
    drawButton(postGameButtons.restart, hoveredButton === 'restart');
    drawButton(postGameButtons.menu,    hoveredButton === 'menu');
    drawText('ou pressione R para reiniciar', CANVAS_W / 2, CANVAS_H / 2 + 130, 12, '#555');
  }

  // ──────────────── CONFIRMAÇÃO ────────────────────────────────
  function renderConfirmOverlay(kills) {
    renderGameHUD(kills);
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle   = '#000122';
    ctx.strokeStyle = '#0ff';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(CANVAS_W / 2 - 160, CANVAS_H / 2 - 70, 320, 140, 8);
    else               ctx.rect(CANVAS_W / 2 - 160, CANVAS_H / 2 - 70, 320, 140);
    ctx.fill();
    ctx.stroke();
    drawShadowText('Deseja reiniciar?', CANVAS_W / 2, CANVAS_H / 2 - 28, 24, '#fff');
    drawText('[ ENTER ] Sim     [ ESC ] Não', CANVAS_W / 2, CANVAS_H / 2 + 14, 15, '#0ff');
  }

  // ──────────────── RENDER PRINCIPAL ───────────────────────────
  function render(state, kills = 0, currentLives = 3, currentHighScore = 0) {
    lives     = currentLives;
    highScore = currentHighScore;
    clear();
    if (optionsActive)              { renderOptionsMenu();  return; }
    if (showingPopup === 'credits') { renderCreditsPopup(); return; }
    switch (state) {
      case STATE_MENU:     renderMenu();                               break;
      case STATE_TUTORIAL: renderTutorial();                           break;
      case STATE_RUNNING:  renderGameHUD(kills);                       break;
      case STATE_PAUSED:   renderGameHUD(kills); renderPauseOverlay(); break;
      case STATE_GAMEOVER: renderGameOverOverlay(kills);               break;
      case STATE_WIN:      renderWinOverlay(kills);                    break;
      case STATE_CONFIRM:  renderConfirmOverlay(kills);                break;
    }
  }

  // ──────────────── DETECÇÃO DE HOVER / CLIQUE ─────────────────
  function getButtonUnderMouse(mx, my) {
    if (optionsActive) {
      const c = optionsButtons.close;
      if (mx >= c.x && mx <= c.x + c.w && my >= c.y && my <= c.y + c.h) return 'close_options';

      const tg = optionsButtons.tabGameplay;
      if (mx >= tg.x && mx <= tg.x + tg.w && my >= tg.y && my <= tg.y + tg.h) return 'tabGameplay';
      const ts = optionsButtons.tabSound;
      if (mx >= ts.x && mx <= ts.x + ts.w && my >= ts.y && my <= ts.y + ts.h) return 'tabSound';

      if (optionsTab === 'gameplay') {
        // Mouse control (y=110..140)
        if (mx >= 280 && mx <= 380 && my >= 110 && my <= 140) return 'mouseControl';
        // NOVO: Keyboard control (y=150..180)
        if (mx >= 280 && mx <= 380 && my >= 150 && my <= 180) return 'keyboardControl';

        // Remap buttons: desabilitados quando mouseControl ativo
        if (!SettingsSystem.get('mouseControl')) {
          // y ajustados: remapLeft=300, remapRight=345, remapShoot=390
          if (mx >= 260 && mx <= 440 && my >= 300 && my <= 330) return 'remapLeft';
          if (mx >= 260 && mx <= 440 && my >= 345 && my <= 375) return 'remapRight';
          if (mx >= 260 && mx <= 440 && my >= 390 && my <= 420) return 'remapShoot';
        }
        // resetControls: y=430
        if (mx >= CANVAS_W/2 - 100 && mx <= CANVAS_W/2 + 100 && my >= 430 && my <= 465) return 'resetControls';

      } else {
        if (mx >= 95 && mx <= 370) {
          if (my >= 100 && my <= 125) return 'slider_masterVolume';
          if (my >= 150 && my <= 175) return 'slider_musicVolume';
          if (my >= 200 && my <= 225) return 'slider_sfxVolume';
        }
        const uploadYPositions = [280, 322, 364, 406, 448, 490];
        const uploadIds        = ['uploadShoot', 'uploadEnemyShoot', 'uploadExplosion',
                                  'uploadDamage', 'uploadGameOver', 'uploadMusic'];
        for (let i = 0; i < uploadYPositions.length; i++) {
          if (mx >= 100 && mx <= 380 && my >= uploadYPositions[i] && my <= uploadYPositions[i] + 32) {
            return uploadIds[i];
          }
        }
      }
      return null;
    }

    if (showingPopup === 'credits') return 'close_popup';

    if (GameState.is(STATE_MENU)) {
      for (const btn of menuButtons) {
        if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) return btn.id;
      }
    }

    if (GameState.is(STATE_TUTORIAL)) {
      if (mx >= tutorialButton.x && mx <= tutorialButton.x + tutorialButton.w &&
          my >= tutorialButton.y && my <= tutorialButton.y + tutorialButton.h) return 'start';
      if (localStorage.getItem(TUTORIAL_COMPLETED_KEY) === 'true' &&
          mx >= skipTutorialButton.x && mx <= skipTutorialButton.x + skipTutorialButton.w &&
          my >= skipTutorialButton.y && my <= skipTutorialButton.y + skipTutorialButton.h) return 'skip';
    }

    if (GameState.is(STATE_GAMEOVER) || GameState.is(STATE_WIN) || GameState.is(STATE_PAUSED) || GameState.is(STATE_CONFIRM)) {
      const r = postGameButtons.restart;
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return 'restart';
      const m = postGameButtons.menu;
      if (mx >= m.x && mx <= m.x + m.w && my >= m.y && my <= m.y + m.h) return 'menu';
    }

    return null;
  }

  function handleSliderClick(mx, sliderId) {
    let value = Math.max(0, Math.min(1, (mx - 100) / 260));
    if      (sliderId === 'slider_masterVolume') SettingsSystem.set('masterVolume', value);
    else if (sliderId === 'slider_musicVolume')  SettingsSystem.set('musicVolume',  value);
    else if (sliderId === 'slider_sfxVolume')    SettingsSystem.set('sfxVolume',    value);
    return true;
  }

  function handleClick(mx, my, callbacks) {
    Object.assign(clickCallbacks, callbacks);
    if (showingPopup === 'credits') { showingPopup = null; return true; }
    if (optionsActive && optionsTab === 'sound' && mx >= 95 && mx <= 370) {
      if (my >= 100 && my <= 125) return handleSliderClick(mx, 'slider_masterVolume');
      if (my >= 150 && my <= 175) return handleSliderClick(mx, 'slider_musicVolume');
      if (my >= 200 && my <= 225) return handleSliderClick(mx, 'slider_sfxVolume');
    }
    const buttonId = getButtonUnderMouse(mx, my);
    if (!buttonId) return false;
    if (buttonId.startsWith('slider_')) return handleSliderClick(mx, buttonId);
    if (clickCallbacks[buttonId]) { clickCallbacks[buttonId](); return true; }
    return false;
  }

  function updateHover(mx, my) {
    hoveredButton = getButtonUnderMouse(mx, my);
  }

  // ──────────────── API PÚBLICA ─────────────────────────────────
  function setLives(l)     { lives     = l; }
  function setHighScore(h) { highScore = h; }
  function setNewRecord(v) { newRecord = v; }
  function setTab(tab)     { optionsTab = tab; }

  function showOptions()   { optionsActive = true;  optionsTab = 'gameplay'; showingPopup = null; remappingAction = null; }
  function closeOptions()  { optionsActive = false; remappingAction = null; }
  function showPopup(type) { showingPopup = type;   optionsActive = false; }
  function closePopup()    { showingPopup = null; }

  function startRemapping(action) { remappingAction = action; }
  function cancelRemapping()      { remappingAction = null;   }
  function isRemapping()          { return remappingAction !== null; }
  function getRemappingAction()   { return remappingAction; }

  // ── NOVO: funções de estado para game.js (fix do bug do Enter) ─
  // game.js verifica esses dois antes de processar Enter no menu.
  function isPopupOpen()   { return showingPopup !== null; }
  function isOptionsOpen() { return optionsActive; }

  return {
    render, handleClick, updateHover,
    setLives, setHighScore, setNewRecord, setTab,
    showOptions, closeOptions,
    showPopup, closePopup,
    startRemapping, cancelRemapping,
    isRemapping, getRemappingAction,
    // NOVO: expostos para game.js
    isPopupOpen, isOptionsOpen,
    get score()     { return score;     },
    get highScore() { return highScore; }
  };
})();

// Polyfill roundRect para browsers mais antigos
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
    return this;
  };
}