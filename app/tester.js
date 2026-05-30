const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const html = fs.readFileSync('app/src/main/assets/www/index.html', 'utf8');

const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.on("error", (e) => { console.error("VC Error:", e); });
virtualConsole.on("warn", (w) => { console.warn("VC Warn:", w); });
virtualConsole.on("log", (l) => { console.log("VC Log:", l); });
virtualConsole.on("jsdomError", (e) => { console.error("JSDOM Error Event:", e.message, e.stack); });

const dom = new JSDOM(html, {
  url: 'http://localhost/',
  runScripts: 'dangerously',
  resources: 'usable',
  virtualConsole
});

setTimeout(() => {
  console.log('Finished simulating.');
}, 2000);
