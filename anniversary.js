// ============ 1. 生成星空 ============
const starsLayer = document.getElementById('stars-layer');
const STAR_COUNT = 180;

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
const FIREFLY_COUNT = 12;
const fireflies = [];

for (let i = 0; i < FIREFLY_COUNT; i++) {
  const el = document.createElement('div');
  el.className = 'firefly';
  el.style.left = Math.random() * 100 + 'vw';
  el.style.top = Math.random() * 100 + 'vh';
  el.style.animationDuration = (Math.random() * 4 + 3) + 's';
  el.style.animationDelay = Math.random() * 5 + 's';
  document.body.appendChild(el);

  fireflies.push({
    el,
    x: parseFloat(el.style.left),
    y: parseFloat(el.style.top),
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
    ff.el.style.left = ff.x + 'vw';
    ff.el.style.top = ff.y + 'vh';
  }
}

// ============ 3. 粒子烟花（优化：对象池 + 跳跃帧衰减 + 阴影优化）============
const canvas = document.getElementById('fireworks-canvas');
const ctx = canvas.getContext('2d');

const prefersReducedMotion = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;
const isSmallScreen = typeof window.matchMedia === 'function'
  ? window.matchMedia('(max-width: 768px)').matches
  : false;
const hardwareConcurrency = typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : 4;
const deviceMemory = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : 4;

const fireworksQuality = (() => {
  let q = 1;
  if (isSmallScreen) q *= 0.75;
  if (hardwareConcurrency <= 4) q *= 0.8;
  if (deviceMemory <= 4) q *= 0.8;
  if (prefersReducedMotion) q *= 0.45;
  return Math.max(0.35, Math.min(1, q));
})();

const MAX_PARTICLES = Math.max(260, Math.min(1200, Math.round(900 * fireworksQuality)));
const SPARKLE_COUNT = Math.max(24, Math.round(60 * fireworksQuality));
const TARGET_FPS = prefersReducedMotion ? 30 : (fireworksQuality < 0.8 ? 45 : 60);
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

  const frameInterval = 1000 / TARGET_FPS;
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

  // 优化：跳跃帧衰减 — 每隔一帧才做全屏 destination-in，降低 50% 像素操作
  trailDecaySkipCounter = (trailDecaySkipCounter + 1) % 2;
  if (trailDecaySkipCounter === 0) {
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
