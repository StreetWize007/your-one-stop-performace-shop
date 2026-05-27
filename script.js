/* =============================================================
   ONE STOP PERFORMANCE SHOP — script.js
   - Animated rev-limiter speedometer (Canvas)
   - 3D tilt on interactive cards
   - Scroll reveal + nav active state
   - Smooth anchor scroll
   ============================================================= */

// ── SMOOTH SCROLL ──────────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
});

// ── SPEEDOMETER CANVAS ─────────────────────────────────────────
(function initSpeedo() {
  const canvas = document.getElementById('speedoCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = H / 2;
  const R = W * 0.42;

  // Gauge runs from 225° (bottom-left) to 315° (bottom-right) spanning 270°
  const START_DEG = 135;
  const END_DEG   = 45 + 360; // 405 → full 270° sweep clockwise
  const SWEEP     = 270;

  const MAX_RPM = 9;          // gauge max (×1000)
  const REDLINE  = 7;         // redline starts here

  // The needle animation state
  let currentRPM = 0;
  let targetRPM  = 0;
  let phase = 0; // 0=climb, 1=hold, 2=drop, 3=pause

  const SEQUENCE = [
    { target: 8.6, hold: 80 },   // SLAM to redline
    { target: 3.2, hold: 40 },   // gear shift drop
    { target: 8.8, hold: 100 },  // second gear pull
    { target: 3.5, hold: 40 },
    { target: 9.0, hold: 120 },  // push past the clock
    { target: 2.8, hold: 60 },
    { target: 8.4, hold: 80 },
    { target: 3.0, hold: 40 },
  ];
  let seqIndex = 0;
  let holdTimer = 0;
  let lastTime = null;

  function rpmToAngle(rpm) {
    const frac = Math.min(rpm / MAX_RPM, 1.06); // allow slight over-rev
    return (START_DEG + frac * SWEEP) * Math.PI / 180;
  }

  function drawBackground() {
    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, R + 12, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(212,175,55,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Dark face
    ctx.beginPath();
    ctx.arc(cx, cy, R + 10, 0, Math.PI * 2);
    ctx.fillStyle = '#0d0d0d';
    ctx.fill();

    // Subtle radial gradient on face
    const faceBg = ctx.createRadialGradient(cx, cy - R * 0.2, 0, cx, cy, R);
    faceBg.addColorStop(0, 'rgba(30,28,20,0.9)');
    faceBg.addColorStop(1, 'rgba(8,8,8,1)');
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = faceBg;
    ctx.fill();
  }

  function drawArc(rpm) {
    const startRad = START_DEG * Math.PI / 180;

    // Full background track
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.82, startRad, (START_DEG + SWEEP) * Math.PI / 180);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Green zone (0 → redline)
    const greenEnd = rpmToAngle(REDLINE);
    const grad = ctx.createConicalGradient
      ? null
      : ctx.createLinearGradient(cx - R, cy, cx + R, cy);
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.82, startRad, Math.min(rpmToAngle(rpm), greenEnd));
    ctx.strokeStyle = rpm < REDLINE ? '#27a060' : '#27a060';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Red zone fill (redline → current)
    if (rpm > REDLINE) {
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.82, greenEnd, rpmToAngle(rpm));
      ctx.strokeStyle = '#e02020';
      ctx.lineWidth = 8;
      ctx.stroke();
    }
  }

  function drawTicks() {
    for (let i = 0; i <= MAX_RPM; i++) {
      const angle = rpmToAngle(i);
      const isMajor = (i % 1 === 0);
      const isRed   = i >= REDLINE;
      const len = isMajor ? R * 0.14 : R * 0.08;
      const innerR = R * 0.88;

      const x1 = cx + Math.cos(angle) * innerR;
      const y1 = cy + Math.sin(angle) * innerR;
      const x2 = cx + Math.cos(angle) * (innerR - len);
      const y2 = cy + Math.sin(angle) * (innerR - len);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = isRed ? '#e02020' : 'rgba(200,190,150,0.7)';
      ctx.lineWidth = isMajor ? 2.5 : 1;
      ctx.stroke();

      // Minor ticks (0.5 intervals)
      if (i < MAX_RPM) {
        const halfAngle = rpmToAngle(i + 0.5);
        const hx1 = cx + Math.cos(halfAngle) * innerR;
        const hy1 = cy + Math.sin(halfAngle) * innerR;
        const hx2 = cx + Math.cos(halfAngle) * (innerR - R * 0.06);
        const hy2 = cy + Math.sin(halfAngle) * (innerR - R * 0.06);
        ctx.beginPath();
        ctx.moveTo(hx1, hy1);
        ctx.lineTo(hx2, hy2);
        ctx.strokeStyle = i >= REDLINE - 1 ? 'rgba(224,32,32,0.5)' : 'rgba(200,190,150,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Number labels
    ctx.save();
    ctx.font = `bold ${W * 0.06}px 'Barlow Condensed', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= MAX_RPM; i++) {
      const angle = rpmToAngle(i);
      const labelR = R * 0.66;
      const lx = cx + Math.cos(angle) * labelR;
      const ly = cy + Math.sin(angle) * labelR;
      ctx.fillStyle = i >= REDLINE ? '#e02020' : 'rgba(212,175,55,0.85)';
      ctx.fillText(String(i), lx, ly);
    }
    ctx.restore();
  }

  function drawNeedle(rpm) {
    const angle = rpmToAngle(rpm);
    const nLen = R * 0.78;
    const nBack = R * 0.18;

    // Needle glow
    ctx.save();
    ctx.shadowColor = rpm >= REDLINE ? '#ff2200' : '#d4af37';
    ctx.shadowBlur = 16;

    // Main needle
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle + Math.PI) * nBack, cy + Math.sin(angle + Math.PI) * nBack);
    ctx.lineTo(cx + Math.cos(angle) * nLen, cy + Math.sin(angle) * nLen);
    const needleColor = rpm >= REDLINE ? '#ff3300' : '#f0c840';
    ctx.strokeStyle = needleColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Needle tip glow dot
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * nLen, cy + Math.sin(angle) * nLen, 4, 0, Math.PI * 2);
    ctx.fillStyle = needleColor;
    ctx.fill();

    ctx.restore();

    // Center cap
    const capGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.07);
    capGrad.addColorStop(0, '#888');
    capGrad.addColorStop(1, '#222');
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = capGrad;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.03, 0, Math.PI * 2);
    ctx.fillStyle = '#d4af37';
    ctx.fill();
  }

  function drawDigitalReadout(rpm) {
    const display = rpm.toFixed(1);
    ctx.save();
    ctx.font = `900 ${W * 0.1}px 'Barlow Condensed', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = rpm >= REDLINE ? '#ff3300' : '#d4af37';
    ctx.shadowColor = rpm >= REDLINE ? '#ff220066' : '#d4af3766';
    ctx.shadowBlur = 14;
    ctx.fillText(display, cx, cy + R * 0.35);
    ctx.restore();
  }

  function drawRedlineFlash(rpm, time) {
    if (rpm < REDLINE) return;
    const alpha = 0.04 + 0.06 * Math.abs(Math.sin(time * 0.008));
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.98, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(224, 32, 32, ${alpha})`;
    ctx.fill();
  }

  function drawAll(rpm, time) {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawArc(rpm);
    drawTicks();
    drawRedlineFlash(rpm, time);
    drawNeedle(rpm);
    drawDigitalReadout(rpm);
  }

  // Animation loop
  function tick(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min(timestamp - lastTime, 50);
    lastTime = timestamp;

    const seq = SEQUENCE[seqIndex];

    if (phase === 0) {
      // Climb toward target
      const speed = Math.abs(targetRPM - currentRPM) > 3 ? 0.022 : 0.012;
      const delta = (targetRPM - currentRPM) * speed * dt;
      currentRPM += delta;
      if (Math.abs(currentRPM - targetRPM) < 0.05) {
        currentRPM = targetRPM;
        phase = 1;
        holdTimer = 0;
      }
    } else if (phase === 1) {
      // Hold + slight vibrato
      const vibrato = targetRPM >= REDLINE ? (Math.random() - 0.5) * 0.18 : (Math.random() - 0.5) * 0.04;
      holdTimer += dt;
      currentRPM = targetRPM + vibrato;
      if (holdTimer >= seq.hold) {
        phase = 0;
        seqIndex = (seqIndex + 1) % SEQUENCE.length;
        targetRPM = SEQUENCE[seqIndex].target;
      }
    }

    drawAll(Math.max(0, currentRPM), timestamp);
    requestAnimationFrame(tick);
  }

  // Kick off: initial approach
  targetRPM = SEQUENCE[0].target;
  requestAnimationFrame(tick);
})();


// ── SCROLL REVEAL ──────────────────────────────────────────────
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

document.querySelectorAll('.reveal-stage, .reveal-card').forEach(el => revealObserver.observe(el));


// ── 3D TILT ON CARDS ───────────────────────────────────────────
const tiltCards = document.querySelectorAll(
  '.gallery-card, .why-card, .specialty-card, .service-card, .trust-card'
);

tiltCards.forEach(card => {
  card.addEventListener('mousemove', e => {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(800px) rotateY(${x * 12}deg) rotateX(${-y * 10}deg) translateY(-8px) scale(1.02)`;
  });
  card.addEventListener('mouseleave', () => { card.style.transform = ''; });
});


// ── NAV SCROLL STYLE ───────────────────────────────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  if (window.scrollY > 40) navbar.classList.add('scrolled');
  else navbar.classList.remove('scrolled');

  let current = '';
  document.querySelectorAll('section[id]').forEach(sec => {
    if (window.pageYOffset >= sec.offsetTop - 220) current = sec.getAttribute('id');
  });

  document.querySelectorAll('.nav-links a').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href')?.slice(1) === current) link.classList.add('active');
  });
});


// ── CONTACT FORM ───────────────────────────────────────────────
const form = document.getElementById('inquiryForm');
if (form) {
  form.addEventListener('submit', e => {
    e.preventDefault();
    const name  = form.querySelector('input[type="text"]').value;
    const phone = form.querySelector('input[type="tel"]').value;
    if (name && phone) {
      alert(`Thanks ${name}! We'll reach out to you at ${phone} shortly.`);
      form.reset();
    }
  });
}

console.log('%c⚙ ONE STOP PERFORMANCE SHOP — Loaded', 'color:#d4af37;font-family:monospace;font-size:14px;');
