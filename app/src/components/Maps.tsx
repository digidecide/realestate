import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import { rupees } from '../lib/format';
import type { Property } from '../lib/types';

const pin = L.divIcon({
  className: '',
  html: '<svg width="28" height="36" viewBox="0 0 28 36"><path d="M14 35C14 35 26 21 26 13A12 12 0 1 0 2 13C2 21 14 35 14 35Z" fill="#2d3a8c" stroke="#fff" stroke-width="2"/><circle cx="14" cy="13" r="4.5" fill="#fff"/></svg>',
  iconSize: [28, 36],
  iconAnchor: [14, 35],
});

const TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTR = '&copy; OpenStreetMap contributors';
const AP_CENTER: [number, number] = [16.5062, 80.648];

export function googleMapsLink(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function PropertyMap({ lat, lng }: { lat: number; lng: number }) {
  return (
    <MapContainer center={[lat, lng]} zoom={15} className="map" scrollWheelZoom={false}>
      <TileLayer url={TILE} attribution={ATTR} />
      <Marker position={[lat, lng]} icon={pin} />
    </MapContainer>
  );
}

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 13);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [30, 30] });
  }, [map, points]);
  return null;
}

export function ResultsMap({ items }: { items: Property[] }) {
  const nav = useNavigate();
  const withPin = items.filter((p) => p.lat != null && p.lng != null);
  const pts = withPin.map((p) => [p.lat!, p.lng!] as [number, number]);
  return (
    <MapContainer center={AP_CENTER} zoom={10} className="results-map" scrollWheelZoom={false}>
      <TileLayer url={TILE} attribution={ATTR} />
      <Fit points={pts} />
      {withPin.map((p) => (
        <Marker key={p.id} position={[p.lat!, p.lng!]} icon={pin} title={`${p.title}, ${rupees(p.price)}`}
          eventHandlers={{ click: () => nav(`/property/${p.id}`) }} />
      ))}
    </MapContainer>
  );
}

function ClickToPin({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)) });
  return null;
}

export function PinPicker({ lat, lng, onPick }: { lat: number | null; lng: number | null; onPick: (lat: number, lng: number) => void }) {
  const has = lat != null && lng != null;
  return (
    <MapContainer center={has ? [lat!, lng!] : AP_CENTER} zoom={has ? 16 : 10} className="map" scrollWheelZoom>
      <TileLayer url={TILE} attribution={ATTR} />
      <ClickToPin onPick={onPick} />
      {has && <Marker position={[lat!, lng!]} icon={pin} draggable eventHandlers={{ dragend: (e) => { const ll = (e.target as L.Marker).getLatLng(); onPick(+ll.lat.toFixed(6), +ll.lng.toFixed(6)); } }} />}
    </MapContainer>
  );
}

/** Reads coordinates from "16.47, 80.71" or a Google Maps link. */
export function parseCoords(t: string): [number, number] | null {
  let s = t.trim();
  try { s = decodeURIComponent(s); } catch { /* keep as is */ }
  const m = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) || s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ||
    s.match(/[?&](?:q|ll|query)=(-?\d+(?:\.\d+)?)[,+ ]\s*(-?\d+(?:\.\d+)?)/) || s.match(/(-?\d{1,2}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)/);
  if (!m) return null;
  const a = +m[1], b = +m[2];
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  return [a, b];
}
