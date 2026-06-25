import { discoverSource } from '../genericSourceDiscovery.mjs';
import { getKnownPagesBySource } from '../knownOfficialPages.mjs';

export async function discoverExamsAndFiles({ supabase, limits, logger }) {
  return discoverSource({
    supabase,
    limits,
    logger,
    source: {
      name: 'IBFC IBGE',
      board: 'IBFC',
      type: 'official_board',
      pages: getKnownPagesBySource('IBFC IBGE'),
      canDownloadPdfs: true,
    },
  });
}
