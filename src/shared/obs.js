/**
 * Minimal obs-websocket v5 client for pages that run inside OBS (browser
 * docks). No dependency: Hello/Identify with the SHA-256 auth from the
 * protocol, requests as promises, events as callbacks.
 *
 * Protocol: https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md
 */

const OP = { HELLO: 0, IDENTIFY: 1, IDENTIFIED: 2, EVENT: 5, REQUEST: 6, RESPONSE: 7 };

/** Event subscription bits (EventSubscription in the protocol). */
export const EVENTS = {
    GENERAL: 1 << 0,
    CONFIG: 1 << 1,
    SCENES: 1 << 2,
    INPUTS: 1 << 3,
    SCENE_ITEMS: 1 << 7,
    ALL: 0x7ff,                   // every low-volume event
    INPUT_VOLUME_METERS: 1 << 16  // high volume: 20 per second
};

function base64(bytes) {
    let s = '';
    for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
    return btoa(s);
}

async function sha256Base64(text, subtle) {
    return base64(await subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

/**
 * The Identify `authentication` string:
 * base64(sha256(base64(sha256(password + salt)) + challenge)).
 * @param {string} password
 * @param {string} salt - from Hello
 * @param {string} challenge - from Hello
 * @param {SubtleCrypto} [subtle]
 * @returns {Promise<string>}
 */
export async function authString(password, salt, challenge, subtle = globalThis.crypto.subtle) {
    const secret = await sha256Base64(password + salt, subtle);
    return sha256Base64(secret + challenge, subtle);
}

/**
 * One connection to obs-websocket.
 *
 *   const obs = new ObsSocket({ url, password, events: EVENTS.ALL });
 *   obs.on('open', ...); obs.on('event', ({ eventType, eventData }) => ...);
 *   await obs.connect();
 *   const { scenes } = await obs.call('GetSceneList');
 */
export class ObsSocket {
    /**
     * @param {Object} opts
     * @param {string} opts.url - e.g. ws://127.0.0.1:4455
     * @param {string} [opts.password]
     * @param {number} [opts.events] - EventSubscription bits
     * @param {typeof WebSocket} [opts.WebSocketImpl] - for tests
     */
    constructor({ url, password = '', events = EVENTS.ALL, WebSocketImpl = globalThis.WebSocket }) {
        this.url = url;
        this.password = password;
        this.events = events;
        this.WebSocketImpl = WebSocketImpl;
        this.ws = null;
        this.ready = false;
        this.nextId = 1;
        this.pending = new Map();
        this.listeners = new Map();
    }

    /** @param {'open'|'close'|'event'|'error'} name @param {Function} fn */
    on(name, fn) {
        if (!this.listeners.has(name)) this.listeners.set(name, []);
        this.listeners.get(name).push(fn);
    }

    emit(name, data) {
        for (const fn of this.listeners.get(name) || []) fn(data);
    }

    /** Resolves once identified; rejects on close or a bad password. */
    connect() {
        return new Promise((resolve, reject) => {
            const ws = new this.WebSocketImpl(this.url);
            this.ws = ws;
            ws.onmessage = async (msg) => {
                const { op, d } = JSON.parse(msg.data);
                if (op === OP.HELLO) {
                    const identify = { rpcVersion: 1, eventSubscriptions: this.events };
                    if (d.authentication) {
                        identify.authentication = await authString(
                            this.password, d.authentication.salt, d.authentication.challenge);
                    }
                    ws.send(JSON.stringify({ op: OP.IDENTIFY, d: identify }));
                } else if (op === OP.IDENTIFIED) {
                    this.ready = true;
                    this.emit('open', d);
                    resolve(d);
                } else if (op === OP.EVENT) {
                    this.emit('event', d);
                } else if (op === OP.RESPONSE) {
                    const p = this.pending.get(d.requestId);
                    if (!p) return;
                    this.pending.delete(d.requestId);
                    if (d.requestStatus.result) p.resolve(d.responseData || {});
                    else p.reject(new Error(`${d.requestType}: ${d.requestStatus.comment || d.requestStatus.code}`));
                }
            };
            ws.onclose = (e) => {
                const wasReady = this.ready;
                this.ready = false;
                for (const p of this.pending.values()) p.reject(new Error('obs-websocket closed'));
                this.pending.clear();
                // 4009: authentication failed
                const reason = e.code === 4009 ? 'wrong password' : (e.reason || `closed (${e.code})`);
                this.emit('close', { code: e.code, reason, wasReady });
                if (!wasReady) reject(new Error(reason));
            };
            ws.onerror = () => this.emit('error', new Error('obs-websocket error'));
        });
    }

    /**
     * Send one request.
     * @param {string} requestType
     * @param {Object} [requestData]
     * @returns {Promise<Object>} responseData
     */
    call(requestType, requestData = {}) {
        if (!this.ready) return Promise.reject(new Error('not connected to OBS'));
        const requestId = String(this.nextId++);
        return new Promise((resolve, reject) => {
            this.pending.set(requestId, { resolve, reject });
            this.ws.send(JSON.stringify({ op: OP.REQUEST, d: { requestType, requestId, requestData } }));
        });
    }

    /** Change the event subscription without reconnecting. */
    resubscribe(events) {
        this.events = events;
        if (this.ready) this.ws.send(JSON.stringify({ op: 3, d: { eventSubscriptions: events } }));
    }

    close() {
        this.ws?.close();
    }
}
