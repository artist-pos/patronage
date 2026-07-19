import { test } from "node:test";
import assert from "node:assert/strict";
import { applyExtractionFilters } from "../lib/extract.js";
import type { ScrapedOpportunity } from "../types.js";

function opp(overrides: Partial<ScrapedOpportunity & { confidence: string; geo_eligibility: string }>): any {
    return {
        title: "Test Opportunity",
        organiser: "Test Org",
        caption: null,
        type: "Open Call",
        country: "Global",
        opens_at: null,
        deadline: null,
        url: null,
        funding_range: null,
        full_description: null,
        featured_image_url: null,
        disciplines: [],
        confidence: "high",
        geo_eligibility: "worldwide_explicit",
        ...overrides,
    };
}

test("drops local_only regardless of mode", () => {
    const out = applyExtractionFilters([opp({ geo_eligibility: "local_only" })]);
    assert.equal(out.length, 0);
});

test("default mode keeps worldwide_likely and legacy items without the field", () => {
    const out = applyExtractionFilters([
        opp({ geo_eligibility: "worldwide_likely" }),
        opp({ geo_eligibility: undefined }),
    ]);
    assert.equal(out.length, 2);
});

test("strictGeo drops worldwide_likely and unlabelled, keeps explicit + NZ/AUS", () => {
    const out = applyExtractionFilters(
        [
            opp({ title: "A", geo_eligibility: "worldwide_likely" }),
            opp({ title: "B", geo_eligibility: undefined }),
            opp({ title: "C", geo_eligibility: "worldwide_explicit" }),
            opp({ title: "D", geo_eligibility: "nz", country: "NZ" }),
            opp({ title: "E", geo_eligibility: "aus", country: "AUS" }),
        ],
        { strictGeo: true }
    );
    assert.deepEqual(out.map((o) => o.title), ["C", "D", "E"]);
});

test("still enforces title/organiser and confidence gates", () => {
    const out = applyExtractionFilters([
        opp({ title: "" }),
        opp({ confidence: "low" }),
        opp({ title: "Keep" }),
    ]);
    assert.deepEqual(out.map((o) => o.title), ["Keep"]);
});

test("maps non-NZ/AUS countries to Global", () => {
    const out = applyExtractionFilters([opp({ country: "UK" })]);
    assert.equal(out[0].country, "Global");
});
