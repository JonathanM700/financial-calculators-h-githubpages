from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        print(self.address_string(), "-", format % args, flush=True)

if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8777), Handler)
    print("listening on 127.0.0.1:8777", flush=True)
    server.serve_forever()
