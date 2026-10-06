document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // Global Flags
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouchDevice = window.matchMedia('(hover: none)').matches;

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

    // --- 15. Peel-off sticker (drag inside the hero, glide on release, lean while moving) ---
    // The peel itself is CSS (:hover / :active / .touch-active); this adds the drag and the cursor-following light.
    const initSticker = () => {
        const sticker = document.getElementById('sticker');
        const bounds = sticker && sticker.parentElement;
        const container = sticker && sticker.querySelector('.sticker__container');
        if (!sticker || !bounds || !container) return;

        const light = document.getElementById('sticker-light-src');
        const lightFlipped = document.getElementById('sticker-light-flipped-src');
        let x = 0, y = 0, moved = false, glide = 0;

        const limits = () => ({
            maxX: Math.max(0, bounds.clientWidth - sticker.offsetWidth),
            maxY: Math.max(0, bounds.clientHeight - sticker.offsetHeight)
        });
        const place = (nx, ny) => {
            const { maxX, maxY } = limits();
            x = Math.min(Math.max(0, nx), maxX);
            y = Math.min(Math.max(0, ny), maxY);
            sticker.style.translate = `${x}px ${y}px`;
        };
        // Resting spot: top-right, below the technical strip
        const home = () => place(
            bounds.clientWidth - sticker.offsetWidth - bounds.clientWidth * 0.04,
            parseFloat(getComputedStyle(document.documentElement).fontSize) * 9
        );

        home();
        window.addEventListener('resize', () => (moved ? place(x, y) : home()));

        let lastX = 0, lastY = 0, vx = 0, vy = 0, lastT = 0;

        sticker.addEventListener('pointerdown', (e) => {
            cancelAnimationFrame(glide);
            sticker.setPointerCapture(e.pointerId);
            sticker.classList.add('is-dragging');
            if (e.pointerType !== 'mouse') container.classList.add('touch-active');
            lastX = e.clientX; lastY = e.clientY; lastT = e.timeStamp; vx = vy = 0;
        });

        sticker.addEventListener('pointermove', (e) => {
            if (!sticker.hasPointerCapture(e.pointerId)) return;
            const dx = e.clientX - lastX, dy = e.clientY - lastY;
            const dt = Math.max(1, e.timeStamp - lastT);
            vx = dx / dt * 16; vy = dy / dt * 16;
            lastX = e.clientX; lastY = e.clientY; lastT = e.timeStamp;
            moved = true;
            place(x + dx, y + dy);
            if (!prefersReducedMotion) sticker.style.rotate = `${Math.max(-24, Math.min(24, dx * 0.4))}deg`;
        });

        const release = (e) => {
            if (!sticker.hasPointerCapture(e.pointerId)) return;
            sticker.releasePointerCapture(e.pointerId);
            sticker.classList.remove('is-dragging');
            container.classList.remove('touch-active');
            sticker.style.rotate = '0deg';
            if (prefersReducedMotion) return;
            const step = () => {
                vx *= 0.94; vy *= 0.94;
                if (Math.abs(vx) < 0.1 && Math.abs(vy) < 0.1) return;
                place(x + vx, y + vy);
                glide = requestAnimationFrame(step);
            };
            glide = requestAnimationFrame(step);
        };
        sticker.addEventListener('pointerup', release);
        sticker.addEventListener('pointercancel', release);

        // A mouse gets a specular highlight that follows it, and the flipped back lights from the opposite side
        if (light && lightFlipped && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            container.addEventListener('mousemove', (e) => {
                const rect = container.getBoundingClientRect();
                const px = e.clientX - rect.left, py = e.clientY - rect.top;
                light.setAttribute('x', px);
                light.setAttribute('y', py);
                lightFlipped.setAttribute('x', px);
                lightFlipped.setAttribute('y', rect.height - py);
            });
        }
    };

    // --- Initialization ---
    initSticker();
    initActiveSection();
    initLocalTime();
    initSmoothScroll();
    initBrief();
    initGlyphSizes();
    initMagneticContact();
    initScrollObservers();

});
