import { discoverSource } from '../genericSourceDiscovery.mjs';
import { getKnownPagesBySource } from '../knownOfficialPages.mjs';

export async function discoverExamsAndFiles({ supabase, limits, logger }) {
  return discoverSource({
    supabase,
    limits,
    logger,
    source: {
      name: 'FGV IBGE',
      board: 'FGV',
      type: 'official_board',
      pages: getKnownPagesBySource('FGV IBGE'),
      canDownloadPdfs: true,
    },
  });
}
