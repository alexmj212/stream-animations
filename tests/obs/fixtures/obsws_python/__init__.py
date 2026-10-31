"""Fake obsws_python for tests/obs/bridge.test.js."""


class ReqClient:
    def __init__(self, host, port, password, timeout):
        if password != "pw":
            raise ConnectionError("authentication failed")

    def send(self, param, data=None, raw=False):
        if param == "Boom":
            raise RuntimeError("request failed: Boom")
        return {"echo": param, "data": data}
