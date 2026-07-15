export const ibgeSources = [
  {
    name: 'PCI Concursos IBGE',
    type: 'index',
    url: 'https://www.pciconcursos.com.br/provas/ibge',
    canDownloadPdfs: false,
    notes: 'Usar apenas como indice. PDFs podem estar protegidos por Turnstile.',
  },
  {
    name: 'FGV IBGE',
    type: 'official_board',
    url: 'https://conhecimento.fgv.br/concursos/ibge-pss/1pss',
    canDownloadPdfs: true,
    notes: 'Fonte oficial FGV 2017 relacionada a ACA.',
  },
  {
    name: 'IBFC IBGE',
    type: 'official_board',
    url: 'https://concursos.ibfc.org.br/informacoes/426/',
    canDownloadPdfs: true,
  },
  {
    name: 'Cebraspe IBGE',
    type: 'official_board',
    url: 'https://www.cebraspe.org.br/concursos/ibge_21_pss',
    canDownloadPdfs: true,
  },
  {
    name: 'IBGE Trabalhe Conosco',
    type: 'official_index',
    url: 'https://www.ibge.gov.br/acesso-informacao/institucional/trabalhe-conosco.html',
    canDownloadPdfs: true,
  },
];
