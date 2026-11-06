# Estoq

**Estoque e acompanhamento de visitas para a rotina da promoção técnica veterinária.**

O Estoq organiza, em um só lugar, as lojas e clínicas acompanhadas, os produtos e as contagens realizadas em cada visita. Foi pensado para quem precisa consultar o histórico e registrar o que encontrou na unidade pelo celular ou tablet, mantendo uma visão geral da rede no computador.

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=000)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS-663399?style=for-the-badge&logo=css&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Neon](https://img.shields.io/badge/Neon-00E599?style=for-the-badge&logo=neon&logoColor=000)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![npm](https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)

Projeto de uso exclusivo de **Caio Firmino** nesta fase de piloto.

Endereço do projeto: [estoq-app.vercel.app](https://estoq-app.vercel.app).

## Por que o sistema foi criado

A demanda nasceu de uma rotina que já existia em planilhas: acompanhar o estoque de produtos veterinários em diferentes lojas e registrar novas contagens a cada visita. Conforme o número de unidades aumenta, manter uma planilha ou aba para cada loja torna o controle extenso, pesado de manusear e trabalhoso de conferir, especialmente no celular.

O esforço deixa de ser apenas contar os produtos. Também é preciso localizar a loja certa, manter os cadastros consistentes, encontrar a visita anterior, comparar as quantidades e reunir os resultados para apresentar ao comprador. Quando essas informações ficam espalhadas entre arquivos e abas, a consolidação depende de etapas manuais e fica mais sujeita a esquecimentos e divergências.

O Estoq surgiu para concentrar esse acompanhamento e tornar o registro de uma visita mais direto. A informação é organizada por **loja, produto e data**, com histórico preservado e consultas que ajudam a entender a posição do estoque e suas mudanças ao longo do tempo.

## Objetivo

Oferecer uma ferramenta prática para o trabalho em campo: registrar contagens com clareza, consultar visitas anteriores e preparar informações úteis para acompanhar os pontos de venda e conversar sobre estoque e reposição.

O foco atual é colocar o piloto em uso e validar a rotina real. A prioridade é conseguir registrar e consultar visitas com confiança, preservar os dados e manter a interface confortável no celular, no tablet e no computador.

## Como funciona na prática

1. **Organizar a base:** cadastrar e consultar lojas, produtos e seus laboratórios. Os dados que já existem em planilhas podem ser aproveitados pela importação local de arquivos XLSX.
2. **Abrir uma visita:** selecionar a loja e a data da conferência. Uma nova visita à mesma unidade acrescenta um registro ao histórico.
3. **Contar os produtos:** informar as quantidades encontradas, com digitação ou botões de aumentar e diminuir. A contagem pode ser feita com foco em um produto por vez.
4. **Revisar e salvar:** conferir a lista, pesquisar um produto e adicionar observações. É possível registrar uma visita parcial, sem transformar produtos não conferidos em estoque zero.
5. **Consultar o acompanhamento:** abrir o histórico da loja, ver uma visita específica ou comparar duas visitas para identificar as variações de estoque.
6. **Compartilhar os resultados:** filtrar por período, loja e laboratório e gerar relatórios em Excel, CSV ou PDF.

Rascunhos ajudam a retomar uma contagem no mesmo navegador e dispositivo. Produtos descontinuados podem ser retirados das próximas contagens sem apagar os registros das visitas antigas.

### Como o estoque é interpretado

A primeira contagem conhecida de um produto em uma loja é a **referência inicial, ou dia zero**. A partir das próximas contagens, o sistema compara as quantidades observadas.

| Contagem anterior | Nova contagem | Leitura do sistema |
| ---: | ---: | --- |
| 10 | 7 | Saída estimada de 3 unidades |
| 7 | 12 | Possível reposição de 5 unidades |
| 12 | 12 | Estoque sem alteração |

Essas variações são estimativas a partir das conferências físicas. Uma queda não comprova uma venda, e uma alta não comprova uma compra: podem existir outras movimentações entre as visitas. O sistema preserva essa distinção para apoiar a análise sem apresentar uma estimativa como uma movimentação confirmada.

**Zero significa que o produto foi conferido e não havia unidades. Um produto não conferido continua sem contagem.** Essa diferença é mantida nas consultas e nos relatórios.

## O que melhora em relação à rotina com planilhas

| Necessidade da rotina | Como o Estoq organiza o trabalho |
| --- | --- |
| Acompanhar várias lojas | Uma base central, com pesquisa e filtros, em vez de procurar cada unidade em arquivos ou abas separados. |
| Registrar visitas recorrentes | Cada visita fica associada à loja e à data, formando um histórico consultável. |
| Comparar contagens | As diferenças entre as visitas são calculadas a partir dos registros, reduzindo a conferência manual. |
| Preencher durante a visita | Uma interface pensada para toque, com contagem por produto e revisão em lista. |
| Reunir informações da rede | Consultas por loja, produto, laboratório e período, com relatórios e exportações. |
| Manter mudanças de catálogo | Produtos podem ser descontinuados para novas visitas sem perder o histórico. |

A exportação em Excel mantém a possibilidade de trabalhar e compartilhar informações em planilhas quando isso fizer parte da rotina. O ganho está em centralizar o registro e o acompanhamento antes dessa exportação.

## Linguagens, dados e plataforma

| Tecnologia | Papel no projeto |
| --- | --- |
| **HTML** | Estrutura das páginas e dos formulários. |
| **CSS** | Aparência, temas claro e escuro e adaptação das telas para celular, tablet e computador. |
| **JavaScript** | Interface, contagem, filtros, cálculos, comparativos e exportações. |
| **Node.js 24** | Execução da API e das regras de leitura e gravação dos dados no servidor. |
| **Python** | Leitura e importação local das planilhas XLSX usadas na rotina anterior. |
| **SQLite** | Persistência na execução local. |
| **PostgreSQL / Neon** | Persistência da operação online, compartilhando os registros entre dispositivos. |
| **Vercel** | Hospedagem da interface e execução da API da versão online. |
| **npm** | Dependências, comandos de desenvolvimento e geração do build. |
| **GitHub** | Versionamento do código e documentação do projeto. |

A interface usa HTML, CSS e JavaScript, sem framework de frontend. Os dados reais da operação permanecem separados do código público.

## Escopo atual e evolução futura

**Agora:** consolidar um piloto utilizável para o acompanhamento que motivou o projeto. Isso inclui contagens claras, histórico confiável, consultas e relatórios úteis, preservação dos registros e boa experiência nos dispositivos usados durante as visitas.

**Mais adiante:** o sistema poderá evoluir para atender outros promotores técnicos, cada um acompanhando mais lojas e clínicas. Essa é uma visão de crescimento, ainda não uma funcionalidade entregue nem um compromisso de prazo. A organização de uma operação maior deve ser definida a partir do uso e das necessidades observadas no piloto.

A evolução será guiada pela rotina de quem usa o sistema. O primeiro passo é fazer o acompanhamento atual funcionar bem no dia a dia.
