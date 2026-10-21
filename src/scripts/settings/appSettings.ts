/** Settings this browser keeps for the app, in localStorage. */
import Events from 'utils/events';
import { toBoolean } from 'utils/string';

class AppSettings {
    /** Whether to stay signed in, the "Remember me" choice on the sign-in page */
    enableAutoLogin(value?: boolean) {
        if (value !== undefined) this.set('enableAutoLogin', String(value));
        return toBoolean(this.get('enableAutoLogin'), true);
    }

    set(name: string, value: string) {
        const current = this.get(name);
        localStorage.setItem(name, value);
        if (current !== value) Events.trigger(this, 'change', [ name ]);
    }

    get(name: string) {
        return localStorage.getItem(name);
    }
}

export default new AppSettings();
