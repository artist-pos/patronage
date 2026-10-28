import { test } from "node:test";
import assert from "node:assert/strict";
import { parseJsonArray } from "../lib/extract.js";

test("parses a clean array", () => {
    assert.deepEqual(parseJsonArray('[{"title":"A"},{"title":"B"}]'), [{ title: "A" }, { title: "B" }]);
});

test("empty array and no array are both 'no results'", () => {
    assert.deepEqual(parseJsonArray("[]"), []);
    assert.equal(parseJsonArray("No relevant opportunities on this page."), null);
});

test("ignores trailing prose that contains brackets (the greedy-match failure)", () => {
    const reply = '[{"title":"A"}]\n\nNote: I skipped the second listing [closed] as it was expired.';
    assert.deepEqual(parseJsonArray(reply), [{ title: "A" }]);
});

test("ignores a bracketed preamble before the real array", () => {
    const reply = 'Result [see below]:\n[{"title":"A"}]';
    assert.deepEqual(parseJsonArray(reply), [{ title: "A" }]);
});

test("brackets and escaped quotes inside strings don't confuse the scan", () => {
    const reply = '[{"title":"Open call [2026]","caption":"Say \\"hi\\" ] to us"}] trailing ]';
    assert.deepEqual(parseJsonArray(reply), [{ title: "Open call [2026]", caption: 'Say "hi" ] to us' }]);
});

test("nested arrays stay inside their parent", () => {
    assert.deepEqual(parseJsonArray('[{"sub_categories":["Painting","Early Career"]}] done'), [
        { sub_categories: ["Painting", "Early Career"] },
    ]);
});

test("balanced but invalid JSON is a failure, not silently empty", () => {
    assert.throws(() => parseJsonArray('[{"title": "A",}]'));
});

test("a reply cut off mid-array (max_tokens) is a failure", () => {
    assert.throws(() => parseJsonArray('[{"title":"A"},{"title":"B'), /unterminated/);
});
