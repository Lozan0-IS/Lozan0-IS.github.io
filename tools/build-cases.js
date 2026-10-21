#!/usr/bin/env node
// Generates the case pages from data/cases.json. Development-time only: the site itself stays plain static files.
//
//   node tools/build-cases.js           write whatever is out of date
//   node tools/build-cases.js --check   write nothing; exit 1 if a generated file is stale or a check fails
//
// Owns exactly these things and touches nothing else:
//   1. work/<slug>/index.html        one page per case (fully generated)
//   2. in index.html: the case articles between the "cases:start" / "cases:end" comments, and the preview thumbnails
//      beside the WORK heading between "peek:start" / "peek:end"
//   3. the /work/ entries in sitemap.xml (the home entry and anything else stay as they are)
// The menu and footer live once in tools/partials/. Spanish strings stay in js/i18n-es.js (checked, not generated).

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const { site, cases } = JSON.parse(read('data/cases.json'));
const header = read('tools/partials/header.html').replace(/\n$/, '');
const footer = read('tools/partials/footer.html').replace(/\n$/, '');
const pad = (s, n) => s.split('\n').map((l) => (l ? ' '.repeat(n) + l : l)).join('\n');
const pageNo = (c) => String(c.n).padStart(2, '0');
const leadText = (c) => c.lead.join('');

// ---------- templates
const casePage = (c, i) => {
    const next = cases[(i + 1) % cases.length];
    const url = `${site.origin}/work/${c.slug}/`;
    const title = `${c.name} — AKAI Case ${pageNo(c)}`;
    const shots = c.shots.map(({ img, label, href }) => {
        const im = `<img src="/assets/work/${img}.webp" alt="${esc(`${c.name}: ${label}`)}" width="1200" height="750" loading="lazy" decoding="async">`;
        const body = href ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${im}</a>` : im;
        return `                <li><figure>${body}<figcaption class="meta-label">${esc(label)}</figcaption></figure></li>`;
    }).join('\n');
    const facts = c.facts.map(([k, v]) => `            <div><dt class="meta-label">${k}</dt><dd>${esc(v)}</dd></div>`).join('\n')
        + (c.live ? `\n            <div><dt class="meta-label">LIVE SITE</dt><dd><a class="contact__email" href="${c.live}" target="_blank" rel="noopener noreferrer">Open the live page</a></dd></div>` : '');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(leadText(c))}">
    <link rel="canonical" href="${url}">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(leadText(c))}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${url}">
    <meta property="og:site_name" content="AKAI">
    <meta property="og:image" content="${site.origin}${site.ogImage}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="theme-color" content="#000000">
    <link rel="icon" href="/assets/favicon-32.png" type="image/png" sizes="32x32">
    <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
    <link rel="preload" href="/assets/fonts/space-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="stylesheet" href="/css/styles.css">
    <script>document.documentElement.classList.add('js');</script>
</head>
<body>
    <a href="#main" class="skip-link">Skip to main content</a>

${header}

    <main id="main" class="note casepage">
        <header class="note__header">
            <a class="case__back meta-label" href="/#work"><span aria-hidden="true">←</span> Work</a>
            <p class="note__meta meta-label">Case ${pageNo(c)} · ${esc(c.kind)}</p>
            <h1 class="note__title" data-no-i18n>${esc(c.name)}</h1>
            <p class="note__lead">${esc(leadText(c))}</p>
        </header>

        <dl class="casefacts">
${facts}
        </dl>

        <section class="casebuilt" aria-labelledby="built-title">
            <h2 class="meta-label" id="built-title">What we built</h2>
            <ul class="casebuilt__list" role="list">
${c.built.map((b) => `                <li>${esc(b)}</li>`).join('\n')}
            </ul>
        </section>

        <section class="caseshots" aria-label="Screens">
            <ul class="caseshots__list" role="list">
${shots}
            </ul>
            <p class="caseshots__note mono">${esc(c.shotNote)}</p>
        </section>

        <nav class="casenext" aria-label="Next case">
            <a href="/work/${next.slug}/" class="casenext__link">
                <span class="meta-label">Next case</span>
                <span class="casenext__name" data-no-i18n>${esc(next.name)}</span>
            </a>
        </nav>

        <section class="case__cta" aria-label="Start a project">
            <p class="case__cta-line">Have something worth building?</p>
            <a class="contact__link" href="/#talk">
                <span class="contact__link-text">LET'S TALK</span>
                <span class="contact__link-arrow" aria-hidden="true">→</span>
            </a>
        </section>
    </main>

${footer}

    <script src="/js/i18n-es.js"></script>
    <script src="/js/app.js"></script>
</body>
</html>
`;
};

// The article each case gets on the home page: a folder whose parts float out (see initCases in js/app.js)
const homeArticle = (c) => {
    const parts = c.shots.map(({ img, label, href }) => {
        const inner = href ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : esc(label);
        return `        <li data-image="/assets/work/${img}.webp" data-thumb="/assets/work/${img}-t.webp"><h4>${inner}</h4></li>`;
    }).join('\n');
    return `<article class="case reveal">
    <h3 class="case__title"><span class="case__word">CASE</span> <span class="case__client">${esc(c.word)}</span></h3>
    <div class="case__stage">
        <p class="case__lead"><span>${esc(c.lead[0])}</span><strong>${esc(c.lead[1])}</strong></p>
        <div class="case__folder" data-folder data-label="${esc(c.folderLabel)}" data-case="${c.n}"></div>
        <div class="case__panel" aria-live="polite"></div>
    </div>
    <ul class="case__parts">
${parts}
    </ul>
    <a class="case__more mono" href="/work/${c.slug}/">View the case →</a>
</article>`;
};

const START = '<!-- cases:start';
const END = '<!-- cases:end -->';
const spliceHome = (html) => {
    const a = html.indexOf(START);
    const b = html.indexOf(END);
    if (a < 0 || b < a) throw new Error('index.html is missing the "cases:start" / "cases:end" markers');
    const lineStart = html.lastIndexOf('\n', a) + 1;
    const indent = html.slice(lineStart, a);
    const block = pad(cases.map(homeArticle).join('\n'), indent.length);
    const startLine = html.slice(a, html.indexOf('-->', a) + 3);
    return html.slice(0, lineStart) + `${indent}${startLine}\n${block}\n${indent}${END}` + html.slice(b + END.length);
};

// A strip of one thumbnail per case beside the folded WORK heading, so proof shows before anything is opened
const splicePeek = (html) => {
    const a = html.indexOf('<!-- peek:start');
    const b = html.indexOf('<!-- peek:end -->');
    if (a < 0 || b < a) throw new Error('index.html is missing the "peek:start" / "peek:end" markers');
    const lineStart = html.lastIndexOf('\n', a) + 1;
    const indent = html.slice(lineStart, a);
    const startLine = html.slice(a, html.indexOf('-->', a) + 3);
    const imgs = cases.map((c) => `    <img src="/assets/work/${c.shots[0].img}-t.webp" alt="" width="400" height="250" loading="lazy" decoding="async">`).join('\n');
    const block = `${indent}${startLine}\n${indent}<span class="work__peek" aria-hidden="true">\n${pad(imgs, indent.length)}\n${indent}</span>\n${indent}<!-- peek:end -->`;
    return html.slice(0, lineStart) + block + html.slice(b + '<!-- peek:end -->'.length);
};

const workUrl = (c) => `${site.origin}/work/${c.slug}/`;
const spliceSitemap = (xml) => {
    const kept = xml.replace(/  <url>\n    <loc>[^<]*\/work\/[^<]*<\/loc>\n(?:    <lastmod>[^<]*<\/lastmod>\n)?  <\/url>\n/g, '');
    const entries = cases.map((c) => `  <url>\n    <loc>${workUrl(c)}</loc>\n    <lastmod>${c.lastmod}</lastmod>\n  </url>\n`).join('');
    return kept.replace('</urlset>', `${entries}</urlset>`);
};

// ---------- plan
const outputs = new Map();
cases.forEach((c, i) => outputs.set(`work/${c.slug}/index.html`, casePage(c, i)));
outputs.set('index.html', splicePeek(spliceHome(read('index.html'))));
outputs.set('sitemap.xml', spliceSitemap(read('sitemap.xml')));

// ---------- checks
const problems = [];
const warnings = [];

const slugs = cases.map((c) => c.slug);
if (new Set(slugs).size !== slugs.length) problems.push('duplicate slugs in data/cases.json');
if (new Set(cases.map((c) => c.n)).size !== cases.length) problems.push('duplicate case numbers in data/cases.json');

cases.forEach((c) => c.shots.forEach(({ img }) => {
    ['', '-t'].forEach((suffix) => {
        const f = `assets/work/${img}${suffix}.webp`;
        if (!exists(f)) problems.push(`${c.slug}: missing image ${f}`);
    });
}));

// every sitemap URL on this site must be a real page, listed once
{
    const xml = outputs.get('sitemap.xml');
    const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
    if (new Set(locs).size !== locs.length) problems.push('sitemap.xml lists a URL more than once');
    locs.forEach((loc) => {
        if (!loc.startsWith(site.origin)) return problems.push(`sitemap.xml: ${loc} is not on ${site.origin}`);
        const rel = loc.slice(site.origin.length).replace(/^\//, '');
        const file = rel === '' ? 'index.html' : `${rel}${rel.endsWith('/') ? '' : '/'}index.html`.replace('//', '/');
        if (!outputs.has(file) && !exists(file)) problems.push(`sitemap.xml: ${loc} has no file (${file})`);
    });
}

// internal links in what we generate must land somewhere
{
    const home = outputs.get('index.html');
    const pages = [...outputs.entries()].filter(([f]) => f.startsWith('work/'));
    pages.concat([['index.html', home]]).forEach(([f, html]) => {
        [...html.matchAll(/(?:href|src)="(\/[^"#?]*)(#[^"]*)?"/g)].forEach(([, p, hash]) => {
            const rel = p.replace(/^\//, '');
            const file = rel === '' ? 'index.html' : (rel.endsWith('/') ? `${rel}index.html` : rel);
            if (!outputs.has(file) && !exists(file)) problems.push(`${f}: broken link ${p}`);
            if (hash && p === '/' && !new RegExp(`id="${hash.slice(1)}"`).test(home)) problems.push(`${f}: no #${hash.slice(1)} on the home page`);
        });
    });
}

// Spanish coverage: warn (never fail) about strings the page shows that i18n-es.js cannot translate
{
    const sandbox = { window: {} };
    vm.runInNewContext(read('js/i18n-es.js'), sandbox);
    const es = sandbox.window.AKAI_ES || {};
    const norm = (s) => s.replace(/\s+/g, ' ').trim();
    const same = new Set(site.sameInSpanish || []);   // words that read the same in both languages
    const need = new Set(['Work', 'Next case', 'What we built', 'Screens', 'Open the live page', 'View the case →', 'Have something worth building?', "LET'S TALK"]);
    cases.forEach((c) => {
        [`Case ${pageNo(c)} · ${c.kind}`, c.kind, leadText(c), c.shotNote, ...c.built, ...c.shots.map((s) => s.label), ...c.facts.flat()].forEach((s) => need.add(s));
    });
    need.forEach((s) => { if (!es[norm(s)] && !same.has(s) && !cases.some((c) => c.name === s || c.folderLabel === s)) warnings.push(`no Spanish for "${s}"`); });
}

// ---------- write or compare
const stale = [];
outputs.forEach((content, rel) => {
    const current = exists(rel) ? read(rel) : null;
    if (current === content) return;
    stale.push(rel);
    if (!CHECK) {
        fs.mkdirSync(path.dirname(path.join(ROOT, rel)), { recursive: true });
        fs.writeFileSync(path.join(ROOT, rel), content);
    }
});

warnings.forEach((w) => console.warn(`warning: ${w}`));
problems.forEach((p) => console.error(`error: ${p}`));

if (CHECK) {
    stale.forEach((f) => console.error(`stale: ${f} (run: node tools/build-cases.js)`));
    const ok = !stale.length && !problems.length;
    console.log(ok ? `OK: ${outputs.size} generated files are up to date.` : 'FAILED');
    process.exit(ok ? 0 : 1);
}
console.log(stale.length ? `Updated ${stale.length} file(s):\n  ${stale.join('\n  ')}` : 'Nothing to update: everything is already current.');
process.exit(problems.length ? 1 : 0);
