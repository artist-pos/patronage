import axios from "axios";

const http = axios.create({ timeout: 10000 });

interface RobotsCache {
    fetchedAt: number;
    disallowedPaths: string[];
}

// In-memory per-host cache; TTL 24h
const cache = new Map<string, RobotsCache>();
const TTL_MS = 24 * 60 * 60 * 1000;

async function fetchRobotsForHost(host: string): Promise<string[]> {
    const url = `https://${host}/robots.txt`;
    let text: string;
    try {
        const res = await http.get(url, { responseType: "text" });
        text = res.data as string;
    } catch {
        return []; // no robots.txt or unreachable — allow all
    }

    const disallowed: string[] = [];
    let inOurSection = false;

    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim().toLowerCase();
        if (line.startsWith("user-agent:")) {
            const agent = line.replace("user-agent:", "").trim();
            inOurSection = agent === "*" || agent.includes("patronage");
        } else if (inOurSection && line.startsWith("disallow:")) {
            const path = line.replace("disallow:", "").trim();
            if (path) disallowed.push(path);
        }
    }

    return disallowed;
}

/**
 * Returns true if the URL is allowed to be fetched (not disallowed by robots.txt).
 */
export async function isAllowedByRobots(url: string): Promise<boolean> {
    let host: string;
    let pathname: string;
    try {
        const u = new URL(url);
        host = u.hostname;
        pathname = u.pathname;
    } catch {
        return true;
    }

    const now = Date.now();
    let entry = cache.get(host);
    if (!entry || now - entry.fetchedAt > TTL_MS) {
        const disallowedPaths = await fetchRobotsForHost(host);
        entry = { fetchedAt: now, disallowedPaths };
        cache.set(host, entry);
    }

    return !entry.disallowedPaths.some((p) => pathname.startsWith(p));
}
