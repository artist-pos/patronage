"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { TierDef } from "@/lib/partner-configs";

const MGMT_RATE = 0.2;
const STATION_MIN = 10_000;
const STATION_MAX = 25_000;
const STATION_STEP = 1_000;

function perBox(tier: TierDef) {
  return tier.artistFee + tier.materials + Math.round(tier.artistFee * MGMT_RATE);
}

function fmt(n: number) {
  return "$" + n.toLocaleString("en-NZ");
}

interface Props {
  tiers: TierDef[];
  defaultQtys: number[];
}

export function TrancheCalculator({ tiers, defaultQtys }: Props) {
  const [qtys, setQtys] = useState<number[]>(defaultQtys);
  const [stationQty, setStationQty] = useState(0);
  const [stationPrice, setStationPrice] = useState(15_000);

  function setQty(i: number, val: number) {
    setQtys((prev) => {
      const next = [...prev];
      next[i] = Math.max(0, val);
      return next;
    });
  }

  const boxRows = tiers
    .map((t, i) => ({ tier: t, qty: qtys[i], subtotal: qtys[i] * perBox(t) }))
    .filter((r) => r.qty > 0);

  const totalArtistFees = tiers.reduce(
    (s, t, i) => s + qtys[i] * t.artistFee,
    0
  );
  const totalBoxCost = boxRows.reduce((s, r) => s + r.subtotal, 0);
  const stationSubtotal = stationQty * stationPrice;
  const programmeTotal = totalBoxCost + stationSubtotal;
  const pctToArtists =
    totalBoxCost > 0
      ? Math.round((totalArtistFees / totalBoxCost) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Tier grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiers.map((tier, i) => (
          <div
            key={tier.name}
            className="bg-stone-50 border border-border rounded-xl p-4 text-center"
          >
            <p className="font-mono text-xs uppercase tracking-wider text-stone-500 mb-0.5">
              {tier.name}
            </p>
            <p className="text-xs text-muted-foreground mb-3">{tier.area}</p>

            {/* Per-box total — primary */}
            <p className="text-2xl font-semibold tabular-nums mb-4">{fmt(perBox(tier))}</p>

            {/* Qty controls */}
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setQty(i, qtys[i] - 1)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-border hover:bg-stone-100 transition-colors text-sm font-medium"
                aria-label={`Decrease ${tier.name}`}
              >
                −
              </button>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={qtys[i]}
                onChange={(e) => setQty(i, parseInt(e.target.value) || 0)}
                className="w-14 text-center bg-white border border-border rounded-lg py-1.5 text-lg font-semibold focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={() => setQty(i, qtys[i] + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-border hover:bg-stone-100 transition-colors text-sm font-medium"
                aria-label={`Increase ${tier.name}`}
              >
                +
              </button>
            </div>

            {/* Breakdown — below controls */}
            <p className="text-[11px] text-stone-400 mt-2.5 leading-relaxed">
              {fmt(tier.artistFee)} fee · ~{fmt(tier.materials)} materials · {fmt(Math.round(tier.artistFee * MGMT_RATE))} mgmt
            </p>
          </div>
        ))}
      </div>

      {/* Station EOI row */}
      <div className="bg-stone-50 border border-border rounded-xl px-5 py-4 flex flex-wrap items-center gap-6">
        {/* Qty controls */}
        <div className="flex flex-col items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-stone-500">
            Station EOIs
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStationQty((q) => Math.max(0, q - 1))}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-border hover:bg-stone-100 transition-colors"
              aria-label="Decrease stations"
            >
              <Minus size={12} />
            </button>
            <span className="font-semibold text-lg w-6 text-center tabular-nums">
              {stationQty}
            </span>
            <button
              onClick={() => setStationQty((q) => Math.min(10, q + 1))}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-border hover:bg-stone-100 transition-colors"
              aria-label="Increase stations"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>

        {/* Price slider */}
        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
          <span className="font-mono text-xs text-stone-400 whitespace-nowrap">
            Est. cost each
          </span>
          <input
            type="range"
            min={STATION_MIN}
            max={STATION_MAX}
            step={STATION_STEP}
            value={stationPrice}
            onChange={(e) => setStationPrice(parseInt(e.target.value))}
            className="flex-1 accent-black"
          />
          <span className="font-mono text-sm text-stone-600 min-w-[60px] text-right tabular-nums">
            {fmt(stationPrice)}
          </span>
        </div>

        {/* Subtotal */}
        <div className="flex flex-col items-center gap-1">
          <span className="font-mono text-xs uppercase tracking-wider text-stone-500">
            Subtotal
          </span>
          <span className="font-semibold text-base tabular-nums">
            {fmt(stationSubtotal)}
          </span>
        </div>
      </div>

      {/* Live breakdown */}
      {(boxRows.length > 0 || stationQty > 0) && (
        <div className="border border-border rounded-xl overflow-hidden">
          {boxRows.map((r) => (
            <div
              key={r.tier.name}
              className="flex justify-between items-center px-5 py-3 border-b border-border text-sm"
            >
              <span className="text-muted-foreground">
                {r.qty}× {r.tier.name}
              </span>
              <span className="font-semibold tabular-nums">{fmt(r.subtotal)}</span>
            </div>
          ))}
          {stationQty > 0 && (
            <div className="flex justify-between items-center px-5 py-3 border-b border-border text-sm">
              <span className="text-muted-foreground">
                {stationQty}× Station EOI
              </span>
              <span className="font-semibold tabular-nums">{fmt(stationSubtotal)}</span>
            </div>
          )}
          <div className="flex justify-between items-center px-5 py-4 bg-stone-50">
            <span className="font-medium text-sm">Total</span>
            <span className="font-bold text-xl tabular-nums">{fmt(programmeTotal)}</span>
          </div>
        </div>
      )}

      {/* Stats — always visible so the figures read as live */}
      <div className="flex flex-wrap gap-8 pt-2">
          <div>
            <p className="text-3xl font-semibold tabular-nums">
              {totalBoxCost > 0 ? `${pctToArtists}%` : "–"}
            </p>
            <p className="font-mono text-xs uppercase tracking-wider text-stone-400 mt-1">
              To artists
            </p>
          </div>
          <div>
            <p className="text-3xl font-semibold tabular-nums">{fmt(totalArtistFees)}</p>
            <p className="font-mono text-xs uppercase tracking-wider text-stone-400 mt-1">
              Total artist fees
            </p>
          </div>
          <div>
            <p className="text-3xl font-semibold tabular-nums">{fmt(programmeTotal)}</p>
            <p className="font-mono text-xs uppercase tracking-wider text-stone-400 mt-1">
              Programme total
            </p>
          </div>
        </div>

      {/* Footnote */}
      <p className="font-mono text-[10px] text-stone-400">
        NZD, ex GST. Paint path materials shown. Wrap materials differ. Stations priced per concept via EOI.
      </p>
    </div>
  );
}
