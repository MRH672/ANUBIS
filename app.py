#!/usr/bin/env python3
"""
ANUBIS - Vulnerable Lab
Local intentionally vulnerable web app for security training.
Contains: Reflected XSS, Stored XSS, XXE
WARNING: Run locally only. Never expose to a network.
"""

from flask import Flask, request, render_template_string, redirect, url_for
from lxml import etree

app = Flask(__name__)

# In-memory store for stored XSS demo
comments = []

# ─── TEMPLATES ────────────────────────────────────────────────────────────────

BASE = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ANUBIS VulnLab</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@400;600;700&display=swap');

    :root {
      --bg:       #0a0c10;
      --surface:  #111520;
      --border:   #1e2a40;
      --accent:   #00ffe0;
      --accent2:  #ff4c6a;
      --text:     #c8d8f0;
      --muted:    #4a5a78;
      --success:  #39ff88;
      --warn:     #ffb347;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Rajdhani', sans-serif;
      font-size: 17px;
      min-height: 100vh;
    }

    /* Scanline overlay */
    body::before {
      content: '';
      position: fixed; inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(0,255,224,.015) 2px,
        rgba(0,255,224,.015) 4px
      );
      pointer-events: none;
      z-index: 999;
    }

    header {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 18px 40px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    header .logo {
      font-family: 'Share Tech Mono', monospace;
      font-size: 22px;
      color: var(--accent);
      letter-spacing: 3px;
      text-shadow: 0 0 12px var(--accent);
    }
    header .badge {
      background: var(--accent2);
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2px;
      padding: 3px 10px;
      border-radius: 2px;
    }

    nav {
      background: #0d1018;
      border-bottom: 1px solid var(--border);
      padding: 0 40px;
      display: flex;
      gap: 4px;
    }
    nav a {
      color: var(--muted);
      text-decoration: none;
      padding: 14px 20px;
      font-size: 13px;
      letter-spacing: 1.5px;
      font-weight: 600;
      text-transform: uppercase;
      border-bottom: 2px solid transparent;
      transition: all .2s;
    }
    nav a:hover, nav a.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }

    main {
      max-width: 900px;
      margin: 40px auto;
      padding: 0 24px;
    }

    .page-title {
      font-size: 28px;
      font-weight: 700;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 3px;
      margin-bottom: 8px;
      text-shadow: 0 0 20px rgba(0,255,224,.3);
    }
    .page-sub {
      color: var(--muted);
      font-size: 14px;
      letter-spacing: 1px;
      margin-bottom: 32px;
      font-family: 'Share Tech Mono', monospace;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 28px;
      margin-bottom: 24px;
      position: relative;
      overflow: hidden;
    }
    .card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      background: linear-gradient(90deg, var(--accent), transparent);
    }
    .card.danger::before { background: linear-gradient(90deg, var(--accent2), transparent); }

    .card h2 {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .tag {
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 2px;
      letter-spacing: 1px;
      font-weight: 700;
    }
    .tag-xss  { background: rgba(255,76,106,.2);  color: var(--accent2); border: 1px solid var(--accent2); }
    .tag-xxe  { background: rgba(255,179,71,.2);  color: var(--warn);    border: 1px solid var(--warn); }
    .tag-info { background: rgba(0,255,224,.1);   color: var(--accent);  border: 1px solid var(--accent); }

    input[type=text], input[type=search], textarea {
      width: 100%;
      background: #0a0c10;
      border: 1px solid var(--border);
      border-radius: 3px;
      color: var(--text);
      font-family: 'Share Tech Mono', monospace;
      font-size: 14px;
      padding: 10px 14px;
      outline: none;
      transition: border-color .2s;
      margin-bottom: 12px;
    }
    input:focus, textarea:focus { border-color: var(--accent); }
    textarea { min-height: 100px; resize: vertical; }

    button, .btn {
      background: transparent;
      border: 1px solid var(--accent);
      color: var(--accent);
      font-family: 'Rajdhani', sans-serif;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      padding: 10px 28px;
      border-radius: 3px;
      cursor: pointer;
      transition: all .2s;
      text-decoration: none;
      display: inline-block;
    }
    button:hover, .btn:hover {
      background: var(--accent);
      color: var(--bg);
      box-shadow: 0 0 20px rgba(0,255,224,.3);
    }
    button.danger { border-color: var(--accent2); color: var(--accent2); }
    button.danger:hover { background: var(--accent2); color: #fff; box-shadow: 0 0 20px rgba(255,76,106,.3); }

    .result-box {
      background: #060810;
      border: 1px solid var(--border);
      border-left: 3px solid var(--accent);
      border-radius: 3px;
      padding: 14px 18px;
      margin-top: 16px;
      font-family: 'Share Tech Mono', monospace;
      font-size: 13px;
    }
    .result-box.danger { border-left-color: var(--accent2); }

    .hint {
      background: rgba(0,255,224,.05);
      border: 1px solid rgba(0,255,224,.15);
      border-radius: 3px;
      padding: 12px 16px;
      margin-top: 16px;
      font-family: 'Share Tech Mono', monospace;
      font-size: 12px;
      color: var(--accent);
    }
    .hint strong { color: var(--accent); display: block; margin-bottom: 4px; }

    .comment-list { margin-top: 16px; }
    .comment-item {
      background: #060810;
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 12px 16px;
      margin-bottom: 8px;
      font-family: 'Share Tech Mono', monospace;
      font-size: 13px;
    }
    .comment-item .author { color: var(--accent); font-weight: 700; margin-bottom: 4px; font-size: 11px; }

    .home-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .vuln-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 24px;
      text-decoration: none;
      color: var(--text);
      display: block;
      transition: all .25s;
      position: relative;
      overflow: hidden;
    }
    .vuln-card::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 2px;
    }
    .vuln-card.xss::before  { background: linear-gradient(90deg, var(--accent2), transparent); }
    .vuln-card.xxe::before  { background: linear-gradient(90deg, var(--warn), transparent); }
    .vuln-card:hover { border-color: var(--accent); transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,.4); }

    .vuln-card .vc-icon { font-size: 32px; margin-bottom: 12px; }
    .vuln-card .vc-title { font-size: 20px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px; }
    .vuln-card .vc-desc  { color: var(--muted); font-size: 14px; line-height: 1.5; }

    .severity {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1.5px;
      padding: 3px 10px;
      border-radius: 2px;
      margin-bottom: 10px;
    }
    .sev-high   { background: rgba(255,76,106,.15);  color: var(--accent2); }
    .sev-crit   { background: rgba(255,179,71,.15);  color: var(--warn); }

    code {
      background: #060810;
      border: 1px solid var(--border);
      border-radius: 2px;
      padding: 1px 6px;
      font-family: 'Share Tech Mono', monospace;
      font-size: 12px;
      color: var(--accent);
    }

    label {
      display: block;
      font-size: 12px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 6px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <header>
    <div class="logo">⚡ ANUBIS</div>
    <div class="badge">VULN LAB</div>
  </header>
  <nav>
    <a href="/" {% if page=='home' %}class="active"{% endif %}>Home</a>
    <a href="/xss/reflected" {% if page=='rxss' %}class="active"{% endif %}>Reflected XSS</a>
    <a href="/xss/stored"    {% if page=='sxss' %}class="active"{% endif %}>Stored XSS</a>
    <a href="/xxe"           {% if page=='xxe'  %}class="active"{% endif %}>XXE</a>
  </nav>
  <main>
    {% block content %}{% endblock %}
  </main>
</body>
</html>
"""

HOME_T = BASE.replace("{% block content %}{% endblock %}", """
<div class="page-title">Vulnerability Lab</div>
<div class="page-sub">// local training environment — intentionally vulnerable</div>

<div class="home-grid">
  <a href="/xss/reflected" class="vuln-card xss">
    <div class="vc-icon">🎯</div>
    <div class="severity sev-high">HIGH — CVE CLASS</div>
    <div class="vc-title">Reflected XSS</div>
    <div class="vc-desc">User input is reflected in the response without sanitization. Payload executes immediately in the victim's browser.</div>
  </a>
  <a href="/xss/stored" class="vuln-card xss">
    <div class="vc-icon">💾</div>
    <div class="severity sev-high">HIGH — PERSISTENT</div>
    <div class="vc-title">Stored XSS</div>
    <div class="vc-desc">Malicious script is saved to the server and served to every user who views the page. More dangerous than reflected.</div>
  </a>
  <a href="/xxe" class="vuln-card xxe">
    <div class="vc-icon">📄</div>
    <div class="severity sev-crit">CRITICAL — CVE CLASS</div>
    <div class="vc-title">XXE Injection</div>
    <div class="vc-desc">XML External Entity attack. Abuses XML parsers to read local files, perform SSRF, or cause denial of service.</div>
  </a>
</div>
""")

RXSS_T = BASE.replace("{% block content %}{% endblock %}", """
<div class="page-title">Reflected XSS</div>
<div class="page-sub">// input is reflected in response without sanitization</div>

<div class="card danger">
  <h2>🎯 Search Box <span class="tag tag-xss">REFLECTED XSS</span></h2>
  <form method="GET" action="/xss/reflected">
    <label>Search Query</label>
    <input type="text" name="q" value="{{ raw_input }}" placeholder='Try: <script>alert("XSS")</script>' autocomplete="off">
    <button type="submit">Search</button>
  </form>

  {% if raw_input %}
  <div class="result-box danger">
    <div style="color:var(--muted);font-size:11px;margin-bottom:8px;">RESULTS FOR:</div>
    <!-- ⚠️  VULNERABLE: raw input rendered without escaping -->
    {{ raw_input | safe }}
  </div>
  {% endif %}

  <div class="hint">
    <strong>💡 Try these payloads:</strong>
    &lt;script&gt;alert('XSS')&lt;/script&gt;<br>
    &lt;img src=x onerror="alert(document.cookie)"&gt;<br>
    &lt;svg onload="alert(1)"&gt;<br>
    &lt;a href="javascript:alert('XSS')"&gt;click me&lt;/a&gt;
  </div>
</div>

<div class="card">
  <h2>📖 What is Reflected XSS? <span class="tag tag-info">THEORY</span></h2>
  The server takes user input from the request (URL param, form field) and <strong>reflects</strong> it back in the HTML response
  without encoding. The payload is not stored — it only executes when a victim clicks a crafted link.<br><br>
  <strong>Fix:</strong> Use <code>escape()</code> / <code>Markup.escape()</code> in Flask, or Jinja2's auto-escaping.
</div>
""")

SXSS_T = BASE.replace("{% block content %}{% endblock %}", """
<div class="page-title">Stored XSS</div>
<div class="page-sub">// payload is saved and served to every visitor</div>

<div class="card danger">
  <h2>💾 Comment Board <span class="tag tag-xss">STORED XSS</span></h2>
  <form method="POST" action="/xss/stored">
    <label>Name</label>
    <input type="text" name="author" placeholder="Your name" autocomplete="off">
    <label>Comment</label>
    <textarea name="body" placeholder='Try: <img src=x onerror="alert(document.cookie)">'></textarea>
    <button type="submit">Post Comment</button>
    &nbsp;
    <a href="/xss/stored/clear" class="btn danger" style="font-size:12px;padding:8px 16px;">Clear All</a>
  </form>

  <div class="comment-list">
    {% for c in comments %}
    <div class="comment-item">
      <div class="author">{{ c.author | safe }}</div>
      <!-- ⚠️  VULNERABLE: stored content rendered without escaping -->
      <div>{{ c.body | safe }}</div>
    </div>
    {% endfor %}
    {% if not comments %}
    <div style="color:var(--muted);font-family:'Share Tech Mono',monospace;font-size:13px;">No comments yet.</div>
    {% endif %}
  </div>

  <div class="hint">
    <strong>💡 Try these payloads:</strong>
    &lt;script&gt;alert('Stored XSS!')&lt;/script&gt;<br>
    &lt;img src=x onerror="alert('cookie: '+document.cookie)"&gt;<br>
    &lt;b style="color:red"&gt;HTML Injection&lt;/b&gt;
  </div>
</div>

<div class="card">
  <h2>📖 Stored vs Reflected <span class="tag tag-info">THEORY</span></h2>
  Unlike reflected XSS, stored XSS saves the payload to a database/memory and serves it to
  <strong>every user</strong> who visits the page — no crafted link needed. This makes it far more dangerous.<br><br>
  <strong>Fix:</strong> Escape output at render time. Never store raw HTML from users. Use a CSP header.
</div>
""")

XXE_T = BASE.replace("{% block content %}{% endblock %}", """
<div class="page-title">XXE Injection</div>
<div class="page-sub">// xml external entity — reading local files via xml parser</div>

<div class="card danger">
  <h2>📄 XML Parser <span class="tag tag-xxe">XXE</span></h2>
  <form method="POST" action="/xxe">
    <label>XML Input</label>
    <textarea name="xml" style="min-height:160px;font-size:12px;">{{ default_xml }}</textarea>
    <button type="submit">Parse XML</button>
  </form>

  {% if result %}
  <div class="result-box danger">
    <div style="color:var(--muted);font-size:11px;margin-bottom:8px;">PARSER OUTPUT:</div>
    <pre style="white-space:pre-wrap;word-break:break-all;font-size:13px;">{{ result }}</pre>
  </div>
  {% endif %}

  {% if error %}
  <div class="result-box" style="border-left-color:var(--muted)">
    <div style="color:var(--muted);font-size:11px;margin-bottom:4px;">ERROR:</div>
    <pre style="color:var(--muted);font-size:12px;">{{ error }}</pre>
  </div>
  {% endif %}

  <div class="hint">
    <strong>💡 XXE payload to read /etc/passwd:</strong>
    &lt;?xml version="1.0"?&gt;<br>
    &lt;!DOCTYPE foo [&lt;!ENTITY xxe SYSTEM "file:///etc/passwd"&gt;]&gt;<br>
    &lt;data&gt;&amp;xxe;&lt;/data&gt;<br><br>
    <strong>Try also:</strong> file:///etc/hostname &nbsp;|&nbsp; file:///etc/os-release
  </div>
</div>

<div class="card">
  <h2>📖 What is XXE? <span class="tag tag-info">THEORY</span></h2>
  XML External Entity (XXE) occurs when an XML parser processes external entity references.
  An attacker can define an entity that points to a local file (<code>file://</code>) or internal
  network resource (<code>http://</code>), leaking sensitive data or performing SSRF.<br><br>
  <strong>Fix:</strong> Disable external entity processing:
  <code>lxml</code> → use <code>resolve_entities=False</code> in XMLParser.
  Never pass raw user XML to an unsafe parser.
</div>
""")


# ─── ROUTES ───────────────────────────────────────────────────────────────────

@app.route("/")
def home():
    return render_template_string(HOME_T, page="home")


# ── Reflected XSS ──
@app.route("/xss/reflected")
def xss_reflected():
    raw = request.args.get("q", "")
    return render_template_string(RXSS_T, page="rxss", raw_input=raw)


# ── Stored XSS ──
@app.route("/xss/stored", methods=["GET", "POST"])
def xss_stored():
    if request.method == "POST":
        author = request.form.get("author", "Anonymous")
        body   = request.form.get("body", "")
        if body.strip():
            comments.append({"author": author, "body": body})
        return redirect(url_for("xss_stored"))
    return render_template_string(SXSS_T, page="sxss", comments=comments)


@app.route("/xss/stored/clear")
def xss_stored_clear():
    comments.clear()
    return redirect(url_for("xss_stored"))


# ── XXE ──
DEFAULT_XML = """<?xml version="1.0"?>
<user>
  <name>John</name>
  <role>admin</role>
</user>"""

@app.route("/xxe", methods=["GET", "POST"])
def xxe():
    result = None
    error  = None
    if request.method == "POST":
        xml_input = request.form.get("xml", "")
        try:
            # ⚠️  VULNERABLE: resolve_entities=True (default), no_network=False
            parser = etree.XMLParser(resolve_entities=True, no_network=False)
            tree   = etree.fromstring(xml_input.encode(), parser)
            result = etree.tostring(tree, pretty_print=True).decode()
        except Exception as e:
            error = str(e)
    return render_template_string(
        XXE_T, page="xxe",
        default_xml=DEFAULT_XML,
        result=result, error=error
    )


# ─── MAIN ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n" + "="*50)
    print("  ANUBIS VulnLab — Local Training Environment")
    print("="*50)
    print("  ⚠️  INTENTIONALLY VULNERABLE — LOCAL ONLY")
    print("  URL: http://127.0.0.1:5000")
    print("="*50 + "\n")
    app.run(debug=False, host="127.0.0.1", port=5000)
