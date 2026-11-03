import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPartnerIndex, foldOrganiser, matchOrganiser, organiserKeys } from "../lib/organiser-link.js";

const index = buildPartnerIndex([
    { id: "cnz", full_name: "Creative New Zealand" },
    { id: "orakei", full_name: "Ōrākei Arts" },
    { id: "nzfc", full_name: "New Zealand Film Commission" },
    { id: "dup-a", full_name: "Arts Trust" },
    { id: "dup-b", full_name: "Arts Trust" },
    { id: "unnamed", full_name: null },
]);

test("foldOrganiser folds macrons, case and punctuation", () => {
    assert.equal(foldOrganiser("Ōrākei Arts"), "orakei arts");
    assert.equal(foldOrganiser("Playmarket & the Adam Foundation"), "playmarket and the adam foundation");
});

test("exact names match, whatever the macrons and case", () => {
    assert.equal(matchOrganiser("Creative New Zealand", index), "cnz");
    assert.equal(matchOrganiser("creative new zealand", index), "cnz");
    assert.equal(matchOrganiser("Orakei Arts", index), "orakei");
});

test("a trailing bracketed alias is ignored", () => {
    assert.equal(matchOrganiser("New Zealand Film Commission (NZFC)", index), "nzfc");
    assert.equal(matchOrganiser("New Zealand Film Commission (Te Tumu Whakaata Taonga)", index), "nzfc");
});

test("near misses and joint listings don't match", () => {
    assert.equal(matchOrganiser("Creative Matters", index), null);
    assert.equal(matchOrganiser("Waitomo District Council / Creative New Zealand", index), null);
    assert.equal(matchOrganiser("Artsin Square x Below Grand Gallery", index), null);
    assert.deepEqual(organiserKeys("A / B"), []);
});

test("a name two partners share never links", () => {
    assert.equal(matchOrganiser("Arts Trust", index), null);
});

test("no index, no match", () => {
    assert.equal(matchOrganiser("Creative New Zealand", undefined), null);
});
