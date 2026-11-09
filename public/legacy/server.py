"""Tiny local server for MediChannel. Run:  python server.py  ->  http://localhost:8000
Serves the static files. Any /api/* call returns 404, which makes the app
fall back to its built-in demo login (see DEMO_USERS in js/app.js)."""
import http.server, socketserver, os, sys
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
os.chdir(os.path.dirname(os.path.abspath(__file__)))
class H(http.server.SimpleHTTPRequestHandler):
    def do_POST(self): self.send_error(404)
    def do_GET(self):
        if self.path.startswith('/api/'): return self.send_error(404)
        super().do_GET()
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', PORT), H) as d:
    print(f'MediChannel running at http://localhost:{PORT}  (Ctrl+C to stop)')
    d.serve_forever()
