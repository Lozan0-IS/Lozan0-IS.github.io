document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // Global Flags
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouchDevice = window.matchMedia('(hover: none)').matches;

    // --- 3. Active Section (pill dot follows the section in view) ---
    const initActiveSection = () => {
        const sections = ['work', 'studio', 'contact']
            .map(id => document.getElementById(id))
            .filter(Boolean);
        if (sections.length === 0) return;

        const setActive = (id) => {
            document.querySelectorAll('[data-section]').forEach(link => {
                const isActive = link.dataset.section === id;
                if (isActive) link.setAttribute('aria-current', 'location');
                else link.removeAttribute('aria-current');
                if (link.classList.contains('pill')) link.parentElement.classList.toggle('is-active', isActive);
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

    // --- 4. Mobile Menu (popover under the pill bar) ---
    const initMobileMenu = () => {
        const menuBtn = document.getElementById('menu-btn');
        const popover = document.getElementById('pill-popover');
        if (!menuBtn || !popover) return;

        const isOpen = () => menuBtn.getAttribute('aria-expanded') === 'true';

        const openMenu = () => {
            popover.classList.add('is-open');
            menuBtn.setAttribute('aria-expanded', 'true');
            const first = popover.querySelector('a');
            if (first) first.focus();
        };

        const closeMenu = ({ restoreFocus = true } = {}) => {
            popover.classList.remove('is-open');
            menuBtn.setAttribute('aria-expanded', 'false');
            if (restoreFocus) menuBtn.focus();
        };

        menuBtn.addEventListener('click', () => (isOpen() ? closeMenu() : openMenu()));

        // Following a link moves focus to the destination, so focus is not sent back to the button
        popover.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => closeMenu({ restoreFocus: false }));
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen()) closeMenu();
        });

        document.addEventListener('click', (e) => {
            if (isOpen() && !popover.contains(e.target) && !menuBtn.contains(e.target)) {
                closeMenu({ restoreFocus: false });
            }
        });

        // Tabbing out of the popover closes it rather than leaving it floating over content
        popover.addEventListener('focusout', (e) => {
            if (isOpen() && e.relatedTarget && !popover.contains(e.relatedTarget) && e.relatedTarget !== menuBtn) {
                closeMenu({ restoreFocus: false });
            }
        });
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

    // --- 12. Santiago Local Time ---
    const initLocalTime = () => {
        const wrapper = document.getElementById('local-time');
        const timeEl = wrapper && wrapper.querySelector('time');
        if (!timeEl) return;

        const format = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Santo_Domingo',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
            timeZoneName: 'short'
        });

        // Screen readers get the plain time; the flap tiles are presentation only
        timeEl.innerHTML = '';
        const spoken = document.createElement('span');
        spoken.className = 'sr-only';
        const tiles = document.createElement('span');
        tiles.className = 'flap';
        tiles.setAttribute('aria-hidden', 'true');
        const zone = document.createElement('span');
        zone.setAttribute('aria-hidden', 'true');
        timeEl.append(spoken, tiles, ' ', zone);

        let cells = [];

        // Split flap: a changed character falls away and the new one swings in. Only runs when a digit actually changes.
        const flip = (cell, char) => {
            if (prefersReducedMotion || !cell.animate) {
                cell.textContent = char;
                return;
            }
            cell.animate(
                [{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(90deg)' }],
                { duration: 120, easing: 'cubic-bezier(0.55, 0, 1, 0.45)' }
            ).finished.then(() => {
                cell.textContent = char;
                cell.animate(
                    [{ transform: 'rotateX(-90deg)' }, { transform: 'rotateX(0deg)' }],
                    { duration: 180, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
                );
            });
        };

        const render = () => {
            const now = new Date();
            const parts = format.formatToParts(now);
            const clock = parts.filter(p => p.type === 'hour' || p.type === 'minute' || (p.type === 'literal' && p.value === ':')).map(p => p.value).join('');
            const tz = (parts.find(p => p.type === 'timeZoneName') || {}).value || '';

            spoken.textContent = `${clock} ${tz}`;
            zone.textContent = tz;
            timeEl.dateTime = now.toISOString();

            if (cells.length !== clock.length) {
                tiles.innerHTML = '';
                cells = [...clock].map(char => {
                    const cell = document.createElement('span');
                    cell.className = char === ':' ? 'flap__sep' : 'flap__cell';
                    cell.textContent = char;
                    tiles.appendChild(cell);
                    return cell;
                });
                return;
            }

            [...clock].forEach((char, i) => {
                if (cells[i].textContent !== char) flip(cells[i], char);
            });
        };

        render();
        wrapper.hidden = false;
        setTimeout(() => {
            render();
            setInterval(render, 60000);
        }, 60000 - (Date.now() % 60000));
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

            const lines = ['Hi AKAI,', '', `What I need: ${need}`];
            if (stage) lines.push(`Where I am: ${stage}`);
            if (note) lines.push('', note);
            if (name) lines.push('', `— ${name}`);

            const subject = `New project: ${need}`;
            window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;

            status.textContent = `Your email app should now be open with the brief written. Nothing opened? Write to ${recipient}.`;
        });
    };

    // --- 14. Wordmark glyph dimensions (shown in the selection label on hover) ---
    const initGlyphSizes = () => {
        const glyphs = document.querySelectorAll('.glyph');
        if (glyphs.length === 0 || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

        const measure = () => {
            glyphs.forEach(glyph => {
                const { width, height } = glyph.getBoundingClientRect();
                glyph.dataset.size = `${Math.round(width)} × ${Math.round(height)}`;
            });
        };

        // Measure after the entrance has settled and the webfont is in, then on resize
        (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(measure, 800));
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(measure, 150);
        });
    };

    // --- 15. Proximity Grid (AKAI Experiments) ---
    // A live version of the experiments dot grid: dots near the pointer swell and take the project colour;
    // a tap or click sends a ring through the field. Draws only while something is happening.
    const initProximityGrid = () => {
        const host = document.querySelector('[data-proximity-grid]');
        if (!host) return;

        const canvas = document.createElement('canvas');
        canvas.className = 'proximity-grid__canvas';
        canvas.setAttribute('aria-hidden', 'true');
        host.appendChild(canvas);
        host.classList.add('is-live');
        const ctx = canvas.getContext('2d');

        const styles = getComputedStyle(host);
        const accent = styles.getPropertyValue('--project-color').trim() || '#2A7A5F';
        const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#141413';
        const SPACING = 26;
        const BASE_R = 2;
        const MAX_R = 5;
        const REACH = 130;

        let dots = [];
        let width = 0;
        let height = 0;
        let pointer = null;
        let presence = 0; // eases the highlight in/out when the pointer enters or leaves
        let ripples = [];
        let frame = null;

        const hexToRgb = (hex) => {
            const n = parseInt(hex.replace('#', ''), 16);
            return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        };
        const accentRgb = hexToRgb(accent);
        const inkRgb = hexToRgb(ink);

        const layout = () => {
            const rect = host.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = rect.width;
            height = rect.height;
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const cols = Math.floor(width / SPACING);
            const rows = Math.floor(height / SPACING);
            const offsetX = (width - (cols - 1) * SPACING) / 2;
            const offsetY = (height - (rows - 1) * SPACING) / 2;
            dots = [];
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    dots.push({ x: offsetX + c * SPACING, y: offsetY + r * SPACING });
                }
            }
            draw();
        };

        const draw = () => {
            ctx.clearRect(0, 0, width, height);
            const now = performance.now();
            ripples = ripples.filter(r => now - r.start < r.life);

            dots.forEach(dot => {
                let energy = 0;
                if (pointer && presence > 0) {
                    const d = Math.hypot(dot.x - pointer.x, dot.y - pointer.y);
                    if (d < REACH) energy = (1 - d / REACH) ** 2 * presence;
                }
                ripples.forEach(r => {
                    const t = (now - r.start) / r.life;
                    const radius = t * r.maxRadius;
                    const band = Math.abs(Math.hypot(dot.x - r.x, dot.y - r.y) - radius);
                    if (band < 30) energy = Math.max(energy, (1 - band / 30) * (1 - t));
                });

                const radius = BASE_R + (MAX_R - BASE_R) * energy;
                const mix = (a, b) => Math.round(a + (b - a) * energy);
                const alpha = 0.18 + 0.82 * energy;
                ctx.fillStyle = `rgba(${mix(inkRgb[0], accentRgb[0])}, ${mix(inkRgb[1], accentRgb[1])}, ${mix(inkRgb[2], accentRgb[2])}, ${alpha})`;
                ctx.beginPath();
                ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
                ctx.fill();
            });
        };

        const tick = () => {
            const target = pointer ? 1 : 0;
            presence += (target - presence) * (prefersReducedMotion ? 1 : 0.2);
            if (Math.abs(target - presence) < 0.01) presence = target;
            draw();
            const busy = presence !== target || ripples.length > 0;
            frame = busy ? requestAnimationFrame(tick) : null;
        };

        const wake = () => {
            if (!frame) frame = requestAnimationFrame(tick);
        };

        const local = (e) => {
            const rect = host.getBoundingClientRect();
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        };

        host.addEventListener('pointermove', (e) => {
            if (e.pointerType !== 'mouse' && e.buttons === 0) return;
            pointer = local(e);
            draw();
            wake();
        });

        host.addEventListener('pointerleave', () => {
            pointer = null;
            wake();
        });

        host.addEventListener('pointerdown', (e) => {
            pointer = local(e);
            if (!prefersReducedMotion) {
                ripples.push({ ...pointer, start: performance.now(), life: 900, maxRadius: Math.hypot(width, height) * 0.6 });
            }
            wake();
        });

        host.addEventListener('pointerup', (e) => {
            if (e.pointerType !== 'mouse') {
                pointer = null;
                wake();
            }
        });

        if ('ResizeObserver' in window) {
            new ResizeObserver(layout).observe(host);
        } else {
            window.addEventListener('resize', layout);
        }
        layout();
    };

    // --- Initialization ---
    initActiveSection();
    initLocalTime();
    initMobileMenu();
    initSmoothScroll();
    initBrief();
    initGlyphSizes();
    initProximityGrid();
    initMagneticContact();
    initScrollObservers();

});
