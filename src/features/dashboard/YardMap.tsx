import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Tag, EntryFilter } from "@/lib/types";

// Interactive Mapbox Yard Map (confirmed with the user — supersedes the earlier "no map library"
// guardrail). Reads a PUBLIC token from VITE_MAPBOX_TOKEN (safe client-side; the secret
// ANTHROPIC_API_KEY stays server-side). Three lettered markers (A/B/C) map to YD-A/B/C; hover
// shows that yard's tag count + total FBM, click deep-links into Stock Locator (EntryFilter.yard).
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const MARKER_BG = "#F0542B"; // brand coral circle, white letter

// Mock yard coordinates — clustered around a Fraser River mill site near Langley, BC, so the
// default zoomed-in detail view shows all three (confirmed with the user; adjust freely).
const YARDS: { code: string; letter: string; name: string; lng: number; lat: number }[] = [
  { code: "YD-A", letter: "A", name: "Yard A", lng: -122.6620, lat: 49.1908 },
  { code: "YD-B", letter: "B", name: "Yard B", lng: -122.6548, lat: 49.1885 },
  { code: "YD-C", letter: "C", name: "Yard C", lng: -122.6482, lat: 49.1924 },
];
const CENTER: [number, number] = [-122.6550, 49.1906];
const DEFAULT_ZOOM = 13.4;

// Custom Mapbox control: a "reset view" button that stacks below the zoom (+/−) control and
// flies the map back to its initial center / zoom (and clears any rotate / tilt).
class ResetViewControl implements mapboxgl.IControl {
  private _container?: HTMLDivElement;
  onAdd(map: mapboxgl.Map): HTMLElement {
    const div = document.createElement("div");
    div.className = "mapboxgl-ctrl mapboxgl-ctrl-group";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Reset map view";
    btn.setAttribute("aria-label", "Reset map view");
    Object.assign(btn.style, { display: "flex", alignItems: "center", justifyContent: "center" } as CSSStyleDeclaration);
    btn.innerHTML =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#333333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>';
    btn.addEventListener("click", () =>
      map.flyTo({ center: CENTER, zoom: DEFAULT_ZOOM, bearing: 0, pitch: 0, duration: 600 }),
    );
    div.appendChild(btn);
    this._container = div;
    return div;
  }
  onRemove(): void {
    this._container?.parentNode?.removeChild(this._container);
  }
}

interface YardMapProps {
  tags: Tag[];
  onNavigateToLocator?: (filter: EntryFilter) => void;
}

export function YardMap({ tags, onNavigateToLocator }: YardMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  // Per-yard count + total FBM, read live at hover time via a ref so the map inits only once.
  const stats = useMemo(() => {
    const m: Record<string, { count: number; fbm: number }> = {};
    for (const t of tags) {
      const s = (m[t.yard] ??= { count: 0, fbm: 0 });
      s.count += 1;
      s.fbm += t.fbm;
    }
    return m;
  }, [tags]);
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const navRef = useRef(onNavigateToLocator);
  navRef.current = onNavigateToLocator;

  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new ResetViewControl(), "top-right"); // stacks directly below the +/− control
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    map.on("load", () => map.resize());

    const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 18, className: "yard-popup" });

    const markers = YARDS.map((y) => {
      const el = document.createElement("div");
      el.textContent = y.letter;
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", `${y.name} — view stock in Stock Locator`);
      Object.assign(el.style, {
        width: "34px", height: "34px", borderRadius: "9999px",
        background: MARKER_BG, color: "#FFFFFF",
        display: "flex", alignItems: "center", justifyContent: "center",
        font: "600 15px/1 Inter, sans-serif", letterSpacing: "0.5px",
        border: "2px solid #FFFFFF", boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
        cursor: "pointer",
      } as CSSStyleDeclaration);

      el.addEventListener("mouseenter", () => {
        const s = statsRef.current[y.code] ?? { count: 0, fbm: 0 };
        popup
          .setLngLat([y.lng, y.lat])
          .setHTML(
            `<div style="font-family:Inter,sans-serif;padding:1px 2px;">
               <div style="font-weight:600;font-size:12px;color:#1F1F1F;">${y.name} · ${y.code}</div>
               <div style="font-size:11px;color:#1F1F1F;opacity:0.75;margin-top:2px;">${s.count} tag${s.count === 1 ? "" : "s"} · ${s.fbm.toLocaleString()} FBM</div>
             </div>`,
          )
          .addTo(map);
      });
      el.addEventListener("mouseleave", () => popup.remove());
      el.addEventListener("click", () => navRef.current?.({ yard: [y.code] }));

      return new mapboxgl.Marker(el).setLngLat([y.lng, y.lat]).addTo(map);
    });

    return () => {
      markers.forEach((m) => m.remove());
      popup.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="bg-white rounded-[10px] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.07)] flex flex-col h-full">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-[13px] font-display font-semibold text-text">Yard Map</div>
        <span className="text-[11px] text-text-ter">Langley, BC · mock locations</span>
      </div>

      {TOKEN ? (
        <div ref={containerRef} className="flex-1 min-h-[300px] rounded-lg overflow-hidden" />
      ) : (
        <div className="flex-1 min-h-[300px] rounded-lg bg-sage/15 border border-dashed border-sage flex items-center justify-center text-center px-6">
          <div className="text-[13px] text-text-sec">
            Add <code className="font-mono text-coral">VITE_MAPBOX_TOKEN</code> to <code className="font-mono">.env.local</code> to load the yard map.
          </div>
        </div>
      )}
    </div>
  );
}
