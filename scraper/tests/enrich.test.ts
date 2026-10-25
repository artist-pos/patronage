import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeOpportunity } from "../lib/enrich.js";
import type { ScrapedOpportunity } from "../types.js";

const base: ScrapedOpportunity = {
    title: "Rita Angus Cottage Residency",
    organiser: "Enjoy Contemporary Art Space",
    caption: "Residency in Wellington.",
    type: "Residency",
    country: "NZ",
    opens_at: null,
    deadline: "2026-12-01",
    url: "https://organiser.example/apply",
    funding_range: null,
    full_description: "Short summary from the aggregator.",
    featured_image_url: null,
    disciplines: ["visual_art"],
};

const rich: ScrapedOpportunity = {
    ...base,
    caption: "A longer caption from the organiser.",
    deadline: "2026-11-28",
    funding_range: "$10,000 NZD",
    full_description: "Eligibility:\nNZ artists.\n\nHow to Apply:\nEmail us with your portfolio and a one-page proposal.",
    contact_email: "residency@enjoy.org.nz",
    featured_image_url: "https://organiser.example/og.jpg",
    disciplines: ["visual_art", "photography"],
};

test("organiser page wins on dates, money and contact; fills blanks", () => {
    const merged = mergeOpportunity(base, rich);
    assert.equal(merged.deadline, "2026-11-28");
    assert.equal(merged.funding_range, "$10,000 NZD");
    assert.equal(merged.contact_email, "residency@enjoy.org.nz");
    assert.equal(merged.featured_image_url, "https://organiser.example/og.jpg");
});

test("keeps the aggregator caption, takes the longer description, unions disciplines", () => {
    const merged = mergeOpportunity(base, rich);
    assert.equal(merged.caption, "Residency in Wellington.");
    assert.match(merged.full_description ?? "", /How to Apply/);
    assert.deepEqual(merged.disciplines.sort(), ["photography", "visual_art"]);
});

test("a blank organiser field does not erase what the aggregator had", () => {
    const merged = mergeOpportunity({ ...base, funding_range: "$5,000" }, { ...rich, funding_range: null, deadline: null });
    assert.equal(merged.funding_range, "$5,000");
    assert.equal(merged.deadline, "2026-12-01");
});
