# River Vertical Slice — Design ("O Rio")

Design da experiência mínima da vertical slice **antes** da implementação. Documento
de discovery: nenhum código foi alterado nesta rodada.

> **Tese do jogo:** "Jogo Xamânico é um RPG 3D de travessia e reciprocidade, no qual
> o jogador entra como Neófito em uma floresta espiritualmente viva, aprende a
> negociar sua presença entre mundos e descobre que poder não é algo possuído, mas
> uma relação temporária com forças que também têm vontade própria."
>
> **Tese da slice:** "O rio não é obstáculo neutro nem fornecedor de recompensa. É
> uma presença territorial que percebe a conduta do jogador, permite ou resiste à
> passagem e conserva memória da relação criada durante a experiência."

**Convenção:** **[FATO]** capacidade técnica já observada no código · **[HIPÓTESE]**
suposição a validar · **[RECOMENDAÇÃO]** decisão de projeto proposta. Ao longo do
texto, **experiência pretendida** e **capacidade técnica existente** são mantidas
separadas de propósito.

---

## 1. Pergunta de protótipo

**Uma única pergunta, com veredito após uma sessão curta de teste humano:**

> Depois de poucos minutos, sem tutorial, o jogador percebe que o rio responde à sua
> conduta e passa a **negociar** a travessia, em vez de tratá-la como um obstáculo a
> vencer?

Se a resposta for "sim" para a maioria dos testadores, a tese (reciprocidade +
agência territorial = jogabilidade) se sustenta. Se os testadores descreverem a
experiência como "puzzle", "achar o caminho" ou "esperar a barra encher", a tese
falhou nesta forma.

---

## 2. Duração e escopo

- **Duração de uma primeira experiência:** ~5 a 10 minutos.
- **Área espacial:** uma clareira única com **uma faixa de rio**, aprox. 60x80 jardas
  (uma margem à outra, floresta em volta fechando os limites). Reusa uma fatia do
  bioma `vale` (já arborizado). [FATO] terreno é `f(x,z,seed)` puro em
  `src/sim/world.ts`.
- **Máximo de entidades significativas:** ≤ 6 (jogador; 1 âncora do espírito;
  1 animal-guia opcional; até ~3 criaturas ambientais não interativas). Foliagem
  decorativa é barata e ilimitada.
- **Início claro:** o jogador surge na **margem próxima**, de frente para o rio, com
  a floresta do outro lado visível.
- **Fim claro:** o jogador está **em pé na margem oposta** (travessia consumada) — a
  slice conclui com um beat ambiental de fechamento.
- **Explicitamente fora do escopo:** combate, dano, afogamento; inventário, loot,
  ouro; classe/talentos/XP visíveis; outros NPCs e quests; dungeons/delves/raid; os
  outros dois biomas; ciclo dia/noite; persistência entre sessões; multiplayer; HUD
  MMO completo; sistema geral de morte.

A experiência é pequena o bastante para nascer em etapas reversíveis (seção 13).

---

## 3. Fantasia imediata do jogador

**O que o jogador acha que está fazendo (primeiros minutos):** "Preciso atravessar
este rio para seguir pela floresta." Ele trata a água como terreno: tenta entrar,
procurar um ponto raso, atravessar a nado.

**O que ele gradualmente compreende:** a água não é passiva. Quando ele força a
entrada, a correnteza o carrega e o devolve à margem — não como "morte", mas como
**recusa**. Quando ele para de tentar vencer e começa a **prestar atenção** (onde a
água corre rasa, para onde um animal atravessa, como a superfície muda perto dele),
o rio responde de outra forma. A compreensão final: **a travessia é uma negociação
com algo que percebe e lembra**, e a "solução" não é uma técnica adquirida, é uma
relação estabelecida naquele momento e naquele lugar.

(Descrição concreta da experiência, sem linguagem de vitrine.)

---

## 4. Sequência jogável

Momento a momento. Para cada beat: **vê / ouve / pode fazer / resposta do mundo /
o que aprende sem exposição.**

**1. Chegada à margem.**
- **Vê:** margem próxima, rio à frente, floresta do outro lado; a água corre (a
  correnteza tem direção visível). Nenhum marcador, nenhuma seta.
- **Ouve:** som de água corrente; ambiente florestal; a trilha procedural em tom
  neutro/curioso.
- **Pode fazer:** andar, olhar (câmera 3ª pessoa), aproximar-se da água.
- **Resposta do mundo:** ao chegar perto da margem, **uma única linha curta** de
  ambientação surge no canal de log (ex.: "A água corre funda e atenta."). [FATO]
  `SimEvent` notice/toast já existe.
- **Aprende:** o objetivo (o outro lado) é espacial e óbvio; ninguém precisa dizer.

**2. Tentativa inicial.**
- **Vê:** ao entrar na água rasa da beira, o corpo desacelera (nado). Na parte funda
  (canal central), o movimento fica lento e a correnteza empurra.
- **Ouve:** o som da água muda ao submergir (abafa); a correnteza cresce no canal.
- **Pode fazer:** tentar avançar pelo canal fundo.
- **Resposta do mundo:** [FATO] água funda já reduz a 0.65x e há `SWIM_DEPTH`; a
  correnteza (novo, do módulo do rio) começa a deslocar o jogador rio abaixo.
- **Aprende:** a água não é só lenta — ela **empurra**. Algo age.

**3. Manifestação da agência (forçar).**
- **Vê:** se insistir no canal, a correnteza toma o controle direcional, carrega o
  corpo rio abaixo e o **deposita de volta na margem de origem**; a imagem
  dessatura por um instante, a câmera reorienta.
- **Ouve:** rugido de água por baixo; silêncio abafado; depois o som volta ao
  normal na margem.
- **Pode fazer:** nada por ~2-3s (perda breve de controle), depois recupera na
  margem.
- **Resposta do mundo:** o rio passa ao estado **ofendido** (seção 6); a superfície
  fica mais agitada perto do jogador.
- **Aprende:** o rio recusa a força e **responde no corpo**, não em texto.

**4. Descoberta de possibilidades (observar).**
- **Vê:** ao caminhar pela margem sem entrar, nota diferenças na água: um trecho onde
  corre **rasa e calma** (o vau natural), pedras semi-expostas, juncos; talvez um
  animal que bebe e atravessa exatamente ali.
- **Ouve:** a água rasa soa diferente da funda; se o animal-guia existir, seus passos
  na água marcam o ponto.
- **Pode fazer:** ler o ambiente, seguir o animal, aproximar-se do vau.
- **Resposta do mundo:** permanecer atento (sem forçar) leva o rio de **desconhecido**
  a **observado**; a presença fica sutilmente mais calma perto do jogador.
- **Aprende:** existe onde a água **permite**; atenção revela, pressa esconde.

**5. Escolha ou experimentação (oferecer).**
- **Vê:** na margem há coisas do lugar (uma pedra, um junco, uma flor caída — objetos
  de chão). Um ponto plano à beira convida a um gesto.
- **Ouve:** ao dar (colocar algo na água), um tom de resposta do rio (aceitação ou
  devolução).
- **Pode fazer:** pegar algo do lugar e **entregá-lo** à água na beira.
- **Resposta do mundo:** se o rio já está **observado**, o gesto é lido como oferta e
  o canal fundo **acalma** (estado **autorizado**); se está **ofendido**, o objeto é
  **devolvido** à margem (reinterpretação visível) até haver reconciliação.
- **Aprende:** dar algo do lugar de volta ao lugar muda a relação; não é uma chave —
  pode ser recusado e depende de como você chegou até ali.

**6. Travessia ou fracasso.**
- **Autorizado:** o canal central corre calmo; a travessia direta é possível.
- **Observado (sem oferta):** o **vau natural** permite passar pela beira rasa —
  travessia mais indireta, sem a bênção do rio.
- **Ofendido/forçando:** carregado de volta; é preciso mudar de conduta.
- **Aprende:** há mais de um jeito, e eles **não são equivalentes**.

**7. Consequência final.**
- **Vê:** ao pisar na margem oposta, a floresta "abre" (foliagem/luz), a água aquieta
  atrás; uma linha curta de fechamento.
- **Ouve:** a trilha resolve; o rio soa distante, não mais em confronto.
- **Resposta do mundo:** o estado do rio **permanece** (memória da relação): quem
  atravessou forçando e reconciliou vê uma manifestação mais reticente do que quem
  foi acolhido.
- **Aprende:** a travessia foi uma **relação estabelecida**, não uma habilidade
  ganha. Nada novo entrou em sua ficha.

---

## 5. Três caminhos de relação

Os três compartilham **uma geometria de rio**: um **vau raso** (descoberto por
observação) e um **canal fundo** central (onde oferta e força se resolvem). Isso
unifica as três relações sobre o mesmo terreno.

### Observar — *percepção espacial ativa, não um botão nem um trigger*
O jogador **não** fica parado dentro de uma área. Ele precisa **ler o rio**: andar
pela margem e identificar, por pistas visuais e sonoras, onde a água corre rasa (o
vau) — água mais clara/calma, correnteza mais lenta, pedras e juncos, e (se presente)
o trajeto do animal-guia. A "habilidade" é **notar** onde atravessar; ao cruzar pelo
vau, o rio o registra como **observado** (presença respeitosa), sem conceder bênção
ativa. **[HIPÓTESE]** tornar o vau visualmente legível pode exigir pequena extensão
do shader/partículas de água (`src/render/water.ts`).

### Oferecer — *um gesto de dar com custo e contexto, não uma chave colorida*
A margem tem coisas do lugar (objetos de chão). O jogador compreende o que ofertar
porque são elementos **daquele** território (uma pedra do leito, um junco, uma flor),
e a oferta tem valor por ser um **relinquir deliberado** (ele abre mão do objeto,
direcionando o gesto ao rio). O rio pode:
- **aceitar** — se já **observado**, acalma o canal (→ **autorizado**);
- **rejeitar/devolver** — se **ofendido**, empurra o objeto de volta à margem;
- **reinterpretar** — o mesmo gesto significa coisas diferentes conforme o estado
  relacional (sinceridade lida pelo **contexto**, não por um item "correto"
  rotulado).
Não é chave porque: (a) o caminho **observar** dispensa a oferta; (b) a oferta pode
ser recusada; (c) não há rótulo de "item de quest". **[HIPÓTESE]** ler "sinceridade"
via estado é um proxy; validar no playtest que jogadores leem reciprocidade, não
"item errado". **[RECOMENDAÇÃO]** manter **um** tipo de objeto ofertável no primeiro
corte para reduzir superfície.

### Forçar — *resistência corporal do território, sem sistema de combate*
O jogador pode tentar o canal fundo sem permissão. Consequência (seção detalhada
abaixo): a **correnteza toma o corpo e o devolve à margem de origem** com
desorientação sensorial breve. Sem dano, sem afogamento, sem punição moralista — o
território simplesmente **não cede** e o demonstra fisicamente.

Os três resultados são **deliberadamente desiguais**: observar dá passagem indireta;
ofertar dá passagem direta e relação; forçar nega e cria memória de ofensa.

---

## 6. Agência e memória do rio

Máquina de estados pequena e legível, **da relação** (não de progresso de quest).
Vive no módulo do cenário, escopo de sessão. [FATO] estado de sessão já é viável
offline (o `questLog` em `PlayerMeta` persiste durante a sessão; aqui usaremos estado
próprio do módulo, no molde de `src/sim/encounters/nythraxis.ts`).

**[RECOMENDAÇÃO]** Manter os 5 estados propostos, com `reconciliado` = autorizado que
**carrega memória** da ofensa.

| Estado | Como é alcançado | Como o rio se manifesta | Ações possíveis | Ações que deixam de funcionar | Memória |
|---|---|---|---|---|---|
| **desconhecido** | início | água corre neutra, atenta | aproximar, observar, tentar | — | — |
| **observado** | atenção real na margem sem forçar (ler o vau / seguir o animal) | acalma sutilmente perto do jogador | oferecer; cruzar pelo vau | — | lembra a presença respeitosa |
| **autorizado** | ofertar estando observado | canal central **acalma**; presença mais definida | travessia direta | forçar deixa de ser necessário | relação de acolhimento |
| **ofendido** | entrar no canal fundo sem autorização | correnteza agitada; carrega e devolve | reconciliar (observar/ofertar de novo) | travessia direta bloqueada; oferta simples é **devolvida** | lembra a ofensa |
| **reconciliado** | ofertar/observar **após** ofender | acalma, porém reticente | travessia direta | — | a manifestação permanece **mais reservada** que em `autorizado` |

**Regra de memória (o que dá "dentes" à relação):** uma vez `ofendido`, os limiares de
observar/ofertar mudam — é preciso **reconciliar primeiro**; e `reconciliado` mantém
uma marca perceptível (visual/sonora) de que houve confronto. Isso impede que forçar
repetidamente "dê certo" por acaso (seção 10).

---

## 7. Manifestação do espírito

**[RECOMENDAÇÃO] Presença ambiental primeiro, com cristalização gradual — não um NPC
humanoide, não um fantasma pronto.** O "corpo" do rio **é a água**: sua agência se
expressa no comportamento da superfície (força/direção da correnteza, calmaria,
som, névoa, luz na água, o modo como a foliagem da outra margem se move). Não começa
como criatura.

- **Experiência pretendida:** conforme a relação avança (`observado` → `autorizado`),
  a presença pode **se reunir** numa forma tênue e **não humanoide** sobre a água
  (uma coalescência de névoa/motes/reflexo), sugerida, nunca antropomórfica.
- **Capacidade técnica existente [FATO]:** dá para prototipar isso com sistemas
  procedurais que já existem — `src/render/water.ts`, `motes.ts`, `weather.ts`
  (névoa), luz/`vfx.ts` — **sem** asset novo.
- **[RECOMENDAÇÃO]** Não usar `ghost.glb`/`tribal.glb` como identidade (registro
  errado: fantasma humanoide de Halloween). Se algum placeholder de malha for
  necessário para depurar posição, tratar como descartável e claramente temporário.
- **[HIPÓTESE]** A direção artística final da "forma" fica **deliberadamente em
  aberto**; o protótipo testa a agência, não o visual definitivo.

---

## 8. Animal-guia

**[RECOMENDAÇÃO] Não obrigatório no núcleo do primeiro corte; incluir como a
primeira melhoria depois que o laço básico funcionar.** O laço central (ler a água →
achar o vau / ofertar / forçar) se sustenta sem ele.

Se/quando incluído:
- **Função mecânica:** ensinar **sem texto** — atravessa o vau, demonstrando por
  exemplo onde a água permite. É um **auxílio de percepção**, não um marcador: o
  jogador lê o **comportamento** do animal, não uma seta.
- **Quando surge:** na transição para **observado** (o rio "notou" uma presença
  respeitosa) — reforçando que atenção é correspondida.
- **Por que não é marcador de caminho:** ele age no mundo (anda, bebe, cruza),
  legível como criatura, não como UI; pode não repetir o mesmo trajeto.
- **Por que não vira pet/recompensa:** sem domar, sem comando, sem posse; parte após
  a travessia — pertence ao lugar, não ao jogador. [FATO] o sistema de pet existe mas
  fica **fora**: aqui é um `mob`/`npc` com trajeto roteirizado (reusa
  `moveToward`/`pathfind`), que **despawna**.

**[FATO/HIPÓTESE]** Custo técnico: pequeno (uma entidade com caminho roteirizado).
Decisão: **adiar para a etapa E de melhoria**, mantendo o núcleo sem dependência
dele.

---

## 9. Interface e comunicação

**Princípio: mínimo de texto. Priorizar ambiente, som, movimento, animação, alteração
espacial e comportamento.** [FATO] o cliente já recebe `SimEvent`s (log/toast) e a
trilha/áudio é procedural (`src/game/music.ts`, `audio.ts`).

- **Objetivo inicial:** implícito e espacial (o outro lado, visível). No máximo **uma**
  linha curta na chegada.
- **Interação possível:** afordância ambiental (a beira convida; o ponto de oferta é
  um lugar plano; o animal, se presente, aponta pelo exemplo). Evitar prompts
  repetidos de "[E] interagir" além do mínimo do motor.
- **Respostas do rio:** expressas **na água e no som** — correnteza, calmaria,
  turbulência, névoa que se reúne, mudança tonal da trilha por estado.
- **Consequência das ações:** **corporal e sensorial** (ser carregado de volta;
  abafamento/dessaturação) — sem números.
- **Conclusão:** beat ambiental (a floresta abre, a trilha resolve) + no máximo uma
  linha de fechamento.

**Explicitamente evitado:** quest log convencional, marcadores/minimapa, **barra de
relação**, números de estado visíveis. O estado do rio **nunca** vira barra, moeda ou
estatística exibida (regra de qualidade). [FATO] o HUD MMO é dirigido por CSS e pode
ser ocultado sem reescrever `src/ui/hud.ts`.

---

## 10. Fracasso e repetição

- **Existe "game over"?** Não. Não há morte nem tela de fim. [RECOMENDAÇÃO] evitar
  `game over` por convenção.
- **O que acontece ao falhar:** forçar → devolvido à margem (o rio resistiu). É um
  **revés relacional**, não uma penalidade de recurso.
- **Pode tentar de novo?** Sempre. A **repetição é o meio**: relê-se o rio, tenta-se
  outra conduta.
- **O que o rio recorda:** o **estado** persiste na sessão (ofender exige
  reconciliar; reconciliado guarda a marca). Assim, insistir na força **não** dá certo
  por acaso — entrincheira a resistência e empurra o jogador a mudar de abordagem.
- **Como evitar tentativa-e-erro arbitrária:** as respostas do rio são
  **consistentes e legíveis** (mesma conduta → mesma resposta, [FATO] determinismo do
  `Sim`), e o espaço de solução recompensa **atenção**, não sorteio. Não há
  aleatoriedade escondida no resultado das condutas.

---

## 11. Critérios de sucesso conceitual

Observáveis num teste humano curto (não basta "o app rodou"):

1. O jogador **percebeu que o rio reagia à sua conduta** (não a tratou como água
   inerte)?
2. Compreendeu **ao menos uma possibilidade sem tutorial** explícito?
3. **Tentou interpretar o ambiente** (leu a água, seguiu pistas) em vez de só
   apertar botões?
4. Descreveu a travessia como **relação/negociação**, não apenas como "puzzle" ou
   "achar a passagem"?
5. Ao **forçar**, sentiu que o **território respondeu no corpo** (foi carregado,
   desorientado), não só recebeu uma mensagem?
6. Procurou uma solução **diferente de combate ou aquisição** (não esperou "matar" o
   rio nem "pegar um item que resolve")?
7. Ao final, entendeu que **não ganhou um poder permanente** — que a passagem foi da
   relação, não da ficha?

Sucesso conceitual = maioria positiva em 1, 4 e 5 (os itens que provam agência
territorial sentida).

---

## 12. Mapeamento técnico preliminar

Cada elemento da experiência → mecanismo provável, com o tipo de esforço.
Legenda: **[R] reaproveitamento direto** · **[E] pequena extensão** · **[N] não
suportado ainda** · **[V] hipótese a validar na implementação**.

| Elemento da experiência | Mecanismo técnico | Tipo |
|---|---|---|
| Bootstrap isolado | entry Vite `river.html` + `src/river_main.ts` (precedente: play/admin/guide) | [R] |
| Mundo pequeno (1 zona) | content pack + `cfg.world` opcional lido pelo construtor do `Sim` | [E] |
| `ZoneDef` única | `src/sim/content/river/` (bioma `vale`, `PLAYER_START` na margem) | [R] estrutura, [E] dados |
| Terreno / margens / vau | `terrainHeight`/`groundHeight`/`WATER_LEVEL` (`src/sim/world.ts`), vau = banda rasa no heightfield | [R] motor, [E] moldar a faixa |
| Água (nadar, funda/rasa) | `SWIM_DEPTH`/`SWIM_SURFACE_Y`/0.65x já existem; "em água" = ground vs `WATER_LEVEL` | [R] |
| Correnteza que desloca | campo de velocidade aplicado à posição por tick no canal fundo (novo, no módulo) | [E] |
| Devolver à margem | reposicionamento (mesmo primitivo de `releasePlayerSpirit`/teleporte) | [R] |
| Âncora do espírito | `object` ou `npc` interativo por proximidade (`src/sim/interaction.ts`) | [R] |
| Trigger territorial | `grid.forEachInRadius` por tick (proximidade), já usado no motor | [R] |
| Módulo do rio | `src/sim/encounters/river_spirit.ts` atrás do `SimContext` (molde `nythraxis.ts`) | [E] |
| Estado relacional em sessão | estado próprio no módulo/`Sim` (não em `IWorld`) | [E] |
| Oferecer (pegar/dar objeto) | `pickUpObject` + um gesto de "dar" na beira (inverso da coleta) | [E] |
| Observar (ler o vau) | leitura espacial de pistas de água; legibilidade do vau | [E]/[V] |
| Comunicação (texto mínimo) | `SimEvent` notice/toast (já entregue ao cliente) | [R] |
| Respostas na água/som | reação client-side a `SimEvent`s (água/motes/névoa/áudio) sem tocar `IWorld` | [E]/[V] |
| Dessaturação/desorientação | efeito de pós no cliente disparado por `SimEvent` (`src/render/post.ts`) | [E] |
| Assets (humano, floresta, animal) | GLB CC0: `chars/players`, `foliage/*`, `creatures/stag|fox|wolf` | [R] |
| Espírito visual | procedural: `water.ts` + `motes.ts` + `weather.ts` + luz (sem asset novo) | [E]/[V] |
| Ocultar HUD MMO | CSS/flag no bootstrap, sem reescrever `hud.ts` | [E] |
| Placeholder de classe | uma `PlayerClass` existente, kit não exibido | [R] (obrigatório ao `Sim`) |
| Água como perigo/dano | — | [N] fora de escopo (sem combate) |
| Separação corpo/espírito | reusaria o seam `releasePlayerSpirit`, mas exige representação dupla | [N]/[V] (adiado) |

**Restrição respeitada [FATO]:** render/UI só falam com `IWorld` e **não** vamos
modificar `IWorld` no primeiro corte. Por isso as reações visuais/sonoras ao estado
do rio são disparadas por **`SimEvent`** (já entregues ao cliente) e resolvidas
client-side, não por leitura de novos campos de `IWorld`. Visual de água que reaja
continuamente ao estado (não só a eventos) pode, no futuro, querer uma leitura mínima
via `IWorld` — **[V]** marcado como fora do primeiro corte.

---

## 13. Corte mínimo de implementação (E1–E8)

Ordem concreta, reversível, **sem escrever código agora**. Para cada etapa:
objetivo · arquivos prováveis · comportamento demonstrável · teste · condição de
avanço · reversão.

**E1 — Entry isolada.**
- Objetivo: servir a slice numa rota própria sem tocar o jogo original.
- Arquivos: `river.html` (novo), `src/river_main.ts` (novo), `vite.config.ts`
  (registrar entry).
- Demonstrável: `npm run dev` serve `/river` com um canvas/tela de carregamento.
- Teste: carga manual da rota.
- Avança se: a entry sobe sem alterar `index.html`/`src/main.ts`.
- Reverte: apagar 2 arquivos + a linha de entry.

**E2 — Seam de conteúdo.**
- Objetivo: permitir um mundo alternativo sem quebrar o padrão.
- Arquivos: `src/sim/types.ts` (`SimConfig.world?` opcional), `src/sim/sim.ts`
  (construtor lê `cfg.world ?? <globais atuais>`).
- Demonstrável: jogo original inalterado; `new Sim` com mundo vazio não cria
  entidades WoW.
- Teste: suíte `sim`/`parity`/`architecture` verde + 1 teste novo (mundo vazio → 0
  mobs).
- Avança se: testes do mundo default continuam verdes.
- Reverte: remover o campo e a leitura (diff pequeno e localizado).

**E3 — Content pack do rio (mundo estático).**
- Objetivo: uma clareira com rio, andável.
- Arquivos: `src/sim/content/river/` (novo: `ZoneDef`, margens, sem camps hostis),
  fiação em `river_main` via `cfg.world`.
- Demonstrável: surgir na margem, rio à frente, floresta ao redor; nadar na água.
- Teste: unit — o pack constrói um `Sim` só com jogador (+ âncora na E4).
- Avança se: cena caminhável e determinística.
- Reverte: apagar o diretório do pack.

**E4 — Âncora do espírito + primeira linha.**
- Objetivo: primeira interação por proximidade.
- Arquivos: content pack (a âncora `object`/`npc`), `river_main`.
- Demonstrável: aproximar-se da margem emite a linha de chegada.
- Teste: unit de interação (proximidade → evento).
- Avança se: o evento dispara de forma estável.
- Reverte: remover a âncora.

**E5 — Máquina de estados + forçar.**
- Objetivo: agência mínima sentida no corpo.
- Arquivos: `src/sim/encounters/river_spirit.ts` (novo), `sim_context.ts` (append de
  callbacks), `sim.ts` (bind + chamada no `tick`), content pack.
- Demonstrável: entrar no canal fundo sem autorização → correnteza carrega e devolve
  à margem; permanecer atento na margem → `observado`.
- Teste: unit determinístico das transições (seed fixa) + parity verde.
- Avança se: transições determinísticas e sem novos draws de rng fora de fase.
- Reverte: desfiar a chamada do módulo + apagar o arquivo.

**E6 — Três caminhos + memória.**
- Objetivo: observar / oferecer / forçar com resultados desiguais e memória.
- Arquivos: `river_spirit.ts`, content pack (geometria do vau + objeto ofertável),
  pistas de render.
- Demonstrável: vau atravessável por leitura; oferta acalma o canal (`autorizado`);
  forçar após acalmar/ofender comporta-se conforme a memória.
- Teste: unit por rota (observado, autorizado, ofendido→reconciliado).
- Avança se: as três rotas produzem respostas distintas e consistentes.
- Reverte: cada rota atrás do módulo (removível em bloco).

**E7 — UI mínima + retorno sensorial.**
- Objetivo: comunicar sem HUD MMO e sem tocar `IWorld`.
- Arquivos: `river_main` (ocultar HUD por CSS/flag; reagir a `SimEvent`s com
  áudio/pós/câmera), hooks client-side em `src/render/` (água/motes/névoa/`post.ts`).
- Demonstrável: água/som/pós respondem ao estado; forçar dessatura e desorienta
  brevemente.
- Teste: manual (leitura sensorial) + checagem de que o HUD oculto não quebra o loop.
- Avança se: feedback perceptível sem número/barras; loop estável.
- Reverte: reexibir HUD; remover os hooks de reação.

**E8 — Conclusão + playtest.**
- Objetivo: fechar o laço e testar a pergunta da seção 1.
- Arquivos: `river_spirit.ts` (detecção de travessia por posição), `river_main`
  (beat de fechamento).
- Demonstrável: laço completo chegada → travessia → fechamento; estado persiste na
  sessão.
- Teste: e2e manual contra os critérios da seção 11 + unit de detecção de fim.
- Avança se: a pergunta de protótipo pode receber veredito humano.
- Reverte: a slice inteira vive atrás de entry + pack + módulo — removível por
  completo.

---

## 14. Veredito de prontidão

**[RECOMENDAÇÃO] O design está específico o suficiente para ser entregue a um agente
implementador (Fable 5)**, desde que uma decisão de projeto fique **travada** (para
não abrir alternativas genéricas durante a implementação):

- **Decisão travada — consequência de forçar:** a **correnteza toma o corpo e o
  devolve à margem de origem**, com perda breve de controle direcional (~2-3s) e
  desorientação sensorial (dessaturação + som abafado + reorientação de câmera).
  Escolhida por comunicar agência territorial no corpo com o **menor custo de
  sistemas** (reusa deslocamento por tick + reposicionamento + pós/áudio client-side),
  sem combate, dano ou afogamento. A alternativa "separação corpo/espírito" é
  evocativa mas exige representação dupla — **adiada** como [HIPÓTESE] pós-slice.

- **Decisão travada — mecânica de oferta:** **um** objeto natural da margem, dado à
  água na beira, cuja aceitação depende do **estado relacional** (aceito se
  `observado`; devolvido se `ofendido`). Mantém a oferta longe de "chave colorida" com
  custo mínimo. Enriquecer (múltiplos objetos, leitura fina de sinceridade) é
  [HIPÓTESE] pós-slice.

Nenhum outro ponto bloqueia a implementação: bootstrap, seam de conteúdo,
representação do espírito, máquina de estados, três caminhos, UI mínima e corte E1–E8
estão definidos e mapeados a mecanismos existentes ou extensões pequenas. Os itens
marcados **[V]** (legibilidade do vau; reação contínua da água ao estado) são de
**validação durante a implementação**, não decisões que impeçam começar — o primeiro
corte os resolve com `SimEvent` + reação client-side, sem tocar `IWorld`.

**Ponto único que o implementador deve confirmar cedo (não bloqueante):** que ocultar
o HUD por CSS/flag no bootstrap isolado não deixa handlers do `hud.update()` em estado
inválido — verificação da etapa E7, com reversão trivial.

---

## Regras de qualidade honradas neste design

- Espiritualidade **não** vira barra, moeda ou estatística (seção 9).
- **Nenhuma** habilidade permanente é concedida como recompensa (seções 3, 4.7).
- Sem lore extenso para compensar mecânica (o texto é mínimo; a agência é jogável).
- Não se desenhou o jogo inteiro (escopo fechado, seção 2).
- Combate **não** resolve a travessia (seção 2, fora de escopo).
- A oferta **não** é chave disfarçada (seção 5).
- A observação **não** é botão disfarçado (seção 5).
- A agência do rio **não** é só diálogo — é correnteza, calmaria, deslocamento,
  memória (seções 4-6).
- Experiência pretendida e capacidade técnica existente ficam **separadas**
  (seção 12).
- Especulação marcada como **[HIPÓTESE]**; caminhos propostos como **[RECOMENDAÇÃO]**.
