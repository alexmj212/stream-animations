#!/usr/bin/env python3
"""Read-only inventory of the OBS setup for this repo's scenes.

Parses the active OBS scene collection file (no websocket, no password) and
prints the transitions, the browser/media sources that use stream-animations
or epcot, and the per-scene transition overrides. Never writes to OBS.

Usage: python3 tools/obs/inventory.py [--json] [--collection PATH]
"""
import argparse
import configparser
import glob
import json
import os
import re
import sys

KEYWORDS = re.compile(r"stream-animations|epcot", re.I)


def obs_dir():
    if os.name == "nt":
        return os.path.join(os.environ["APPDATA"], "obs-studio")
    # WSL: find the Windows user's APPDATA through /mnt/c
    hits = glob.glob("/mnt/c/Users/*/AppData/Roaming/obs-studio")
    if not hits:
        sys.exit("obs-studio config folder not found; pass --collection")
    return hits[0]


def active_collection(base):
    for name in ("user.ini", "global.ini"):
        ini = os.path.join(base, name)
        if not os.path.exists(ini):
            continue
        cp = configparser.ConfigParser(strict=False, interpolation=None)
        cp.read(ini, encoding="utf-8-sig")
        if cp.has_option("Basic", "SceneCollectionFile"):
            name = cp.get("Basic", "SceneCollectionFile")
            if not name.endswith(".json"):
                name += ".json"
            return os.path.join(base, "basic", "scenes", name)
    sys.exit("could not find the active scene collection; pass --collection")


def inventory(path):
    d = json.load(open(path, encoding="utf-8"))
    sources = d["sources"]
    parents = {}
    for s in sources:
        if s["id"] == "scene":
            for item in s["settings"].get("items", []):
                parents.setdefault(item["name"], []).append({"scene": s["name"], "visible": item.get("visible")})
    out = {
        "collection": path,
        "current_scene": d.get("current_scene"),
        "current_transition": d.get("current_transition"),
        "transition_duration": d.get("transition_duration"),
        "transitions": [{"name": t["name"], "id": t["id"], "settings": t.get("settings", {})} for t in d.get("transitions", [])],
        "sources": [],
        "scene_transition_overrides": {
            s["name"]: s["private_settings"]
            for s in sources
            if s["id"] == "scene" and s.get("private_settings", {}).get("transition")
        },
    }
    for s in sources:
        if s["id"] in ("browser_source", "ffmpeg_source", "vlc_source") and KEYWORDS.search(json.dumps(s.get("settings", {}))):
            st = s["settings"]
            out["sources"].append({
                "name": s["name"],
                "kind": s["id"],
                "target": st.get("url") or st.get("local_file"),
                "size": [st.get("width"), st.get("height")],
                "fps": st.get("fps") if st.get("fps_custom") else None,
                "shutdown_when_hidden": st.get("shutdown"),
                "refresh_when_active": st.get("restart_when_active"),
                "looping": st.get("looping"),
                "in_scenes": parents.get(s["name"], []),
            })
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--collection")
    a = ap.parse_args()
    inv = inventory(a.collection or active_collection(obs_dir()))
    if a.json:
        print(json.dumps(inv, indent=2))
        return
    print(f"Collection: {inv['collection']}")
    print(f"Current scene: {inv['current_scene']}  transition: {inv['current_transition']} ({inv['transition_duration']} ms)\n")
    print("Transitions:")
    for t in inv["transitions"]:
        st = t["settings"]
        extra = ""
        if t["id"] in ("browser_transition", "obs_stinger_transition"):
            point = st.get("transition_point_ms", st.get("transition_point"))
            extra = f"  duration={st.get('duration')} point={point} target={st.get('url') or st.get('path')}"
        print(f"  {t['name']} [{t['id']}]{extra}")
    print("\nSources using stream-animations / epcot:")
    for s in inv["sources"]:
        where = ", ".join(f"{p['scene']}{'' if p['visible'] else ' (hidden)'}" for p in s["in_scenes"]) or "no scene"
        print(f"  {s['name']} [{s['kind']}] in {where}\n    {s['target']}")
    print("\nPer-scene transition overrides:")
    for name, ps in inv["scene_transition_overrides"].items():
        print(f"  {name}: {ps['transition']} {ps.get('transition_duration')} ms")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
