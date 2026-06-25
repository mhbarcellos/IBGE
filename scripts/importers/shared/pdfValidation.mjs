import { fetchWithTimeout } from './fetchWithTimeout.mjs';

export function looksLikePdfUrl(url = '') {
  try {
    return /\.pdf$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export function isBlockedOrProtectedHtml(html = '') {
  return /captcha|turnstile|cloudflare|login|senha|paywall|javascript habilitado|verifica[cç][aã]o de seguran[cç]a/i.test(html);
}

export async function validatePdfUrl(url, timeoutMs = 8000) {
  if (looksLikePdfUrl(url)) return { ok: true, finalUrl: url, reason: 'url_pdf' };

  try {
    const head = await fetchWithTimeout(url, { method: 'HEAD', headers: { Accept: 'application/pdf' } }, timeoutMs);
    const type = head.headers.get('content-type') || '';
    if (head.ok && /application\/pdf|octet-stream/i.test(type)) return { ok: true, finalUrl: head.url || url, reason: type };
    if (/text\/html/i.test(type)) return { ok: false, reason: 'html' };
  } catch {
    // Some official hosts block HEAD. GET below checks headers and then cancels.
  }

  const response = await fetchWithTimeout(url, { headers: { Accept: 'application/pdf' } }, timeoutMs);
  const type = response.headers.get('content-type') || '';
  if (response.ok && /application\/pdf|octet-stream/i.test(type)) {
    response.body?.cancel?.();
    return { ok: true, finalUrl: response.url || url, reason: type };
  }

  let reason = type || `HTTP ${response.status}`;
  if (/text\/html/i.test(type)) {
    const html = await response.text();
    reason = isBlockedOrProtectedHtml(html) ? 'protected_html' : 'html';
  } else {
    response.body?.cancel?.();
  }

  return { ok: false, reason };
}
