// ═══════════════════════════════════════════════════════════════
// src/systems/levelSystem.js
// Sistema de fases infinitas com progressão dinâmica de dificuldade.
//
// Responsabilidades:
//   · Rastrear o número da fase atual
//   · Calcular parâmetros de dificuldade por fase (uma única fonte de verdade)
//   · Gerenciar o timer de transição entre fases
//
// Arquitetura de dificuldade:
//   Cada parâmetro tem um valor BASE (fase 1) e um CAP (teto absoluto).
//   As fórmulas aplicam curvas exponenciais suaves para que:
//     - Os primeiros níveis sejam acessíveis para novos jogadores
//     - O jogo fique progressivamente difícil, não impossível de repente
//     - A dificuldade se estabilize nos caps antes de virar absurdo
//
// Como ajustar o ritmo:
//   Edite APENAS o bloco DIFFICULTY_CONFIG abaixo.
//   Não espalhe números mágicos pelo restante do código.
//
// Dependências: nenhuma (puro JS, sem globals de outros módulos)
// Exporta (global): LevelSystem, STATE_LEVEL_TRANSITION
// ═══════════════════════════════════════════════════════════════
"use strict";

// Novo estado de máquina de estados.
// Se o projeto já tiver um constants.js, mova esta linha para lá.
const STATE_LEVEL_TRANSITION = 'level_transition';

const LevelSystem = (() => {

  // ╔══════════════════════════════════════════════════════════╗
  // ║          CONFIGURAÇÃO DE DIFICULDADE                     ║
  // ║  Edite esta seção para ajustar a progressão do jogo.     ║
  // ║  NUNCA coloque valores mágicos fora deste bloco.         ║
  // ╚══════════════════════════════════════════════════════════╝
  const DIFFICULTY_CONFIG = {
    BASE: {
      enemySpeed:    40,    // px/s — velocidade do bloco de inimigos na fase 1
      speedInc:       8,    // px/s por morte — aceleração intra-fase (tensão crescente)
      fireInterval:   2.5,  // s   — intervalo mínimo entre disparos do inimigo
      maxBullets:     3,    // máx de projéteis inimigos simultâneos
      rows:           4,    // linhas de inimigos na formação inicial
      cols:           8,    // colunas de inimigos na formação inicial
      dropAmount:    20,    // px descidos a cada toque na borda lateral
    },
    CAPS: {
      enemySpeed:   320,    // teto absoluto de velocidade (canvas de 640px → 2s de travessia)
      speedInc:      30,    // teto da aceleração por morte
      fireInterval:   0.35, // piso do intervalo de disparo (ainda dodgeable com reação humana)
      maxBullets:    10,    // teto de projéteis simultâneos
      rows:           7,    // teto de linhas (acima disso a formação chega rápido demais)
      cols:          12,    // teto de colunas (limite visual seguro para um canvas de 640px)
    },
    // Duração da tela de transição entre fases (segundos)
    TRANSITION_DURATION: 2.5,
  };

  // ─────────────────────────────────────────────────────────────
  // Estado interno
  // ─────────────────────────────────────────────────────────────
  let currentLevel    = 1;
  let transitioning   = false;
  let transitionTimer = 0;

  // ╔══════════════════════════════════════════════════════════╗
  // ║          FÓRMULAS DE PROGRESSÃO                          ║
  // ╚══════════════════════════════════════════════════════════╝
  //
  // Todas as curvas são exponenciais com clamp no CAP.
  // Visão geral da progressão (valores aproximados):
  //
  //  Parâmetro        │ Fase 1 │ Fase 5 │ Fase 10 │ Fase 15 │ Teto
  // ──────────────────┼────────┼────────┼─────────┼─────────┼──────
  //  Vel. inimigo px/s│   80   │  117   │   192   │   312*  │  320
  //  Aceleração/morte │    8   │  10.9  │    15   │   20.7  │   30
  //  Intervalo tiro s │   2.5  │  1.72  │   1.07  │   0.66  │  0.35
  //  Projéteis simult.│    3   │    4   │     5   │     6   │   10
  //  Linhas × colunas │  4×8   │  5×8   │   6×9   │   7×10  │  7×12
  //  Total inimigos   │   32   │   40   │    54   │    70   │   84
  //
  //  * atingirá o cap antes da fase 15

  function _computeParams(level) {
    const n = level - 1; // expoente 0-based (fase 1 → n=0, sem modificação)

    const { BASE, CAPS } = DIFFICULTY_CONFIG;

    // Velocidade base: cresce ~10% por fase (exponencial suave)
    const enemySpeed = Math.min(
      BASE.enemySpeed * Math.pow(1.10, n),
      CAPS.enemySpeed
    );

    // Aceleração por morte: cresce ~7% por fase (mais devagar que a vel. base)
    const speedInc = Math.min(
      BASE.speedInc * Math.pow(1.07, n),
      CAPS.speedInc
    );

    // Intervalo de disparo: cai ~10% por fase → inimigos atiram mais rápido
    const fireInterval = Math.max(
      BASE.fireInterval * Math.pow(0.90, n),
      CAPS.fireInterval
    );

    // Projéteis simultâneos: +1 a cada 3 fases (escada discreta)
    const maxBullets = Math.min(
      BASE.maxBullets + Math.floor(n / 3),
      CAPS.maxBullets
    );

    // Linhas: +1 a cada 4 fases
    const rows = Math.min(
      BASE.rows + Math.floor(n / 4),
      CAPS.rows
    );

    // Colunas: +1 a cada 5 fases
    const cols = Math.min(
      BASE.cols + Math.floor(n / 5),
      CAPS.cols
    );

    return {
      enemySpeed,
      speedInc,
      fireInterval,
      maxBullets,
      rows,
      cols,
      dropAmount: BASE.dropAmount, // constante por ora; escalar aqui se desejar
    };
  }

  // ─────────────────────────────────────────────────────────────
  // API pública
  // ─────────────────────────────────────────────────────────────

  /** Reinicia o sistema para a fase 1 (chamado em Game.resetAll). */
  function reset() {
    currentLevel    = 1;
    transitioning   = false;
    transitionTimer = 0;
  }

  /**
   * Conclui a fase atual e prepara a transição para a próxima.
   * Chamado por game.js quando todos os inimigos são eliminados.
   */
  function nextLevel() {
    currentLevel++;
    transitioning   = true;
    transitionTimer = 0;
  }

  /**
   * Atualiza o timer de transição. Deve ser chamado a cada frame
   * quando o estado é STATE_LEVEL_TRANSITION.
   *
   * @param {number} dt  Delta time em segundos
   * @returns {boolean}  true quando a transição termina (hora de spawnar a wave)
   */
  function update(dt) {
    if (!transitioning) return false;
    transitionTimer += dt;
    if (transitionTimer >= DIFFICULTY_CONFIG.TRANSITION_DURATION) {
      transitioning = false;
      return true; // sinal: spawn próxima wave
    }
    return false;
  }

  return {
    reset,
    nextLevel,
    update,

    /** Parâmetros de dificuldade da fase atual. */
    params: () => _computeParams(currentLevel),

    /** Número da fase atual (1-based). */
    get current()       { return currentLevel; },

    /** true durante a transição entre fases. */
    get transitioning() { return transitioning; },

    /**
     * Progresso da transição de 0 (início) a 1 (fim).
     * Útil para animações de fade ou barras de progresso.
     */
    get timerProgress() {
      return Math.min(transitionTimer / DIFFICULTY_CONFIG.TRANSITION_DURATION, 1);
    },

    TRANSITION_DURATION: DIFFICULTY_CONFIG.TRANSITION_DURATION,
  };
})();
