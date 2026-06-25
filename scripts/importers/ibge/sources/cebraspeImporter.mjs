import { discoverSource } from '../genericSourceDiscovery.mjs';
import { getKnownPagesBySource } from '../knownOfficialPages.mjs';

export async function discoverExamsAndFiles({ supabase, limits, logger }) {
  return discoverSource({
    supabase,
    limits,
    logger,
    source: {
      name: 'Cebraspe IBGE',
      board: 'Cebraspe',
      type: 'official_board',
      pages: getKnownPagesBySource('Cebraspe IBGE'),
      canDownloadPdfs: true,
    },
  });
}
