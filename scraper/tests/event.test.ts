import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanEvent } from "../lib/event.js";
import { applyExtractionFilters } from "../lib/extract.js";

const NOW = new Date("2026-11-24T00:00:00Z");

test("keeps a believable future event and tidies it", () => {
    const e = cleanEvent(
        { event_date: "2026-12-05", event_time: "5:30", event_venue: "  Whitespace Gallery, Ponsonby ", event_label: "Opening night", deadline: "2026-11-30" },
        NOW,
    );
    assert.deepEqual(e, { event_date: "2026-12-05", event_time: "05:30", event_venue: "Whitespace Gallery, Ponsonby", event_label: "Opening night" });
});

test("drops past dates, impossible dates and dates over two years out", () => {
    for (const d of ["2026-11-01", "2026-02-30", "2029-01-01", "soon", ""]) {
        assert.equal(cleanEvent({ event_date: d }, NOW).event_date, null, d);
    }
});

test("drops an event on the deadline or open date (model mixed them up)", () => {
    assert.equal(cleanEvent({ event_date: "2026-12-05", deadline: "2026-12-05" }, NOW).event_date, null);
    assert.equal(cleanEvent({ event_date: "2026-12-05", opens_at: "2026-12-05" }, NOW).event_date, null);
});

test("a bad time is dropped but the event stays; no date means all nulls", () => {
    assert.equal(cleanEvent({ event_date: "2026-12-05", event_time: "25:99" }, NOW).event_time, null);
    assert.equal(cleanEvent({ event_date: "2026-12-05", event_time: "25:99" }, NOW).event_date, "2026-12-05");
    assert.deepEqual(cleanEvent({ event_venue: "Somewhere", event_label: "Opening" }, NOW), {
        event_date: null, event_time: null, event_venue: null, event_label: null,
    });
});

test("applyExtractionFilters runs the event through the same checks", () => {
    const base: any = {
        title: "T", organiser: "O", caption: null, type: "Open Call", country: "NZ", opens_at: null,
        deadline: null, url: null, funding_range: null, full_description: null, featured_image_url: null,
        disciplines: [], confidence: "high", geo_eligibility: "nz",
    };
    const out = applyExtractionFilters([{ ...base, event_date: "2020-01-01", event_venue: "x" }]);
    assert.equal(out[0].event_date, null);
    assert.equal(out[0].event_venue, null);
});
