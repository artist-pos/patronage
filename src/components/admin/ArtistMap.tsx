"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { REGION_CENTROIDS } from "@/lib/nz-geo";
import type { MapPerson, MapPin } from "@/lib/artist-map";

interface Props {
  pins: MapPin[];
  focusRegion: string | null;
}

const NZ_BOUNDS: [[number, number], [number, number]] = [
  [-47.6, 166.2],
  [-34.2, 178.8],
];

function personLink(p: MapPerson): HTMLElement {
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.href = `/${p.username}`;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = p.name;
  a.style.textDecoration = "underline";
  a.style.textUnderlineOffset = "2px";
  li.appendChild(a);
  if (p.shadow) {
    const tag = document.createElement("span");
    tag.textContent = " · shadow";
    tag.style.color = "#a8a29e";
    li.appendChild(tag);
  }
  return li;
}

function section(title: string, people: MapPerson[]): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.marginTop = "6px";
  const h = document.createElement("div");
  h.textContent = `${title} (${people.length})`;
  h.style.cssText =
    "font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#a8a29e;margin-bottom:2px";
  const ul = document.createElement("ul");
  ul.style.cssText = "margin:0;padding:0;list-style:none;max-height:180px;overflow:auto;font-size:12px;line-height:1.6";
  people.forEach((p) => ul.appendChild(personLink(p)));
  wrap.append(h, ul);
  return wrap;
}

function popupFor(pin: MapPin): HTMLElement {
  const root = document.createElement("div");
  root.style.minWidth = "160px";
  const title = document.createElement("div");
  title.textContent = pin.approx ? `${pin.place} (region only)` : pin.place;
  title.style.cssText = "font-weight:600;font-size:13px";
  root.appendChild(title);
  if (pin.artists.length) root.appendChild(section("Artists", pin.artists));
  if (pin.orgs.length) root.appendChild(section("Organisations", pin.orgs));
  return root;
}

export default function ArtistMap({ pins, focusRegion }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;
    let observer: ResizeObserver | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      map = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
        minZoom: 4,
      });
      mapRef.current = map;
      map.setView([-41, 173.5], 5);

      // The container can be measured before layout settles, so fit to NZ once
      // the observer reports its real size, then just keep it re-measured.
      let fitted = false;
      observer = new ResizeObserver(() => {
        map?.invalidateSize();
        if (!fitted) {
          fitted = true;
          map?.fitBounds(NZ_BOUNDS, { animate: false });
        }
      });
      observer.observe(containerRef.current);

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
        className: "artist-map-tiles",
      }).addTo(map);

      for (const pin of pins) {
        const n = pin.artists.length;
        const hasOrg = pin.orgs.length > 0;
        const size = n === 0 ? 22 : Math.min(22 + Math.sqrt(n) * 7, 52);
        const bg = n === 0 ? "#d97706" : "#000";
        const ring = hasOrg && n > 0 ? "box-shadow:0 0 0 3px #d97706;" : "";
        const style = `width:${size}px;height:${size}px;border-radius:9999px;background:${bg};${ring}color:#fff;display:flex;align-items:center;justify-content:center;font:600 11px system-ui,sans-serif;border:2px solid #fff;${pin.approx ? "opacity:.65;" : ""}`;
        const icon = L.divIcon({
          className: "",
          html: `<div style="${style}">${n === 0 ? "org" : n}</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        L.marker([pin.lat, pin.lng], { icon })
          .bindPopup(popupFor(pin), { closeButton: false })
          .addTo(map);
      }
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      map?.remove();
      mapRef.current = null;
    };
  }, [pins]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (focusRegion && REGION_CENTROIDS[focusRegion]) {
      map.flyTo(REGION_CENTROIDS[focusRegion], 8, { duration: 0.6 });
    } else if (focusRegion === null) {
      map.flyToBounds(NZ_BOUNDS, { duration: 0.6 });
    }
  }, [focusRegion]);

  return (
    <>
      <style>{`.artist-map-tiles{filter:grayscale(1) contrast(.9) brightness(1.06)}`}</style>
      <div ref={containerRef} className="h-[70vh] min-h-[420px] w-full border border-border" />
    </>
  );
}
