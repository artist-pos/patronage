import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateGuard } from "../tools/yield-guard.js";

const baseline = {
    "Big Aggregator": 68,     // must stay above zero
    "Medium Source": 12,      // must stay above zero
    "Tiny Source": 2,         // under the min-baseline threshold — never guarded
};

test("passes when all baselined sources still discover items", () => {
    const results = [
        { name: "Big Aggregator", count: 40, status: 200, note: "" },
        { name: "Medium Source", count: 3, status: 200, note: "" },
        { name: "Tiny Source", count: 0, status: 200, note: "" },
    ];
    assert.deepEqual(evaluateGuard(baseline, results), []);
});

test("flags a silent selector break (200 with zero items)", () => {
    const results = [
        { name: "Big Aggregator", count: 0, status: 200, note: "0 raw links extracted from page" },
        { name: "Medium Source", count: 5, status: 200, note: "" },
    ];
    const regressions = evaluateGuard(baseline, results);
    assert.equal(regressions.length, 1);
    assert.equal(regressions[0].name, "Big Aggregator");
    assert.equal(regressions[0].status, 200);
});

test("flags hard failures (403 / timeout) on baselined sources", () => {
    const results = [
        { name: "Big Aggregator", count: 12, status: 200, note: "" },
        { name: "Medium Source", count: 0, status: 403, note: "Request failed with status code 403" },
    ];
    const regressions = evaluateGuard(baseline, results);
    assert.equal(regressions.length, 1);
    assert.equal(regressions[0].name, "Medium Source");
});

test("ignores low-baseline sources and sources removed from the registry", () => {
    const results = [
        { name: "Big Aggregator", count: 9, status: 200, note: "" },
        // "Medium Source" absent — removed from registry
        { name: "Tiny Source", count: 0, status: 404, note: "" },
    ];
    assert.deepEqual(evaluateGuard(baseline, results), []);
});
