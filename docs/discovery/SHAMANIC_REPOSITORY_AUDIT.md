# Shamanic Repository Audit

Auditoria de descoberta do fork `world-of-claudecraft` como possível infraestrutura
para o projeto autoral provisoriamente chamado **Jogo Xamânico**.

> **Conceito-guia do projeto:** "Jogo Xamânico é um RPG 3D de travessia e
> reciprocidade, no qual o jogador entra como Neófito em uma floresta
> espiritualmente viva, aprende a negociar sua presença entre mundos e descobre
> que poder não é algo possuído, mas uma relação temporária com forças que também
> têm vontade própria."

## 0. Metadados e método

- **Data:** 2026-07-04
- **Branch:** `discovery/shamanic-game` (working tree limpo)
- **Commit-base:** `685a5596 fix(sim): prevent pets inheriting evade immunity (#1403)`
- **origin:** `https://github.com/fmultiman/world-of-claudecraft.git` (fork do usuário)
- **upstream:** `https://github.com/levy-street/world-of-claudecraft.git` (projeto original)
- **Escopo desta rodada:** somente leitura. Nenhum arquivo de código alterado,
  nenhuma dependência instalada, nenhum banco/servidor executado.

**Convenção de evidência (usada em todo o documento):**

- **[FATO]** — observado diretamente no código-fonte.
- **[DOC]** — afirmado na documentação do repo (README/CLAUDE.md) e ainda **não**
  conferido linha a linha no código.
- **[HIPÓTESE]** — inferência do auditor a partir das evidências.
- **[NÃO VERIFICADO]** — não confirmado nesta rodada; lacuna explícita.

**Nota estrutural:** o repositório **não está na raiz** do diretório de trabalho.
Ele vive em `world-of-claudecraft/`. Todos os caminhos abaixo são relativos a essa
subpasta.

---

## 1. Sumário executivo

O `world-of-claudecraft` é um **micro-MMO estilo WoW-Classic maduro e ativo**,
construído sobre um núcleo de simulação determinístico em TypeScript que roda
idêntico em três hosts (browser offline, servidor autoritativo, ambiente RL
headless). É software real, testado e grande (~470k linhas TS), não um protótipo.

Três achados definem a decisão sobre usá-lo como base:

1. **[FATO] O modo offline já é um single-player completo e client-side.** Não
   precisa de servidor, banco ou login. Isso torna o fork uma base de prototipagem
   plausível para uma vertical slice offline.
2. **[HIPÓTESE] O peso é grande e o acoplamento ao WoW é profundo** nos sistemas de
   identidade (classes, rage/energy, hit tables vanilla, talentos, HUD MMO). Reusar
   o *motor* é viável; reusar a *mecânica de identidade* empurra o design de volta
   ao WoW.
3. **[RISCO] Os ícones de habilidade CraftPix são licenciados a outra conta** e não
   podem ser redistribuídos no projeto autoral sem licença própria.

---

## 2. Stack e estrutura factual

**[FATO]** (`package.json`, `CLAUDE.md`)

- **Linguagem:** TypeScript ESM `strict`. ~447k linhas em `src/`, ~23k em `server/`.
- **Render:** Three.js `^0.165.0` (geometria/texturas/VFX procedurais).
- **Rede:** `ws` (WebSockets). **DB:** `pg` (Postgres). **Build:** Vite `^8` +
  esbuild. **Testes:** Vitest (centenas de arquivos em `tests/`).
- **Sem framework de UI no cliente de jogo.** Exceção única sancionada: dashboard
  admin em Svelte 5 (`src/admin/`).
- **Empacotamento múltiplo:** Electron (desktop), Capacitor (iOS/Android), Docker.
  Diretórios `electron/`, `android/`, `ios/`, `headless/`, `python/`, `bot/`,
  `mediawiki/`.

**[FATO] Divergência documentação vs código:** o `CLAUDE.md` diz `main.ts ~6.4k` e
`hud.ts ~10k`; a medição real é `src/main.ts` = **7360** linhas e
`src/ui/hud.ts` = **11495**. A documentação está desatualizada e **subestima** o
tamanho. Lição operacional: **não confiar em README/CLAUDE.md sem conferir o
código.**

---

## 3. Arquitetura: um sim, três hosts

**[FATO]** A ideia central é real e verificável no código, não só no README:

- Núcleo determinístico `src/sim/` roda idêntico em: browser offline, servidor
  autoritativo, ambiente RL headless.
- **Cliente:** `src/main.ts` (fixa a seed, decide offline vs online, faz o wiring).
- **Servidor:** `server/main.ts` (HTTP+WS, loop de mundo, Postgres, auth).
- **Headless RL:** `headless/env_server.ts` — **[FATO]** instancia `new Sim(...)`,
  usa `ACTIONS/encodeObs/obsSize` de `src/sim/obs.ts`, roda `sim.tick()` em loop.
- **[FATO] Seam único:** `IWorld` em `src/world_api.ts`. `render/` e `ui/` só falam
  com `IWorld`, nunca com `Sim`/`ClientWorld` concretos. O offline `Sim` satisfaz
  `IWorld` estruturalmente; o online `ClientWorld` implementa espelhando snapshots.
- **[FATO] `IWorld` é grande:** 145 membros em 21 facetas de domínio, com 3 testes
  de paridade que travam o seam (`tests/snapshots.test.ts`,
  `tests/command_schema.test.ts`, `tests/world_api_parity.test.ts`). Essa é a
  principal medida do "peso" do MMO.

**[DOC]** Modelo de rede: clientes enviam intenção de movimento + comandos a 20 Hz;
o servidor roda o `Sim` compartilhado e devolve snapshots com escopo de interesse
(~120 yd). Todo combate/loot/quest/economia resolve server-side.

**Invariantes enforçados (relevantes para qualquer trabalho futuro):**

- **[FATO]** `src/sim/` tem **zero** imports de DOM/Three.js e nunca importa de
  `render/`, `ui/`, `game/`, `net/`. Guardado por `tests/architecture.test.ts`
  (arquivo confirmado; asserções internas **[NÃO VERIFICADO]**).
- **[DOC]** Determinismo: tick fixo 20 Hz (`DT = 1/20`), toda aleatoriedade via
  `Rng` (`src/sim/rng.ts`); nunca `Math.random`/`Date.now`/`performance.now`.
- **[DOC]** Fórmulas de gameplay seguem MMO clássico real (rage, hit tables, armor
  DR, curvas de XP); "não invente números de balanceamento".
- **[DOC]** i18n obrigatório: toda string visível ao jogador é uma chave `t()`.

---

## 4. Inventário por subsistema

| Subsistema | Arquivos-chave | Acoplamento WoW | Reuso | Evidência |
|---|---|---|---|---|
| Câmera 3ª pessoa | `src/game/camera_follow.ts` | baixo | alto | [FATO] lido |
| Input (teclado/mouse/gamepad/touch) | `src/game/input.ts`, `click_move.ts`, `mobile_controls.ts` | baixo | alto | [DOC]+[FATO] |
| Terreno procedural | `src/sim/world.ts`, `src/render/terrain.ts` | baixo | alto | [FATO] lido |
| Interação por proximidade | `src/sim/interaction.ts` | baixo | alto | [FATO] lido |
| Motor de quests | `src/sim/quests/`, `content/zone*.ts` | médio | alto | [DOC]+[FATO] |
| Morte / espírito | `src/sim/entity_roster.ts` | médio | médio | [FATO] lido |
| Combate/auras/cooldowns | `src/sim/combat/` | alto | médio | [DOC] |
| Classes/atributos/talentos | `content/classes.ts`, `content/talents_*.ts` | muito alto | baixo | [FATO] lido |
| Loot/itens/equipamento | `src/sim/items.ts`, `src/sim/loot/` | alto | baixo | [DOC] |
| Persistência/auth | `server/db.ts`, `server/auth.ts` | alto | nenhum (offline) | [FATO] |
| Social (guild/party/arena/market) | `src/sim/social/`, `src/sim/market.ts` | muito alto | baixo | [DOC] |
| Dungeons/delves/raid | `src/sim/instances/`, `delves/`, `encounters/nythraxis.ts` | muito alto | baixo | [DOC] |
| Cripto/monetização | `src/net/wallet.ts`, `server/woc_balance.ts`, daily rewards | muito alto | nenhum | [FATO] |
| HUD MMO | `src/ui/hud.ts` (11k linhas) | alto | médio | [FATO] tamanho |

---

## 5. Modo offline como base da vertical slice

**[FATO]** O modo offline é um caminho de **primeira classe, totalmente
client-side**, verificado em `src/main.ts` (`startOffline`, ~linha 2510):

```ts
const sim = new Sim({ seed: WORLD_SEED, playerClass, playerName, devCommands });
// ...
void startGame(sim, sim, null, `offline:${playerClass}:${name}`);
```

- Passa o mesmo `sim` como mundo local **e** como `IWorld`; passa `null` para o
  `ClientWorld` online.
- **Sem login, sem servidor, sem Postgres, sem persistência.** Comentário no código:
  "Offline characters are not persisted (a fresh name is typed each session)".

**[FATO]** O offline recebe o **mundo completo**. O construtor de `Sim`
(`src/sim/sim.ts`, ~linha 913) popula tudo a partir dos dados: NPCs (~944),
camps/mobs (~954-973), objetos de chão (~986), portas de dungeon (~1017). Ou seja:
**o modo offline já é um single-player jogável com as 3 zonas, quests, NPCs e mobs**
— não é um stub de desenvolvimento.

**Implicação:** já existe uma vertical slice offline funcional embutida. O trabalho
autoral é **substituir conteúdo/tema/mecânica dentro dessa moldura**, não construir
a moldura.

---

## 6. Correção factual: morte, espírito e corpo

> **Correção explícita de um entendimento anterior do projeto.**

A hipótese anterior do projeto considerava que **o personagem morto precisaria
recuperar seu corpo** (mecânica de "corpse run" no mundo aberto, comum em MMOs
como o WoW original).

**[FATO] A auditoria do código real refuta essa suposição.** Em
`src/sim/entity_roster.ts` (`releasePlayerSpirit`, ~linha 159, lido na íntegra):
ao morrer no mundo aberto, o jogador **não** precisa correr até o próprio corpo.
`releasePlayerSpirit()` faz o seguinte, em sequência:

1. teleporta o personagem **diretamente ao graveyard da zona** (`p.pos =
   ctx.groundPos(graveyard.x, graveyard.z)`);
2. **restaura vida e recurso ao máximo** (`p.hp = p.maxHp`; `p.resource` volta ao
   cheio conforme mana/energy/rage);
3. limpa auras, alvo, combate e emite `respawn`.

Não há caminhada até o cadáver, não há penalidade de durabilidade nem recuperação
do corpo no mundo aberto. A única variação é em **delves** (`releaseSpiritInDelve`),
onde há limite de 2 mortes por run e o respawn é a 50% de vida/recurso.

**Por que isto importa (não é detalhe menor):** o design xamânico depende de uma
teoria de morte/travessia entre mundos. O código atual **não** oferece a mecânica
de recuperação de corpo que se imaginava reutilizar; oferece um respawn instantâneo
em ponto ancestral. Ao mesmo tempo, o fluxo `releasePlayerSpirit()` (com os campos
`p.dead`, o conceito de "spirit", o retorno a um "graveyard") é um **seam pequeno,
localizado e semanticamente sugestivo** — provavelmente o melhor ponto para
reescrever a travessia entre mundos, mas **do zero**, não por adaptação de um
corpse-run que não existe.

---

## 7. Acoplamento vs reuso

**[FATO/HIPÓTESE] Fortemente acoplados ao MMO/WoW (carregam o tema e a mecânica):**

- Identidade de classe WoW: 9 classes (warrior, mage, rogue, paladin, hunter,
  priest, warlock, druid, **shaman**), recursos rage/mana/energy, hit tables e
  curvas de XP vanilla (`content/classes.ts`, `content/talents_*.ts`, `types.ts`).
- Sistemas sociais de MMO: guildas, party/raid, duelos, arena ranqueada (Elo), 2v2
  "Fiesta", World Market (`src/sim/social/`, `src/sim/market.ts`, facetas `IWorld`).
- Dungeons/delves/raid (encounter Nythraxis) + lockouts (`src/sim/instances/`,
  `src/sim/delves/`, `src/sim/encounters/nythraxis.ts`).
- Camada cripto/monetização: token $WOC, wallet-link Solana, daily rewards com
  payout, referrals, player cards.
- HUD clássico WoW (frames, cast bar, nameplates, action bars) em `src/ui/`.

**[HIPÓTESE, fundamentada no código lido] Genéricos e reaproveitáveis (baixo
acoplamento temático):**

- Motor de terreno procedural determinístico (`src/sim/world.ts`) + render de
  terreno/água/céu/clima/foliage (`src/render/`).
- Câmera 3ª pessoa + input (`src/game/`) — quase tema-neutro.
- Loop de simulação determinístico + seam `IWorld` (a arquitetura).
- Interação por proximidade (`src/sim/interaction.ts`) + motor de quests
  (kill/collect/interact).
- Áudio/música procedural WebAudio (`src/game/audio.ts`, `music.ts`).
- Pathfinding A* (`src/sim/pathfind.ts`), colisão (`src/sim/colliders.ts`), spatial
  grid (`src/sim/spatial.ts`), `Rng` determinístico (`src/sim/rng.ts`).
- i18n, telemetria, ambiente RL headless.

---

## 8. Riscos técnicos e conceituais

1. **[RISCO ALTO — Licença CraftPix]** Os ícones de skill (`public/ui/skills/...`)
   são licença premium comprada por outra conta (callum@levystreet.com, conta Levy
   Street), conforme `CREDITS.md`. Uso autoral/distribuição exige removê-los ou
   substituí-los.
2. **[RISCO ALTO — Escopo/gravidade]** ~470k linhas TS, `IWorld` com 145 membros,
   HUD de 11k linhas, servidor de 23k. Entender o suficiente para modificar com
   segurança já é caro. Invariantes testados (determinismo, pureza do `sim`, i18n,
   fidelidade vanilla) impõem disciplina.
3. **[RISCO CONCEITUAL]** A mecânica-núcleo (poder como kit de classe fixo,
   rage/energy, hit tables) contradiz o pilar xamânico ("poder = relação temporária
   com forças de vontade própria"). Reusar o motor de combate como está empurra o
   design de volta ao WoW.
4. **[RISCO — deriva do upstream]** Upstream altamente ativo (v0.20+). Divergir
   muito dificulta puxar correções; manter-se perto engessa o tema.
5. **[RISCO — cripto/monetização embutida]** Solana/$WOC/daily-rewards/referrals no
   servidor e no `package.json`. Precisam decisão explícita de manter/remover.
6. **[RISCO — acoplamento de conteúdo no motor]** Conteúdo específico costurado no
   núcleo: cratera Mirefen no gerador de terreno (`src/sim/world.ts`); hooks
   Nythraxis dentro de `src/sim/interaction.ts`. Reescrever tema exige caçar esses
   pontos.
7. **[RISCO — documentação desatualizada]** Já há divergências doc vs código
   (tamanhos de arquivo). Confiar apenas no código.

---

## 9. Tensão de design: mecânica WoW vs conceito xamânico

- **Onde o motor ajuda:** física/terreno/câmera/interação/quests genéricas, loop
  determinístico, entidades e spawn, áudio procedural. Tudo isso é infraestrutura
  neutra que acelera um protótipo.
- **Onde o motor empurra de volta ao WoW:** o instante em que se ativa o sistema de
  classe/talento/combate/loot/nível, o design herda pressupostos de MMO
  (poder acumulável, barras de habilidade, progressão por XP, recompensa material).
  Esses pressupostos brigam com "poder como relação temporária e contextual".
- **Consequência de projeto:** tratar os sistemas de identidade WoW como
  **suspeitos por padrão** e só ativá-los quando comprovadamente servirem ao
  conceito.

---

## 10. Ativos e licenças

**[FATO]** (`CREDITS.md`, lido na íntegra; `THIRD_PARTY_NOTICES.md`, 232 linhas)

- **Maioria dos assets é CC0** (domínio público): personagens/animações KayKit,
  criaturas e kits de natureza Quaternius, kits Kenney, texturas ambientCG, HDRIs
  Poly Haven. Reaproveitáveis sem amarras.
- **Exceções que são risco:**
  1. **Ícones de habilidade CraftPix** — licença premium comprada por outra conta.
     Reuso comercial no fork provavelmente viola a licença CraftPix.
     **[RISCO — decisão/limpeza necessária].**
  2. Water normal maps three.js = MIT (trivial, só atribuição).
- **[FATO]** Modelos em `public/models/`: `chars, creatures, dungeon, foliage,
  props, quest, resources, tools, weapons` (GLB). Todos temáticos
  medieval-fantasia, não xamânico — mas CC0, portanto reutilizáveis ou
  substituíveis.
- **[FATO]** Material de marca/cripto no repo (`World-of-ClaudeCraft-Whitepaper.pdf`,
  `merch.html`, `press.html`, logos). Não é asset de jogo.

---

## 11. Lacunas de verificação (o que ainda NÃO foi conferido)

- **[NÃO VERIFICADO]** Conteúdo integral de `THIRD_PARTY_NOTICES.md` (licenças das
  libs npm).
- **[NÃO VERIFICADO]** As asserções internas de `tests/architecture.test.ts` (o
  arquivo existe; o que exatamente ele valida não foi lido).
- **[NÃO VERIFICADO]** Profundidade real de social/market/delves/arena.
- **[NÃO VERIFICADO]** `types.ts` linha a linha para as constantes de tuning (`DT`,
  `XP_TABLE`, ranges).
- **[NÃO VERIFICADO]** Validação arquivo a arquivo dos assets contra a tabela do
  `CREDITS.md`.

---

## 12. Decisões provisórias desta fase

Decisões de escopo tomadas para orientar a próxima etapa. São **provisórias** e
podem ser revistas conforme a prototipagem gerar evidência.

1. **O protótipo inicial será exclusivamente offline.**
2. **`server/`, Postgres, autenticação, sistemas sociais, mercado, cripto e
   multiplayer ficam fora da vertical slice.**
3. **Os assets CraftPix não deverão ser reutilizados** no projeto autoral sem
   licença própria; devem ser substituídos ou removidos antes de qualquer
   distribuição.
4. **O fork será tratado como infraestrutura de prototipagem, não como definição
   automática da mecânica do jogo.**
5. **Sistemas de classe, talentos, loot, níveis, equipamentos e recursos
   tradicionais são considerados suspeitos** até prova de que servem ao conceito.
6. **A primeira vertical slice não dependerá de combate.**
7. **O principal teste conceitual** será verificar se **reciprocidade e agência
   territorial** produzem uma experiência jogável, e não apenas narrativa.
