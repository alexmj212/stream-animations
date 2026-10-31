"""obs-websocket bridge for tools/obs/restart.js when it runs in WSL.

WSL (NAT mode) can't reach Windows OBS on 127.0.0.1, and the Hyper-V firewall
drops the WSL host address (Defiant, 2026-10-31). Windows Python can, with
obsws_python (the library Defiant's obs-ops skill already uses). Run with
Windows Python; the first stdin line is the password (never argv), then one
JSON request per line: {"id", "type", "data"}. Each answer is one JSON line:
{"id", "data"} or {"id", "error"}. id 0 reports the connection.
"""
import json
import sys

import obsws_python as obs


def out(msg):
    print(json.dumps(msg), flush=True)


def main():
    host, port = sys.argv[1], int(sys.argv[2])
    password = sys.stdin.readline().rstrip("\r\n")
    try:
        client = obs.ReqClient(host=host, port=port, password=password, timeout=20)
    except Exception as e:  # noqa: BLE001 - report any connect failure
        out({"id": 0, "error": str(e)})
        return 1
    out({"id": 0, "data": {}})
    for line in sys.stdin:
        if not line.strip():
            continue
        req = json.loads(line)
        try:
            data = client.send(req["type"], req.get("data") or None, raw=True)
            out({"id": req["id"], "data": data or {}})
        except Exception as e:  # noqa: BLE001 - pass OBS errors back to Node
            out({"id": req["id"], "error": str(e)})
    return 0


if __name__ == "__main__":
    sys.exit(main())
