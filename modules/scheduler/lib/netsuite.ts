/** NetSuite URL helpers (ported from esprint-support-scheduler/src/lib/netsuite.js) */

export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function cleanNetsuiteUrl(url: string): string {
  if (!url) return "";
  const decoded = decodeHtmlEntities(url.trim());
  if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
    return decoded;
  }
  if (decoded.startsWith("/")) {
    return "https://system.netsuite.com" + decoded;
  }
  return decoded;
}

/**
 * Extract the best NetSuite href from clipboard HTML.
 * Priority: anchor matching pasted text > ID query param match > first netsuite.com anchor.
 */
export function extractHrefFromHtml(
  html: string | undefined,
  pastedText: string
): string {
  if (!html) return "";
  const anchorRe = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  const matches: { href: string; text: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    const href = decodeHtmlEntities(m[1]);
    const text = m[2].replace(/<[^>]+>/g, "").trim();
    if (/netsuite\.com/i.test(href)) {
      matches.push({ href, text });
    }
  }
  if (!matches.length) return "";
  if (pastedText) {
    const exact = matches.find(
      (x) => x.text.toLowerCase() === pastedText.toLowerCase()
    );
    if (exact) return exact.href;
    const idMatch = pastedText.match(/\d+/);
    if (idMatch) {
      const byId = matches.find((x) => x.href.includes(`id=${idMatch[0]}`));
      if (byId) return byId.href;
    }
  }
  return matches[0].href;
}

/**
 * Build a NetSuite case search URL from a case number.
 * Using a search URL avoids the "search criteria expired" error.
 */
export function buildNetsuiteUrl(caseNumber: string): string {
  const clean = String(caseNumber || "").trim();
  if (!clean) return "#";
  return `https://11128201.app.netsuite.com/app/common/search/searchresults.nl?searchtype=Case&Case_CASENUMBER=${encodeURIComponent(clean)}&action=search`;
}
