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

        let res;
        try {
            res = await http.get(endpoint, { params, responseType: "json" });
        } catch (err: any) {
            if (err?.response?.status === 400 || err?.response?.status === 404) break; // no more pages
            throw err;
        }

        const items = res.data as any[];
        if (!items || items.length === 0) break;

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
