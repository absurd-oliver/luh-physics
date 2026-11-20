const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const mousePot = document.getElementById('mousePot');

const balls = [];
const G = 9.81;
const simFactor = 100;
const g = G * simFactor;
const bounce = 0.5;
const mouse = { x: 0, y: 0 };
const grace = 1.75;

var ballAmount = 1;
var fps = 0; // yo don't fucking touch this plz

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);

function createBall(x, y, s, c) {
    balls.push({
        id: balls.length + 1,
        pos: { x: Math.random() * canvas.width / 2, y: Math.random() * canvas.height / 2 },
        vel: { x: ( ( Math.random() * canvas.width * 2 ) - canvas.width ), y: ( ( Math.random() * canvas.height * 2 ) - canvas.height ) },
        size: s,
        colour: c,
        held: false,
    });
}

function canvasPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
}

window.addEventListener('mousemove', e => {
    Object.assign(mouse, canvasPos(e));
});

canvas.addEventListener('mousedown', e => {
    const p = canvasPos(e);
    balls.forEach(ball => {
        ball.held = Math.hypot(p.x - ball.pos.x, p.y - ball.pos.y) <= (ball.size  * grace );
    });
    if(e.button === 2){
        e.preventDefault();
        balls.forEach(ball => {
            ball.pos.x = (Math.random()*canvas.width) - ball.size;
            ball.pos.y = canvas.height - ball.size
        });
    }
});

canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();
});

window.addEventListener('mouseup', () => {
    balls.forEach(ball => (ball.held = false));
});

window.addEventListener('keydown', (e) => {
    let old = ballAmount;
    if(e.key === 'ArrowDown'){ballAmount > 1 ? ballAmount -= 1 : ballAmount -= 0;}
    if(e.key === 'ArrowUp'){ballAmount < 100 ? ballAmount +=1 : ballAmount +=0;}
    if(old < ballAmount){
        for (let i = old; i < ballAmount; i++){
            createBall(200, 200, 20, 'black');
        }
    } else if (old > ballAmount){
        for (let i = old; i > ballAmount; i--){
            balls.pop();
        }
    }
});

function update(dt) {
    balls.forEach(ball => {
        if (ball.held) {
            const vx = (mouse.x - ball.pos.x) / dt;
            const vy = (mouse.y - ball.pos.y) / dt;
            ball.vel.x += (vx - ball.vel.x) * 0.5;
            ball.vel.y += (vy - ball.vel.y) * 0.5;
            ball.pos.x = mouse.x;
            ball.pos.y = mouse.y;
        } else {
            ball.vel.y += g * dt;
            ball.pos.x += ball.vel.x * dt;
            ball.pos.y += ball.vel.y * dt;

            const floor = canvas.height - ball.size;
            if (ball.pos.y > floor) {
                ball.pos.y = floor;
                ball.vel.y *= -bounce;
                ball.vel.x *= 0.98;
                if (Math.abs(ball.vel.y) < 20) ball.vel.y = 0; // stops jitter, this is the only shit that works bruh
            }
            const ceil = 0 + ball.size;
            if (ball.pos.y < ceil) {
                ball.pos.y = ceil;
                ball.vel.y *= -bounce;
                ball.vel.x *= 0.98;
                if (Math.abs(ball.vel.y) < 20) ball.vel.y = 0; // stops jitter AGAIN, this is the only shit that works bruh AGAIN
            }
            if (ball.pos.x < ball.size) { ball.pos.x = ball.size; ball.vel.x *= -bounce; }
            if (ball.pos.x > canvas.width - ball.size) {
                ball.pos.x = canvas.width - ball.size;
                ball.vel.x *= -bounce;
            }
        }
    });
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

function drawArrow(ball) {
    const arrowScale = 0.1;
    const x0 = ball.pos.x;
    const y0 = ball.pos.y;
    const x1 = x0 + ball.vel.x * arrowScale;
    const y1 = y0 + ball.vel.y * arrowScale;

    arrow(x0, y0, x1, y1, 'red');
    arrow(x0, y0, x1, y0, 'blue');
    arrow(x0, y0, x0, y1, 'green');
}


function drawBall(){
    balls.forEach(ball => {
        ctx.beginPath();
        ctx.arc(ball.pos.x, ball.pos.y, ball.size, 0, 2 * Math.PI);
        ctx.strokeStyle = ball.colour;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ball.pos.x, ball.pos.y, 0.25*ball.size, 0, 2 * Math.PI);
        ctx.fillStyle = ball.colour;
        ctx.fill();
        drawArrow(ball) 
    });
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBall()

    mousePot.textContent =
        `loop & render fps: ${fps}\n` +
        `(${mouse.x | 0}, ${mouse.y | 0})\n` +
        `amount: ${ballAmount} \n` +
        balls.map(b => `ball#${b.id} held:${b.held} pos:( ${Math.round(100*b.pos.x)/100}, ${Math.round(100*b.pos.y)/100})`).join('\n');
}

let last = performance.now(); // this absolutely needs to be outside of loop(), time moves backwards kinda if its not

function loop(now) {
    const rawDt = (now - last) / 1000;
    const dt = Math.min(rawDt, 0.05); // clamp so tab-switching doesn't fucking explode
    last = now;

    fps = rawDt > 0 ? Math.round(1 / rawDt) : 0;


    update(dt);
    render();
    requestAnimationFrame(loop);
}


document.addEventListener('DOMContentLoaded', () => {
    resize();
    createBall(200, 200, 20, 'black');
    requestAnimationFrame(loop);
});