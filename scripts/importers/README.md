# Importadores de PDFs

Esta pasta contem a Fase 3 do pipeline:

1. `discoverPdfLinks.mjs`: le apenas a pagina principal de fontes cadastradas e registra links candidatos.
2. `inferDiscoveredFiles.mjs`: normaliza metadados e sugere prova, edital, banca e cargo.
3. `archiveIrrelevantDiscoveredFiles.mjs`: arquiva comunicados, editais e itens administrativos em dry-run ou com `--apply`.
4. `reclassifyAndArchiveDiscoveredFiles.mjs`: reclassifica tudo e limpa a lista principal.
5. `downloadExamFiles.mjs`: baixa PDFs aprovados/cadastrados em `exam_files`.
6. `extractTextFromPdfs.mjs`: extrai texto dos PDFs locais.
7. `checkPdfPipeline.mjs`: mostra contagens do pipeline.

O escopo e exam-only: a lista principal deve priorizar provas, cadernos de questoes e gabaritos. Editais, comunicados, resultados e documentos administrativos ficam arquivados por padrao.

Arquivos baixados e textos extraidos ficam em `data/imported/`, que nao deve ser versionado.

Proxima fase:

1. Detectar questoes, alternativas e metadados a partir do texto extraido.
2. Cruzar questoes com gabaritos.
3. Classificar disciplina, assunto e dificuldade.
4. Enviar tudo para revisao antes de publicar no banco principal.

Nao fazer scraping agressivo, nao burlar CAPTCHA, login, bloqueio, paywall ou areas restritas.
