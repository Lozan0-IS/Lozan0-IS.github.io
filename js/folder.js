/* A folder that opens and lets its notes float out of it. A plain-JS port of React Bits' FolderFloat (no React).
   Physics (floating, collisions, drag and throw) uses a self-hosted copy of matter-js, loaded only the first time a
   folder opens on a device with a mouse; touch screens, reduced motion and failed loads keep the plain open/close. */
(() => {
    'use strict';

    const PAD = 28, CHAR = 6.8, GAP = 12, ROW = 52, DRAG_MIN = 4, ZONE_PAD = 8;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');

    // Same pseudo-random per index, so a folder always lays out the same way
    const jitter = (i) => {
        const x = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
        return x - Math.floor(x);
    };

    const make = (tag, cls) => {
        const el = document.createElement(tag);
        if (cls) el.className = cls;
        return el;
    };

    let matterPromise = null;
    const loadMatter = () => {
        if (!matterPromise) {
            matterPromise = new Promise((resolve) => {
                if (window.Matter) return resolve(window.Matter);
                const s = document.createElement('script');
                s.src = '/js/vendor/matter.min.js';
                s.async = true;
                s.onload = () => resolve(window.Matter || null);
                s.onerror = () => resolve(null);
                document.head.append(s);
            });
        }
        return matterPromise;
    };

    // Pack the pills (or page cards) into centred rows above the folder
    const layout = (labels, spread, lift, tilt, sizes) => {
        const rowH = Math.max(ROW, ...sizes.map((s) => (s ? s.h + 18 : 0)));
        const rows = [];
        let row = [], width = 0;
        labels.forEach((text, i) => {
            const pw = sizes[i] ? sizes[i].w : PAD + text.length * CHAR;
            if (row.length && width + GAP + pw > spread * 2) {
                rows.push({ items: row, width });
                row = [];
                width = 0;
            }
            row.push({ i, pw });
            width += (row.length > 1 ? GAP : 0) + pw;
        });
        if (row.length) rows.push({ items: row, width });

        const pos = [];
        rows.forEach((r, ri) => {
            let x = -r.width / 2;
            const shift = (ri % 2 ? 1 : -1) * Math.min(16, spread * 0.1);
            r.items.forEach(({ i, pw }) => {
                const j = jitter(i);
                const extra = sizes[i] ? Math.max(0, sizes[i].h - 34) : 0;   // a tall card keeps its bottom edge where a pill's would be
                pos[i] = { x: x + pw / 2 + shift + (j - 0.5) * 6, y: -lift - extra - ri * rowH - j * 6, r: tilt * (j * 2 - 1) };
                x += pw + GAP;
            });
        });
        return pos;
    };

    const mount = (host, options) => {
        const o = Object.assign({
            items: [], label: '', sublabel: '', width: 200, height: 148, radius: 14, spread: 180, lift: 26, tilt: 8,
            flapAngle: 34, restAngle: 16, openDuration: 520, stagger: 45, bounce: 0.3, drift: 0.5,
            physics: true, closeOnSelect: true, onSelect() {}
        }, options);

        const n = o.items.length;
        const hoverCapable = matchMedia('(hover: hover) and (pointer: fine)').matches;
        let open = false, live = false, sizes = [], pos = [];
        let liveTimer = 0, popTimer = 0;
        const world = { engine: null, bodies: [], sizes: [], raf: 0, last: 0, t0: 0, drag: null, zone: null, M: null };

        // ---- DOM
        const root = make('div', 'folder-float');
        const vars = {
            '--ff-w': o.width + 'px', '--ff-h': o.height + 'px', '--ff-r': o.radius + 'px',
            '--ff-spread': o.spread + 'px', '--ff-lift': o.lift + 'px', '--ff-angle': o.flapAngle + 'deg',
            '--ff-rest': o.restAngle + 'deg', '--ff-open': o.openDuration + 'ms',
            '--ff-close': Math.round(o.openDuration * 0.6) + 'ms', '--ff-stagger': o.stagger + 'ms', '--ff-n': n,
            '--ff-spring': `cubic-bezier(0.34, ${(1 + o.bounce * 1.9).toFixed(2)}, 0.64, 1)`
        };
        Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
        if (o.physics) root.setAttribute('data-physics', '');

        const itemsBox = make('div', 'folder-float__items');
        const pills = o.items.map((item, i) => {
            const b = make('button', 'folder-float__item');
            b.type = 'button';
            b.tabIndex = -1;
            b.setAttribute('aria-hidden', 'true');
            b.style.setProperty('--i', i);
            const span = make('span', 'folder-float__drift');
            if (item.image) {
                // A page card: the picture is only fetched the first time the folder opens
                b.classList.add('folder-float__item--card');
                b.setAttribute('aria-label', item.label);
                const img = make('img');
                img.alt = '';
                img.width = 400;
                img.height = 250;
                img.decoding = 'async';
                img.dataset.src = item.image;
                const cap = make('span', 'folder-float__cap');
                cap.textContent = item.label;
                span.append(img, cap);
            } else {
                span.textContent = item.label;
            }
            b.append(span);
            itemsBox.append(b);
            return b;
        });

        const folder = make('div', 'folder-float__folder');
        const front = make('span', 'folder-float__front');
        front.setAttribute('aria-hidden', 'true');
        const lab = make('span', 'folder-float__label');
        lab.textContent = o.label;
        const sub = make('span', 'folder-float__sub');
        sub.textContent = o.sublabel || `${n} ${n === 1 ? 'note' : 'notes'}`;
        front.append(lab, sub);
        const back = make('span', 'folder-float__back');
        back.setAttribute('aria-hidden', 'true');
        const paper = make('span', 'folder-float__paper');
        paper.setAttribute('aria-hidden', 'true');
        const trigger = make('button', 'folder-float__trigger');
        trigger.type = 'button';
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-label', `${o.label}, ${sub.textContent}`);
        folder.append(back, paper, front, trigger);
        // The trigger comes first in the DOM, so Tab goes from the folder into its pills; z-index keeps them visually on top
        root.append(folder, itemsBox);
        host.append(root);

        // ---- measuring and placing the pills
        const place = () => {
            pos = layout(o.items.map((it) => it.label), o.spread, o.lift, o.tilt, sizes);
            pills.forEach((b, i) => {
                b.style.setProperty('--x', pos[i].x.toFixed(1) + 'px');
                b.style.setProperty('--y', pos[i].y.toFixed(1) + 'px');
                b.style.setProperty('--r', pos[i].r.toFixed(2) + 'deg');
            });
        };
        const measure = () => {
            sizes = pills.map((b) => ({ w: b.offsetWidth, h: b.offsetHeight }));
            place();
        };
        place();
        measure();
        if (document.fonts) document.fonts.ready.then(measure);

        // ---- physics: a zero-gravity room where the pills drift, collide and can be thrown
        const stopPhysics = () => {
            clearTimeout(liveTimer);
            cancelAnimationFrame(world.raf);
            world.raf = 0;
            if (world.engine) {
                const M = world.M;
                world.bodies.forEach((b, i) => {
                    pills[i].style.setProperty('--x', b.position.x.toFixed(1) + 'px');
                    pills[i].style.setProperty('--y', (b.position.y - world.sizes[i].h / 2).toFixed(1) + 'px');
                });
                M.Composite.clear(world.engine.world, false, true);
                M.Engine.clear(world.engine);
                world.engine = null;
            }
            world.bodies = [];
            world.drag = null;
            live = false;
            root.removeAttribute('data-live');
        };

        const startPhysics = () => {
            if (world.engine || !open) return;
            loadMatter().then((M) => {
                if (!M || !open || world.engine) return;
                const { Bodies, Body, Composite, Engine } = M;
                world.M = M;
                world.engine = Engine.create({ gravity: { x: 0, y: 0 } });
                world.engine.enableSleeping = false;
                world.sizes = pills.map((b) => ({ w: b.offsetWidth, h: b.offsetHeight }));
                const ys = pos.map((p) => p.y);
                const zone = {
                    left: -o.spread - ZONE_PAD, right: o.spread + ZONE_PAD,
                    top: Math.min(...ys) - ZONE_PAD, bottom: -o.lift + Math.max(...world.sizes.map((s) => s.h))
                };
                world.zone = zone;
                world.bodies = pills.map((b, i) => {
                    const { w: bw, h: bh } = world.sizes[i];
                    const body = Bodies.rectangle(pos[i].x, pos[i].y + bh / 2, bw, bh, {
                        chamfer: { radius: Math.min(bh / 2 - 1, 16) }, restitution: 0.55, friction: 0, frictionAir: 0.08, inertia: Infinity
                    });
                    body.plugin = { phase: jitter(i) * Math.PI * 2 };
                    return body;
                });
                const T = 80, cx = (zone.left + zone.right) / 2, cy = (zone.top + zone.bottom) / 2;
                const walls = [
                    Bodies.rectangle(cx, zone.top - T / 2, zone.right - zone.left + 2 * T, T, { isStatic: true }),
                    Bodies.rectangle(cx, zone.bottom + T / 2, zone.right - zone.left + 2 * T, T, { isStatic: true }),
                    Bodies.rectangle(zone.left - T / 2, cy, T, zone.bottom - zone.top + 2 * T, { isStatic: true }),
                    Bodies.rectangle(zone.right + T / 2, cy, T, zone.bottom - zone.top + 2 * T, { isStatic: true })
                ];
                Composite.add(world.engine.world, [...world.bodies, ...walls]);
                live = true;
                world.last = 0;
                world.t0 = performance.now();
                root.setAttribute('data-live', '');

                const tick = (now) => {
                    if (!world.engine) return;
                    const dt = world.last ? Math.min(32, now - world.last) : 16;
                    world.last = now;
                    const t = (now - world.t0) / 1000;
                    const k = o.drift * 0.00005 * Math.min(1, t / 2);
                    world.bodies.forEach((b, i) => {
                        if (world.drag && world.drag.i === i) return;
                        const ph = b.plugin.phase;
                        Body.applyForce(b, b.position, { x: Math.sin(t * 0.9 + ph) * k * b.mass, y: Math.cos(t * 1.3 + ph * 1.7) * k * b.mass });
                    });
                    Engine.update(world.engine, dt);
                    world.bodies.forEach((b, i) => {
                        pills[i].style.setProperty('--x', b.position.x.toFixed(1) + 'px');
                        pills[i].style.setProperty('--y', (b.position.y - world.sizes[i].h / 2).toFixed(1) + 'px');
                    });
                    world.raf = requestAnimationFrame(tick);
                };
                world.raf = requestAnimationFrame(tick);
            });
        };

        // ---- open / close
        const set = (next) => {
            if (next === open) return;
            open = next;
            if (open) pills.forEach((b) => { const im = b.querySelector('img[data-src]'); if (im && !im.src) im.src = im.dataset.src; });
            root.toggleAttribute('data-open', open);
            trigger.setAttribute('aria-expanded', String(open));
            pills.forEach((b) => {
                b.tabIndex = open ? 0 : -1;
                if (open) b.removeAttribute('aria-hidden'); else b.setAttribute('aria-hidden', 'true');
            });
            clearTimeout(liveTimer);
            if (!open) {
                stopPhysics();
            } else if (o.physics && hoverCapable && !reduced.matches) {
                liveTimer = setTimeout(startPhysics, o.openDuration + (n - 1) * o.stagger + 80);
            }
        };

        const pick = (i) => {
            o.onSelect(o.items[i].value, i);
            clearTimeout(popTimer);
            pills[i].setAttribute('data-pop', '');
            popTimer = setTimeout(() => pills[i].removeAttribute('data-pop'), 320);
            if (o.closeOnSelect) {
                // The pill is about to be hidden, so a keyboard user's focus goes back to the folder
                if (pills.includes(document.activeElement)) trigger.focus();
                set(false);
            }
        };

        // ---- pointer drag inside the cloud (only while the physics room is live)
        const pointerAt = (e) => {
            const r = itemsBox.getBoundingClientRect();
            return { x: e.clientX - r.left, y: e.clientY - r.top };
        };
        pills.forEach((b, i) => {
            b.addEventListener('pointerdown', (e) => {
                if (!live || e.button !== 0) return;
                const body = world.bodies[i];
                if (!body) return;
                const p = pointerAt(e);
                world.drag = { i, id: e.pointerId, dx: body.position.x - p.x, dy: body.position.y - p.y, sx: e.clientX, sy: e.clientY, moved: false };
                try { b.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
            });
            b.addEventListener('pointermove', (e) => {
                const d = world.drag;
                if (!d || d.i !== i || d.id !== e.pointerId) return;
                if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) >= DRAG_MIN) {
                    d.moved = true;
                    b.setAttribute('data-drag', '');
                }
                if (!d.moved) return;
                const body = world.bodies[i];
                const { w: bw, h: bh } = world.sizes[i];
                const z = world.zone, p = pointerAt(e);
                const x = Math.min(z.right - bw / 2, Math.max(z.left + bw / 2, p.x + d.dx));
                const y = Math.min(z.bottom - bh / 2, Math.max(z.top + bh / 2, p.y + d.dy));
                world.M.Body.setVelocity(body, { x: (x - body.position.x) * 0.6, y: (y - body.position.y) * 0.6 });
                world.M.Body.setPosition(body, { x, y });
            });
            const end = (e) => {
                const d = world.drag;
                if (!d || d.i !== i || d.id !== e.pointerId) return;
                world.drag = null;
                b.removeAttribute('data-drag');
                try { b.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
                if (!d.moved && e.type === 'pointerup') pick(i);
            };
            b.addEventListener('pointerup', end);
            b.addEventListener('pointercancel', end);
            // Mouse clicks outside the physics room, and keyboard activation (detail 0) always pick
            b.addEventListener('click', (e) => { if (!live || e.detail === 0) pick(i); });
        });

        // ---- triggers
        if (hoverCapable) {
            root.addEventListener('pointerenter', () => set(true));
            root.addEventListener('pointerleave', () => { if (!world.drag) set(false); });
        }
        // With a mouse the hover already opened it, so a click must not close it again; keyboard and touch toggle
        trigger.addEventListener('click', (e) => { if (hoverCapable && e.detail > 0) return; set(!open); });
        root.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && open) { e.stopPropagation(); set(false); trigger.focus(); }
        });
        const outside = (e) => { if (open && !root.contains(e.target)) set(false); };
        document.addEventListener('pointerdown', outside);

        return {
            close: () => set(false),
            destroy() {
                document.removeEventListener('pointerdown', outside);
                clearTimeout(popTimer);
                stopPhysics();
                root.remove();
            }
        };
    };

    window.AKAIFolder = { mount };
})();
