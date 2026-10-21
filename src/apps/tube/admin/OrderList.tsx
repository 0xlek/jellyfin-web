import React, { type FC } from 'react';

import globalize from 'lib/globalize';

import Icon from '../icons';

export type OrderItem = { name: string, enabled: boolean };

/** Plugins sorted by a saved order; names missing from it keep their place at the front, as the server does. */
export const ordered = (names: string[], order: string[] | null | undefined) => {
    const ranks = order ?? [];
    return [ ...names ].sort((a, b) => ranks.indexOf(a) - ranks.indexOf(b));
};

type Props = { title: string, help?: string, items: OrderItem[], onChange: (items: OrderItem[]) => void, sortable?: boolean, checkable?: boolean };

/** Checkbox list whose order matters: earlier entries win. */
const OrderList: FC<Props> = ({ title, help, items, onChange, sortable = true, checkable = true }) => {
    if (!items.length) return null;

    const move = (from: number, to: number) => {
        const next = [ ...items ];
        const [ item ] = next.splice(from, 1);
        next.splice(to, 0, item);
        onChange(next);
    };

    return (
        <div className='tb-setting tb-setting--wide' style={{ alignItems: 'flex-start' }}>
            <div className='tb-setting__text'>
                <span className='tb-setting__label'>{title}</span>
                {help && <span className='tb-setting__help'>{help}</span>}
            </div>
            <div className='tb-setting__control tb-order'>
                {items.map((item, i) => (
                    <div key={item.name} className='tb-order__item'>
                        {checkable ? (
                            <label className='tb-check'>
                                <input type='checkbox' checked={item.enabled} onChange={e => onChange(items.map(x => (x.name === item.name ? { ...x, enabled: e.target.checked } : x)))} />
                                {item.name}
                            </label>
                        ) : <span>{item.name}</span>}
                        {sortable && items.length > 1 && (
                            <span>
                                <button type='button' className='tb-icon-btn' disabled={i === 0} onClick={() => move(i, i - 1)} title={globalize.translate('Up')}>
                                    <Icon name='chevronDown' style={{ transform: 'rotate(180deg)' }} />
                                </button>
                                <button type='button' className='tb-icon-btn' disabled={i === items.length - 1} onClick={() => move(i, i + 1)} title={globalize.translate('Down')}>
                                    <Icon name='chevronDown' />
                                </button>
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default OrderList;
