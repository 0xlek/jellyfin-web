import classNames from 'classnames';
import React from 'react';

export type Chip<T extends string> = { id: T, label: string };

type ChipsProps<T extends string> = {
    chips: Chip<T>[]
    value: T
    onChange: (id: T) => void
};

const Chips = <T extends string>({ chips, value, onChange }: ChipsProps<T>) => (
    <div className='tb-chips' role='tablist'>
        {chips.map(chip => (
            <button
                key={chip.id}
                role='tab'
                aria-selected={chip.id === value}
                className={classNames('tb-chip', { 'is-active': chip.id === value })}
                onClick={() => onChange(chip.id)}
            >
                {chip.label}
            </button>
        ))}
    </div>
);

export default Chips;
