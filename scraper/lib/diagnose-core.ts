/**
 * Discovery-level source diagnostics — no Claude calls, no DB writes.
 *
 * Exercises only the DISCOVERY layer of the pipeline for a source (WP REST /
 * RSS / sitemap / list-page + filterLinks) and reports HTTP status and the
 * number of discovered items. A source with HTTP 200 but 0 discovered items is
 * the silent-break signature (site redesign, moved feed, JS-only rendering,
 * bot wall serving a shell page).
 *
 * Used by tools/diagnose.ts (ad-hoc report) and tools/yield-guard.ts (CI
 * regression guard).
 */
import axios from "axios";
import { fetchPageContent, fetchWithBrowser, fetchRssFeed } from "./fetch.js";
import { fetchSitemap, resolveSitemapUrl, filterByLastmodAge } from "./sitemap.js";
import { fetchWpPosts } from "./wp.js";
import { filterLinks } from "./filter-links.js";
import type { Source } from "../types.js";

export type DiagMode = "wp" | "rss" | "sitemap" | "list-browser" | "list-static" | "single-page";

export interface DiagResult {
    name: string;
    mode: DiagMode;
    status: number | string; // HTTP status, or error class ("TIMEOUT", "DNS", "ERR")
    count: number;           // discovered items at the discovery layer
    contentBytes: number;
    note: string;
    ms: number;
}

export function modeFor(s: Source): DiagMode {
    if (s.feedUrl) return "wp";
    if (s.isRss) return "rss";
    if (s.sitemapUrl) return "sitemap";
    if (s.needsBrowser) return "list-browser";
    if (s.followLinks || s.isListPage) return "list-static";
    return "single-page";
}

function errStatus(err: any): number | string {
    const status = err?.response?.status;
    if (status) return status;
    const code = err?.code ?? "";
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "DNS";
    if (code === "ECONNABORTED" || /timeout/i.test(err?.message ?? "")) return "TIMEOUT";
    if (code === "ECONNRESET" || code === "ECONNREFUSED") return code;
    if (code === "ERR_TLS_CERT_ALTNAME_INVALID" || /certificate/i.test(err?.message ?? "")) return "TLS";
    return "ERR";
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    let t: ReturnType<typeof setTimeout>;
    return Promise.race([
        p,
        new Promise<never>((_, rej) => { t = setTimeout(() => rej(Object.assign(new Error("diag timeout"), { code: "ECONNABORTED" })), ms); }),
    ]).finally(() => clearTimeout(t!));
}

export async function diagnoseSource(s: Source, browserOk: boolean): Promise<DiagResult> {
    const mode = modeFor(s);
    const started = Date.now();
    const done = (partial: Omit<DiagResult, "name" | "mode" | "ms">): DiagResult =>
        ({ name: s.name, mode, ms: Date.now() - started, ...partial });

    try {
        if (mode === "wp") {
            const posts = await withTimeout(fetchWpPosts(s.url, { feedPath: s.feedUrl, limit: 100 }), 45_000);
            return done({ status: 200, count: posts.length, contentBytes: 0, note: posts.length === 0 ? "WP REST reachable but returned 0 posts" : "" });
        }

        if (mode === "rss") {
            const items = await withTimeout(fetchRssFeed(s.url), 45_000);
            return done({ status: 200, count: items.length, contentBytes: 0, note: items.length === 0 ? "feed parsed but 0 items" : "" });
        }

        if (mode === "sitemap") {
            const abs = resolveSitemapUrl(s.sitemapUrl!, s.url);
            // fetchSitemap swallows HTTP errors — probe status separately
            let status: number | string = 200;
            try {
                const probe = await axios.get(abs, { timeout: 20_000, responseType: "text", headers: { "User-Agent": "Mozilla/5.0" } });
                status = probe.status;
            } catch (err) { status = errStatus(err); }
            const entries = await withTimeout(fetchSitemap(abs), 60_000);
            const aged = s.sitemapMaxAgeDays ? filterByLastmodAge(entries, s.sitemapMaxAgeDays) : entries;
            const pat = s.linkPattern ? (typeof s.linkPattern === "string" ? new RegExp(s.linkPattern) : s.linkPattern) : null;
            const filtered = pat ? aged.filter((e) => pat.test(e.loc)) : aged;
            const note = entries.length === 0 ? "sitemap fetch/parse yielded 0 entries (run.ts falls back to list-page)"
                : filtered.length === 0 ? `${entries.length} sitemap URLs but 0 match linkPattern/age window` : "";
            return done({ status, count: filtered.length, contentBytes: 0, note });
        }

        // List-page modes
        let text: string, links: string[];
        let usedStaticFallback = false;
        if (mode === "list-browser" && browserOk) {
            const r = await withTimeout(fetchWithBrowser(s.url), 60_000);
            text = r.text; links = r.links;
        } else {
            if (mode === "list-browser") usedStaticFallback = true;
            const r = await withTimeout(fetchPageContent(s.url), 45_000);
            text = r.text; links = r.links;
        }

        if (mode === "single-page" || !s.followLinks) {
            const note = text.length < 500 ? "page returned near-empty content" : "single page — count is content-length proxy";
            return done({ status: 200, count: text.length >= 500 ? 1 : 0, contentBytes: text.length, note });
        }

        const candidates = filterLinks(links, {
            baseUrl: s.url,
            linkPattern: s.linkPattern,
            maxLinks: s.maxLinks ?? 10,
            allowExternalDomains: s.allowExternalDomains,
        });
        const noteBits: string[] = [];
        if (usedStaticFallback) noteBits.push("needsBrowser but diagnosed via static fetch");
        if (links.length === 0) noteBits.push("0 raw links extracted from page");
        else if (candidates.length === 0) noteBits.push(`${links.length} raw links but 0 pass filterLinks/linkPattern`);
        return done({ status: 200, count: candidates.length, contentBytes: text.length, note: noteBits.join("; ") });
    } catch (err: any) {
        return done({ status: errStatus(err), count: 0, contentBytes: 0, note: (err?.message ?? String(err)).slice(0, 140) });
    }
}

/** Run diagnostics: static sources in a small pool, browser sources sequentially. */
export async function runDiagnostics(targets: Source[], onResult?: (r: DiagResult) => void): Promise<DiagResult[]> {
    let browserOk = true;
    try {
        const { chromium } = await import("playwright");
        const b = await chromium.launch({ headless: true });
        await b.close();
    } catch {
        browserOk = false;
        console.warn("⚠ Playwright browser unavailable — needsBrowser sources diagnosed via static fetch\n");
    }

    const results: DiagResult[] = new Array(targets.length);
    const staticIdx: number[] = [], browserIdx: number[] = [];
    targets.forEach((s, i) => (modeFor(s) === "list-browser" && browserOk ? browserIdx : staticIdx).push(i));

    const POOL = 6;
    let cursor = 0;
    async function worker() {
        while (cursor < staticIdx.length) {
            const i = staticIdx[cursor++];
            results[i] = await diagnoseSource(targets[i], false);
            onResult?.(results[i]);
        }
    }
    await Promise.all(Array.from({ length: POOL }, worker));

    for (const i of browserIdx) {
        results[i] = await diagnoseSource(targets[i], true);
        onResult?.(results[i]);
    }

    const { closeBrowser } = await import("./fetch.js");
    await closeBrowser();
    return results;
}

export function formatDiagResult(r: DiagResult): string {
    return `${String(r.status).padStart(7)}  ${String(r.count).padStart(4)}  ${r.mode.padEnd(12)} ${r.name.padEnd(40)} ${r.note}`;
}
