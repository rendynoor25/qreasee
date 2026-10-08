import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { makeTranslator, type Point } from "@qreasee/shared";
import { useApp } from "../state/store";
import { projectLatLng, unprojectToLatLng } from "../lib/osm";
import { Button, Panel } from "./ui";

type LatLngTuple = [number, number];

/**
 * 2D map for tracing a site boundary from OpenStreetMap imagery before any 3D
 * drawing. Traced points are projected into the model coordinate system.
 */
export function MapPanel() {
  const lang = useApp((s) => s.lang);
  const tr = makeTranslator(lang);
  const project = useApp((s) => s.project);
  const updateProject = useApp((s) => s.updateProject);
  const dispatch = useApp((s) => s.dispatch);
  const boundary = useApp((s) => s.docState.site.boundary);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const draftLayerRef = useRef<L.LayerGroup | null>(null);
  const siteLayerRef = useRef<L.Polygon | null>(null);
  const tracingRef = useRef(false);
  const draftRef = useRef<LatLngTuple[]>([]);

  const [tracing, setTracing] = useState(false);
  const [draft, setDraft] = useState<LatLngTuple[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    tracingRef.current = tracing;
  }, [tracing]);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const { lat, lng } = project.location;
    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 18,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: tr("map.attribution"),
    }).addTo(map);
    draftLayerRef.current = L.layerGroup().addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (!tracingRef.current) return;
      setDraft((d) => [...d, [e.latlng.lat, e.latlng.lng]]);
    });
    mapRef.current = map;
    setReady(true);
    // Leaflet needs a size recalculation once the panel is visible.
    setTimeout(() => map.invalidateSize(), 50);
    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show the current site boundary.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (siteLayerRef.current) {
      siteLayerRef.current.remove();
      siteLayerRef.current = null;
    }
    if (boundary.length >= 3) {
      const latlngs = boundary.map((p) => {
        const ll = unprojectToLatLng(p, project.location.lat, project.location.lng, project.northAngle);
        return [ll.lat, ll.lng] as LatLngTuple;
      });
      siteLayerRef.current = L.polygon(latlngs, {
        color: "#f0913b",
        weight: 2,
        fillOpacity: 0.15,
      }).addTo(map);
    }
  }, [boundary, project.location.lat, project.location.lng, project.northAngle, ready]);

  // Draw the in-progress trace.
  useEffect(() => {
    const layer = draftLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const ll of draft) {
      L.circleMarker(ll, { radius: 4, color: "#f0913b", fillColor: "#f0913b", fillOpacity: 1 }).addTo(layer);
    }
    if (draft.length >= 2) {
      L.polygon(draft, { color: "#f0913b", weight: 2, dashArray: "4 3", fillOpacity: 0.12 }).addTo(layer);
    }
  }, [draft, ready]);

  useEffect(() => {
    mapRef.current?.setView([project.location.lat, project.location.lng]);
  }, [project.location.lat, project.location.lng]);

  const applySite = () => {
    if (draft.length < 3) return;
    const cLat = draft.reduce((s, [a]) => s + a, 0) / draft.length;
    const cLng = draft.reduce((s, [, b]) => s + b, 0) / draft.length;
    updateProject({ location: { lat: cLat, lng: cLng } });
    const points: Point[] = draft.map(([lat, lng]) =>
      projectLatLng(lat, lng, cLat, cLng, project.northAngle),
    );
    dispatch({ type: "site.setBoundary", points });
    setDraft([]);
    setTracing(false);
  };

  const setLocationHere = () => {
    const c = mapRef.current?.getCenter();
    if (c) updateProject({ location: { lat: c.lat, lng: c.lng } });
  };

  return (
    <div className="space-y-3">
      <Panel title={tr("map.title")}>
        <p className="mb-2 text-[11px] text-ink-500">{tr("map.hint")}</p>
        <div ref={containerRef} className="h-[300px] w-full overflow-hidden rounded-md border border-ink-800" />
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant={tracing ? "primary" : "outline"}
            onClick={() => setTracing((v) => !v)}
          >
            {tracing ? tr("map.stop") : tr("map.trace")}
          </Button>
          <Button size="sm" variant="primary" disabled={draft.length < 3} onClick={applySite}>
            {tr("map.setSite")}
          </Button>
          <Button size="sm" variant="ghost" onClick={setLocationHere}>
            {tr("map.setLocation")}
          </Button>
          {draft.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setDraft([])}>
              {tr("map.clear")}
            </Button>
          )}
        </div>
        <div className="mt-2 text-[11px] text-ink-400">
          {tr("map.points", { n: draft.length })} · lat {project.location.lat.toFixed(4)}, lng{" "}
          {project.location.lng.toFixed(4)}
        </div>
      </Panel>
    </div>
  );
}
