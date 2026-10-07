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

    // --- 15. Founder portrait: tap, click or Enter/Space lifts the scribble (hover does it too, in CSS) ---
    const initFounder = () => {
        const photo = document.querySelector('.founder__photo[role="button"]');
        if (!photo) return;

        const section = photo.closest('.founder');
        const toggle = () => {
            const revealed = photo.classList.toggle('is-revealed');
            section.classList.toggle('is-revealed', revealed);
            photo.setAttribute('aria-pressed', String(revealed));
        };

        photo.addEventListener('click', toggle);
        photo.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
            }
        });
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
    initFounder();
    initActiveSection();
    initLocalTime();
    initSmoothScroll();
    initBrief();
    initMagneticContact();
    initScrollObservers();

});
