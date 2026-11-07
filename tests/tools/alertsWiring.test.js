import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
    miuType, walkActions, passesNoChatFlag, chatReport, findInMiu, findInObs, commandsFromJson,
} from '../../tools/alerts/wiring.js';

const T = name => `MixItUp.Base.Model.Actions.${name}ActionModel, MixItUp.Base`;

// Shaped like the MIU 1.8 Commands JSON read from Defiant on 2026-10-28.
const sidescreen = {
    ID: 'side', Name: 'Sidescreen Alert', GroupName: 'Toasts', IsEnabled: true,
    Actions: [
        { $type: T('StreamingSoftware'), ActionType: 3, ItemName: 'Sidescreen Source', ParentName: null, Url: 'https://x/sidebar/?text=$argdelimited1text' },
        { $type: T('Conditional'), Actions: [{ $type: T('Chat'), ChatText: '$argdelimited1text' }] },
    ],
};
const shoutout = {
    ID: 'so', Name: 'Shoutout', IsEnabled: true,
    Actions: [
        { $type: T('Chat'), ChatText: 'Check out @$targetusername' },
        { $type: T('Command'), CommandID: 'side', Arguments: 'Check out @$targetusername|1' },
    ],
};
const resub = {
    ID: 'rs', Name: 'Twitch Channel Resubscribed', IsEnabled: true,
    Actions: [{ $type: T('Command'), CommandID: 'side', Arguments: '@$username resubbed!' }],
};
const couch = {
    ID: 'cc', Name: 'Couch Color', GroupName: 'PNG States', IsEnabled: true,
    Actions: [{ $type: T('StreamingSoftware'), ActionType: 3, ItemName: 'Scene Transition Source', Url: 'https://x/stinger/?color=$themecolor' }],
};
const commands = [sidescreen, shoutout, resub, couch];

describe('alerts wiring', () => {
    it('names MIU types', () => {
        expect(miuType({ $type: T('Chat') })).toBe('Chat');
        expect(miuType({ $type: 'MixItUp.Base.Model.Commands.EventCommandModel, MixItUp.Base' })).toBe('Event');
    });

    it('walks nested actions with their parents', () => {
        const flat = walkActions(sidescreen.Actions);
        expect(flat).toHaveLength(3);
        expect(flat[2].path).toEqual(['Conditional']);
    });

    it('reads the |1 no-chat flag', () => {
        expect(passesNoChatFlag('$hugtext|1')).toBe(true);
        expect(passesNoChatFlag('$hugtext| 1 ')).toBe(true);
        expect(passesNoChatFlag('@$username resubbed!')).toBe(false);
        expect(passesNoChatFlag('a|0')).toBe(false);
        expect(passesNoChatFlag(undefined)).toBe(false);
    });

    it('flags calls to chat-posting commands without |1', () => {
        const { posters, calls } = chatReport(commands);
        expect(posters.map(p => [p.name, p.guarded, p.via])).toEqual([
            ['Sidescreen Alert', true, null], ['Shoutout', false, null], ['Twitch Channel Resubscribed', false, 'Sidescreen Alert'],
        ]);
        const flagged = calls.filter(c => !c.safe).map(c => c.caller);
        expect(flagged).toEqual(['Twitch Channel Resubscribed']);
    });

    it('treats |1 as safe only when the target guards its chat', () => {
        const always = { ID: 'al', Name: 'Always', IsEnabled: true, Actions: [{ $type: T('Chat'), ChatText: 'hi' }] };
        const caller = { ID: 'ca', Name: 'Caller', IsEnabled: true, Actions: [{ $type: T('Command'), CommandID: 'al', Arguments: '$user|1' }] };
        const grand = { ID: 'gr', Name: 'Grand', IsEnabled: true, Actions: [{ $type: T('Command'), CommandID: 'ca', Arguments: '' }] };
        const { posters, calls } = chatReport([always, caller, grand, sidescreen, shoutout]);
        const byCaller = Object.fromEntries(calls.map(c => [`${c.caller}->${c.target}`, c.safe]));
        expect(byCaller['Caller->Always']).toBe(false);
        expect(byCaller['Grand->Caller']).toBe(false);
        expect(byCaller['Shoutout->Sidescreen Alert']).toBe(true);
        expect(posters.find(p => p.name === 'Grand').via).toBe('Caller');
    });

    it('finds MIU actions by any field', () => {
        const rows = findInMiu(commands, 'stinger');
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ command: 'Couch Color', item: 'Scene Transition Source', obsActionType: 3 });
    });

    it('finds OBS transitions and the scenes that override to them, ignoring keys', () => {
        const collection = {
            current_transition: 'Browser',
            transitions: [
                { name: 'Browser', id: 'browser_transition', settings: { url: 'https://x/stinger/?duration=1200' } },
                { name: 'Fade', id: 'fade_transition', settings: {} },
            ],
            sources: [
                { name: 'BRB', id: 'scene', settings: { items: [{ show_transition: { id: 'fade' } }] }, private_settings: { transition: 'Browser', transition_duration: 1200 } },
                { name: 'Price is Right', id: 'scene', settings: {}, private_settings: { transition: 'Fade' } },
            ],
        };
        const out = findInObs(collection, 'stinger');
        expect(out.transitions.map(t => [t.name, t.current])).toEqual([['Browser', true]]);
        expect(out.overrides).toEqual([{ scene: 'BRB', transition: 'Browser', durationMs: 1200 }]);
        expect(findInObs(collection, 'transition').sources).toEqual([]);
    });

    it('ignores JSON that is not a command', () => {
        expect(commandsFromJson('not json')).toEqual([]);
        expect(commandsFromJson('{"ID":"x"}')).toEqual([]);
        expect(commandsFromJson(JSON.stringify(resub))).toHaveLength(1);
    });

    it('reads commands from a db3 Commands table', async () => {
        const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
        const dir = mkdtempSync(join(tmpdir(), 'miu-'));
        try {
            const file = join(dir, 'settings.db3');
            const db = new DatabaseSync(file);
            db.exec('CREATE TABLE Commands (ID TEXT, TypeID INTEGER, Data TEXT)');
            const insert = db.prepare('INSERT INTO Commands VALUES (?, ?, ?)');
            for (const c of commands) insert.run(c.ID, 1, JSON.stringify(c));
            db.close();
            const out = execFileSync(process.execPath, ['tools/alerts/wiring.js', 'chat', `--miu=${file}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
            expect(out).toContain('MIU: 4 commands');
            expect(out).toMatch(/POSTS \(no \|1\) +Twitch Channel Resubscribed -> Sidescreen Alert/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
