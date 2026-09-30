#!/usr/bin/env python3
"""Bundle Training OS into one self-contained index.html, plus a service worker.

The ES modules are wrapped one per IIFE and wired through a registry, so private
top-level names in different modules can never collide. No transpiling: the code
that ships is the code that was written and tested.
"""
import base64, io, json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
OUT = os.path.join(ROOT, 'docs')          # GitHub Pages serves /docs on main

IMPORT_RE = re.compile(r"^import\s*\{([^}]*)\}\s*from\s*'([^']+)';\s*$", re.M | re.S)
NS_IMPORT_RE = re.compile(r"^import\s+\*\s+as\s+([A-Za-z0-9_$]+)\s+from\s*'([^']+)';\s*$", re.M)
EXPORT_LIST_RE = re.compile(r"^export\s*\{([^}]*)\};\s*$", re.M | re.S)
EXPORT_DECL_RE = re.compile(r"^export\s+(function|const|class|let|var)\s+([A-Za-z0-9_$]+)", re.M)


def key_for(path):
    return os.path.relpath(path, SRC).replace(os.sep, '/')


def resolve(from_path, spec):
    return os.path.normpath(os.path.join(os.path.dirname(from_path), spec))


def read(path):
    return io.open(path, encoding='utf-8').read()


def collect(entry, seen=None, order=None):
    """Depth-first so every dependency is defined before the module that needs it."""
    seen = seen if seen is not None else set()
    order = order if order is not None else []
    if entry in seen:
        return order
    seen.add(entry)
    text = read(entry)
    specs = [spec for _, spec in IMPORT_RE.findall(text)]
    specs += [spec for _, spec in NS_IMPORT_RE.findall(text)]
    for spec in specs:
        if spec.startswith('.'):
            collect(resolve(entry, spec), seen, order)
    order.append(entry)
    return order


def transform(path):
    src = read(path)
    exports = set(EXPORT_DECL_RE.findall(src))
    exports = {name for _, name in EXPORT_DECL_RE.findall(src)}

    for names in EXPORT_LIST_RE.findall(src):
        for n in names.split(','):
            n = n.strip()
            if n:
                exports.add(n.split(' as ')[-1].strip())
    src = EXPORT_LIST_RE.sub('', src)

    def swap_import(m):
        names, spec = m.group(1), m.group(2)
        parts = []
        for n in names.split(','):
            n = n.strip()
            if not n:
                continue
            if ' as ' in n:
                a, b = [x.strip() for x in n.split(' as ')]
                parts.append('%s: %s' % (a, b))
            else:
                parts.append(n)
        return "const { %s } = __M['%s'];" % (', '.join(parts), key_for(resolve(path, spec)))

    src = IMPORT_RE.sub(swap_import, src)
    src = NS_IMPORT_RE.sub(
        lambda m: "const %s = __M['%s'];" % (m.group(1), key_for(resolve(path, m.group(2)))), src)
    src = re.sub(r"^export\s+(?=(function|const|class|let|var)\s)", '', src, flags=re.M)

    ret = 'return { %s };' % ', '.join(sorted(exports)) if exports else 'return {};'
    return "__M['%s'] = (function () {\n%s\n%s\n})();" % (key_for(path), src, ret)


def main():
    entry = os.path.join(SRC, 'app.js')
    modules = collect(entry)
    bundle = "(function () {\n'use strict';\nconst __M = {};\n%s\n})();" % '\n'.join(
        transform(m) for m in modules)

    # A missed module form would ship a broken file, so refuse to build one.
    stray = [ln for ln in bundle.split('\n') if re.match(r'^\s*(import|export)\s', ln)]
    if stray:
        sys.exit('unhandled module syntax:\n  ' + '\n  '.join(stray[:5]))

    css = '\n'.join(read(os.path.join(ROOT, 'styles', f)) for f in ('app.css', 'themes.css'))
    icon192 = base64.b64encode(open(os.path.join(ROOT, 'icons/icon-192.png'), 'rb').read()).decode()
    icon512 = base64.b64encode(open(os.path.join(ROOT, 'icons/icon-512.png'), 'rb').read()).decode()
    manifest = json.dumps({
        'name': 'Training OS', 'short_name': 'Training OS',
        'start_url': './', 'scope': './', 'display': 'standalone',
        'orientation': 'portrait', 'background_color': '#121315', 'theme_color': '#121315',
        'icons': [
            {'src': 'data:image/png;base64,' + icon192, 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any maskable'},
            {'src': 'data:image/png;base64,' + icon512, 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any maskable'},
        ],
    }, separators=(',', ':'))

    version = re.search(r"APP_VERSION = '([^']+)'", read(os.path.join(SRC, 'version.js'))).group(1)

    html = """<!doctype html>
<html lang="en" data-theme="analog">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">
<meta name="theme-color" content="#121315">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Training OS">
<meta name="description" content="Private strength and physique training log.">
<title>Training OS</title>
<link rel="manifest" href="data:application/manifest+json;base64,__MANIFEST__">
<link rel="apple-touch-icon" href="data:image/png;base64,__ICON192__">
<link rel="icon" href="data:image/png;base64,__ICON192__">
<style>
__CSS__
</style>
</head>
<body>
<div id="app" class="app">
  <header class="appbar" id="appbar"></header>
  <main class="screen" id="screen" tabindex="-1"></main>
  <nav class="tabbar" id="tabbar" aria-label="Sections"></nav>
</div>
<div id="workout-root"></div>
<div id="timer-root"></div>
<div id="sheet-root"></div>
<div id="toast-root" class="toast-root" role="status" aria-live="polite"></div>
<noscript><p style="padding:16px">Training OS needs JavaScript.</p></noscript>
<script>
__BUNDLE__
</script>
</body>
</html>
"""
    html = (html
            .replace('__MANIFEST__', base64.b64encode(manifest.encode()).decode())
            .replace('__ICON192__', icon192)
            .replace('__CSS__', css)
            .replace('__BUNDLE__', bundle))

    sw = """// Offline cache for Training OS. The whole app is one file, so this is short.
const VERSION = 'training-os-%s';
const SHELL = ['./', './index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Cache first so it opens instantly with no connection, with a quiet background
// refresh so a new build is picked up on the next launch.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) {
      fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); }).catch(() => {});
      return hit;
    }
    try {
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      return (await cache.match('./index.html')) || new Response('Offline', { status: 503 });
    }
  })());
});
""" % version

    os.makedirs(OUT, exist_ok=True)
    io.open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(html)
    io.open(os.path.join(OUT, 'sw.js'), 'w', encoding='utf-8').write(sw)
    io.open(os.path.join(OUT, '.nojekyll'), 'w').write('')
    print('index.html  %6.1f KB' % (len(html.encode()) / 1024))
    print('sw.js       %6.1f KB' % (len(sw.encode()) / 1024))
    print('modules bundled:', len(modules))


if __name__ == '__main__':
    main()
