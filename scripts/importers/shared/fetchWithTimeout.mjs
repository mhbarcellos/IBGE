export async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IBGE Estudos Importer)',
        Accept: 'text/html,application/xhtml+xml,application/pdf',
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}
