# Estoq · Calm Inventory

Redesign de 02/11/2026, orientado pelas três referências fornecidas pelo usuário. O código continua em HTML, CSS e JavaScript, com API Node, SQLite local e adaptador Neon. A rede contém 52 lojas, PF01 a PF52, com possibilidade de novos cadastros.

## Direção visual

Layout editorial com navegação por ícones, contexto e próxima ação à esquerda, resultados à direita. Fundo creme, superfícies off-white, verde-floresta e sálvia; no tema escuro, grafite com tonalidades verdes. Títulos e indicadores usam a família editorial; menus, tabelas e formulários usam a família de interface.

As fontes priorizam Fraunces/DM Serif Display e DM Sans/Inter quando disponíveis localmente, com Georgia e fontes do sistema como alternativas. Não há dependência de fontes ou imagens externas.

| Token | Claro | Escuro |
| --- | --- | --- |
| Fundo | `#F4F0E9` | `#151917` |
| Superfície | `#FCFAF6` | `#1F2421` |
| Fundo secundário | `#EAE8DF` | `#282E2A` |
| Destaque | `#426B57` | `#A8CCB1` |
| Texto principal | `#27332B` | `#F1F0E9` |
| Bordas | `#E4E2D9` | `#343B36` |

Os estados semânticos têm fundos suaves e versões de texto com contraste reforçado. Os estados não dependem somente da cor: também há texto e ícones.

## Organização

| Arquivo | Responsabilidade |
| --- | --- |
| `public/tokens.css` | Cores semânticas, tipografia e tokens dos dois temas |
| `public/app.css` | Componentes comuns, tabelas, formulários, relatórios e impressão |
| `public/design.css` | Navegação, dashboard assimétrico, coleções, painéis e contagem |
| `public/theme.css`, `public/theme.js` | Preferência persistente, tema do sistema e transição de cores |
| `public/animations.css` | Entrada de 8 px, rolagem numérica, expansão e redução de movimentos |
| `public/ui.js` | Ícones, formatação, botões, estados, títulos e indicadores reutilizáveis |
| `public/brand.js`, `BRAND.md` | Aplicação da identidade Estoq fornecida pelo usuário |
| `public/inventory-view.js` | Projeções de visitas, lojas, pendências e zeros confirmados |
| `public/screens.js` | Dashboard, lojas, produtos, laboratórios, movimentações e detalhes |
| `public/counting.js` | Seleção da loja, contagem por produto, lista, revisão e confirmação |
| `public/visit-draft.js` | Estado da contagem e rascunhos separados por conta e visita |
| `public/app.js` | Navegação, eventos e comunicação com a API |
| `public/domain.js`, `lib/` | Regras e persistência existentes |

## Comportamentos

- Dashboard usa somente os dados reais. O mês inicial é o mais recente com visita até a data atual, ou o mês atual quando a base está vazia. Todos os filtros também afetam os resultados e exportações existentes.
- Visitas expandem seus detalhes na própria página. Pendências de conferência são separadas dos estoques zero confirmados.
- Lojas têm cartões/lista, pesquisa, situação, ordenação e painel com histórico.
- Produtos têm pesquisa, filtros, ordenação, paginação e painel com estoque por loja e histórico. Categoria e unidade são opcionais. Remoção lógica e reativação permanecem disponíveis ao administrador.
- Laboratórios consolidam produtos, estoque, cobertura e variações do período.
- A página Movimentações mostra variações observadas, identificadas como estimativas. Não foram reintroduzidos lançamentos manuais durante o redesign: esse item do prompt conflita com a regra anterior e foi apresentado ao usuário para esclarecimento.
- A contagem começa em branco, permite digitação e +/−, tem ações diferentes para não conferido e zero, e oferece revisão editável e salvamento parcial.
- Rascunhos são locais, separados por usuário e por visita. Continuam disponíveis após recarregar o navegador. Não sincronizam entre dispositivos e não fazem parte do backup do servidor. Falha no armazenamento é informada, e fechar nessa situação exige confirmação.
- Salvar oferece estados de ação, carregamento e sucesso. Falha da API mantém o rascunho. O servidor continua protegendo permissões e revisão concorrente.
- Laylah cria visitas e consulta registros salvos; Caio também corrige, exclui e administra cadastros. A consulta de lojas e catálogo foi organizada em páginas próprias para ambos, com ações administrativas restritas.
- Navegação mobile usa uma cápsula flutuante, com margens laterais, borda suave e seleção destacada. O botão com a marca abre o menu em um painel que sobe da base, limitado a 75% da altura disponível, com opções em duas colunas e fechamento animado. O painel respeita as áreas seguras e a redução de movimentos. A contagem usa a tela inteira e respeita áreas seguras.
- Todas as animações respeitam `prefers-reduced-motion`; foco visível, labels, navegação por teclado e estados descritivos estão presentes.

## Verificação

59 testes automatizados passaram, incluindo zero/branco, rascunhos por conta/loja, falha de armazenamento, preservação histórica, posição no tempo e salvamento parcial pela promotora sem liberação de correção. Uma verificação adicional executou o cliente com DOM simulado e API real em bancos isolados: nove telas do administrador, oito da promotora, falha de salvamento, retomada, gravação e exclusão.

Essa verificação não é uma inspeção visual em navegador. O ambiente da sessão bloqueia portas locais e não oferece navegador automatizado. A revisão visual de desktop/celular, claro/escuro e impressão deve ser feita no navegador do computador, usando o iniciador existente. O build continua sendo `npm run build`.

O redesign não publica o projeto e não modifica os registros do banco local. A preparação de uma versão limpa para GitHub privado e a validação de Vercel/Neon continuam pendentes.
