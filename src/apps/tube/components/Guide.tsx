import React, { type FC } from 'react';
import { NavLink } from 'react-router-dom';

import Icon, { type IconName } from '../icons';

export type GuideEntry = {
    to: string,
    icon: IconName,
    label: string,
    /** Active only on this exact path, not its children */
    end?: boolean,
    /** Overrides the router's match, for links that differ only in their query */
    active?: boolean
};

export type GuideSection = { title?: string, entries: GuideEntry[] };

type GuideProps = { label: string, sections: GuideSection[], collapsed?: boolean, onNavigate?: () => void };

/** The side menu: labelled rows when expanded, an icon rail when collapsed. */
const Guide: FC<GuideProps> = ({ label, sections, collapsed, onNavigate }) => (
    <nav className='tb-guide' aria-label={label}>
        {sections.filter(s => s.entries.length).map(section => (
            <div key={section.title ?? section.entries[0].to} className='tb-guide__section'>
                {section.title && <h3 className='tb-guide__title'>{section.title}</h3>}
                {section.entries.map(entry => (
                    <NavLink
                        key={entry.to}
                        to={entry.to}
                        end={entry.end}
                        className={({ isActive }) => ((entry.active ?? isActive) ? 'tb-guide__entry active' : 'tb-guide__entry')}
                        // The label is hidden in the rail, so it shows on hover there
                        title={collapsed ? entry.label : undefined}
                        aria-label={entry.label}
                        onClick={onNavigate}
                    >
                        <Icon name={entry.icon} />
                        <span className='tb-guide__label'>{entry.label}</span>
                    </NavLink>
                ))}
            </div>
        ))}
    </nav>
);

export default Guide;
