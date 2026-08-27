/**
 * mockData.js
 * Capa de datos para sensores.
 * → Consume la API pública de MySQL para estadísticas y filtros.
 * → Si la API no responde, devuelve listas vacías para que la UI muestre estado sin datos.
 */

import { format } from 'date-fns';

// ── Base URL automática ───────────────────────────────────────────────
const REMOTE_API_URL = 'https://daa.yjk.mybluehost.me/api/obtener_datos.php';
const LOCAL_API_URL = '/api/obtener_datos.php';
const LOCAL_API_PORT = '3001';
const DEFAULT_ZONE = '';
const DEFAULT_STATION = '';

function isLocalHost() {
    if (typeof window === 'undefined') return false;
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

function getApiBaseCandidates() {
    const candidates = [LOCAL_API_URL, REMOTE_API_URL];
    if (isLocalHost()) {
        candidates.unshift(`${window.location.protocol}//${window.location.hostname}:${LOCAL_API_PORT}/api/obtener_datos.php`);
    }
    return [...new Set(candidates)];
}

function buildQuery(params = {}) {
    const cleaned = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '');
    if (!cleaned.length) return '';
    const search = new URLSearchParams(cleaned.map(([k, v]) => [k, String(v)]));
    return `?${search.toString()}`;
}

async function fetchJSONWithApiFallback(params = {}) {
    let lastError;
    const bases = getApiBaseCandidates();
    const search = buildQuery(params);

    for (const base of bases) {
        try {
            const res = await fetch(`${base}${search}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('No se pudo consultar la API de sensores');
}

function normalizeZoneId(zone) {
    const value = String(zone || DEFAULT_ZONE).trim();
    if (!value) return '';

    const compact = value.replace(/\s+/g, '').toUpperCase();
    const directMatch = compact.match(/^Z?(\d+[A-Z]?)$/i);
    if (directMatch) {
        return directMatch[1];
    }

    const numericMatch = compact.match(/(\d+[A-Z]?)/i);
    if (numericMatch) {
        return numericMatch[1];
    }

    return value;
}

function getPeriodDays(period) {
    const value = String(period || '7d').trim();

    const hoursMatch = value.match(/^(\d+)h$/i);
    if (hoursMatch) {
        return Math.max(1, Math.ceil(Number(hoursMatch[1]) / 24));
    }

    const daysMatch = value.match(/^(\d+)d$/i);
    if (daysMatch) {
        return Number(daysMatch[1]);
    }

    return 7;
}

function extractArray(payload, preferredKeys = []) {
    if (Array.isArray(payload)) return payload;

    if (!payload || typeof payload !== 'object') return [];

    for (const key of preferredKeys) {
        if (Array.isArray(payload[key])) return payload[key];
    }

    const genericKeys = ['datos', 'data', 'rows', 'results', 'items', 'records', 'registros', 'zonas', 'estaciones', 'sensores', 'variables'];
    for (const key of genericKeys) {
        if (Array.isArray(payload[key])) return payload[key];
    }

    const values = Object.values(payload);
    if (values.length && values.every(value => value && typeof value === 'object' && !Array.isArray(value))) {
        return Object.entries(payload).map(([id, value]) => ({ id, ...value }));
    }

    return [];
}

function pickFirstDefined(source, keys) {
    for (const key of keys) {
        if (source && source[key] !== undefined && source[key] !== null && source[key] !== '') {
            return source[key];
        }
    }
    return null;
}

function parseApiTimestamp(row) {
    const datetime = pickFirstDefined(row, ['fecha_hora', 'datetime']);
    if (datetime) {
        const parsedDateTime = Date.parse(datetime);
        if (!Number.isNaN(parsedDateTime)) return parsedDateTime;
    }

    const datePart = pickFirstDefined(row, ['fecha_lectura', 'fecha']);
    const timePart = pickFirstDefined(row, ['hora_lectura', 'hora']);
    if (datePart && timePart) {
        const parsedComposed = Date.parse(`${datePart}T${timePart}`);
        if (!Number.isNaN(parsedComposed)) return parsedComposed;
    }

    const timestampValue = pickFirstDefined(row, [
        'timestamp',
        'recorded_at',
        'createdAt',
        'created_at',
        'time',
        'ts'
    ]);

    if (timestampValue !== null) {
        const asNumber = Number(timestampValue);
        if (Number.isFinite(asNumber)) return asNumber;
        const parsed = Date.parse(String(timestampValue));
        if (!Number.isNaN(parsed)) return parsed;
    }

    return null;
}

function normalizeReadingRow(row, sensorId, fallbackId) {
    if (!row || typeof row !== 'object') return null;

    const timestamp = parseApiTimestamp(row);
    const rawValue = pickFirstDefined(row, [sensorId, 'value', 'valor', 'reading', 'measurement', 'measure', 'dato']);
    const value = Number(rawValue);

    if (!timestamp || Number.isNaN(value)) return null;

    return {
        id: String(pickFirstDefined(row, ['id', 'key', 'uuid']) || fallbackId || timestamp),
        timestamp: new Date(timestamp).toISOString(),
        label: row.label || format(new Date(timestamp), 'dd/MM HH:mm'),
        value: Number(value.toFixed(3))
    };
}

function normalizeStationId(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';

    const compact = raw.replace(/\s+/g, '').toUpperCase();
    if (/^E\d+$/.test(compact)) {
        return compact;
    }

    const explicitMatch = compact.match(/E?(\d+)/i);
    if (explicitMatch) {
        return `E${explicitMatch[1]}`;
    }

    return raw;
}

function normalizeZoneItem(zone, fallbackId) {
    if (!zone || typeof zone !== 'object') return null;
    const rawId = pickFirstDefined(zone, ['id_zona', 'zona_id', 'zonaId', 'id', 'zone_id', 'codigo', 'cod_zona', 'numZona']) || fallbackId || '';
    const id = normalizeZoneId(rawId);
    if (!id) return null;
    return {
        id,
        name: pickFirstDefined(zone, ['nombre', 'name', 'zona_nombre', 'label']) || id
    };
}

function normalizeStationItem(station, fallbackId) {
    if (!station || typeof station !== 'object') return null;

    const stationName = String(pickFirstDefined(station, ['nombre', 'estacion', 'id_estacion_nombre', 'station', 'label']) || '').trim();
    const rawId = pickFirstDefined(station, ['id_estacion', 'id_estacion_nombre', 'estacion', 'stationId', 'station', 'id']) || fallbackId || '';
    const id = normalizeStationId(stationName || rawId);

    if (!id) return null;
    return {
        id,
        name: pickFirstDefined(station, ['descripcion', 'name', 'estacion_nombre', 'label']) || stationName || id
    };
}

function normalizeStats(payload, fallbackId) {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        const direct = {
            min: pickFirstDefined(payload, ['min', 'minimum', 'menor']),
            avg: pickFirstDefined(payload, ['avg', 'average', 'promedio', 'media']),
            max: pickFirstDefined(payload, ['max', 'maximum', 'mayor'])
        };

        if (direct.min !== null && direct.avg !== null && direct.max !== null) {
            return {
                min: Number(direct.min).toFixed(2),
                avg: Number(direct.avg).toFixed(2),
                max: Number(direct.max).toFixed(2)
            };
        }

        const rows = extractArray(payload, ['datos', fallbackId]);
        if (rows.length) {
            const sensorMin = Number(rows[0][`${fallbackId}_min`]);
            const sensorMax = Number(rows[0][`${fallbackId}_max`]);
            const sensorAvg = Number(rows[0][`${fallbackId}_prom`] ?? rows[0][`${fallbackId}_avg`]);

            if (!Number.isNaN(sensorMin) && !Number.isNaN(sensorMax) && !Number.isNaN(sensorAvg)) {
                return {
                    min: sensorMin.toFixed(2),
                    avg: sensorAvg.toFixed(2),
                    max: sensorMax.toFixed(2)
                };
            }
        }
    }

    return null;
}

export const ZONES = [
    { id: '1', name: '1' },
    { id: '2', name: '2' },
    { id: '3', name: '3' },
    { id: '4', name: '4' }
];

export const STATIONS = [
    { id: 'E1', name: 'E1' },
    { id: 'E2', name: 'E2' },
    { id: 'E3', name: 'E3' }
];

// ── Sensores esperados por la interfaz ───────────────────────────────
export const SENSORS = [
    { id: 'T1', name: 'Temperatura Suelo 1', unit: '°C', color: '#ef4444' },
    { id: 'H1', name: 'Humedad Suelo 1', unit: '%', color: '#3b82f6' },
    { id: 'T2', name: 'Temperatura Suelo 2', unit: '°C', color: '#f97316' },
    { id: 'H2', name: 'Humedad Suelo 2', unit: '%', color: '#6366f1' },
    { id: 'T3', name: 'Temperatura Suelo 3', unit: '°C', color: '#dc2626' },
    { id: 'H3', name: 'Humedad Suelo 3', unit: '%', color: '#2563eb' },
    { id: 'T4', name: 'Temperatura Aire', unit: '°C', color: '#f59e0b' },
    { id: 'H4', name: 'Humedad Aire', unit: '%', color: '#14b8a6' },
    { id: 'W1', name: 'Velocidad Viento', unit: 'm/s', color: '#8b5cf6' },
    { id: 'R1', name: 'Lluvia', unit: 'mm', color: '#0ea5e9' }
];

// ── Variables medidas por cada grupo de estaciones ────────────────────
// Cada zona mide solo un subconjunto de sensores; esta lista se usa para
// restringir lo que puede mostrarse aunque la API devuelva ruido en otras
// columnas. Claves = id_zona normalizado (ver normalizeZoneId).
const SOIL_SENSOR_IDS = ['T1', 'H1', 'T2', 'H2', 'T3', 'H3'];
const AIR_SENSOR_IDS = ['T4', 'H4', 'W1'];
const RAIN_SENSOR_IDS = ['R1'];

const ZONE_SENSOR_GROUPS = {
    // Altavista: humedad y temperatura del suelo (x3) + lluvia
    1: [...SOIL_SENSOR_IDS, ...RAIN_SENSOR_IDS],
    // San Antonio de Prado: humedad y temperatura del suelo (x3) + lluvia
    2: [...SOIL_SENSOR_IDS, ...RAIN_SENSOR_IDS],
    // Universidad Minas: todas las variables (suelo aún sin instalar, pero se incluyen)
    3: [...SOIL_SENSOR_IDS, ...AIR_SENSOR_IDS, ...RAIN_SENSOR_IDS],
    // Guajira: temperatura y humedad del aire, viento y lluvia (sin sensores de suelo)
    4: [...AIR_SENSOR_IDS, ...RAIN_SENSOR_IDS]
};

function getZoneSensorIds(zoneId) {
    const normalized = String(zoneId ?? '').trim();
    return ZONE_SENSOR_GROUPS[normalized] || null;
}

function extractSensorIdsFromRows(rows = [], allowedSensorIds = null) {
    const knownSensorIds = new Set(
        allowedSensorIds ? SENSORS.filter(sensor => allowedSensorIds.includes(sensor.id)).map(sensor => sensor.id) : SENSORS.map(sensor => sensor.id)
    );
    const ids = new Set();

    rows.forEach(row => {
        if (!row || typeof row !== 'object') return;

        Object.keys(row).forEach(key => {
            if (knownSensorIds.has(key)) {
                const numericValue = Number(row[key]);
                if (!Number.isNaN(numericValue)) {
                    ids.add(key);
                }
            }
        });
    });

    return [...ids];
}


// ── API: obtener zonas ───────────────────────────────────────────────
export async function fetchZones() {
    try {
        const response = await fetchJSONWithApiFallback({ tipo: 'zonas', formato: 'json' });
        const zones = extractArray(response).map((zone, index) => normalizeZoneItem(zone, index + 1)).filter(Boolean);
        return zones;
    } catch {
        return [];
    }
}

// ── API: obtener estaciones por zona ─────────────────────────────────
export async function fetchStations(zone = DEFAULT_ZONE) {
    try {
        const zoneId = normalizeZoneId(zone);
        const response = await fetchJSONWithApiFallback({ zona_id: zoneId, tipo: 'estaciones', formato: 'json' });
        const stations = extractArray(response).map((station, index) => normalizeStationItem(station, index + 1)).filter(Boolean);
        return stations;
    } catch {
        return [];
    }
}

// Ventana amplia usada solo para detectar qué sensores existen, sin depender
// del período seleccionado en la UI. Sin este parámetro la API asume un
// filtro por defecto muy restrictivo (equivalente a "solo hoy"), lo que hace
// que estaciones con lecturas menos frecuentes (p. ej. Altavista, Universidad
// Minas) aparezcan sin datos aunque sí tengan historial.
const SENSOR_DISCOVERY_DAYS = 3650;

// ── API: obtener lista de sensores ────────────────────────────────────
export async function fetchSensors(options = {}) {
    const zoneId = normalizeZoneId(options.zone || DEFAULT_ZONE);
    const stationId = options.station || DEFAULT_STATION;
    try {
        const response = await fetchJSONWithApiFallback({
            zona_id: zoneId,
            tipo: 'ultimas',
            estacion: stationId,
            dias: SENSOR_DISCOVERY_DAYS,
            limite: 50,
            offset: 0,
            formato: 'json'
        });

        const rows = extractArray(response, ['datos']);
        const allowedSensorIds = getZoneSensorIds(zoneId);
        const sensorIds = extractSensorIdsFromRows(rows, allowedSensorIds);

        const sensors = SENSORS.filter(sensor => sensorIds.includes(sensor.id));
        return sensors;
    } catch {
        return [];
    }
}

// ── API: obtener lecturas de un sensor filtradas por período ──────────
export async function fetchReadings(sensorId, period = '7d', options = {}) {
    const zoneId = normalizeZoneId(options.zone || DEFAULT_ZONE);
    const stationId = options.station || DEFAULT_STATION;
    try {
        const response = await fetchJSONWithApiFallback({
            zona_id: zoneId,
            tipo: 'ultimas',
            estacion: stationId,
            variables: sensorId,
            dias: getPeriodDays(period),
            limite: 5000,
            offset: 0,
            formato: 'json'
        });

        const rows = extractArray(response, ['datos', sensorId])
            .map((row, index) => normalizeReadingRow(row, sensorId, `${sensorId}-${index}`))
            .filter(Boolean)
            .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

        if (rows.length) return rows;
    } catch {
        return [];
    }

    return [];
}

// ── API: estadísticas de un sensor ───────────────────────────────────
export async function fetchStats(sensorId, period = '7d', options = {}) {
    const zoneId = normalizeZoneId(options.zone || DEFAULT_ZONE);
    const stationId = options.station || DEFAULT_STATION;
    try {
        const response = await fetchJSONWithApiFallback({
            zona_id: zoneId,
            tipo: 'estadisticas',
            estacion: stationId,
            variables: sensorId,
            dias: getPeriodDays(period),
            formato: 'json'
        });

        const normalized = normalizeStats(response, sensorId);
        if (normalized) return normalized;
    } catch {
        return null;
    }

    return null;
}
