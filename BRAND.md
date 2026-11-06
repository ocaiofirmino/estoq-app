# Estoq · marca e aplicação

Nome oficial: **Estoq**. A identidade reúne estoque, visitas técnicas e veterinária, conforme a prancha enviada pelo usuário em 02/11/2026.

## Arquivos finais

| Arquivo | Uso |
| --- | --- |
| `branding/estoq-reference.png` | Imagem original fornecida, preservada sem alterações |
| `public/estoq-brand-board.webp` | A mesma imagem, codificada em WebP sem perdas para aplicação no site |
| `public/favicon.svg` | Adaptação vetorial compacta do símbolo para favicon, barra lateral, menu e atalho do sistema |
| `public/brand.js` | Componente da marca nos relatórios e comparativos |
| `public/design.css` | Janelas da prancha para as aplicações clara e inversa |
| `iniciar-estoq.sh` | Inicializador principal com o nome novo |

O PNG original mede 1448 × 1086. A codificação WebP mantém as mesmas dimensões e pixels: a comparação independente com ImageMagick retornou `AE = 0`. O arquivo passou de 1.624.804 para 870.252 bytes.

As janelas CSS usam a marca maior da parte superior no tema claro e a aplicação inversa da parte inferior direita no tema escuro. A imagem original não foi redesenhada nem recortada em um novo bitmap. A composição tem proporção fixa para evitar mudanças de layout ao alternar o tema; a impressão usa a aplicação clara.

## Extrações avaliadas

A skill imagegen foi usada em modo **built-in** para tentar extrair versões transparentes. As extrações e uma rodada de limpeza apresentaram artefatos nas bordas e não foram utilizadas no aplicativo. Os prompts completos estão em `branding/imagegen-prompts.json`; as cópias descartadas ficaram em `data/backups/estoq-extracoes-nao-utilizadas/`, fora do Git e do build.

## Identidade e migração

- O projeto fica em `/home/caio/Projetos/estoq`, com apenas `iniciar-estoq.sh` como inicializador e `estoq.desktop` como atalho do sistema.
- O banco é `data/estoq.sqlite`; workspace, sessões, limites de login e índice de expiração usam o prefixo `estoq_`.
- O cookie é `estoq_session`; tema e rascunhos usam `estoq-theme` e `estoq-draft-v1:`. Os valores existentes são transferidos, incluindo contagens zero e visitas incompletas. O cookie anterior é aposentado na próxima resposta autenticada.
- Apenas `ESTOQ_DATA_DIR` e `ESTOQ_OPEN_BROWSER` são aceitas como variáveis próprias do aplicativo.
- A planilha em `data/imports/Estoq_Controle_Estoque_Reformulado.xlsx` mantém exatamente os bytes e SHA-256 da fonte original; o nome de exibição na base foi atualizado sem alterar lojas, produtos, visitas ou configurações.
- Identificadores anteriores existem somente nos conversores `lib/migrations/001-estoq.mjs`, `public/storage-migration.js`, `scripts/migrate-estoq.mjs` nos testes específicos da migração e nos backups de segurança, para permitir migração precisa sem recriar a base.
- `npm run migrate:brand` migra o banco SQLite local com backup e renomeia o arquivo. `npm run db:setup` também converte as tabelas de um banco Postgres existente antes de inicializar a estrutura Estoq.
- O auxiliar de GitHub aponta para o destino planejado `ocaiofirmino/estoq`, privado. Nenhum repositório foi publicado ou alterado remotamente.

A migração local preservou os registros de estoque e de acesso. A integridade SQLite foi confirmada; o nome da fonte e a revisão foram atualizados, mantendo bytes e hash da planilha, todas as contagens e a auditoria existentes. A rota HTTP foi verificada com login, migração do cookie e logout, sem gravar visitas.

O endereço local continua sendo `http://127.0.0.1:4173`. Para iniciar: `bash /home/caio/Projetos/estoq/iniciar-estoq.sh`.
