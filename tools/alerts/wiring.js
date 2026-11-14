#!/usr/bin/env node
/**
 * Answers "what in Mix It Up and OBS touches X?" and "which MIU calls can
 * post to Twitch chat?" from a staged copy of AJ's MIU settings and OBS
 * scene collection, read-only. Built by the Alerts and integrations expert
 * (2026-11-07 audit): it replaced hand-written greps and Python over
 * Archive_1.json and a stale MIU export, done twice in its first week.
 *
 * Usage:
 *   npm run alerts:wiring -- find <term> --miu=<db3|dir|json> [--obs=<Archive_1.json>]
 *   npm run alerts:wiring -- chat --miu=<db3|dir|json>
 *
 * --miu takes the MIU settings database (%LOCALAPPDATA%\MixItUp\Settings\
 * <id>.db3, staged from Defiant), a folder of command JSON files, or one.
 * `chat` lists every command with a Chat action and every call to it, with
 * its arguments: the Toasts alerts post their headline unless the second
 * argument is `1` (docs/roles/alerts.md, Safety rule 1), so calls without
 * `|1` are flagged. Never fire a flagged command to test.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Short type name of an MIU model: "MixItUp.Base.Model.Actions.ChatActionModel, MixItUp.Base" -> "Chat".
 * @param {Object} node - MIU action or command object
 * @returns {string} short type name
 */
export function miuType(node) {
    const full = String(node?.$type ?? '').split(',')[0];
    return full.split('.').pop().replace(/(Action|Command)?Model$/, '');
}

/**
 * Every action in a command, nested ones (conditionals, groups) included,
 * with the path of parents above it.
 * @param {Array<Object>} actions - a command's Actions
 * @param {Array<string>} [path] - parent type names
 * @returns {Array<{action: Object, path: Array<string>}>} flat list
 */
export function walkActions(actions, path = []) {
    const out = [];
    for (const action of actions ?? []) {
        out.push({ action, path });
        for (const key of ['Actions', 'SubActions']) {
            if (Array.isArray(action[key])) {
                out.push(...walkActions(action[key], [...path, miuType(action)]));
            }
        }
    }
    return out;
}

/**
 * True when a call's arguments carry the no-chat flag: a second
 * `|`-delimited argument of `1` (MIU's $argdelimited2text).
 * @param {string} args - CommandAction Arguments
 * @returns {boolean} whether the call passes `|1`
 */
export function passesNoChatFlag(args) {
    const parts = String(args ?? '').split('|');
    return parts.length > 1 && parts[1].trim() === '1';
}

/**
 * Commands that post to chat, and every call to them. A call is safe only
 * when its target's chat actions all sit inside a conditional (the `|1`
 * guard) and the call passes `|1`; `|1` does nothing for a target that
 * posts unconditionally (code review on #163). A command that makes an
 * unsafe call posts too, so callers are followed to any depth.
 * @param {Array<Object>} commands - parsed MIU command objects
 * @returns {{posters: Array<Object>, calls: Array<Object>}} report rows
 */
export function chatReport(commands) {
    const byId = new Map(commands.map(c => [c.ID, c]));
    const posters = new Map();
    for (const c of commands) {
        const chats = walkActions(c.Actions).filter(({ action }) => miuType(action) === 'Chat');
        if (!chats.length) continue;
        posters.set(c.ID, {
            name: c.Name,
            id: c.ID,
            enabled: c.IsEnabled !== false,
            guarded: chats.every(({ path }) => path.includes('Conditional')),
            texts: chats.map(({ action }) => action.ChatText),
            via: null,
        });
    }
    const callsTo = target => {
        const out = [];
        for (const c of commands) {
            for (const { action } of walkActions(c.Actions)) {
                if (miuType(action) !== 'Command' || action.CommandID !== target.id) continue;
                const noChatFlag = passesNoChatFlag(action.Arguments);
                out.push({
                    caller: c.Name,
                    callerId: c.ID,
                    callerEnabled: c.IsEnabled !== false,
                    target: target.name,
                    args: action.Arguments ?? '',
                    noChatFlag,
                    targetGuarded: target.guarded,
                    safe: target.guarded && noChatFlag,
                    actionEnabled: action.Enabled !== false,
                });
            }
        }
        return out;
    };
    // Follow unsafe calls upward until nothing changes: a caller of an
    // unsafe call becomes a poster, or loses its guard if it already was one
    // (its own chat may be guarded, but the call it makes is not).
    let changed = true;
    while (changed) {
        changed = false;
        for (const target of [...posters.values()]) {
            for (const call of callsTo(target)) {
                if (call.safe) continue;
                const known = posters.get(call.callerId);
                if (known && !known.guarded) continue;
                if (known) {
                    known.guarded = false;
                    known.via = target.name;
                } else {
                    const caller = byId.get(call.callerId);
                    posters.set(caller.ID, {
                        name: caller.Name, id: caller.ID, enabled: caller.IsEnabled !== false,
                        guarded: false, texts: [], via: target.name,
                    });
                }
                changed = true;
            }
        }
    }
    const calls = [...posters.values()].flatMap(callsTo);
    return { posters: [...posters.values()], calls };
}

/**
 * MIU actions whose fields mention a term (case-insensitive).
 * @param {Array<Object>} commands - parsed MIU command objects
 * @param {string} term - text to look for
 * @returns {Array<Object>} rows: command, action type, matching fields
 */
export function findInMiu(commands, term) {
    const needle = term.toLowerCase();
    const rows = [];
    for (const c of commands) {
        for (const { action, path } of walkActions(c.Actions)) {
            const fields = {};
            for (const [key, value] of Object.entries(action)) {
                if (key === 'Actions' || key === '$type' || value === null || typeof value === 'object') continue;
                if (String(value).toLowerCase().includes(needle)) fields[key] = value;
            }
            if (Object.keys(fields).length) {
                rows.push({
                    command: c.Name,
                    group: c.GroupName ?? '',
                    enabled: c.IsEnabled !== false && action.Enabled !== false,
                    type: miuType(action),
                    obsActionType: action.ActionType,
                    item: action.ItemName ?? action.SceneName ?? '',
                    parent: action.ParentName ?? '',
                    path: path.join(' > '),
                    fields,
                });
            }
        }
    }
    return rows;
}

/**
 * OBS sources, transitions and per-scene transition overrides that mention
 * a term in their name or settings.
 * @param {Object} collection - parsed OBS scene collection (Archive_1.json)
 * @param {string} term - text to look for
 * @returns {{sources: Array<Object>, transitions: Array<Object>, overrides: Array<Object>}} matches
 */
export function findInObs(collection, term) {
    const needle = term.toLowerCase();
    // Match values only: every scene's items carry keys like
    // "show_transition", which would match half the collection.
    const hit = value => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'object') return Object.values(value).some(hit);
        return String(value).toLowerCase().includes(needle);
    };
    const sources = (collection.sources ?? [])
        .filter(s => hit(s.name) || hit(s.settings) || (s.filters ?? []).some(f => hit(f.name) || hit(f.settings)))
        .map(s => ({
            name: s.name,
            kind: s.id,
            url: s.settings?.url,
            filters: (s.filters ?? []).filter(f => hit(f.name) || hit(f.settings)).map(f => f.name),
        }));
    const transitions = (collection.transitions ?? [])
        .filter(t => hit(t.name) || hit(t.id) || hit(t.settings))
        .map(t => ({ name: t.name, kind: t.id, current: t.name === collection.current_transition, settings: t.settings }));
    // A scene override counts when it names a matching transition, or names
    // the term itself.
    const names = new Set(transitions.map(t => t.name));
    const overrides = (collection.sources ?? [])
        .filter(s => s.id === 'scene' && s.private_settings?.transition)
        .filter(s => names.has(s.private_settings.transition) || hit(s.private_settings.transition))
        .map(s => ({ scene: s.name, transition: s.private_settings.transition, durationMs: s.private_settings.transition_duration }));
    return { sources, transitions, overrides };
}

/**
 * Pull MIU command objects out of any JSON text cell (a db3 row, a file).
 * @param {string} text - JSON text
 * @returns {Array<Object>} commands found (objects with ID, Name, Actions)
 */
export function commandsFromJson(text) {
    let value;
    try { value = JSON.parse(text); } catch { return []; }
    const list = Array.isArray(value) ? value : [value];
    return list.filter(v => v && typeof v === 'object' && v.ID && Array.isArray(v.Actions));
}

async function loadMiu(path) {
    if (statSync(path).isDirectory()) {
        return readdirSync(path)
            .filter(f => f.endsWith('.json'))
            .flatMap(f => commandsFromJson(readFileSync(join(path, f), 'utf8')));
    }
    if (path.endsWith('.json')) return commandsFromJson(readFileSync(path, 'utf8'));
    // An MIU .db3: read every text cell of the Commands table and keep the
    // ones that parse as commands, so a schema change doesn't break us.
    const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
    const db = new DatabaseSync(path, { readOnly: true });
    const rows = db.prepare('SELECT * FROM Commands').all();
    db.close();
    const byId = new Map();
    for (const row of rows) {
        for (const cell of Object.values(row)) {
            if (typeof cell !== 'string' || !cell.includes('"Actions"')) continue;
            for (const c of commandsFromJson(cell)) byId.set(c.ID, c);
        }
    }
    return [...byId.values()];
}

function parseArgs(argv) {
    const opts = {};
    const rest = [];
    for (const arg of argv) {
        const m = arg.match(/^--([^=]+)=(.*)$/);
        if (m) opts[m[1]] = m[2];
        else rest.push(arg);
    }
    return { mode: rest[0], term: rest.slice(1).join(' '), opts };
}

async function main() {
    const { mode, term, opts } = parseArgs(process.argv.slice(2));
    if (!['find', 'chat'].includes(mode) || (mode === 'find' && !term) || (!opts.miu && !opts.obs) || (mode === 'chat' && !opts.miu)) {
        console.error('Usage: npm run alerts:wiring -- find <term> --miu=<db3|dir|json> [--obs=<Archive_1.json>]');
        console.error('       npm run alerts:wiring -- chat --miu=<db3|dir|json>');
        process.exit(2);
    }
    const commands = opts.miu ? await loadMiu(opts.miu) : [];
    if (opts.miu) console.log(`MIU: ${commands.length} commands from ${opts.miu}`);

    if (mode === 'chat') {
        const { posters, calls } = chatReport(commands);
        console.log('\nCommands with a Chat action:');
        for (const p of posters) {
            const how = p.via ? `posts through ${p.via}` : p.guarded ? 'inside a conditional (|1 skips it)' : 'ALWAYS posts';
            console.log(`  ${p.name}${p.enabled ? '' : ' [disabled]'}: ${how}${p.texts.length ? `; text ${p.texts.join(' / ')}` : ''}`);
        }
        console.log('\nCalls to them. "ok" means this call stays off chat; firing its caller');
        console.log('can still post if the caller is listed above:');
        const posterIds = new Set(posters.map(p => p.id));
        const label = c => c.safe
            ? (posterIds.has(c.callerId) ? 'ok, caller posts' : 'ok            ')
            : c.targetGuarded ? 'POSTS (no |1) ' : 'POSTS (always)';
        for (const c of calls.sort((a, b) => Number(a.safe) - Number(b.safe))) {
            const off = !c.callerEnabled || !c.actionEnabled ? ' [disabled]' : '';
            console.log(`  ${label(c)} ${c.caller} -> ${c.target}${off}: ${c.args}`);
        }
        return;
    }

    const miuRows = findInMiu(commands, term);
    if (opts.miu) {
        console.log(`\nMIU actions mentioning "${term}": ${miuRows.length}`);
        for (const r of miuRows) {
            const where = r.item ? ` item "${r.item}"${r.parent ? ` in "${r.parent}"` : ''}` : '';
            console.log(`  ${r.command} [${r.group}]${r.enabled ? '' : ' [disabled]'}: ${r.type}${r.obsActionType !== undefined ? ` (ActionType ${r.obsActionType})` : ''}${where}${r.path ? ` under ${r.path}` : ''}`);
            for (const [k, v] of Object.entries(r.fields)) console.log(`      ${k}: ${v}`);
        }
    }
    if (opts.obs) {
        const obs = findInObs(JSON.parse(readFileSync(opts.obs, 'utf8')), term);
        console.log(`\nOBS (${opts.obs}):`);
        for (const s of obs.sources) console.log(`  source "${s.name}" (${s.kind})${s.url ? ` url ${s.url}` : ''}${s.filters.length ? ` filters: ${s.filters.join(', ')}` : ''}`);
        for (const t of obs.transitions) console.log(`  transition "${t.name}" (${t.kind})${t.current ? ' [current]' : ''} ${JSON.stringify(t.settings)}`);
        for (const o of obs.overrides) console.log(`  scene "${o.scene}" overrides its transition to "${o.transition}" (${o.durationMs} ms)`);
        if (!obs.sources.length && !obs.transitions.length && !obs.overrides.length) console.log('  nothing');
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(err => { console.error(err.message); process.exit(1); });
}
