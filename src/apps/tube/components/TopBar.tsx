import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import classNames from 'classnames';
import React, { type FC, type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { logout } from 'utils/session';

import { useCurrentUser, useSearchSuggestions, useServerName } from '../api';
import { useDebounced, useDismiss, isTyping } from '../hooks';
import Icon from '../icons';
import { itemLink } from '../utils';

const SearchBox: FC = () => {
    const navigate = useNavigate();
    const [ params ] = useSearchParams();
    const [ term, setTerm ] = useState(params.get('q') ?? '');
    const [ open, setOpen ] = useState(false);
    const [ active, setActive ] = useState(-1);
    const boxRef = useRef<HTMLFormElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { data: suggestions = [] } = useSearchSuggestions(useDebounced(term, 200));
    const q = params.get('q') ?? '';

    // Mirror the URL: keep the query on the results page, clear it everywhere else
    useEffect(() => setTerm(q), [ q ]);

    const close = useCallback(() => setOpen(false), []);
    useDismiss(boxRef, open, close);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === '/' && !isTyping(e)) {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const picked = suggestions[active];
        setOpen(false);
        inputRef.current?.blur();
        if (picked) {
            navigate(itemLink(picked));
        } else if (term.trim()) {
            navigate(`/results?q=${encodeURIComponent(term.trim())}`);
        }
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive(i => Math.min(i + 1, suggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive(i => Math.max(i - 1, -1));
        }
    };

    return (
        <form ref={boxRef} className='tb-search' role='search' onSubmit={submit}>
            <div className='tb-search__field'>
                <input
                    ref={inputRef}
                    value={term}
                    placeholder={globalize.translate('Search')}
                    aria-label={globalize.translate('Search')}
                    autoComplete='off'
                    onChange={e => {
                        setTerm(e.target.value);
                        setActive(-1);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={onKeyDown}
                />
                {term && (
                    <button type='button' className='tb-search__btn' aria-label='Clear' onClick={() => {
                        setTerm('');
                        inputRef.current?.focus();
                    }}>
                        <Icon name='close' />
                    </button>
                )}
                <button type='submit' className='tb-search__btn' aria-label={globalize.translate('Search')}>
                    <Icon name='search' />
                </button>
            </div>
            {open && term.trim().length > 1 && suggestions.length > 0 && (
                <ul className='tb-search__suggestions' role='listbox'>
                    {suggestions.map((item, i) => (
                        <li key={item.Id} role='option' aria-selected={i === active}>
                            <Link
                                to={itemLink(item)}
                                className={classNames('tb-suggestion', { 'is-active': i === active })}
                                onClick={() => setOpen(false)}
                            >
                                <Icon name='search' />
                                <span>{item.Name}</span>
                                {item.SeriesName && <span className='tb-muted'>{item.SeriesName}</span>}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </form>
    );
};

const UserMenu: FC = () => {
    const { api } = useApi();
    const { data: user } = useCurrentUser();
    const [ open, setOpen ] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const close = useCallback(() => setOpen(false), []);
    useDismiss(ref, open, close);

    const avatar = api && user?.PrimaryImageTag ?
        getImageApi(api).getUserImageUrl(user, { maxWidth: 64 }) :
        undefined;

    return (
        <div ref={ref} className='tb-menu-anchor'>
            <button className='tb-avatar-btn' aria-haspopup='menu' aria-expanded={open} onClick={() => setOpen(o => !o)}>
                {avatar ? <img src={avatar} alt='' /> : <span>{user?.Name?.[0]?.toUpperCase()}</span>}
            </button>
            {open && (
                <div className='tb-menu' role='menu'>
                    <div className='tb-menu__header'>{user?.Name}</div>
                    <Link role='menuitem' className='tb-menu__item' to='/settings' onClick={close}>
                        <Icon name='gear' />{globalize.translate('Settings')}
                    </Link>
                    {user?.Policy?.IsAdministrator && (
                        <Link role='menuitem' className='tb-menu__item' to='/dashboard' onClick={close}>
                            <Icon name='dashboard' />{globalize.translate('TabDashboard')}
                        </Link>
                    )}
                    <hr />
                    <button role='menuitem' className='tb-menu__item' onClick={() => {
                        close();
                        logout();
                    }}>
                        <Icon name='logout' />{globalize.translate('ButtonSignOut')}
                    </button>
                </div>
            )}
        </div>
    );
};

type TopBarProps = { onMenuClick: () => void };

const TopBar: FC<TopBarProps> = ({ onMenuClick }) => {
    const serverName = useServerName();
    return (
        <header className='tb-topbar'>
            <div className='tb-topbar__start'>
                <button className='tb-icon-btn' aria-label='Menu' onClick={onMenuClick}>
                    <Icon name='menu' />
                </button>
                <Link to='/home' className='tb-logo' aria-label={globalize.translate('Home')}>
                    <span className='tb-logo__mark'><Icon name='play' filled /></span>
                    <span className='tb-logo__text'>{serverName}</span>
                </Link>
            </div>
            <SearchBox />
            <div className='tb-topbar__end'>
                <UserMenu />
            </div>
        </header>
    );
};

export default TopBar;
