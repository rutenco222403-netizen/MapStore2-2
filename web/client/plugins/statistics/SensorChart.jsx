/**
 * SensorChart.jsx
 * Gráfica de línea para un sensor individual - estilo shadcn/ui
 * Consume datos desde la API REST pública de MySQL sin fallback a datos locales
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { format } from 'date-fns';
import Message from '../../components/I18N/Message';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip
} from 'recharts';
import { fetchReadings } from './mockData';

// Períodos cortos (horas) muestran hora; períodos largos (días) muestran solo
// la fecha, evitando que se amontonen fecha + hora en cada marca del eje X.
const SHORT_PERIODS_WITH_TIME = new Set(['24h']);

function getAxisTickFormat(period) {
    return SHORT_PERIODS_WITH_TIME.has(period) ? 'HH:mm' : 'dd/MM';
}

function formatAxisTick(isoTimestamp, period) {
    const date = new Date(isoTimestamp);
    if (Number.isNaN(date.getTime())) return '';
    return format(date, getAxisTickFormat(period));
}

function formatTooltipLabel(isoTimestamp) {
    const date = new Date(isoTimestamp);
    if (Number.isNaN(date.getTime())) return '';
    return format(date, 'dd/MM/yyyy HH:mm');
}

// ── Tooltip personalizado (look shadcn) ───────────────────────────────
function CustomTooltip({ active, payload, label, unit }) {
    if (!active || !payload || !payload.length) return null;
    return (
        <div className="sc-tooltip">
            <p className="sc-tooltip__label">{formatTooltipLabel(label)}</p>
            <p className="sc-tooltip__value">
                {payload[0].value} <span className="sc-tooltip__unit">{unit}</span>
            </p>
        </div>
    );
}


CustomTooltip.propTypes = {
    active: PropTypes.bool,
    payload: PropTypes.array,
    label: PropTypes.string,
    unit: PropTypes.string
};

// ── Estadísticas rápidas (calculadas localmente desde los datos) ──────
function Stats({ data }) {
    if (!data.length) return null;
    const values = data.map(d => d.value);
    const min = Math.min(...values).toFixed(2);
    const max = Math.max(...values).toFixed(2);
    const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
    return (
        <div className="sc-stats">
            <span className="sc-stats__item"><em className="sc-stats__label"><Message msgId="Statistics.min" defaultMessage="Mín" /></em>{min}</span>
            <span className="sc-stats__item"><em className="sc-stats__label"><Message msgId="Statistics.avg" defaultMessage="Prom" /></em>{avg}</span>
            <span className="sc-stats__item"><em className="sc-stats__label"><Message msgId="Statistics.max" defaultMessage="Máx" /></em>{max}</span>
        </div>
    );
}

Stats.propTypes = { data: PropTypes.array };

// ── Skeleton de carga ─────────────────────────────────────────────────
function ChartSkeleton() {
    return (
        <div className="sc-card__skeleton">
            <div className="sc-card__skeleton-bar" style={{ width: '60%' }} />
            <div className="sc-card__skeleton-bar" style={{ width: '40%' }} />
            <div className="sc-card__skeleton-chart" />
        </div>
    );
}

// ── Componente principal ──────────────────────────────────────────────
function SensorChart({ sensor, period, zone, station }) {
    const [data, setData]       = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetchReadings(sensor.id, period, { zone, station })
            .then(rows => setData(rows))
            .finally(() => setLoading(false));
    }, [sensor.id, period, zone, station]);

    const tickInterval = Math.max(1, Math.ceil(data.length / 8));

    if (!sensor) return null;

    return (
        <div className="sc-card" style={{ '--sc-card-accent': sensor.color }}>
            {/* Cabecera */}
            <div className="sc-card__header">
                <span className="sc-card__indicator" style={{ background: sensor.color }} />
                <div>
                    <h3 className="sc-card__title"><Message msgId={`Statistics.sensor.${sensor.id}`} defaultMessage={sensor.name} /></h3>
                    <p className="sc-card__subtitle">
                        <Message msgId="Statistics.sensorInfo" defaultMessage="Sensor" /> {sensor.id} · {sensor.unit}
                    </p>
                </div>
            </div>

            {loading ? <ChartSkeleton /> : (
                <>
                    <Stats data={data} />
                    <div className="sc-card__chart">
                        {data.length === 0 ? (
                            <p className="sc-card__empty">
                                <Message msgId="Statistics.noDataPeriod" defaultMessage="Sin datos para este período" />
                            </p>
                        ) : (
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis
                                        dataKey="timestamp"
                                        tickFormatter={value => formatAxisTick(value, period)}
                                        tick={{ fontSize: 10, fill: '#888' }}
                                        interval={tickInterval}
                                        tickLine={false}
                                        axisLine={{ stroke: '#e5e7eb' }}
                                        minTickGap={24}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 10, fill: '#888' }}
                                        tickLine={false}
                                        axisLine={false}
                                        width={42}
                                    />
                                    <Tooltip
                                        content={<CustomTooltip unit={sensor.unit} />}
                                        cursor={{ stroke: sensor.color, strokeWidth: 1, strokeDasharray: '4 2' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        stroke={sensor.color}
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4, fill: sensor.color }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

SensorChart.propTypes = {
    sensor: PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string,
        unit: PropTypes.string,
        color: PropTypes.string
    }).isRequired,
    period: PropTypes.string.isRequired,
    zone: PropTypes.string,
    station: PropTypes.string
};

SensorChart.defaultProps = {
    zone: '1',
    station: 'E1'
};

export default SensorChart;
