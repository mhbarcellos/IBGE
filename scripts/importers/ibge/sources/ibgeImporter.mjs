import { discoverSource } from '../genericSourceDiscovery.mjs';
import { getKnownPagesBySource } from '../knownOfficialPages.mjs';

export async function discoverExamsAndFiles({ supabase, limits, logger }) {
  return discoverSource({
    supabase,
    limits,
    logger,
    source: {
      name: 'IBGE Trabalhe Conosco',
      board: 'IBGE',
      type: 'official_index',
      pages: getKnownPagesBySource('IBGE Trabalhe Conosco'),
      canDownloadPdfs: true,
      maxDepth: 1,
    },
  });
}
