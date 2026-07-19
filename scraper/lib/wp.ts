import axios from "axios";
import * as cheerio from "cheerio";
import { REALISTIC_HEADERS } from "./auth.js";

const http = axios.create({ timeout: 20000, headers: REALISTIC_HEADERS });

export interface WpPost {
    id: number;
    link: string;
    modified: string;       // ISO datetime — use as lastmod
    title: string;          // rendered HTML title
    content: string;        // rendered HTML content
    featuredImageUrl: string | null;
}

/**
 * Fetch posts from the WordPress REST API.
 * Returns posts modified after `since` (ISO string), or all recent posts if omitted.
 * Automatically paginates until no more results or `limit` posts are collected.
 */
export async function fetchWpPosts(
    baseUrl: string,
    opts: { since?: string; limit?: number; feedPath?: string } = {}
): Promise<WpPost[]> {
    const { since, limit = 200, feedPath = "/wp-json/wp/v2/posts" } = opts;
    const origin = new URL(baseUrl).origin;
    const endpoint = `${origin}${feedPath}`;

    const posts: WpPost[] = [];
    let page = 1;

    while (posts.length < limit) {
        const params: Record<string, string | number> = {
            per_page: 100,
            page,
            orderby: "modified",
            order: "desc",
            _embed: 1,
        };
        if (since) params["after"] = since;

        let items: any[] | null = null;
        try {
            const res = await http.get(endpoint, { params, responseType: "json" });
            items = Array.isArray(res.data) ? (res.data as any[]) : null;
        } catch (err: any) {
            const status = err?.response?.status;
            // Past page 1, a 400/404 just means "no more pages"
            if (page > 1 && (status === 400 || status === 404)) break;
            // TLS-fingerprint 403 (e.g. Cloudflare blocking axios but not real browsers):
            // retry the request through a Playwright page before giving up
            if (status === 403) {
                items = await fetchWpJsonViaBrowser(endpoint, params);
                if (items === null) throw err;
            } else {
                throw err;
            }
        }

        // A redirect to an HTML page (site migrated off WordPress) arrives here as
        // non-array data. Silently returning [] hid the NAVA/a-n breakage for months.
        if (items === null) {
            if (page > 1) break;
            throw new Error(`WP REST endpoint ${endpoint} did not return a post array — endpoint moved or site is no longer WordPress`);
        }
        if (items.length === 0) break;

        for (const item of items) {
            const featuredImageUrl =
                item._embedded?.["wp:featuredmedia"]?.[0]?.source_url ?? null;

            // Strip HTML tags from title and content
            const title = cheerio.load(item.title?.rendered ?? "").text().trim();
            const content = cheerio.load(item.content?.rendered ?? "").text().replace(/\s+/g, " ").trim();

            posts.push({
                id: item.id,
                link: item.link,
                modified: item.modified,
                title,
                content: content.slice(0, 8000),
                featuredImageUrl,
            });
        }

        // Stop if we got fewer than requested (last page)
        if (items.length < 100) break;
        page++;
    }

    return posts.slice(0, limit);
}

/**
 * Fetch a WP REST JSON URL through a real browser page. Cloudflare's TLS
 * fingerprinting blocks axios on some sites (artguide.com.au) while letting
 * real Chromium through. Returns null if the body isn't a JSON array.
 */
async function fetchWpJsonViaBrowser(
    endpoint: string,
    params: Record<string, string | number>
): Promise<any[] | null> {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
    const url = `${endpoint}?${qs}`;
    try {
        const { fetchJsonWithBrowser } = await import("./fetch.js");
        const data = await fetchJsonWithBrowser(url);
        return Array.isArray(data) ? data : null;
    } catch {
        return null;
    }
}
