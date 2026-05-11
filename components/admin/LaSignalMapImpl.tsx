"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Fragment, useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";

import type { LaSignalMapNeighborhood, LaSignalMapPlaceCluster, LaSignalMapPlacePoint } from "@/lib/admin/laSignalMapLayout";

const LA_CENTER: [number, number] = [34.0522, -118.2437];

/** CARTO Positron — light editorial basemap (OSM data via CARTO). */
const TILE_POSITRON = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

export type LaSignalMapProps = {
  liveGeoActive: boolean;
  hasRealCoordinates: boolean;
  placePointCount: number;
  neighborhoods: LaSignalMapNeighborhood[];
  placeClusters: LaSignalMapPlaceCluster[];
  placePoints: LaSignalMapPlacePoint[];
  totalNeighborhoodHits: number;
  clusterCount: number;
  topCluster: string;
  overlapHotspots: string;
  fastestGrowth: string;
};

function trendFill(activity: LaSignalMapNeighborhood["activity"]): string {
  if (activity === "green") return "#ea580c";
  if (activity === "yellow") return "#fb923c";
  return "#be123c";
}

function makeCountIcon(count: number): L.DivIcon {
  const c = Math.min(99, count);
  return L.divIcon({
    className: "la-signal-map-count-icon",
    html: `<div class="la-signal-map-count-icon__inner">${c}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function FitLaBounds({
  neighborhoods,
  placeClusters,
  placePoints,
}: {
  neighborhoods: LaSignalMapNeighborhood[];
  placeClusters: LaSignalMapPlaceCluster[];
  placePoints: LaSignalMapPlacePoint[];
}) {
  const map = useMap();
  useEffect(() => {
    const pts: [number, number][] = [];
    for (const n of neighborhoods) {
      if (n.count > 0) pts.push([n.lat, n.lng]);
    }
    for (const c of placeClusters) pts.push([c.lat, c.lng]);
    for (const p of placePoints) pts.push([p.lat, p.lng]);
    if (pts.length === 0) {
      map.setView(LA_CENTER, 10);
      return;
    }
    const b = L.latLngBounds(pts);
    map.fitBounds(b, { padding: [32, 32], maxZoom: 11, animate: false });
  }, [map, neighborhoods, placeClusters, placePoints]);
  return null;
}

export default function LaSignalMapImpl(props: LaSignalMapProps) {
  const {
    liveGeoActive,
    hasRealCoordinates: _hasRealCoordinates,
    placePointCount,
    neighborhoods,
    placeClusters,
    placePoints,
    totalNeighborhoodHits,
    clusterCount,
    topCluster,
    overlapHotspots,
    fastestGrowth,
  } = props;

  const showIndividualPlaces = liveGeoActive && placePoints.length <= 150;

  const neighborhoodTooltip = (n: LaSignalMapNeighborhood) => (
    <div className="max-w-[240px] text-[11px] leading-snug text-[#1f2937]">
      <p className="font-semibold text-[#0f172a]">{n.name}</p>
      <p>
        <span className="text-[#64748b]">Signal count:</span> {n.count}
      </p>
      <p>
        <span className="text-[#64748b]">Top trend:</span> {n.topTrend}
      </p>
      <p>
        <span className="text-[#64748b]">Google Places in hood:</span> {n.placeCount}
      </p>
      <p>
        <span className="text-[#64748b]">Source mix:</span> {n.sourceMix}
      </p>
      <p className="text-[10px] text-[#64748b]">{n.coordinateType}</p>
    </div>
  );

  const placeClusterTooltip = (c: LaSignalMapPlaceCluster) => {
    const a = c.anchor;
    return (
      <div className="max-w-[220px] text-[11px] text-[#1f2937]">
        <p className="font-semibold">
          {c.count} restaurant{c.count === 1 ? "" : "s"}
        </p>
        <p>Lead: {a.name}</p>
        <p className="capitalize">Cuisine: {c.strongestCuisine}</p>
        {a.neighborhood ? <p>{a.neighborhood}</p> : null}
      </div>
    );
  };

  const placePointTooltip = (p: LaSignalMapPlacePoint) => (
    <div className="max-w-[220px] text-[11px] text-[#1f2937]">
      <p className="font-semibold">{p.name}</p>
      {p.neighborhood ? <p>{p.neighborhood}</p> : null}
      <p className="capitalize">{(p.cuisines ?? []).slice(0, 3).join(", ") || "—"}</p>
      {p.rating != null ? <p>Rating: {p.rating}</p> : null}
    </div>
  );

  const statusLabel = liveGeoActive ? "Live geo data active" : "Approximate neighborhood clustering";
  const statusDetail = liveGeoActive
    ? `${placePointCount} restaurant coordinates from Google Places on map`
    : "Neighborhood markers use centroid fallbacks until live geo is available";

  const activeNeighborhoods = useMemo(() => neighborhoods.filter((n) => n.count > 0), [neighborhoods]);

  return (
    <div className="la-signal-map">
      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px]">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
            liveGeoActive ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {statusLabel}
        </span>
        <span className="text-[#4b5563]">{statusDetail}</span>
      </div>

      <div className="mb-2 rounded-md border border-[#e7dfcf] bg-[#f8f5ef] px-2.5 py-1.5 text-[11px] leading-snug text-[#4b5563]">
        <p className="font-semibold uppercase tracking-[0.06em] text-[#4b5563]">Map data</p>
        <p className="mt-0.5">
          Restaurant coordinates from Google Places when available. Neighborhood positions are approximate centroids. No
          invented precision.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-xl border-2 border-[#cfc3aa] shadow-inner">
        <MapContainer
          center={LA_CENTER}
          zoom={10}
          className="la-signal-map-root z-0 min-h-[420px] h-[min(520px,58vh)] w-full"
          scrollWheelZoom
          attributionControl
        >
          <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_POSITRON} subdomains="abcd" maxZoom={19} />
          <FitLaBounds neighborhoods={neighborhoods} placeClusters={placeClusters} placePoints={placePoints} />

          {liveGeoActive &&
            placeClusters.map((c) => (
              <CircleMarker
                key={`gcl-${c.key}`}
                center={[c.lat, c.lng]}
                radius={Math.min(18, 5 + c.count * 1.15)}
                pathOptions={{
                  color: "#bfdbfe",
                  weight: 1.5,
                  fillColor: "#2563eb",
                  fillOpacity: 0.5,
                }}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  {placeClusterTooltip(c)}
                </Tooltip>
              </CircleMarker>
            ))}

          {liveGeoActive &&
            showIndividualPlaces &&
            placePoints.map((p, idx) => (
              <CircleMarker
                key={`gp-${p.name}-${idx}`}
                center={[p.lat, p.lng]}
                radius={4}
                pathOptions={{
                  color: "#e2e8f0",
                  weight: 0.6,
                  fillColor: "#1d4ed8",
                  fillOpacity: 0.28,
                }}
              >
                <Tooltip direction="top" offset={[0, -4]}>
                  {placePointTooltip(p)}
                </Tooltip>
              </CircleMarker>
            ))}

          {activeNeighborhoods.map((n) => {
            const r = Math.min(28, 11 + Math.min(n.count, 12) * 1.35);
            const fill = trendFill(n.activity);
            return (
              <Fragment key={n.name}>
                <CircleMarker
                  center={[n.lat, n.lng]}
                  radius={r}
                  pathOptions={{
                    color: "#ffffff",
                    weight: 3,
                    fillColor: fill,
                    fillOpacity: 0.9,
                  }}
                >
                  <Tooltip direction="top" sticky offset={[0, -10]}>
                    {neighborhoodTooltip(n)}
                  </Tooltip>
                </CircleMarker>
                <Marker
                  position={[n.lat, n.lng]}
                  icon={makeCountIcon(n.count)}
                  interactive={false}
                  keyboard={false}
                  zIndexOffset={900}
                />
              </Fragment>
            );
          })}
        </MapContainer>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#e8e0d2] pt-2 text-[10px] font-medium text-[#4b5563]">
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full bg-orange-600" /> Trends
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full bg-blue-600" /> Google Places
        </span>
        <span className="text-[#6b6570]">Fastest: {fastestGrowth}</span>
      </div>

      <div className="mt-2 grid max-h-[152px] grid-cols-2 gap-2 overflow-hidden rounded-md border border-[#e3dcd0] bg-[#faf7f0] text-[11px] md:max-h-[160px]">
        <div className="max-h-full overflow-auto p-2">
          {neighborhoods
            .filter((n) => n.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 7)
            .map((n) => (
              <div
                key={`${n.name}-meta`}
                className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-[#ebe4d8] py-1 last:border-b-0"
              >
                <span className="truncate font-semibold text-[#1a202c]">{n.name}</span>
                <span className="tabular-nums text-[#111827]">{n.count}</span>
              </div>
            ))}
        </div>
        <div className="max-h-full overflow-auto border-l border-[#ebe4d8] p-2 text-[#475569]">
          {placeClusters
            .sort((a, b) => b.count - a.count)
            .slice(0, 6)
            .map((cluster) => (
              <div
                key={`cluster-row-${cluster.key}`}
                className="grid grid-cols-[auto_1fr] items-center gap-1 border-b border-[#efe7da] py-0.5 last:border-b-0"
              >
                <span className="font-bold text-[#1e3a8a]">{cluster.count}×</span>
                <span className="truncate capitalize">{cluster.strongestCuisine}</span>
              </div>
            ))}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] md:grid-cols-4">
        <div className="rounded-md border border-[#e7dfcf] bg-[#fbfaf7] px-2 py-1.5">
          <p className="font-medium text-[#5c6570]">Trend hits</p>
          <p className="text-sm font-semibold tabular-nums text-[#111827]">{totalNeighborhoodHits}</p>
        </div>
        <div className="rounded-md border border-[#e7dfcf] bg-[#fdfbf7] px-2 py-1.5">
          <p className="font-medium text-[#5c6570]">Clusters</p>
          <p className="text-sm font-semibold tabular-nums text-[#111827]">{clusterCount}</p>
        </div>
        <div className="col-span-2 rounded-md border border-[#e7dfcf] bg-[#fbfaf7] px-2 py-1.5">
          <p className="font-medium text-[#5c6570]">Pulse</p>
          <p className="truncate font-semibold leading-tight text-[#374151]">
            {topCluster} · {overlapHotspots || "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
