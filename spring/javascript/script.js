const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

var grace = 1.75;
var bounce = 0.5;
var G = 9.81;
var simFactor = 200; // lower values make slower animations

// spring settings
var restLength = 120;
var stiffness = 60; // higher = stiffer spring
var damping = 1.2;  // higher = oscillation dies faster
var endRadius = 12;
var coils = 8;
var minLengthRatio = 0.3;
var coilThickness = 0.5; // how much of the drawn coil width is solid for end caps (0 = just the centre line)
var subSteps = 10;  // physics steps per frame (stiff springs need this) hehe "stiff"

const springs = [];
const ends = []; // flat list of every end cap, 2 per spring
const g = G * simFactor;
const mouse = { x: 0, y: 0 };

var springAmount = 1; // yo don't fucking touch this plz
var maxBalls = 100;
var fps = 0;
var showVectors = true;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);

// distance from point (px, py) to the line segment (ax, ay)-(bx, by)
function pointSegDist(px, py, ax, ay, bx, by) {
    const sx = bx - ax, sy = by - ay;
    const l2 = sx * sx + sy * sy;
    let t = l2 > 0 ? ((px - ax) * sx + (py - ay) * sy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + sx * t), py - (ay + sy * t));
}

function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
    const o = (px, py, qx, qy, rx, ry) => (ry - py) * (qx - px) - (qy - py) * (rx - px);
    return o(ax, ay, cx, cy, dx, dy) * o(bx, by, cx, cy, dx, dy) < 0 &&
           o(ax, ay, bx, by, cx, cy) * o(ax, ay, bx, by, dx, dy) < 0;
}

// true if a spring from (ax, ay) to (bx, by) wouldn't touch or cross any existing spring
function spawnClear(ax, ay, bx, by, clearance) {
    for (const s of springs) {
        const sa = s.a.pos, sb = s.b.pos;
        if (segmentsCross(ax, ay, bx, by, sa.x, sa.y, sb.x, sb.y)) return false;
        const d = Math.min(
            pointSegDist(ax, ay, sa.x, sa.y, sb.x, sb.y),
            pointSegDist(bx, by, sa.x, sa.y, sb.x, sb.y),
            pointSegDist(sa.x, sa.y, ax, ay, bx, by),
            pointSegDist(sb.x, sb.y, ax, ay, bx, by)
        );
        if (d < clearance) return false;
    }
    return true;
}

function createSpring(len, r, c) {
    // new springs spawn in a free spot so they don't start out tangled in another spring
    let cx, cy, ang, hx, hy;
    for (let attempt = 0; attempt < 60; attempt++) {
        const areaW = attempt < 20 ? canvas.width / 2 : canvas.width; // top-left quarter first, then anywhere
        const areaH = attempt < 20 ? canvas.height / 2 : canvas.height;
        cx = Math.random() * areaW;
        cy = Math.random() * areaH;
        ang = Math.random() * Math.PI * 2;
        hx = Math.cos(ang) * len / 2;
        hy = Math.sin(ang) * len / 2;
        if (spawnClear(cx - hx, cy - hy, cx + hx, cy + hy, r * 2 + 10)) break;
    }
    const vx = (Math.random() * canvas.width * 2) - canvas.width;
    const vy = (Math.random() * canvas.height * 2) - canvas.height;

    const makeEnd = (x, y) => ({
        pos: { x, y },
        vel: { x: vx, y: vy },
        size: r,
        held: false,
        pinned: false,
        touchId: null,
        owner: null,
    });

    const s = {
        id: springs.length + 1,
        a: makeEnd(cx - hx, cy - hy), // top end
        b: makeEnd(cx + hx, cy + hy), // bottom end
        rest: len,
        minLen: len * minLengthRatio,
        colour: c,
    };
    s.a.owner = s;
    s.b.owner = s;
    springs.push(s);
    ends.push(s.a, s.b);
}

function canvasPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function isFixed(end) { return end.held || end.pinned; }

function togglePin(end) {
    end.pinned = !end.pinned;
    if (end.pinned) { end.vel.x = 0; end.vel.y = 0; }
}

function nearestEnd(p, ok) {
    let best = null, bestD = Infinity;
    for (const end of ends) {
        if (!ok(end)) continue;
        const d = Math.hypot(p.x - end.pos.x, p.y - end.pos.y);
        if (d <= end.size * grace && d < bestD) { best = end; bestD = d; }
    }
    return best;
}

function resetSprings() {
    ends.forEach(end => { end.pinned = false; });
    springs.forEach(s => {
        const r = s.b.size;
        const x = r + Math.random() * Math.max(0, canvas.width - 2 * r);
        s.b.pos.x = x;
        s.b.pos.y = canvas.height - r;
        s.a.pos.x = x;
        s.a.pos.y = canvas.height - r - s.rest;
    });
}

window.addEventListener('mousemove', e => {
    Object.assign(mouse, canvasPos(e));
});

canvas.addEventListener('mousedown', e => {
    const p = canvasPos(e);
    if (e.shiftKey && e.button === 0) { // shift+click = pin/unpin that end
        const target = nearestEnd(p, () => true);
        if (target) togglePin(target);
        return;
    }
    ends.forEach(end => { if (end.touchId == null) end.held = false; });
    const hit = nearestEnd(p, end => end.touchId == null);
    if (hit) hit.held = true;
    if (e.button === 2) {
        e.preventDefault();
        resetSprings();
    }
});

canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();
});

window.addEventListener('mouseup', () => {
    ends.forEach(end => { if (end.touchId == null) end.held = false; });
});

const touches = new Map();
let lastTap = { t: 0, x: 0, y: 0 };

// long-press an end on touch screens to pin/unpin it
const pressTimers = new Map();
function cancelPress(id) {
    const pt = pressTimers.get(id);
    if (pt) { clearTimeout(pt.timer); pressTimers.delete(id); }
}

canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
        const p = canvasPos(t);
        touches.set(t.identifier, p);

        const hit = nearestEnd(p, end => end.touchId == null && !end.held);
        if (hit) {
            hit.held = true;
            hit.touchId = t.identifier;
            const id = t.identifier;
            pressTimers.set(id, {
                x: p.x, y: p.y,
                timer: setTimeout(() => {
                    pressTimers.delete(id);
                    if (hit.touchId === id) {
                        togglePin(hit);
                        if (navigator.vibrate) navigator.vibrate(30);
                    }
                }, 500),
            });
        } else {
            const now = performance.now();
            if (now - lastTap.t < 300 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 40) {
                resetSprings();
                lastTap.t = 0;
            } else {
                lastTap = { t: now, x: p.x, y: p.y };
            }
        }
    }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
        const p = touches.get(t.identifier);
        if (p) Object.assign(p, canvasPos(t));
        const pt = pressTimers.get(t.identifier);
        if (pt && p && Math.hypot(p.x - pt.x, p.y - pt.y) > 12) cancelPress(t.identifier);
    }
}, { passive: false });

function touchRelease(e) {
    for (const t of e.changedTouches) {
        touches.delete(t.identifier);
        cancelPress(t.identifier);
        ends.forEach(end => {
            if (end.touchId === t.identifier) { end.held = false; end.touchId = null; }
        });
    }
}
canvas.addEventListener('touchend', touchRelease);
canvas.addEventListener('touchcancel', touchRelease);

function setspringAmount(n) {
    const old = springAmount;
    springAmount = Math.max(1, Math.min(maxBalls, n));
    for (let i = old; i < springAmount; i++) createSpring(restLength, endRadius, 'black');
    for (let i = old; i > springAmount; i--) { springs.pop(); ends.pop(); ends.pop(); }
}

window.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp') setspringAmount(springAmount + 1);
    if (e.key === 'ArrowDown') setspringAmount(springAmount - 1);
    if (e.key === 'p' || e.key === 'P') { // pin/unpin the end under the cursor
        const target = nearestEnd(mouse, () => true);
        if (target) togglePin(target);
    }
    if (e.key === 'u' || e.key === 'U') ends.forEach(end => { end.pinned = false; }); // unpin all
});
document.getElementById('plus').addEventListener('click', () => setspringAmount(springAmount + 1));
document.getElementById('minus').addEventListener('click', () => setspringAmount(springAmount - 1));

// push two end caps apart if closer than minDist, and bounce them off each other.
// used for end-vs-end collisions AND for the spring's "fully squashed" limit
function separate(a, b, minDist) {
    if (isFixed(a) && isFixed(b)) return;

    let dx = b.pos.x - a.pos.x;
    let dy = b.pos.y - a.pos.y;
    let dist = Math.hypot(dx, dy);
    if (dist >= minDist) return;
    if (dist === 0) { dx = 1; dy = 0; dist = 1; }

    const nx = dx / dist, ny = dy / dist; // collision normal

    const ima = isFixed(a) ? 0 : 1;
    const imb = isFixed(b) ? 0 : 1;
    const total = ima + imb;

    const overlap = minDist - dist;
    a.pos.x -= nx * overlap * ima / total;
    a.pos.y -= ny * overlap * ima / total;
    b.pos.x += nx * overlap * imb / total;
    b.pos.y += ny * overlap * imb / total;

    const rv = (b.vel.x - a.vel.x) * nx + (b.vel.y - a.vel.y) * ny;
    if (rv < 0) {
        const e = -rv < 30 ? 0 : bounce; // no bounce at tiny speeds, stack jitter ewwy
        const imp = -(1 + e) * rv / total;
        a.vel.x -= imp * nx * ima;
        a.vel.y -= imp * ny * ima;
        b.vel.x += imp * nx * imb;
        b.vel.y += imp * ny * imb;
    }
}

// half-width of a coil as drawn (used by drawCoil and by the coil collision)
function coilAmp(s, d) {
    return Math.min(24, 12 * Math.sqrt(s.rest / d));
}

// an end cap vs another spring's coil, which counts as a thick line from end a to end b.
// the push gets shared between the cap and the coil's two ends depending on where it hit
function collideEndWithCoil(p, s) {
    const a = s.a, b = s.b;
    const sx = b.pos.x - a.pos.x;
    const sy = b.pos.y - a.pos.y;
    const len2 = sx * sx + sy * sy;
    if (len2 < 1e-6) return;
    const len = Math.sqrt(len2);

    // closest point on the coil to the cap (t = 0 is end a, t = 1 is end b)
    let t = ((p.pos.x - a.pos.x) * sx + (p.pos.y - a.pos.y) * sy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = a.pos.x + sx * t;
    const cy = a.pos.y + sy * t;

    const dx = p.pos.x - cx;
    const dy = p.pos.y - cy;
    let dist = Math.hypot(dx, dy);
    const minDist = p.size + coilAmp(s, len) * coilThickness;
    if (dist >= minDist) return;

    let nx, ny; // normal pointing from the coil toward the cap
    if (dist < 1e-6) { nx = -sy / len; ny = sx / len; dist = 0; } // dead centre on the line, push sideways
    else { nx = dx / dist; ny = dy / dist; }

    const ip = isFixed(p) ? 0 : 1;
    const ia = isFixed(a) ? 0 : 1;
    const ib = isFixed(b) ? 0 : 1;
    const wa = 1 - t, wb = t;
    const total = ip + wa * wa * ia + wb * wb * ib;
    if (total === 0) return;

    const k = (minDist - dist) / total;
    p.pos.x += nx * k * ip;
    p.pos.y += ny * k * ip;
    a.pos.x -= nx * k * wa * ia;
    a.pos.y -= ny * k * wa * ia;
    b.pos.x -= nx * k * wb * ib;
    b.pos.y -= ny * k * wb * ib;

    const cvx = wa * a.vel.x + wb * b.vel.x; // velocity of the contact point on the coil
    const cvy = wa * a.vel.y + wb * b.vel.y;
    const rv = (p.vel.x - cvx) * nx + (p.vel.y - cvy) * ny;
    if (rv < 0) {
        const e = -rv < 30 ? 0 : bounce;
        const imp = -(1 + e) * rv / total;
        p.vel.x += nx * imp * ip;
        p.vel.y += ny * imp * ip;
        a.vel.x -= nx * imp * wa * ia;
        a.vel.y -= ny * imp * wa * ia;
        b.vel.x -= nx * imp * wb * ib;
        b.vel.y -= ny * imp * wb * ib;
    }
}

function collideCoils() {
    for (const p of ends) {
        for (const s of springs) {
            if (s !== p.owner) collideEndWithCoil(p, s);
        }
    }
}

function collideEnds() {
    for (let i = 0; i < ends.length; i++) {
        for (let j = i + 1; j < ends.length; j++) {
            const a = ends[i], b = ends[j];
            if (a.owner === b.owner) continue; // same spring: handled by minLen
            separate(a, b, a.size + b.size);
        }
    }

    collideCoils(); // caps can't poke through other springs' coils

    // walllllls
    ends.forEach(end => {
        if (isFixed(end)) return;
        end.pos.x = Math.max(end.size, Math.min(canvas.width - end.size, end.pos.x));
        end.pos.y = Math.max(end.size, Math.min(canvas.height - end.size, end.pos.y));
    });
}

// Hooke's law along the spring axis + damping on the relative speed ( FUCK YEAH HOOKE )
function springForce(s, h) {
    const a = s.a, b = s.b;
    const dx = b.pos.x - a.pos.x;
    const dy = b.pos.y - a.pos.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) return;
    const nx = dx / d, ny = dy / d;

    const stretch = d - s.rest;
    const relv = (b.vel.x - a.vel.x) * nx + (b.vel.y - a.vel.y) * ny;
    const f = stiffness * stretch + damping * relv; // positive = pulls ends together

    if (!isFixed(a)) { a.vel.x += nx * f * h; a.vel.y += ny * f * h; }
    if (!isFixed(b)) { b.vel.x -= nx * f * h; b.vel.y -= ny * f * h; }
}

function moveHeld(dt) {
    ends.forEach(end => {
        if (end.pinned && !end.held) { end.vel.x = 0; end.vel.y = 0; return; }
        if (!end.held) return;
        const src = end.touchId != null ? touches.get(end.touchId) : mouse;
        if (!src) { end.held = false; end.touchId = null; return; }
        const vx = (src.x - end.pos.x) / dt;
        const vy = (src.y - end.pos.y) / dt;
        end.vel.x += (vx - end.vel.x) * 0.5;
        end.vel.y += (vy - end.vel.y) * 0.5;
        end.pos.x = src.x;
        end.pos.y = src.y;
    });
}

function integrate(end, h) {
    if (isFixed(end)) return;

    const fric = Math.pow(0.98, 1 / subSteps);

    end.vel.y += g * h;
    end.pos.x += end.vel.x * h;
    end.pos.y += end.vel.y * h;

    const floor = canvas.height - end.size;
    if (end.pos.y > floor) {
        end.pos.y = floor;
        end.vel.y *= -bounce;
        end.vel.x *= fric;
        if (Math.abs(end.vel.y) < 20) end.vel.y = 0;
    }
    const ceil = end.size;
    if (end.pos.y < ceil) {
        end.pos.y = ceil;
        end.vel.y *= -bounce;
        end.vel.x *= fric;
        if (Math.abs(end.vel.y) < 20) end.vel.y = 0;
    }
    if (end.pos.x < end.size) { end.pos.x = end.size; end.vel.x *= -bounce; }
    if (end.pos.x > canvas.width - end.size) {
        end.pos.x = canvas.width - end.size;
        end.vel.x *= -bounce;
    }
}

function update(dt) {
    moveHeld(dt);

    // stiff springs explode with big timesteps, so chop the frame up duhh
    const h = dt / subSteps;
    for (let i = 0; i < subSteps; i++) {
        springs.forEach(s => springForce(s, h));
        ends.forEach(end => integrate(end, h));
        springs.forEach(s => separate(s.a, s.b, s.minLen)); // can't squash past solid length cause no duh
        collideEnds();
    }
}


function arrowHead(x0, y0, x1, y1, colour, r = 8) {
    const len = Math.hypot(x1 - x0, y1 - y0);   if (len < 1) return;
    const size = Math.min(r, len / 1.5);
    const a = Math.atan2(y1 - y0, x1 - x0);
    const cx = x1 - size * Math.cos(a);
    const cy = y1 - size * Math.sin(a);

    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
        const ang = a + (2 * Math.PI * k) / 3;
        const x = cx + size * Math.cos(ang);
        const y = cy + size * Math.sin(ang);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
}

function arrow(x0, y0, x1, y1, colour) {
    ctx.beginPath();
    ctx.strokeStyle = colour;
    ctx.lineWidth = 3;
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    arrowHead(x0, y0, x1, y1, colour);
}

function drawArrow(end) {
    const arrowScale = 0.1;
    const x0 = end.pos.x;
    const y0 = end.pos.y;
    const x1 = x0 + end.vel.x * arrowScale;
    const y1 = y0 + end.vel.y * arrowScale;

    arrow(x0, y0, x1, y1, 'red');
    arrow(x0, y0, x1, y0, 'blue');
    arrow(x0, y0, x0, y1, 'green');
}

function drawCoil(s) {
    const ax = s.a.pos.x, ay = s.a.pos.y;
    const bx = s.b.pos.x, by = s.b.pos.y;
    const d = Math.hypot(bx - ax, by - ay);
    if (d < 1) return;

    const nx = (bx - ax) / d, ny = (by - ay) / d;
    const px = -ny, py = nx;

    const lead = Math.min(s.a.size, d * 0.3);
    const amp = coilAmp(s, d);
    const steps = coils * 2;

    ctx.beginPath();
    ctx.moveTo(ax, ay);
    for (let i = 0; i <= steps; i++) {
        const t = lead + (d - 2 * lead) * (i / steps);
        const side = (i === 0 || i === steps) ? 0 : (i % 2 ? 1 : -1);
        ctx.lineTo(ax + nx * t + px * side * amp, ay + ny * t + py * side * amp);
    }
    ctx.lineTo(bx, by);
    ctx.strokeStyle = s.colour;
    ctx.lineWidth = 2;
    ctx.stroke();
}

function drawEnd(end, colour) {
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(end.pos.x, end.pos.y, end.size, 0, 2 * Math.PI);
    ctx.strokeStyle = colour;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(end.pos.x, end.pos.y, 0.25 * end.size, 0, 2 * Math.PI);
    ctx.fillStyle = colour;
    ctx.fill();

    if (end.pinned) { // pin marker :3
        ctx.beginPath();
        ctx.arc(end.pos.x, end.pos.y, end.size + 5, 0, 2 * Math.PI);
        ctx.strokeStyle = 'crimson';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(end.pos.x, end.pos.y, 0.5 * end.size, 0, 2 * Math.PI);
        ctx.fillStyle = 'crimson';
        ctx.fill();
    }
}

function drawSprings() {
    springs.forEach(s => {
        drawCoil(s);
        drawEnd(s.a, s.colour);
        drawEnd(s.b, s.colour);
        if (showVectors) { drawArrow(s.a); drawArrow(s.b); }
    });
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawSprings();
}

let last = performance.now();

function loop(now) {
    const rawDt = (now - last) / 1000;
    const dt = Math.min(rawDt, 0.05);
    last = now;

    fps = rawDt > 0 ? Math.round(1 / rawDt) : 0;

    update(dt);
    render();
    requestAnimationFrame(loop);
}


document.addEventListener('DOMContentLoaded', () => {
    resize();
    createSpring(restLength, endRadius, 'black');
    requestAnimationFrame(loop);
});