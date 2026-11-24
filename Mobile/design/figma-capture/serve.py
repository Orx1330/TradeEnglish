import http.server, os, sys, urllib.parse
ROOT, OUT = sys.argv[1], sys.argv[2]
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(self, *a): pass
    def do_POST(self):
        name = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get('name', ['snap'])[0]
        name = ''.join(ch for ch in name if ch.isalnum() or ch in '-_')
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        open(os.path.join(OUT, name + '.html'), 'wb').write(body)
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')
http.server.ThreadingHTTPServer(('127.0.0.1', 8090), H).serve_forever()
