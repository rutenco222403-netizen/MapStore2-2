/**
 * SensorSelector.jsx
 * Chips para seleccionar/deseleccionar sensores activos
 */

import React from 'react';
import PropTypes from 'prop-types';
import Message from '../../components/I18N/Message';

function SensorLabel({ id, name }) {
    return <Message msgId={`Statistics.sensor.${id}`} defaultMessage={name} />;
}

SensorLabel.propTypes = {
    id: PropTypes.string,
    name: PropTypes.string
};

function SensorSelector({ active, onChange, sensors }) {
    const list = sensors || [];

    function toggle(id) {
        if (active.includes(id)) {
            // No dejar deseleccionar el último
            if (active.length === 1) return;
            onChange(active.filter(s => s !== id));
        } else {
            onChange([...active, id]);
        }
    }

    return (
        <div className="sc-sensor-selector">
            <span className="sc-sensor-selector__label">
                <Message msgId="Statistics.sensorsLabel" defaultMessage="Sensores:" />
            </span>
            <div className="sc-sensor-selector__chips">
                {list.map(s => (
                    <button
                        key={s.id}
                        type="button"
                        className={`sc-chip${active.includes(s.id) ? ' sc-chip--active' : ''}`}
                        style={active.includes(s.id) ? {
                            borderColor: s.color,
                            color: s.color,
                            background: s.color + '18'
                        } : {}}
                        onClick={() => toggle(s.id)}
                    >
                        <span
                            className="sc-chip__dot"
                            style={{ background: active.includes(s.id) ? s.color : '#d1d5db' }}
                        />
                        <SensorLabel id={s.id} name={s.name} />
                    </button>
                ))}
            </div>
        </div>
    );
}

SensorSelector.propTypes = {
    active: PropTypes.arrayOf(PropTypes.string).isRequired,
    onChange: PropTypes.func.isRequired,
    sensors: PropTypes.array
};

export default SensorSelector;
