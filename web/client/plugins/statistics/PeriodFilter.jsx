/**
 * PeriodFilter.jsx
 * Botones para filtrar las gráficas por período de tiempo - estilo shadcn
 */

import React from 'react';
import PropTypes from 'prop-types';
import Message from '../../components/I18N/Message';

export const PERIODS = [
    { value: '24h', labelId: 'Statistics.period.24h', defaultMessage: 'Últimas 24h' },
    { value: '7d',  labelId: 'Statistics.period.7d', defaultMessage: 'Últimos 7 días' },
    { value: '30d', labelId: 'Statistics.period.30d', defaultMessage: 'Últimos 30 días' },
    { value: '90d', labelId: 'Statistics.period.90d', defaultMessage: 'Últimos 90 días' }
];

function PeriodFilter({ value, onChange }) {
    return (
        <div className="sc-period-filter">
            <span className="sc-period-filter__label">
                <Message msgId="Statistics.periodLabel" defaultMessage="Período:" />
            </span>
            <div className="sc-period-filter__buttons">
                {PERIODS.map(p => (
                    <button
                        key={p.value}
                        className={`sc-period-filter__btn${value === p.value ? ' sc-period-filter__btn--active' : ''}`}
                        onClick={() => onChange(p.value)}
                        type="button"
                    >
                        <Message msgId={p.labelId} defaultMessage={p.defaultMessage} />
                    </button>
                ))}
            </div>
        </div>
    );
}

PeriodFilter.propTypes = {
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired
};

export default PeriodFilter;
