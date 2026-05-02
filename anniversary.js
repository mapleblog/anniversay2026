const prefersReducedMotion = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;
const isSmallScreen = typeof window.matchMedia === 'function'
  ? window.matchMedia('(max-width: 768px)').matches
  : false;
const hardwareConcurrency = typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : 4;
const deviceMemory = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : 4;

const perfQuality = (() => {
  let q = 1;
  if (isSmallScreen) q *= 0.75;
  if (hardwareConcurrency <= 4) q *= 0.8;
  if (deviceMemory <= 4) q *= 0.8;
  if (prefersReducedMotion) q *= 0.45;
  return Math.max(0.35, Math.min(1, q));
})();

document.documentElement.dataset.perf = perfQuality < 0.7 ? 'low' : 'high';

// ============ 1. 生成星空 ============
const starsLayer = document.getElementById('stars-layer');
const STAR_COUNT = Math.max(70, Math.min(200, Math.round(180 * (isSmallScreen ? 0.7 : 1) * (hardwareConcurrency <= 4 ? 0.8 : 1) * (prefersReducedMotion ? 0.6 : 1))));

for (let i = 0; i < STAR_COUNT; i++) {
  const star = document.createElement('div');
  star.className = 'star';
  const r = Math.random();
  if (r < 0.15) star.classList.add('gold');
  else if (r < 0.25) star.classList.add('rose');

  const size = Math.random() * 2 + 0.5;
  star.style.width = size + 'px';
  star.style.height = size + 'px';
  star.style.left = Math.random() * 100 + '%';
  star.style.top = Math.random() * 100 + '%';
  star.style.animationDuration = (Math.random() * 3 + 2) + 's';
  star.style.animationDelay = Math.random() * 5 + 's';
  starsLayer.appendChild(star);
}

// ============ 2. 萤火虫（优化：单 rAF 循环替代 12 个 setInterval）============
const FIREFLY_COUNT = Math.max(6, Math.round(12 * (isSmallScreen ? 0.75 : 1) * (hardwareConcurrency <= 4 ? 0.85 : 1) * (prefersReducedMotion ? 0.6 : 1)));
const fireflies = [];

for (let i = 0; i < FIREFLY_COUNT; i++) {
  const el = document.createElement('div');
  el.className = 'firefly';
  el.style.left = '0';
  el.style.top = '0';
  el.style.animationDuration = (Math.random() * 4 + 3) + 's';
  el.style.animationDelay = Math.random() * 5 + 's';
  document.body.appendChild(el);

  const x = Math.random() * 100;
  const y = Math.random() * 100;
  el.style.transform = `translate3d(${x}vw, ${y}vh, 0)`;
  fireflies.push({
    el,
    x,
    y,
    vx: (Math.random() - 0.5) * 0.05,
    vy: (Math.random() - 0.5) * 0.05,
  });
}

let lastFireflyTime = 0;

function updateFireflies(now) {
  if (now - lastFireflyTime < 50) return;
  lastFireflyTime = now;
  for (let i = 0; i < fireflies.length; i++) {
    const ff = fireflies[i];
    ff.x += ff.vx;
    ff.y += ff.vy;
    if (ff.x < 0 || ff.x > 100) ff.vx *= -1;
    if (ff.y < 0 || ff.y > 100) ff.vy *= -1;
    ff.el.style.transform = `translate3d(${ff.x}vw, ${ff.y}vh, 0)`;
  }
}

// ============ 3. 粒子烟花（优化：对象池 + 跳跃帧衰减 + 阴影优化）============
const canvas = document.getElementById('fireworks-canvas');
const ctx = canvas.getContext('2d');
const fireworksQuality = perfQuality;

const MAX_PARTICLES = Math.max(260, Math.min(1200, Math.round(900 * fireworksQuality)));
const SPARKLE_COUNT = Math.max(24, Math.round(60 * fireworksQuality));
const TARGET_FPS = prefersReducedMotion ? 30 : (fireworksQuality < 0.8 ? 45 : 60);
const IDLE_FPS = prefersReducedMotion ? 10 : (fireworksQuality < 0.8 ? 12 : 15);
const SHADOW_BLUR = prefersReducedMotion ? 6 : (fireworksQuality < 0.8 ? 8 : 12);
const TRAIL_FADE_MS = 3000;
const TRAIL_DECAY_K = Math.log(100) / TRAIL_FADE_MS;
const SHADOW_LIFE_THRESHOLD = 0.3;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
resize();
window.addEventListener('resize', resize);

// ---------- 对象池 ----------
let particlePool = [];
let particles = [];

class Particle {
  constructor() {
    this.active = false;
    this.x = 0; this.y = 0;
    this.px = 0; this.py = 0;
    this.color = '';
    this.size = 0;
    this.life = 0;
    this.decay = 0;
    this.gravity = 0.04;
    this.vx = 0; this.vy = 0;
  }

  init(x, y, color) {
    this.active = true;
    this.x = x; this.y = y;
    this.px = x; this.py = y;
    this.color = color;
    this.size = 2 + Math.random() * 2;
    this.life = 1;
    this.decay = 0.008 + Math.random() * 0.008;
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  update() {
    this.px = this.x;
    this.py = this.y;
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.vx *= 0.99;
    this.vy *= 0.99;
    this.life -= this.decay;
    if (this.life <= 0) this.active = false;
  }

  draw() {
    if (this.life <= 0) return;
    ctx.globalAlpha = this.life;
    if (this.life > SHADOW_LIFE_THRESHOLD) {
      ctx.shadowBlur = SHADOW_BLUR * this.life;
      ctx.shadowColor = this.color;
    } else {
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.color;
    if (this.life > SHADOW_LIFE_THRESHOLD) {
      ctx.lineWidth = Math.max(0.75, this.size * this.life);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.px, this.py);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 预分配对象池
for (let i = 0; i < MAX_PARTICLES; i++) {
  particlePool.push(new Particle());
}

function acquireParticle(x, y, color) {
  for (let i = 0; i < particlePool.length; i++) {
    if (!particlePool[i].active) {
      particlePool[i].init(x, y, color);
      return particlePool[i];
    }
  }
  return null;
}

function releaseParticle(p) {
  p.active = false;
}

function launchSparkleFirework(x, y) {
  if (particles.length > MAX_PARTICLES * 0.92) return;

  // 多组颜色主题，每次随机选一组
  const colorFamilies = [
    // 暖色系
    ['#f4d4a0', '#ffd700', '#ffe4a0', '#e8b87f', '#ffedb3'],
    ['#ffb3c6', '#ff8fa3', '#ffe5ec', '#ff6b8a', '#ffc4d6'],
    ['#fdba74', '#fb923c', '#fed7aa', '#ff9d5c', '#feb88b'],
    // 冷色系
    ['#93c5fd', '#7dd3fc', '#bae6fd', '#60a5fa', '#a5d8ff'],
    ['#c084fc', '#a855f7', '#d8b4fe', '#e9d5ff', '#b794f4'],
    ['#5eead4', '#99f6e4', '#67e8f9', '#a5f3fc', '#2dd4bf'],
    ['#6ee7b7', '#86efac', '#a7f3d0', '#34d399', '#4ade80'],
    // 混合系
    ['#f4d4a0', '#ffb3c6', '#93c5fd', '#c084fc', '#5eead4'],
    ['#ffc4d6', '#d8b4fe', '#a5f3fc', '#fdba74', '#fde68a'],
  ];

  const palette = colorFamilies[Math.floor(Math.random() * colorFamilies.length)];

  for (let i = 0; i < SPARKLE_COUNT; i++) {
    const color = palette[Math.floor(Math.random() * palette.length)];
    const p = acquireParticle(x, y, color);
    if (p) particles.push(p);
  }
}

// ---------- 爱心形状烟花 ----------
const HEART_PARTICLES = Math.max(60, Math.round(160 * fireworksQuality));

function launchHeartFirework(cx, cy) {
  if (particles.length > MAX_PARTICLES * 0.88) return;

  // 爱心烟花颜色主题，兼顾浪漫与多彩
  const heartColorSets = [
    // 经典浪漫粉
    ['#ffb3c6', '#ff8fa3', '#ffe5ec', '#ffc4d6', '#ff6b8a'],
    // 金色暖阳
    ['#f4d4a0', '#ffd700', '#ffe4a0', '#ffedb3', '#e8b87f'],
    // 梦幻紫罗兰
    ['#c084fc', '#d8b4fe', '#e9d5ff', '#b794f4', '#a855f7'],
    // 冰蓝之心
    ['#93c5fd', '#bae6fd', '#7dd3fc', '#a5d8ff', '#60a5fa'],
    // 珊瑚落日
    ['#fdba74', '#fb923c', '#fed7aa', '#ff9d5c', '#feb88b'],
    // 翡翠之恋
    ['#6ee7b7', '#86efac', '#a7f3d0', '#34d399', '#4ade80'],
    // 极光幻彩
    ['#5eead4', '#67e8f9', '#99f6e4', '#2dd4bf', '#a5f3fc'],
    // 彩虹之心
    ['#ffb3c6', '#fdba74', '#fde68a', '#6ee7b7', '#93c5fd', '#c084fc'],
  ];

  const heartColors = heartColorSets[Math.floor(Math.random() * heartColorSets.length)];
  const color = heartColors[Math.floor(Math.random() * heartColors.length)];
  const secondColor = heartColors[Math.floor(Math.random() * heartColors.length)];
  const scale = 8 + Math.random() * 4;

  // 心形参数方程: x = 16 sin³(t), y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
  for (let i = 0; i < HEART_PARTICLES; i++) {
    const t = (i / HEART_PARTICLES) * Math.PI * 2;
    const sinT = Math.sin(t);
    const hx = 16 * sinT * sinT * sinT;
    const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const jitter = 0.85 + Math.random() * 0.3;
    const targetX = cx + hx * scale * jitter;
    const targetY = cy - hy * scale * jitter;
    const speed = 1.5 + Math.random() * 2.5;
    const angle = Math.atan2(targetY - cy, targetX - cx);
    const p = acquireParticle(cx, cy, i % 3 === 0 ? secondColor : color);
    if (p) {
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.gravity = 0.02 + Math.random() * 0.02;
      p.decay = 0.006 + Math.random() * 0.006;
      particles.push(p);
    }
  }

  // 中心爆发的小粒子增添闪耀感
  const sparkleCount = Math.round(20 * fireworksQuality);
  for (let i = 0; i < sparkleCount; i++) {
    const p = acquireParticle(cx, cy, '#fff0f5');
    if (p) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.size = 1 + Math.random() * 1.5;
      p.decay = 0.012 + Math.random() * 0.008;
      p.gravity = 0.01;
      particles.push(p);
    }
  }
}

let animationFrameId = null;
let lastFrameTime = 0;
let lastRenderTime = 0;
let lastParticleTime = 0;
let trailDecaySkipCounter = 0;
let fireworksActive = !prefersReducedMotion;

function animateFireworks(now) {
  if (!fireworksActive) return;

  updateFireflies(now);

  const desiredFps = particles.length > 0 ? TARGET_FPS : IDLE_FPS;
  const frameInterval = 1000 / desiredFps;
  if (lastFrameTime && (now - lastFrameTime) < frameInterval) {
    animationFrameId = requestAnimationFrame(animateFireworks);
    return;
  }
  const dt = lastRenderTime ? (now - lastRenderTime) : frameInterval;
  lastFrameTime = now;
  lastRenderTime = now;

  if (particles.length > 0) {
    lastParticleTime = now;
  }

  if (lastParticleTime && (now - lastParticleTime) > TRAIL_FADE_MS && particles.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    lastParticleTime = 0;
    animationFrameId = requestAnimationFrame(animateFireworks);
    return;
  }

  trailDecaySkipCounter = (trailDecaySkipCounter + 1) % 2;
  if ((particles.length > 0 || lastParticleTime) && trailDecaySkipCounter === 0) {
    ctx.globalCompositeOperation = 'destination-in';
    const keepAlpha = Math.exp(-TRAIL_DECAY_K * dt * 2);
    ctx.fillStyle = `rgba(0, 0, 0, ${keepAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.globalCompositeOperation = 'lighter';

  let writeIndex = 0;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (!p.active) {
      releaseParticle(p);
      continue;
    }
    p.update();
    if (!p.active) {
      releaseParticle(p);
      continue;
    }
    p.draw();
    particles[writeIndex] = p;
    writeIndex += 1;
  }
  particles.length = writeIndex;
  ctx.globalAlpha = 1;

  animationFrameId = requestAnimationFrame(animateFireworks);
}

// 定时发射烟花
function launchRandomFirework() {
  if (Math.random() < 0.3) {
    const cx = canvas.width * (0.35 + Math.random() * 0.3);
    const cy = canvas.height * (0.3 + Math.random() * 0.25);
    launchHeartFirework(cx, cy);
  } else {
    const x = canvas.width * (0.2 + Math.random() * 0.6);
    const y = canvas.height * (0.25 + Math.random() * 0.35);
    launchSparkleFirework(x, y);
  }
}

let autoFireworkTimeoutId = null;
let doubleFireworkIntervalId = null;

function scheduleNextAutoFirework(delayMs) {
  if (autoFireworkTimeoutId) clearTimeout(autoFireworkTimeoutId);
  autoFireworkTimeoutId = setTimeout(() => {
    if (!fireworksActive) return;
    launchRandomFirework();
    const next = 2500 + Math.random() * 3000;
    scheduleNextAutoFirework(next);
  }, delayMs);
}

function startDoubleFireworks() {
  if (doubleFireworkIntervalId) return;
  doubleFireworkIntervalId = setInterval(() => {
    if (!fireworksActive) return;
    if (Math.random() < 0.4) {
      const cx = canvas.width * 0.5;
      const cy = canvas.height * 0.35;
      if (Math.random() < 0.5) {
        launchHeartFirework(cx, cy);
      } else {
        const x1 = canvas.width * 0.3;
        const x2 = canvas.width * 0.7;
        const y = canvas.height * 0.35;
        launchSparkleFirework(x1, y);
        setTimeout(() => {
          if (!fireworksActive) return;
          launchSparkleFirework(x2, y);
        }, 300);
      }
    }
  }, 12000);
}

function stopDoubleFireworks() {
  if (!doubleFireworkIntervalId) return;
  clearInterval(doubleFireworkIntervalId);
  doubleFireworkIntervalId = null;
}

function startFireworks() {
  if (fireworksActive) return;
  fireworksActive = true;
  lastFrameTime = 0;
  lastRenderTime = 0;
  if (!animationFrameId) animationFrameId = requestAnimationFrame(animateFireworks);
  scheduleNextAutoFirework(800);
  startDoubleFireworks();
}

function stopFireworks() {
  if (!fireworksActive) return;
  fireworksActive = false;
  if (autoFireworkTimeoutId) clearTimeout(autoFireworkTimeoutId);
  autoFireworkTimeoutId = null;
  stopDoubleFireworks();
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
  for (let i = 0; i < particles.length; i++) {
    releaseParticle(particles[i]);
  }
  particles.length = 0;
  lastParticleTime = 0;
  lastRenderTime = 0;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

if (!prefersReducedMotion) {
  fireworksActive = true;
  animationFrameId = requestAnimationFrame(animateFireworks);
  scheduleNextAutoFirework(1500);
  startDoubleFireworks();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopFireworks();
  else if (!prefersReducedMotion) startFireworks();
});

// ============ 4. 幻灯片轮播 ============
(function slideshow() {
  const slides = document.querySelectorAll('.slide');
  const prevBtn = document.querySelector('.slideshow-arrow.prev');
  const nextBtn = document.querySelector('.slideshow-arrow.next');
  const container = document.getElementById('slideshow');

  if (!slides.length) return;

  let current = 0;
  let interval = null;
  const DELAY = 6000;

  function goTo(index) {
    slides.forEach(s => s.classList.remove('active'));

    current = (index + slides.length) % slides.length;
    slides[current].classList.add('active');
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  function startAuto() {
    stopAuto();
    interval = setInterval(next, DELAY);
  }

  function stopAuto() {
    if (interval) { clearInterval(interval); interval = null; }
  }

  if (prevBtn) prevBtn.addEventListener('click', () => { prev(); startAuto(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { next(); startAuto(); });

  if (container) {
    container.addEventListener('mouseenter', stopAuto);
    container.addEventListener('mouseleave', startAuto);
  }

  startAuto();
})();

// ============ 5. 流星雨（Canvas 对象池 + 自动阵发调度）============
const meteorCanvas = document.getElementById('meteor-canvas');
const mctx = meteorCanvas.getContext('2d');

const METEOR_MAX = Math.max(10, Math.round(24 * (isSmallScreen ? 0.85 : 1) * (hardwareConcurrency <= 4 ? 0.85 : 1) * (prefersReducedMotion ? 0.7 : 1)));

function resizeMeteorCanvas() {
  meteorCanvas.width = window.innerWidth;
  meteorCanvas.height = window.innerHeight;
}
resizeMeteorCanvas();
window.addEventListener('resize', resizeMeteorCanvas);

class Meteor {
  constructor() {
    this.active = false;
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.length = 0;
    this.width = 0;
    this.opacity = 0;
    this.life = 0;
    this.decay = 0;
    this.hue = 0;  // 色相偏移，让流星带轻微暖色/冷色变化
  }

  reset() {
    const w = meteorCanvas.width;
    const h = meteorCanvas.height;
    const startX = w * (0.55 + Math.random() * 0.45);
    const startY = -20 - Math.random() * h * 0.15;
    this.x = startX;
    this.y = startY;

    const angle = Math.PI * (0.12 + Math.random() * 0.18);
    const speed = 7 + Math.random() * 11;
    this.vx = -Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    this.length = 50 + Math.random() * 90;
    this.width = 1.2 + Math.random() * 1.8;
    this.opacity = 0.5 + Math.random() * 0.5;
    this.life = 1;
    this.decay = 0.003 + Math.random() * 0.005;

    // 大部分白色 (80%)，少部分暖色 (12%) 或冷色 (8%)
    const r = Math.random();
    if (r < 0.12) this.hue = 25 + Math.random() * 20;      // 暖橙
    else if (r < 0.20) this.hue = 200 + Math.random() * 30; // 冰蓝
    else this.hue = 0;

    this.active = true;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
    if (this.life <= 0 || this.x < -200 || this.y > meteorCanvas.height + 200) {
      this.active = false;
    }
  }

  draw(ctx) {
    if (this.life <= 0) return;

    const tailLen = this.length * this.life;
    const dx = this.vx;
    const dy = this.vy;
    const dist = Math.hypot(dx, dy) || 1;
    const tx = this.x - (dx / dist) * tailLen;
    const ty = this.y - (dy / dist) * tailLen;

    // 尾部渐变：头部最亮 → 尾部完全透明
    const grad = ctx.createLinearGradient(this.x, this.y, tx, ty);
    if (this.hue > 0) {
      const base = `hsla(${this.hue}, 80%, 85%`;
      grad.addColorStop(0, `${base}, ${this.opacity * this.life})`);
      grad.addColorStop(0.15, `${base}, ${this.opacity * this.life * 0.6})`);
      grad.addColorStop(0.5, `${base}, ${this.opacity * this.life * 0.15})`);
    } else {
      grad.addColorStop(0, `rgba(255, 255, 255, ${this.opacity * this.life})`);
      grad.addColorStop(0.15, `rgba(255, 255, 255, ${this.opacity * this.life * 0.5})`);
      grad.addColorStop(0.5, `rgba(255, 255, 255, ${this.opacity * this.life * 0.12})`);
    }
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = this.width * (0.3 + 0.7 * this.life);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    // 头部光晕
    ctx.shadowBlur = 18 * this.life;
    ctx.shadowColor = this.hue > 0
      ? `hsla(${this.hue}, 80%, 85%, ${0.7 * this.life})`
      : `rgba(255, 255, 255, ${0.7 * this.life})`;
    ctx.fillStyle = this.hue > 0
      ? `hsla(${this.hue}, 70%, 92%, ${this.opacity * this.life})`
      : `rgba(255, 255, 255, ${this.opacity * this.life})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, (1.5 + this.width * 0.6) * this.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

const meteorPool = [];
for (let i = 0; i < METEOR_MAX; i++) {
  meteorPool.push(new Meteor());
}

function acquireMeteor() {
  for (let i = 0; i < meteorPool.length; i++) {
    if (!meteorPool[i].active) {
      meteorPool[i].reset();
      return meteorPool[i];
    }
  }
  return null;
}

let activeMeteors = [];
let meteorAnimId = null;
let meteorActive = true;

function animateMeteors() {
  if (!meteorActive) return;

  if (activeMeteors.length === 0) {
    meteorAnimId = null;
    mctx.clearRect(0, 0, meteorCanvas.width, meteorCanvas.height);
    return;
  }

  mctx.clearRect(0, 0, meteorCanvas.width, meteorCanvas.height);

  let wi = 0;
  for (let i = 0; i < activeMeteors.length; i++) {
    const m = activeMeteors[i];
    m.update();
    if (!m.active) continue;
    m.draw(mctx);
    activeMeteors[wi] = m;
    wi++;
  }
  activeMeteors.length = wi;

  meteorAnimId = requestAnimationFrame(animateMeteors);
}

function launchMeteorBurst(count) {
  for (let i = 0; i < count; i++) {
    const m = acquireMeteor();
    if (m) activeMeteors.push(m);
  }
  if (meteorActive && !meteorAnimId) meteorAnimId = requestAnimationFrame(animateMeteors);
}

let showerTimerId = null;
let loneMeteorTimerId = null;

function scheduleNextShower() {
  const delay = 4000 + Math.random() * 16000;
  showerTimerId = setTimeout(() => {
    if (!meteorActive) return;

    const count = 3 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        if (!meteorActive) return;
        launchMeteorBurst(1 + Math.floor(Math.random() * 2));
      }, i * (80 + Math.random() * 220));
    }

    scheduleNextShower();
  }, delay);
}

// 偶尔触发一颗孤星划过
function scheduleLoneMeteor() {
  const delay = 2000 + Math.random() * 8000;
  loneMeteorTimerId = setTimeout(() => {
    if (!meteorActive) return;
    if (activeMeteors.length < 3) {
      launchMeteorBurst(1);
    }
    scheduleLoneMeteor();
  }, delay);
}

function startMeteorShower() {
  if (meteorActive) return;
  meteorActive = true;
  scheduleNextShower();
  if (!prefersReducedMotion) scheduleLoneMeteor();
}

function stopMeteorShower() {
  if (!meteorActive) return;
  meteorActive = false;
  if (showerTimerId) clearTimeout(showerTimerId);
  showerTimerId = null;
  if (loneMeteorTimerId) clearTimeout(loneMeteorTimerId);
  loneMeteorTimerId = null;
  if (meteorAnimId) cancelAnimationFrame(meteorAnimId);
  meteorAnimId = null;
  activeMeteors.length = 0;
  mctx.clearRect(0, 0, meteorCanvas.width, meteorCanvas.height);
}

if (!prefersReducedMotion) {
  meteorActive = true;
  scheduleNextShower();
  scheduleLoneMeteor();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopMeteorShower();
  else if (!prefersReducedMotion) startMeteorShower();
});
