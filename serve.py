"""Local preview server that never lets the browser cache, so edits show on a normal reload.

    python serve.py          # http://localhost:5174
    python serve.py 8000     # another port
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5174


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    handler = partial(NoCacheHandler, directory=str(Path(__file__).parent))
    print(f"Serving on http://localhost:{PORT}")
    ThreadingHTTPServer(("", PORT), handler).serve_forever()
