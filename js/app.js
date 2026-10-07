document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // Global Flags
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouchDevice = window.matchMedia('(hover: none)').matches;

    // --- 1. Language (English by default; a stored choice wins) ---
    // The Spanish copy in js/i18n-es.js is a draft. Anything it lacks stays in English.
    const ES = window.AKAI_ES || {};
    let lang = 'en';
    try { if (localStorage.getItem('akai-lang') === 'es') lang = 'es'; } catch (e) { /* storage can be blocked */ }
    const t = (s) => (lang === 'es' && ES[s]) || s;
    const norm = (s) => s.replace(/\s+/g, ' ').trim();

    const initLanguage = () => {
        const originals = new WeakMap();
        const attrOriginals = new WeakMap();
        const SKIP = 'script, style, svg, textarea, [data-no-i18n]';
        const ATTRS = ['aria-label', 'placeholder', 'title', 'alt'];

        const apply = () => {
            document.documentElement.lang = lang;

            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
                const parent = node.parentElement;
                if (!parent || parent.closest(SKIP)) continue;
                if (!originals.has(node)) {
                    if (!norm(node.nodeValue)) continue;
                    originals.set(node, node.nodeValue);
                }
                const original = originals.get(node);
                const es = lang === 'es' ? ES[norm(original)] : undefined;
                node.nodeValue = es === undefined ? original : original.match(/^\s*/)[0] + es + original.match(/\s*$/)[0];
            }

            document.querySelectorAll('[aria-label], [placeholder], [title], [alt]').forEach((el) => {
                if (el.closest('[data-no-i18n]')) return;
                const saved = attrOriginals.get(el) || {};
                ATTRS.forEach((attr) => {
                    if (!el.hasAttribute(attr)) return;
                    if (!(attr in saved)) saved[attr] = el.getAttribute(attr);
                    const es = lang === 'es' ? ES[norm(saved[attr])] : undefined;
                    el.setAttribute(attr, es === undefined ? saved[attr] : es);
                });
                attrOriginals.set(el, saved);
            });

            document.querySelectorAll('[data-lang]').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.lang === lang)));
        };

        document.querySelectorAll('[data-lang]').forEach((btn) => btn.addEventListener('click', () => {
            if (btn.dataset.lang === lang) return;
            lang = btn.dataset.lang;
            try { localStorage.setItem('akai-lang', lang); } catch (e) { /* not worth failing for */ }
            const status = document.getElementById('brief-status');
            if (status) status.textContent = '';
            apply();
            document.dispatchEvent(new CustomEvent('akai:lang'));
        }));

        apply();
    };

    // --- 3. Active Section (nav link follows the section in view) ---
    const initActiveSection = () => {
        const sections = ['studio', 'contact']
            .map(id => document.getElementById(id))
            .filter(Boolean);
        if (sections.length === 0) return;

        const setActive = (id) => {
            document.querySelectorAll('[data-section]').forEach(link => {
                const isActive = link.dataset.section === id;
                if (isActive) link.setAttribute('aria-current', 'location');
                else link.removeAttribute('aria-current');
            });
        };

        // A section counts as current while it crosses the middle band of the viewport
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) setActive(entry.target.id);
                else if (entry.target === sections[0] && entry.boundingClientRect.top > 0) setActive(null);
            });
        }, { rootMargin: '-45% 0px -50% 0px' });

        sections.forEach(section => observer.observe(section));
    };

    // --- 5. Smooth Anchor Scrolling ---
    const initSmoothScroll = () => {
        const anchors = document.querySelectorAll('a[href^="#"]');
        anchors.forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const targetId = this.getAttribute('href');
                if (targetId === '#') return;

                const targetElement = document.querySelector(targetId);
                if (!targetElement) return;

                e.preventDefault();
                targetElement.scrollIntoView({
                    behavior: prefersReducedMotion ? 'auto' : 'smooth',
                    block: 'start'
                });
                targetElement.setAttribute('tabindex', '-1');
                targetElement.focus({ preventScroll: true });
            });
        });
    };

    // --- 6. Scroll Reveal Animations ---
    const initScrollObservers = () => {
        const revealElements = document.querySelectorAll('.reveal');
        
        if (prefersReducedMotion) {
            revealElements.forEach(el => el.classList.add('is-visible'));
            initMethodSteps();
            return;
        }

        const revealObserver = new IntersectionObserver((entries, observer) => {
            const intersectingEntries = entries.filter(entry => entry.isIntersecting);
            
            intersectingEntries.forEach((entry, index) => {
                if (intersectingEntries.length > 1) {
                    entry.target.style.transitionDelay = `${Math.min(index, 5) * 60}ms`;
                }
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            });
        }, {
            threshold: 0.15,
            rootMargin: '0px 0px -50px 0px'
        });

        revealElements.forEach(el => revealObserver.observe(el));
        
        initMethodSteps();
    };

    // --- 10. Method Steps Sequential Reveal ---
    const initMethodSteps = () => {
        if (prefersReducedMotion) {
            document.querySelectorAll('.method__step').forEach(step => step.classList.add('is-active'));
            return;
        }

        const methodSection = document.querySelector('.method');
        const steps = document.querySelectorAll('.method__step');
        if (!methodSection || steps.length === 0) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    steps.forEach((step, index) => {
                        setTimeout(() => {
                            step.classList.add('is-active');
                        }, index * 120);
                    });
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.3
        });

        observer.observe(methodSection);
    };

    // --- 11. Contact CTA Magnetic Effect ---
    const initMagneticContact = () => {
        if (isTouchDevice || prefersReducedMotion) return;

        const link = document.querySelector('.contact__link[data-magnetic]');
        const section = document.querySelector('.contact');
        if (!link || !section) return;

        const release = () => {
            link.style.transform = 'translate(0, 0)';
            link.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), color 0.2s ease';
        };

        // Scoped to the contact section so the rest of the page does no layout reads on mousemove
        section.addEventListener('mouseleave', release);
        section.addEventListener('mousemove', (e) => {
            const rect = link.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            const dx = e.clientX - centerX;
            const dy = e.clientY - centerY;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            const radius = 80;
            const maxMove = 10;

            if (distance < radius) {
                const moveX = (dx / radius) * maxMove;
                const moveY = (dy / radius) * maxMove;
                link.style.transform = `translate(${moveX}px, ${moveY}px)`;
                link.style.transition = 'transform 0.1s ease-out, color 0.2s ease';
            } else {
                release();
            }
        });
    };

    // --- 12. Santiago Local Time (hero footer) ---
    const initLocalTime = () => {
        const clock = document.getElementById('clock');
        if (!clock) return;
        const format = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Santo_Domingo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
        const render = () => { const now = new Date(); clock.dateTime = now.toISOString(); clock.textContent = format.format(now) + ' AST'; };
        render();
        setTimeout(() => { render(); setInterval(render, 60000); }, 60000 - (Date.now() % 60000));
    };

    // --- 13. Guided Brief → composed email ---
    // Until a form service is chosen, the brief is turned into a readable email in the visitor's own mail app.
    const initBrief = () => {
        const form = document.getElementById('brief');
        if (!form) return;

        const status = document.getElementById('brief-status');
        const needError = document.getElementById('need-error');
        const needInputs = form.querySelectorAll('input[name="need"]');
        const recipient = 'hello@akai.do';

        const setNeedError = (show) => {
            needError.hidden = !show;
            needInputs.forEach(input => {
                if (show) {
                    input.setAttribute('aria-invalid', 'true');
                    input.setAttribute('aria-describedby', 'need-error');
                } else {
                    input.removeAttribute('aria-invalid');
                    input.removeAttribute('aria-describedby');
                }
            });
        };

        needInputs.forEach(input => input.addEventListener('change', () => setNeedError(false)));

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const data = new FormData(form);
            const need = data.get('need');

            if (!need) {
                setNeedError(true);
                needInputs[0].focus();
                return;
            }

            const stage = data.get('stage');
            const name = (data.get('name') || '').trim();
            const note = (data.get('note') || '').trim();

            const lines = [t('Hi AKAI,'), '', `${t('What I need:')} ${t(need)}`];
            if (stage) lines.push(`${t('Where I am:')} ${t(stage)}`);
            if (note) lines.push('', note);
            if (name) lines.push('', `— ${name}`);

            const subject = `${t('New project:')} ${t(need)}`;
            window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;

            status.textContent = `${t('Your email app should now be open with the brief written. Nothing opened? Write to')} ${recipient}.`;
        });
    };

    // --- 14a. Connect opens a "let's talk" panel (a modal dialog: Esc, focus trap and focus return come with it). Without JS the link still goes to #contact ---
    const initTalk = () => {
        const dialog = document.getElementById('talk');
        const trigger = document.querySelector('.connect');
        if (!dialog || !trigger || typeof dialog.showModal !== 'function') return;

        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            dialog.showModal();
        });
        dialog.querySelector('.talk__close').addEventListener('click', () => dialog.close());
        dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
        dialog.querySelector('.talk__go').addEventListener('click', () => dialog.close());
        dialog.querySelector('.talk__chip').addEventListener('click', () => dialog.close());
    };

    // --- 14b. Credo headline: letters you can cut by dragging across them. A cut letter falls, turns to dust on the floor and pours back in ---
    const initSand = () => {
        const title = document.querySelector('.sand');
        if (!title) return;
        const glyphs = title.querySelector('.sand__glyphs');
        const dust = title.querySelector('.sand__dust');
        const sourceLines = title.dataset.lines.split('|');
        const canSlice = !prefersReducedMotion;
        if (!canSlice) title.closest('.credo').querySelector('.sand__hint').hidden = true;

        const GRAVITY = 0.55, FLOOR_GAP = 110, RETURN_MS = 520;
        let letters = [], grains = [], raf = 0, last = 0;

        const build = () => {
            letters = [];
            grains.forEach((g) => g.el.remove());
            grains = [];
            glyphs.replaceChildren(...sourceLines.map((line) => {
                const row = document.createElement('span');
                row.className = 'sand__line';
                t(line).split(' ').forEach((word, wi) => {
                    if (wi) row.append(' ');
                    const w = document.createElement('span');
                    w.className = 'sand__word';
                    [...word].forEach((ch) => {
                        const el = document.createElement('span');
                        el.className = 'sand__ch';
                        el.textContent = ch;
                        w.append(el);
                        letters.push({ el, state: 'idle', x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0, floor: 0, wake: 0, born: 0 });
                    });
                    row.append(w);
                });
                return row;
            }));
        };

        const cut = (L, dx, now) => {
            const lr = L.el.getBoundingClientRect();
            const tr = title.getBoundingClientRect();
            L.state = 'fall';
            L.x = L.y = L.r = 0;
            L.vx = dx * 0.05 + (Math.random() - 0.5) * 2;
            L.vy = -3 - Math.random() * 3;
            L.vr = (Math.random() - 0.5) * 9;
            L.floor = tr.bottom + FLOOR_GAP - lr.bottom;
            L.cx = lr.left + lr.width / 2 - tr.left;
            L.cy = tr.bottom + FLOOR_GAP - tr.top;
            L.size = lr.width;
            start(now);
        };

        const crumble = (L, now) => {
            L.state = 'gone';
            L.el.style.opacity = '0';
            L.wake = now + 900 + Math.random() * 900;
            for (let k = 0; k < 9; k++) {
                const el = document.createElement('span');
                el.className = 'sand__grain';
                dust.append(el);
                grains.push({ el, x: L.cx + (Math.random() - 0.5) * L.size, y: L.cy, vx: (Math.random() - 0.5) * 5, vy: -2 - Math.random() * 4, born: now });
            }
        };

        const step = (now) => {
            const k = Math.min(2.5, (now - last) / 16.67);
            last = now;
            let busy = false;

            letters.forEach((L) => {
                if (L.state === 'fall') {
                    busy = true;
                    L.vy += GRAVITY * k;
                    L.x += L.vx * k;
                    L.y += L.vy * k;
                    L.r += L.vr * k;
                    if (L.y >= L.floor) crumble(L, now);
                    else L.el.style.transform = `translate(${L.x}px, ${L.y}px) rotate(${L.r}deg)`;
                } else if (L.state === 'gone') {
                    busy = true;
                    if (now >= L.wake) { L.state = 'pour'; L.born = now; }
                } else if (L.state === 'pour') {
                    busy = true;
                    const p = Math.min(1, (now - L.born) / RETURN_MS);
                    const e = 1 - Math.pow(1 - p, 3);
                    L.el.style.opacity = String(e);
                    L.el.style.transform = `translateY(${(-70 * (1 - e)).toFixed(1)}px)`;
                    if (p === 1) { L.state = 'idle'; L.el.style.transform = ''; L.el.style.opacity = ''; }
                }
            });

            grains = grains.filter((g) => {
                const age = now - g.born;
                if (age > 1100) { g.el.remove(); return false; }
                g.vy += GRAVITY * 0.6 * k;
                g.x += g.vx * k;
                g.y += g.vy * k;
                g.el.style.transform = `translate(${g.x}px, ${g.y}px)`;
                g.el.style.opacity = String(1 - age / 1100);
                return true;
            });
            if (grains.length) busy = true;

            raf = busy ? requestAnimationFrame(step) : 0;
        };
        const start = (now) => {
            if (!raf) { last = now; raf = requestAnimationFrame(step); }
        };

        if (canSlice) {
            let down = false, px = 0, py = 0, rects = [];
            const cacheRects = () => { rects = letters.map((L) => L.el.getBoundingClientRect()); };

            title.addEventListener('pointerdown', (e) => {
                if (e.button) return;
                down = true;
                px = e.clientX;
                py = e.clientY;
                cacheRects();
                title.setPointerCapture(e.pointerId);
            });
            title.addEventListener('pointermove', (e) => {
                if (!down) return;
                const dx = e.clientX - px, dy = e.clientY - py;
                const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 6));
                for (let s = 1; s <= n; s++) {
                    const x = px + (dx * s) / n, y = py + (dy * s) / n;
                    letters.forEach((L, i) => {
                        const r = rects[i];
                        if (L.state === 'idle' && x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2) cut(L, dx, e.timeStamp);
                    });
                }
                px = e.clientX;
                py = e.clientY;
            });
            const up = () => { down = false; };
            title.addEventListener('pointerup', up);
            title.addEventListener('pointercancel', up);
            window.addEventListener('resize', () => { if (down) cacheRects(); });
        }

        build();
        document.addEventListener('akai:lang', build);
    };

    // --- 15. Founder and team portraits: tap, click or Enter/Space lifts the scribble (hover does it too, in CSS) ---
    const initFounder = () => {
        document.querySelectorAll('.founder__photo[role="button"], .member__photo[role="button"]').forEach((photo) => {
            const group = photo.closest('.founder, .member');
            const toggle = () => {
                const revealed = photo.classList.toggle('is-revealed');
                group.classList.toggle('is-revealed', revealed);
                photo.setAttribute('aria-pressed', String(revealed));
            };

            photo.addEventListener('click', toggle);
            photo.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle();
                }
            });
        });
    };

    // --- 15b. Work cases: each case's notes become a folder whose pills float out; picking one fills the card ---
    const initCases = () => {
        const cases = [...document.querySelectorAll('.case')];
        if (!cases.length || !window.AKAIFolder) return;

        let mounted = [];
        const build = () => {
            mounted.forEach((m) => m.destroy());
            mounted = cases.map((c) => {
                const host = c.querySelector('[data-folder]');
                const panel = c.querySelector('.case__panel');
                const parts = [...c.querySelectorAll('.case__parts > li')];
                if (!host || !panel || !parts.length) return { destroy() {} };

                const show = (i) => {
                    const li = parts[i];
                    const link = li.querySelector('a');   // a page of a live site has one; a private product has none
                    const label = li.querySelector('h4').textContent.trim();

                    const shot = document.createElement(link ? 'a' : 'div');
                    shot.className = 'case__shot';
                    if (link) {
                        shot.href = link.href;
                        shot.target = '_blank';
                        shot.rel = 'noopener noreferrer';
                        shot.tabIndex = -1;
                        shot.setAttribute('aria-hidden', 'true');
                    }
                    const img = document.createElement('img');
                    img.src = li.dataset.image;
                    img.alt = '';
                    img.width = 1200;
                    img.height = 750;
                    img.loading = 'lazy';
                    img.decoding = 'async';
                    shot.append(img);

                    const title = document.createElement('h4');
                    title.textContent = label;
                    panel.replaceChildren(shot, title);
                    if (!link) return;

                    const open = document.createElement('a');
                    open.className = 'case__open mono';
                    open.href = link.href;
                    open.target = '_blank';
                    open.rel = 'noopener noreferrer';
                    open.textContent = `${t('Open the live page')} →`;
                    panel.append(open);
                };
                show(0);
                c.classList.add('is-enhanced');

                const w = window.innerWidth;
                const width = Math.round(Math.min(340, Math.max(220, w * 0.62)));
                return window.AKAIFolder.mount(host, {
                    items: parts.map((li, i) => ({ label: li.querySelector('h4').textContent.trim(), value: i, image: li.dataset.thumb })),
                    label: host.dataset.label,
                    sublabel: `${t('Case')} ${String(host.dataset.case).padStart(2, '0')}`,
                    width,
                    height: Math.round(width * 0.74),
                    spread: Math.max(120, Math.min(260, (w - 56) / 2)),
                    onSelect: (i) => show(i)
                });
            });
        };
        build();

        // Rebuild when the width changes (not on the height-only resizes of a phone's address bar) or the language does
        let lastWidth = window.innerWidth, timer;
        window.addEventListener('resize', () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                if (window.innerWidth !== lastWidth) { lastWidth = window.innerWidth; build(); }
            }, 250);
        });
        document.addEventListener('akai:lang', build);
    };

    // --- 16. Hero: the name is drawn first, then "We build ___" draws each word as a type specimen ---
    // The guides are the real vertical metrics of each typeface (measured here), and the number under the word is
    // the width it takes on screen. Each lap starts with the name.
    const initHero = () => {
        const word = document.getElementById('word');
        const lead = document.getElementById('lead');
        const dimline = document.getElementById('dimline');
        const readout = document.getElementById('readout');
        if (!word || !lead || !dimline || !readout) return;

        const NS = 'http://www.w3.org/2000/svg';
        const BASELINE = 380;
        const FIT_WIDTH = 1210;   // the widest serif word fills this much of the drawing

        const HERO_TEXT = {
            en: {
                words: ['brands', 'websites', 'platforms', 'automations', 'experiences'],
                lines: ['Ascender', 'X-height', 'Baseline', 'Descender'],
                glyphs: 'glyphs', wide: 'units wide', units: 'units'
            },
            es: {
                words: ['marcas', 'sitios web', 'plataformas', 'automatizaciones', 'experiencias'],
                lines: ['Ascendente', 'Altura de la x', 'Línea base', 'Descendente'],
                glyphs: 'glifos', wide: 'unidades de ancho', units: 'unidades'
            }
        };

        const BRAND = { text: 'AKAI', family: '"Space Grotesk", system-ui, sans-serif', style: 'normal', weight: 300, spacing: '-0.06em', size: 365 };
        const SERIF = { family: '"Times New Roman", Times, serif', style: 'italic', weight: 400, spacing: '-0.04em' };

        const $ = (id) => document.getElementById(id);
        const ctx = document.createElement('canvas').getContext('2d');
        const measure = (text, f, size) => { ctx.font = `${f.style} ${f.weight} ${size}px ${f.family}`; return ctx.measureText(text); };

        let words = HERO_TEXT[lang].words;
        let items = [];
        let index = 0;
        let animation = null;
        let timer = null;
        let slideshow = null;
        let armed = false;

        const fitSerif = () => {
            const longest = words.reduce((a, b) => (b.length > a.length ? b : a)) + '.';
            SERIF.size = Math.min(300, Math.floor(FIT_WIDTH / (measure(longest, SERIF, 100).width / 100)));
        };

        // Each typeface puts its guides in a different place, so they are measured per face and slide between faces
        const GUIDES = { asc: 'g-asc', xh: 'g-xh', base: 'g-base', desc: 'g-desc' };
        const placeGuides = (f) => {
            const m = {
                asc: measure('h', f, f.size).actualBoundingBoxAscent,
                xh: measure('x', f, f.size).actualBoundingBoxAscent,
                desc: measure('p', f, f.size).actualBoundingBoxDescent
            };
            const ys = { asc: BASELINE - m.asc, xh: BASELINE - m.xh, base: BASELINE, desc: BASELINE + m.desc };
            for (const k in GUIDES) {
                const line = $(GUIDES[k]), label = $('t-' + k);
                if (!armed) { line.setAttribute('y1', 0); line.setAttribute('y2', 0); label.setAttribute('y', 0); }
                line.style.transform = `translateY(${ys[k]}px)`;
                label.style.transform = `translateY(${ys[k] - 6}px)`;
            }
            if (!armed) {
                requestAnimationFrame(() => document.querySelectorAll('.hero__spec .guide, .hero__spec .tick').forEach((el) => { el.style.transition = 'transform 800ms cubic-bezier(0.16, 1, 0.3, 1)'; }));
            }
            armed = true;
            return m;
        };

        const dimension = (descent) => {
            const b = word.getBBox();
            const y = BASELINE + descent + 44;
            dimline.replaceChildren();
            const add = (tag, attrs, cls) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); if (cls) el.setAttribute('class', cls); dimline.append(el); return el; };
            add('line', { x1: b.x, y1: y, x2: b.x + b.width, y2: y }, 'dim');
            add('line', { x1: b.x, y1: y - 7, x2: b.x, y2: y + 7 }, 'dim');
            add('line', { x1: b.x + b.width, y1: y - 7, x2: b.x + b.width, y2: y + 7 }, 'dim');
            const label = add('text', { x: b.x + b.width / 2, y: y + 26, 'text-anchor': 'middle' }, 'tick');
            label.textContent = `${Math.round(b.width)} ${HERO_TEXT[lang].units}`;
            label.style.opacity = 1;
            label.style.animation = 'none';
            return Math.round(b.width);
        };

        const show = (i) => {
            const it = items[i];
            const f = it.kind === 'brand' ? BRAND : { ...SERIF };
            const size = it.kind === 'brand' ? BRAND.size : SERIF.size;
            word.style.fontFamily = f.family;
            word.style.fontStyle = f.style;
            word.style.fontWeight = f.weight;
            word.style.letterSpacing = f.spacing;
            word.setAttribute('font-size', size);
            word.textContent = it.kind === 'brand' ? it.text : it.text + '.';
            lead.style.opacity = it.kind === 'brand' ? 0 : 1;

            const m = placeGuides({ ...f, size });
            const width = dimension(m.desc);
            const L = HERO_TEXT[lang];
            const face = it.kind === 'brand' ? 'Space Grotesk Light' : 'Times Italic';
            const label = document.createElement('b');
            let rest;
            if (it.kind === 'brand') {
                label.textContent = 'AKAI';
                rest = ` · 4 ${L.glyphs} · ${width} ${L.wide} · ${face}`;
            } else {
                label.textContent = `${String(i).padStart(2, '0')} / ${String(words.length).padStart(2, '0')}`;
                rest = ` · ${it.text} · ${it.text.replace(/\s/g, '').length} ${L.glyphs} · ${width} ${L.wide} · ${face}`;
            }
            readout.replaceChildren(label, rest);
        };

        const cycle = () => {
            show(index);
            const brand = items[index].kind === 'brand';
            dimline.style.opacity = 0;
            animation = word.animate([
                { strokeDashoffset: 4000, fillOpacity: 0, offset: 0, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
                { strokeDashoffset: 0, fillOpacity: 0, offset: 0.3, easing: 'ease' },
                { strokeDashoffset: 0, fillOpacity: 1, offset: 0.42 },
                { strokeDashoffset: 0, fillOpacity: 1, offset: brand ? 0.8 : 0.76, easing: 'ease' },
                { strokeDashoffset: 0, fillOpacity: 0, offset: brand ? 0.85 : 0.82, easing: 'cubic-bezier(0.7, 0, 0.84, 0)' },
                { strokeDashoffset: -4000, fillOpacity: 0, offset: 1 }
            ], { duration: brand ? 5200 : 5600, fill: 'both' });
            timer = setTimeout(() => { dimline.style.opacity = 1; }, 1700);
            animation.onfinish = () => { index = (index + 1) % items.length; cycle(); };
        };

        const run = () => {
            const L = HERO_TEXT[lang];
            words = L.words;
            items = [{ kind: 'brand', text: BRAND.text }, ...words.map((w) => ({ kind: 'serif', text: w }))];
            ['asc', 'xh', 'base', 'desc'].forEach((k, n) => { $('t-' + k).textContent = L.lines[n]; });
            fitSerif();
            index = 0;
            clearTimeout(timer);
            clearInterval(slideshow);
            if (animation) { animation.onfinish = null; animation.cancel(); }
            if (prefersReducedMotion) {
                word.style.strokeDashoffset = 0;
                word.style.fillOpacity = 1;
                show(0);
                dimline.style.opacity = 1;
                slideshow = setInterval(() => { index = (index + 1) % items.length; show(index); }, 3200);
            } else {
                cycle();
            }
        };

        document.addEventListener('akai:lang', run);
        (document.fonts ? Promise.all([document.fonts.load('300 100px "Space Grotesk"'), document.fonts.ready]) : Promise.resolve()).then(run);
    };

    // --- Initialization ---
    initLanguage();
    initHero();
    initTalk();
    initSand();
    initFounder();
    initCases();
    initActiveSection();
    initLocalTime();
    initSmoothScroll();
    initBrief();
    initMagneticContact();
    initScrollObservers();

});
