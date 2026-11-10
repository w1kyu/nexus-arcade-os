// @ts-check
// Built-in starter templates for Code Playground

export const TEMPLATES = {
  blank: {
    name: 'Blank',
    html: '<div class="container">\n  <h1>Hello, World!</h1>\n  <p>Start editing to see changes live.</p>\n</div>',
    css: 'body {\n  font-family: system-ui, sans-serif;\n  background: #0f172a;\n  color: #f8fafc;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  height: 100vh;\n  margin: 0;\n}\n.container {\n  text-align: center;\n}',
    js: '// JavaScript code\nconsole.log("Hello from Code Playground!");',
  },

  canvas: {
    name: 'Canvas Game Loop',
    html: '<canvas id="gameCanvas" width="400" height="300"></canvas>',
    css: 'body {\n  margin: 0;\n  background: #111827;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  height: 100vh;\n}\ncanvas {\n  border: 2px solid #3b82f6;\n  border-radius: 8px;\n  box-shadow: 0 4px 20px rgba(0,0,0,0.5);\n}',
    js: `const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let x = 50;
let y = 50;
let vx = 3;
let vy = 2;
const radius = 15;

function loop() {
  ctx.fillStyle = 'rgba(17, 24, 39, 0.3)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  x += vx;
  y += vy;

  if (x + radius > canvas.width || x - radius < 0) vx = -vx;
  if (y + radius > canvas.height || y - radius < 0) vy = -vy;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#60a5fa';
  ctx.shadowColor = '#3b82f6';
  ctx.shadowBlur = 15;
  ctx.fill();
  ctx.closePath();

  requestAnimationFrame(loop);
}

loop();
console.log('Game loop started');`,
  },

  animation: {
    name: 'CSS 3D Animation',
    html: '<div class="scene">\n  <div class="cube">\n    <div class="face front">Nexus</div>\n    <div class="face back">Arcade</div>\n    <div class="face right">OS</div>\n    <div class="face left">2026</div>\n    <div class="face top">HTML</div>\n    <div class="face bottom">CSS</div>\n  </div>\n</div>',
    css: `body {
  margin: 0;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: radial-gradient(circle, #1e1b4b, #030712);
  perspective: 800px;
}
.scene { width: 120px; height: 120px; }
.cube {
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  animation: rotateCube 8s infinite linear;
}
.face {
  position: absolute;
  width: 120px;
  height: 120px;
  background: rgba(99, 102, 241, 0.2);
  border: 2px solid #818cf8;
  color: #fff;
  font-family: sans-serif;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.4) inset;
}
.front  { transform: rotateY(0deg) translateZ(60px); }
.back   { transform: rotateY(180deg) translateZ(60px); }
.right  { transform: rotateY(90deg) translateZ(60px); }
.left   { transform: rotateY(-90deg) translateZ(60px); }
.top    { transform: rotateX(90deg) translateZ(60px); }
.bottom { transform: rotateX(-90deg) translateZ(60px); }
@keyframes rotateCube {
  from { transform: rotateX(0deg) rotateY(0deg); }
  to   { transform: rotateX(360deg) rotateY(360deg); }
}`,
    js: 'console.log("3D CSS animation rendered!");',
  },

  fetchJson: {
    name: 'Fetch + JSON Demo',
    html: '<div class="app">\n  <h2>Users Directory</h2>\n  <button id="loadBtn">Load Users</button>\n  <ul id="list"></ul>\n</div>',
    css: `body {
  font-family: system-ui, sans-serif;
  background: #0f172a;
  color: #f8fafc;
  padding: 20px;
}
.app { max-width: 400px; margin: 0 auto; }
button {
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font-weight: bold;
  cursor: pointer;
}
button:hover { background: #2563eb; }
ul { list-style: none; padding: 0; margin-top: 16px; }
li {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 6px;
}`,
    js: `const btn = document.getElementById('loadBtn');
const list = document.getElementById('list');

btn.addEventListener('click', () => {
  btn.disabled = true;
  btn.textContent = 'Loading...';
  
  // Simulated API response for reliable offline preview
  setTimeout(() => {
    const mockUsers = [
      { name: 'Ada Lovelace', role: 'Chief Mathematician' },
      { name: 'Alan Turing', role: 'Lead Cryptographer' },
      { name: 'Margaret Hamilton', role: 'Software Director' }
    ];
    
    list.innerHTML = '';
    mockUsers.forEach(u => {
      const li = document.createElement('li');
      li.innerHTML = \`<strong>\${u.name}</strong> - \${u.role}\`;
      list.appendChild(li);
    });
    
    btn.disabled = false;
    btn.textContent = 'Reload Users';
    console.table(mockUsers);
  }, 400);
});`,
  },

  webComponent: {
    name: 'Web Component',
    html: '<nexus-card title="Autonomous OS" tag="v1.0">\n  Nexus Arcade OS features full offline execution and complete kernel services.\n</nexus-card>',
    css: 'body {\n  font-family: system-ui, sans-serif;\n  background: #090d16;\n  color: #e2e8f0;\n  padding: 40px;\n  display: flex;\n  justify-content: center;\n}',
    js: `class NexusCard extends HTMLElement {
  connectedCallback() {
    const title = this.getAttribute('title') || 'Card';
    const tag = this.getAttribute('tag') || 'Info';
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = \`
      <style>
        :host {
          display: block;
          max-width: 340px;
          background: #1e293b;
          border: 1px solid #3b82f6;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        h3 { margin: 0; color: #60a5fa; }
        .tag { background: #3b82f6; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; }
        .content { color: #cbd5e1; font-size: 13px; line-height: 1.5; }
      </style>
      <div class="header">
        <h3>\${title}</h3>
        <span class="tag">\${tag}</span>
      </div>
      <div class="content"><slot></slot></div>
    \`;
  }
}
customElements.define('nexus-card', NexusCard);
console.log('Registered <nexus-card> Web Component');`,
  },

  p5Helper: {
    name: 'p5-like Drawing Helper',
    html: '<canvas id="art" width="400" height="400"></canvas>',
    css: 'body {\n  margin: 0;\n  background: #0a0a0c;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  height: 100vh;\n}\ncanvas {\n  border-radius: 50%;\n  box-shadow: 0 0 30px rgba(236, 72, 153, 0.4);\n}',
    js: `const canvas = document.getElementById('art');
const ctx = canvas.getContext('2d');
const cx = canvas.width / 2;
const cy = canvas.height / 2;
let angle = 0;

function draw() {
  ctx.fillStyle = 'rgba(10, 10, 12, 0.05)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 8; i++) {
    const a = angle + (i * Math.PI) / 4;
    const r = 100 + Math.sin(angle * 2) * 50;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;

    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = \`hsl(\${(angle * 50 + i * 40) % 360}, 90%, 65%)\`;
    ctx.fill();
  }

  angle += 0.02;
  requestAnimationFrame(draw);
}

draw();
console.log('Creative drawing started');`,
  },
};

/**
 * Packs HTML, CSS and JS into a single runnable document string with console capture.
 * @param {string} html
 * @param {string} css
 * @param {string} js
 */
export function buildPreviewDocument(html, css, js) {
  // Console capture interceptor script inside iframe
  const interceptor =
    `
  <script>
    (function() {
      function send(type, args) {
        try {
          const serialized = args.map(a => {
            if (a === null) return 'null';
            if (a === undefined) return 'undefined';
            if (typeof a === 'object') {
              try { return JSON.stringify(a); } catch (e) { return String(a); }
            }
            return String(a);
          });
          window.parent.postMessage({ type: 'CONSOLE_LOG', level: type, args: serialized }, '*');
        } catch(e) {}
      }
      const origLog = console.log;
      const origWarn = console.warn;
      const origError = console.error;
      const origTable = console.table;
      console.log = function(...args) { origLog.apply(console, args); send('log', args); };
      console.warn = function(...args) { origWarn.apply(console, args); send('warn', args); };
      console.error = function(...args) { origError.apply(console, args); send('error', args); };
      console.table = function(...args) { origTable.apply(console, args); send('table', args); };

      window.onerror = function(msg, src, line, col) {
        send('error', [\`Uncaught error at line \${line}:\${col}: \${msg}\`]);
      };
      window.onunhandledrejection = function(e) {
        send('error', [\`Unhandled Promise Rejection: \${e.reason}\`]);
      };

      window.addEventListener('message', function(e) {
        if (e.data && e.data.type === 'EVAL_EXPR') {
          try {
            const res = (0, eval)(e.data.code);
            send('log', ['=> ' + (typeof res === 'object' ? JSON.stringify(res) : String(res))]);
          } catch(err) {
            send('error', [String(err.message || err)]);
          }
        }
      });
    })();
  <` +
    `/script>
  `;

  return (
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
${css}
  </style>
  ${interceptor}
</head>
<body>
${html}
  <script>
${js}
  <` +
    `/script>
</body>
</html>`
  );
}
