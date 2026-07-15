# IBGE Estudos

Plataforma pessoal de estudos para concursos do IBGE, com login pelo Supabase, banco de questoes, questionario, desempenho, revisao de erros, materiais e cadastro simples de provas e questoes.

## Tecnologias

- React + Vite
- JavaScript
- React Router
- Supabase Auth e Database
- CSS puro
- Netlify para deploy futuro

## Instalar

```bash
npm install
```

## Rodar localmente

```bash
npm run dev
```

O app abre a tela de login. Sem variaveis do Supabase, ele mostra um aviso amigavel e usa dados demonstrativos nas telas de consulta.

Sem Supabase configurado, use o botao `Entrar em modo demonstração` para navegar pelo app inteiro com dados locais.

## Configurar Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Execute o conteudo de `supabase/schema.sql`.
4. Em Project Settings > API, copie a URL do projeto e a anon public key.
5. Crie um arquivo `.env` local a partir do `.env.example`.

```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
VITE_TARGET_ROLE=ACA
VITE_TARGET_ROLE_LABEL=Agente Censitário Administrativo
TARGET_EXAM_ROLE=ACA
SEED_USER_EMAIL=email-do-usuario-criado-no-app
SEED_USER_PASSWORD=senha-do-usuario-criado-no-app
ADMIN_USER_EMAIL=email-do-primeiro-admin
```

Nao use `service_role` no frontend.
`SEED_USER_EMAIL` e `SEED_USER_PASSWORD` sao usados somente pelos scripts locais de seed e devem corresponder a um usuario real criado pelo proprio app.

## Foco de estudo: ACA

O cargo-alvo padrão da plataforma é `ACA`, ou seja, Agente Censitário Administrativo.

No frontend, essas variáveis podem ser ajustadas no `.env` e no Netlify:

```bash
VITE_TARGET_ROLE=ACA
VITE_TARGET_ROLE_LABEL=Agente Censitário Administrativo
```

Nos scripts locais, `TARGET_EXAM_ROLE=ACA` também é aceito. Se as variáveis não existirem, o app usa `ACA` e `Agente Censitário Administrativo` como padrão.

Para habilitar as colunas de foco no banco, execute no SQL Editor:

```sql
-- Cole e execute o conteudo de:
-- supabase/phase8_target_role_focus.sql
```

Depois de importar provas ou questões, rode:

```bash
npm run questions:classify-role
```

Esse script marca provas e questões como:

- `target`: ACA.
- `related`: cargos censitários próximos, como ACI, ACM e ACS.
- `other`: outros cargos do IBGE, como APM, SCQ e recenseador.
- `unknown`: sem informação suficiente.

As questões de APM, SCQ e outros cargos não são apagadas. Elas continuam disponíveis como treino complementar, mas o Dashboard, o Questionário, o Banco de Questões, Provas e Materiais passam a priorizar ACA.

## Fase 9: trilha, revisão de erros e simulados

Para habilitar persistência de simulados no Supabase, execute no SQL Editor:

```sql
-- Cole e execute o conteudo de:
-- supabase/phase9_study_features.sql
```

Essa migração cria:

- `simulated_exams`
- `simulated_exam_questions`

As policies de RLS garantem que cada usuário veja e altere somente os próprios simulados. A revisão de erros usa `question_attempts`, que também permanece privada por usuário.

Novas rotas de estudo:

- `/trilha`: organiza os próximos passos por disciplina e mostra questões disponíveis, acertos e taxa de acerto.
- `/revisao-erros`: lista questões que o usuário errou, com filtros por disciplina, assunto e prova.
- `/simulados`: cria treinos rápidos de 10, 20, 30 ou 60 questões, com foco ACA, ACA + relacionados ou todas.

No modo demonstração, essas telas funcionam com dados locais.

## Multiusuario e papeis

A plataforma possui dois papeis:

- `student`: usa a plataforma para estudar, praticar questoes e acompanhar desempenho individual.
- `admin`: gerencia importacao, revisao e administracao de questoes.

Para habilitar perfis e papeis, execute no SQL Editor:

```sql
-- Cole e execute o conteudo de:
-- supabase/phase7_multi_user_roles.sql
```

Essa migracao cria `profiles`, funcoes `get_my_role()` e `is_admin()`, RLS para perfis e trigger para criar profile automaticamente quando um usuario novo entra no Auth.

### Primeiro admin

1. Rode `supabase/phase7_multi_user_roles.sql`.
2. Defina `ADMIN_USER_EMAIL` no `.env`.
3. Garanta que esse usuario ja criou conta ou fez login ao menos uma vez.
4. Rode:

```bash
npm run users:set-admin
```

O script usa o cliente autenticado com `SEED_USER_EMAIL` e `SEED_USER_PASSWORD`, sem `service_role`. Se o RLS bloquear a promocao inicial, ele mostra o SQL seguro para rodar uma unica vez no SQL Editor:

```sql
update public.profiles
set role = 'admin'
where email = 'email-do-admin';
```

## Recuperacao de senha

Para o link de recuperacao do Supabase abrir a tela correta, configure em Authentication -> URL Configuration:

Site URL:

```text
http://127.0.0.1:5173
```

Redirect URLs:

```text
http://127.0.0.1:5173/reset-password
http://localhost:5173/reset-password
http://127.0.0.1:5173/
http://localhost:5173/
```

A tela `/reset-password` recebe o usuario vindo do e-mail de recuperacao e chama `supabase.auth.updateUser` para salvar a nova senha.

## Fase 2: importacao e curadoria

Para projetos ja criados com o schema da primeira versao, execute no SQL Editor:

```sql
-- Cole e execute o conteudo de:
-- supabase/phase2_import_tables.sql
```

Esse arquivo adiciona as tabelas:

- `import_sources`
- `exam_files`
- `import_jobs`
- `question_import_reviews`

Tambem adiciona `topic` em `study_materials` para melhorar a organizacao dos materiais.

## Seeds e diagnostico

Depois de configurar `.env`, rode:

```bash
npm run seed:all
```

Esse comando executa:

- `npm run seed:sources`
- `npm run seed:exams`
- `npm run seed:materials`
- `npm run check:supabase`

Os scripts evitam duplicidade por URL, por dados principais da prova e por `subject + topic + title` nos materiais. Eles usam `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SEED_USER_EMAIL` e `SEED_USER_PASSWORD`. O login e feito com Supabase Auth usando a anon key, respeitando RLS, sem `service_role`.

## Tela Importações

A rota `/importacoes` permite:

- listar fontes cadastradas em `import_sources`
- popular as fontes iniciais conhecidas pelo frontend
- adicionar uma nova fonte manualmente
- abrir links em nova aba
- listar arquivos cadastrados em `exam_files`
- revisar arquivos descobertos em `import_discovered_files`
- aprovar arquivos descobertos como arquivos de prova
- visualizar trechos de textos extraidos em `exam_file_texts`

No modo demonstração, esses dados ficam no `localStorage`.

## Fase 3: pipeline de PDFs públicos

Depois de executar a Fase 2, rode no SQL Editor:

```sql
-- Cole e execute o conteudo de:
-- supabase/phase3_pdf_pipeline.sql
```

Essa migracao adiciona:

- `import_discovered_files`
- `exam_file_texts`

Para habilitar a camada de inferencia de metadados, execute tambem:

```sql
-- Cole e execute o conteudo de:
-- supabase/phase3_file_metadata_inference.sql
```

Para habilitar o filtro exam-only, execute:

```sql
-- Cole e execute o conteudo de:
-- supabase/phase3_exam_only_filter.sql
```

Com `.env` configurado e usuario de seed autenticavel, use:

```bash
npm run import:discover
npm run import:infer
npm run import:archive-irrelevant
npm run import:archive-irrelevant -- --apply
npm run import:clean-discovered
npm run import:download
npm run import:extract
npm run import:check
```

Ou o fluxo completo:

```bash
npm run import:pdfs
```

O que cada etapa faz:

- `import:discover`: le apenas a pagina principal de cada fonte cadastrada e registra links candidatos, sem crawling profundo.
- `import:infer`: normaliza titulos, refina tipos, infere edital, ano, banca, cargo e prova sugerida.
- `import:archive-irrelevant`: em dry-run, mostra comunicados, editais e itens administrativos que seriam arquivados.
- `import:archive-irrelevant -- --apply`: arquiva itens irrelevantes/desconhecidos sem deletar.
- `import:clean-discovered`: reclassifica tudo e arquiva automaticamente o que nao for prova/gabarito, exceto itens aprovados.
- `import:download`: baixa apenas arquivos ja cadastrados em `exam_files` com status `pending`, `discovered` ou `approved`.
- `import:extract`: extrai texto dos PDFs baixados e salva em `exam_file_texts`.
- `import:check`: mostra contagens do pipeline.

Para testar a descoberta com poucas fontes, defina no `.env`:

```bash
IMPORT_MAX_SOURCES=3
```

PDFs e textos locais ficam em `data/imported/` e nao devem ir para o GitHub. A inferencia e heuristica, nao perfeita, e a aprovacao ainda deve ser revisada pela usuaria. O sistema agora e exam-only: editais, comunicados, resultados, convocacoes e documentos administrativos nao fazem parte do banco principal de estudo e sao arquivados por padrao. Esta fase nao cria questoes automaticamente; a proxima fase sera parser de questoes com revisao humana.

## Fase 4: banco real de questoes IBGE

O objetivo da Fase 4 e transformar o app em um banco pessoal de questoes reais do IBGE, priorizando provas publicas anteriores. O fluxo principal e automatico: ele usa PCI como indice historico, busca fontes oficiais/bancas, baixa apenas PDFs publicos acessiveis, extrai texto, cruza gabaritos e envia itens incertos para revisao.

Antes de importar, execute no SQL Editor:

```sql
-- Cole e execute o conteudo de:
-- supabase/phase4_pci_question_bank.sql
-- supabase/phase4_pci_pdf_question_pipeline.sql
-- supabase/phase5_auto_ibge_importer.sql
-- supabase/phase5_exam_file_formats.sql
-- supabase/phase8_target_role_focus.sql
-- supabase/phase9_study_features.sql
```

Os importadores automaticos usam paginas oficiais especificas conhecidas das bancas e do IBGE, em vez de paginas genericas de concursos. O crawler e controlado: ele le a pagina oficial, segue no maximo um nivel de pagina candidata e nunca tenta contornar CAPTCHA, Turnstile, login, paywall ou JavaScript protegido.

Para ACA, a fonte oficial inicial priorizada é a página FGV 2017:

```text
https://conhecimento.fgv.br/concursos/ibge-pss/1pss
```

O importador procura primeiro provas e gabaritos com sinais de Agente Censitário Administrativo, ACA, IBGE PSS 2017, 1PSS e FGV 2017. Depois considera cargos censitários relacionados e deixa outros cargos com prioridade menor.

O sistema procura arquivos diretos de prova e gabarito nestes formatos:

- `pdf`
- `zip`
- `doc`
- `docx`
- `xls`
- `xlsx`
- `csv`

HTML e usado apenas como pagina intermediaria para descobrir arquivos reais. HTML nao e cadastrado como arquivo final de prova. Editais, comunicados, resultados, convocacoes, cronogramas, homologacoes, inscricoes, recursos e avisos sao ignorados mesmo quando aparecem em formatos permitidos.

Para limitar testes locais, use no `.env`:

```bash
IBGE_MAX_OFFICIAL_PAGES=10
IBGE_MAX_EXAM_FILES=20
```

Se precisar limpar dados de importacoes anteriores, rode primeiro em dry-run:

```bash
npm run reset:imports
```

Para aplicar a limpeza:

```bash
npm run reset:imports -- --apply
```

O reset remove dados importados pelo pipeline, mas nao usa `service_role` e respeita o usuario autenticado via `SEED_USER_EMAIL` e `SEED_USER_PASSWORD`.

Se links ruins de navegacao forem importados como arquivos PCI, rode primeiro em dry-run:

```bash
npm run pci:clean-bad
```

Para remover esses registros:

```bash
npm run pci:clean-bad -- --apply
```

Fluxo principal:

```bash
npm run ibge:import-all
```

Diagnostico:

```bash
npm run ibge:check
```

O `ibge:check` mostra também as contagens de provas ACA, provas relacionadas, questões ACA, questões relacionadas, questões outras e questões sem classificação.

O sistema importa automaticamente o que for publico e acessivel. Fontes com CAPTCHA, Turnstile, login, paywall ou JavaScript bloqueante nao sao burladas; PDFs protegidos sao pulados e registrados no relatorio. Editais, comunicados, resultados, convocacoes e cronogramas nao devem entrar como conteudo de estudo. Questoes sem gabarito ou com parse incerto vao para `/revisao-questoes`; o questionario usa apenas questoes validas com gabarito.

Arquivos PDF, DOCX, XLS, XLSX e CSV baixados sao candidatos a extracao de texto. ZIPs sao registrados e baixados, mas podem ficar como `unsupported_zip` ate haver extracao segura do conteudo interno. DOC antigo pode ficar como `unsupported`. O questionario usa somente questoes validas com gabarito; o parser nao inventa respostas.

Se precisar limpar artefatos automaticos antigos das fontes oficiais, rode primeiro em dry-run:

```bash
npm run ibge:clean-auto
```

Para aplicar:

```bash
npm run ibge:clean-auto -- --apply
```

Esse comando nao remove o historico PCI nem questoes.

### Importacao manual de PDFs oficiais (fallback tecnico)

O fluxo manual existe apenas como fallback tecnico para uma URL direta de PDF que a importacao automatica ainda nao encontrou. Ele nao e o caminho principal do projeto.

Voce pode cadastrar os PDFs pelo app em `/importar-pdf` ou pelo `.env`:

```bash
MANUAL_EXAM_TITLE=
MANUAL_EXAM_YEAR=
MANUAL_EXAM_BOARD=
MANUAL_EXAM_ROLE=
MANUAL_EXAM_ORGANIZATION=IBGE
MANUAL_PROVA_PDF_URL=
MANUAL_GABARITO_PDF_URL=
MANUAL_SOURCE_NAME=Importação manual
MANUAL_SOURCE_PAGE_URL=
```

Pelo `.env`, cadastre o par:

```bash
npm run manual:pdf-pair
```

Depois rode o pipeline local:

```bash
npm run manual:download-pdfs
npm run manual:extract-text
npm run manual:parse-pdfs
npm run pci:check
```

Ou o fluxo completo:

```bash
npm run manual:import
```

Os scripts manuais so baixam URLs diretas de arquivos permitidos. Se a URL retornar HTML, login, CAPTCHA, paywall ou qualquer pagina intermediaria protegida, ela e ignorada ou marcada como erro de download.

## Deploy no Netlify

O arquivo `netlify.toml` ja esta preparado para SPA:

- build: `npm run build`
- publish: `dist`
- redirect: todas as rotas para `/index.html`

No Netlify, cadastre as mesmas variaveis:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Checklist antes de publicar:

- Configurar variaveis no Netlify.
- Configurar URLs de Auth no Supabase.
- Testar cadastro de novo usuario.
- Testar login real.
- Confirmar que novo usuario recebe `student`.
- Confirmar que `student` nao ve nem acessa rotas administrativas.
- Confirmar que `admin` ve Importacao automatica, Historico de Importacoes, Importar PDF, Revisao e Admin.
- Confirmar que tentativas/desempenho aparecem somente para o proprio usuario.

## Funcionalidades

- Login, cadastro e logout com Supabase Auth.
- Rotas internas protegidas.
- Dashboard com resumo de desempenho.
- Listagem de provas, questoes e materiais.
- Questionario com correcao imediata e salvamento de tentativas.
- Pagina de desempenho por disciplina e assunto.
- Admin simples para cadastrar provas e questoes.
- Tela de importacoes para fontes publicas e arquivos de prova.
- Revisao de questoes importadas antes de liberar para treino.

## Limitacoes atuais

- O importador PCI usa heuristicas e pode exigir ajustes manuais.
- Nem toda pagina publica traz gabarito estruturado.
- Questoes importadas com duvida passam por revisao antes de aparecerem no treino padrao.
- Seeds via API respeitam RLS; por isso podem exigir login de usuario comum nas variaveis locais.
- O pipeline de arquivos baixa somente arquivos aprovados/cadastrados e nao transforma texto em questoes finais sem gabarito valido.
- A inferencia de metadados usa regras locais e pode errar edital, cargo ou prova sugerida.

## Proximos passos

1. Refinar o parser das paginas da PCI com casos reais.
2. Melhorar classificacao de disciplina e assunto.
3. Revisar questoes importadas em lote.
4. Ampliar fontes publicas permitidas sem importacao agressiva.
