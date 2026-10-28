/**
 * Where the follower count comes from.
 *
 * - Mix It Up's Developer API (default): polls GET <api><counter>, the same
 *   counter MIU's own goal widget read. Local only, no tokens, so nothing
 *   secret ever reaches this public repo or the Pages URL. Backs off while
 *   MIU is closed.
 * - ?count=: seeds the bar at load. With ?source=url it is the only source,
 *   for a MIU command that sets the OBS browser-source URL instead.
 * - A `followers` window event with detail {count} (or {count, goal}):
 *   obs-browser's emit_event (obs-websocket vendor request) and the motion
 *   harness use it.
 * - localStorage keeps the last count, so a reload paints at once.
 */
import { parseCount, pollDelay } from '../shared/animations/followers.js';

export class FollowerSource {
    /**
     * @param {Object} options
     * @param {Object} options.config - config.followers.source
     * @param {'miu'|'url'} options.mode - ?source=
     * @param {string} [options.api] - ?api= override of the API base
     * @param {string} [options.counter] - ?counter= override
     * @param {AbortSignal} options.signal - lifecycle signal: stops polling
     * @param {Object} options.debug - createDebug('followers')
     * @param {(count: number, info: {via: string, goal?: number}) => void} options.onCount
     */
    constructor({ config, mode, api, counter, signal, debug, onCount }) {
        this.config = config;
        this.mode = mode;
        this.url = `${api || config.api}${encodeURIComponent(counter || config.counter)}`;
        this.signal = signal;
        this.debug = debug;
        this.onCount = onCount;
        this.failures = 0;
        this.timer = null;
        this.last = null;
        signal.addEventListener('abort', () => clearTimeout(this.timer));
    }

    /** Last stored count, or null. */
    stored() {
        try {
            return parseCount(window.localStorage.getItem(this.config.storageKey));
        } catch {
            return null;
        }
    }

    store(count) {
        try {
            window.localStorage.setItem(this.config.storageKey, String(count));
        } catch {
            // Private or blocked storage: the next poll repaints anyway
        }
    }

    /** Report a count when it changed. */
    emit(count, info) {
        if (count === null || count === this.last) return;
        this.last = count;
        this.store(count);
        this.debug.mark('count', { count, ...info });
        this.onCount(count, info);
    }

    start() {
        window.addEventListener('followers', (e) => {
            const d = e.detail ?? {};
            this.emit(parseCount(d.count ?? d), { via: 'event', goal: parseCount(d.goal) ?? undefined });
        }, { signal: this.signal });
        if (this.mode === 'miu') this.poll();
    }

    async poll() {
        if (this.signal.aborted) return;
        const timeout = new AbortController();
        const timer = setTimeout(() => timeout.abort(), this.config.timeoutMs);
        try {
            const res = await fetch(this.url, { cache: 'no-store', signal: timeout.signal });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const count = parseCount(await res.json());
            if (count === null) throw new Error('no count in response');
            if (this.failures > 0) this.debug.mark('pollRecovered', { after: this.failures });
            this.failures = 0;
            this.emit(count, { via: 'miu' });
        } catch (err) {
            this.failures++;
            // Log the first failure of a run, then every tenth, not each retry
            if (this.failures === 1 || this.failures % 10 === 0) {
                this.debug.mark('pollFailed', { failures: this.failures, error: String(err?.message ?? err) });
            }
        } finally {
            clearTimeout(timer);
        }
        if (this.signal.aborted) return;
        this.timer = setTimeout(() => this.poll(), pollDelay(this.failures, this.config.pollMs, this.config.maxBackoffMs));
    }
}
