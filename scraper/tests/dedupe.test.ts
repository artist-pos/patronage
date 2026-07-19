import { test } from "node:test";
import assert from "node:assert/strict";
import {
    normTitle,
    normOrganiser,
    makeMatchKey,
    tokenSortRatio,
    deadlinesCompatible,
    isLikelyDuplicate,
    authorityRank,
} from "../lib/dedupe.js";

test("normTitle strips years, punctuation, and case", () => {
    assert.equal(normTitle("Open Call: Summer Salon 2026!"), "open call summer salon");
    assert.equal(normTitle("  Te  Tuhi — Residency  "), "te tuhi residency");
});

test("makeMatchKey is stable across cosmetic variations", () => {
    const a = makeMatchKey("Summer Salon 2026", "2026-08-01", "Aotearoa Art House");
    const b = makeMatchKey("Summer Salon", "2026-08-01", "Aotearoa Art House Ltd.".replace(" Ltd.", ""));
    assert.equal(a, b);
});

test("tokenSortRatio is order-insensitive and scores near-identical titles high", () => {
    assert.equal(tokenSortRatio("open call summer salon", "summer salon open call"), 100);
    assert.ok(tokenSortRatio("summer salon open call", "summer salon call for entries") >= 60);
    assert.ok(tokenSortRatio("painting prize", "film residency berlin") < 50);
});

test("deadlinesCompatible respects the window and tolerates nulls", () => {
    assert.ok(deadlinesCompatible("2026-08-01", "2026-08-03"));
    assert.ok(!deadlinesCompatible("2026-08-01", "2026-09-01"));
    assert.ok(deadlinesCompatible("2026-08-01", null));
    assert.ok(deadlinesCompatible(null, null));
});

test("isLikelyDuplicate catches cross-posted variants of the same call", () => {
    const original = {
        titleNorm: normTitle("Summer Salon 2026 — Call for Entries"),
        organiserNorm: normOrganiser("Riverside Gallery"),
        deadline: "2026-08-01",
    };
    const crossPost = {
        titleNorm: normTitle("Call for Entries: Summer Salon"),
        organiserNorm: normOrganiser("Riverside Gallery"),
        deadline: "2026-08-01",
    };
    assert.ok(isLikelyDuplicate(original, crossPost));
});

test("isLikelyDuplicate rejects different opportunities from the same organiser", () => {
    const a = {
        titleNorm: normTitle("Winter Residency Programme"),
        organiserNorm: normOrganiser("Riverside Gallery"),
        deadline: "2026-08-01",
    };
    const b = {
        titleNorm: normTitle("Summer Salon Call for Entries"),
        organiserNorm: normOrganiser("Riverside Gallery"),
        deadline: "2026-08-01",
    };
    assert.ok(!isLikelyDuplicate(a, b));
});

test("isLikelyDuplicate rejects same title outside the deadline window", () => {
    const a = { titleNorm: "annual open call", organiserNorm: "gallery x", deadline: "2026-03-01" };
    const b = { titleNorm: "annual open call", organiserNorm: "gallery x", deadline: "2026-09-01" };
    assert.ok(!isLikelyDuplicate(a, b));
});

test("authorityRank: org pages beat aggregators, explicit authority wins", () => {
    assert.equal(authorityRank({}), 1);
    assert.equal(authorityRank({ isAggregator: true }), 2);
    assert.equal(authorityRank({ isAggregator: true, authority: 3 }), 3);
});
