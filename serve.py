#!/usr/bin/env python3
"""Static server for local development: correct MIME types, no caching."""
import functools, http.server, mimetypes, socketserver, sys

mimetypes.add_type('application/manifest+json', '.webmanifest')
mimetypes.add_type('text/javascript', '.js')
mimetypes.add_type('text/css', '.css')

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Service-Worker-Allowed', '/')
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write('%s - %s\n' % (self.address_string(), fmt % args))

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('127.0.0.1', port), Handler) as httpd:
        print(f'Training OS on http://127.0.0.1:{port}')
        httpd.serve_forever()
