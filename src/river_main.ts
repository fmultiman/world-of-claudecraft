// Vertical slice "O Rio" - entrada isolada (etapa E1).
//
// Este e o ponto de entrada da vertical slice do Jogo Xamanico, mantido
// deliberadamente separado de src/main.ts. Nesta etapa (E1) ele apenas confirma
// que a entry Vite sobe de forma independente, sem login, servidor ou Postgres,
// e sem iniciar Sim, Renderer ou HUD. O bootstrap offline do cenario (content
// pack, terreno, rio e sistema relacional) entra nas etapas seguintes (E2+),
// conforme docs/discovery/RIVER_VERTICAL_SLICE_DESIGN.md.
//
// Mantido minimo e limpo de proposito: nada de src/main.ts e reaproveitado aqui.

function markReady(): void {
  const status = document.getElementById('river-status');
  if (status) {
    status.textContent = 'Entrada isolada pronta. Cenario ainda nao iniciado (E1).';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', markReady, { once: true });
} else {
  markReady();
}
