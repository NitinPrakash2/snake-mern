import { useEffect, useRef, useState, useCallback } from 'react';

const LS_KEY = 'snake_scores';
const getScores = () => JSON.parse(localStorage.getItem(LS_KEY) || '[]');
const persistScore = (name, score) => {
  const scores = [...getScores(), { name, score }]
    .sort((a, b) => b.score - a.score).slice(0, 5);
  localStorage.setItem(LS_KEY, JSON.stringify(scores));
  return scores;
};

const GRID = 20;
const SPEED = 130;

const randomPos = () => ({ x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) });
const initState = () => ({ snake: [{ x: 10, y: 10 }], dir: { x: 1, y: 0 }, food: randomPos(), running: false, over: false, score: 0, started: false });

export default function App() {
  const [state, setState] = useState(initState());
  const [displayScore, setDisplayScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [scores, setScores] = useState(getScores());
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);
  const [cell, setCell] = useState(24);

  const stateRef = useRef(state);
  stateRef.current = state;
  const cellRef = useRef(cell);
  cellRef.current = cell;

  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const floatersRef = useRef([]);
  const shakeRef = useRef(0);
  const foodPulseRef = useRef(0);
  const animRef = useRef(null);
  const scoreAnimRef = useRef({ current: 0, target: 0 });
  const lerpRef = useRef(0);
  const lastTickRef = useRef(Date.now());
  const speedRef = useRef(130);
  const intervalRef = useRef(null);
  const speedFlashRef = useRef(0);

  // Responsive cell size
  useEffect(() => {
    const resize = () => {
      const sidebarW = window.innerWidth < 600 ? 0 : 220;
      const maxW = window.innerWidth - sidebarW - 32;
      const maxH = window.innerHeight - 32;
      const c = Math.floor(Math.min(maxW, maxH) / GRID);
      setCell(Math.max(c, 14));
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const spawnParticles = (x, y) => {
    const C = cellRef.current;
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20 + Math.random() * 0.3;
      const speed = 1.5 + Math.random() * 3;
      particlesRef.current.push({
        x: x * C + C / 2, y: y * C + C / 2,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 1, size: 2 + Math.random() * 3,
        color: `hsl(${Math.random() > 0.5 ? 160 + Math.random() * 40 : 0 + Math.random() * 20}, 100%, 65%)`,
      });
    }
  };

  const move = useCallback(() => {
    const { snake, dir, food, running, over } = stateRef.current;
    if (!running || over) return;
    const head = { x: (snake[0].x + dir.x + GRID) % GRID, y: (snake[0].y + dir.y + GRID) % GRID };
    if (snake.some(s => s.x === head.x && s.y === head.y)) {
      shakeRef.current = 20;
      setState(s => ({ ...s, running: false, over: true }));
      return;
    }
    const ate = head.x === food.x && head.y === food.y;
    if (ate) {
      spawnParticles(food.x, food.y);
      const C = cellRef.current;
      floatersRef.current.push({ x: food.x * C + C / 2, y: food.y * C, life: 1 });
    }
    lerpRef.current = 0;
    lastTickRef.current = Date.now();
    const newSnake = ate ? [head, ...snake] : [head, ...snake.slice(0, -1)];
    const newFood = ate ? randomPos() : food;
    const newScore = ate ? stateRef.current.score + 10 : stateRef.current.score;
    if (ate && newScore % 50 === 0) {
      const newSpeed = Math.max(60, speedRef.current - 15);
      if (newSpeed !== speedRef.current) {
        speedRef.current = newSpeed;
        speedFlashRef.current = 120;
        setLevel(l => l + 1);
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(move, newSpeed);
      }
    }
    scoreAnimRef.current.target = newScore;
    setState(s => ({ ...s, snake: newSnake, food: newFood, score: newScore }));
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(move, speedRef.current);
    return () => clearInterval(intervalRef.current);
  }, [move]);

  useEffect(() => {
    const handleKey = (e) => {
      const dirs = { ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 } };
      if (dirs[e.key]) {
        e.preventDefault();
        const cur = stateRef.current.dir;
        const next = dirs[e.key];
        if (next.x !== -cur.x || next.y !== -cur.y) setState(s => ({ ...s, dir: next }));
      }
      if (e.key === ' ' || e.key === 'Enter') {
        const { running, over, started } = stateRef.current;
        if (!running && !over) setState(s => ({ ...s, running: true, started: true }));
      }
      if (e.key === 'p' || e.key === 'P' || e.key === 'Backspace') {
        const { running, over, started } = stateRef.current;
        if (!over && started) {
          e.preventDefault();
          setState(s => ({ ...s, running: !s.running }));
          // pause/resume the interval
          if (running) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          } else {
            lastTickRef.current = Date.now();
            intervalRef.current = setInterval(move, speedRef.current);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      const C = cellRef.current;
      const SIZE = GRID * C;
      const { snake, food, over, running } = stateRef.current;
      foodPulseRef.current += 0.08;

      // Advance lerp using dynamic speed
      if (running && !over) {
        lerpRef.current = Math.min((Date.now() - lastTickRef.current) / speedRef.current, 1);
      }

      const sa = scoreAnimRef.current;
      if (sa.current < sa.target) { sa.current = Math.min(sa.current + 2, sa.target); setDisplayScore(sa.current); }

      let sx = 0, sy = 0;
      if (shakeRef.current > 0) {
        sx = (Math.random() - 0.5) * shakeRef.current;
        sy = (Math.random() - 0.5) * shakeRef.current;
        shakeRef.current *= 0.78;
        if (shakeRef.current < 0.4) shakeRef.current = 0;
      }

      canvas.width = SIZE; canvas.height = SIZE;
      ctx.save(); ctx.translate(sx, sy);

      // BG gradient
      const bgGrad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
      bgGrad.addColorStop(0, '#0a1a0a');
      bgGrad.addColorStop(1, '#050d05');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(-20, -20, SIZE + 40, SIZE + 40);

      // Grid cells alternating
      for (let x = 0; x < GRID; x++)
        for (let y = 0; y < GRID; y++) {
          ctx.fillStyle = (x + y) % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.0)';
          ctx.fillRect(x * C, y * C, C, C);
        }

      // Food — apple shape
      const pulse = 1 + Math.sin(foodPulseRef.current) * 0.12;
      const fx = food.x * C + C / 2, fy = food.y * C + C / 2;
      const fr = (C / 2 - 2) * pulse;
      ctx.save();
      ctx.shadowColor = '#ff2244'; ctx.shadowBlur = 20 * pulse;

      // apple body
      ctx.beginPath();
      ctx.arc(fx, fy + fr * 0.08, fr * 0.88, 0, Math.PI * 2);
      const appleGrad = ctx.createRadialGradient(fx - fr * 0.25, fy - fr * 0.2, 0, fx, fy, fr);
      appleGrad.addColorStop(0, '#ff6060');
      appleGrad.addColorStop(0.6, '#e8001a');
      appleGrad.addColorStop(1, '#8b0000');
      ctx.fillStyle = appleGrad; ctx.fill();

      // top indent
      ctx.beginPath();
      ctx.arc(fx, fy - fr * 0.78, fr * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = '#8b0000'; ctx.fill();

      // shine
      ctx.beginPath();
      ctx.ellipse(fx - fr * 0.28, fy - fr * 0.22, fr * 0.22, fr * 0.14, -0.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();

      // stem
      ctx.strokeStyle = '#5a3010'; ctx.lineWidth = C * 0.08; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(fx, fy - fr * 0.82); ctx.lineTo(fx + C * 0.12, fy - fr * 1.18); ctx.stroke();

      // leaf
      ctx.beginPath();
      ctx.ellipse(fx + C * 0.22, fy - fr * 1.08, fr * 0.28, fr * 0.14, -0.8, 0, Math.PI * 2);
      ctx.fillStyle = '#22cc44'; ctx.fill();
      ctx.restore();

      // Snake — smooth bezier spine
      const R = C * 0.38;
      const lerp = lerpRef.current;
      const { dir } = stateRef.current;

      // Build interpolated positions — handle wall wrap smoothly
      const ipos = snake.map((seg, i) => {
        if (i === 0) {
          // head moves in dir, wrapping
          let px = seg.x - dir.x * (1 - lerp);
          let py = seg.y - dir.y * (1 - lerp);
          // wrap fractional position
          if (px < 0) px += GRID;
          if (px >= GRID) px -= GRID;
          if (py < 0) py += GRID;
          if (py >= GRID) py -= GRID;
          return { x: px * C + C / 2, y: py * C + C / 2 };
        }
        const prev = snake[i - 1];
        let dx = prev.x - seg.x;
        let dy = prev.y - seg.y;
        // shortest path across wrap
        if (dx > GRID / 2) dx -= GRID;
        if (dx < -GRID / 2) dx += GRID;
        if (dy > GRID / 2) dy -= GRID;
        if (dy < -GRID / 2) dy += GRID;
        let px = seg.x + dx * lerp;
        let py = seg.y + dy * lerp;
        if (px < 0) px += GRID;
        if (px >= GRID) px -= GRID;
        if (py < 0) py += GRID;
        if (py >= GRID) py -= GRID;
        return { x: px * C + C / 2, y: py * C + C / 2 };
      });

      if (ipos.length === 1) {
        ctx.save(); ctx.shadowColor = '#39ff14'; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(ipos[0].x, ipos[0].y, R, 0, Math.PI * 2);
        ctx.fillStyle = '#39ff14'; ctx.fill(); ctx.restore();
      } else {
        for (let i = 0; i < ipos.length - 1; i++) {
          const ax = ipos[i].x, ay = ipos[i].y;
          const bx = ipos[i+1].x, by = ipos[i+1].y;
          // skip if crossed a wall
          if (Math.hypot(bx - ax, by - ay) > C * 1.5) continue;

          const t0 = i / (ipos.length - 1);
          const t1 = (i + 1) / (ipos.length - 1);
          const g0 = Math.round(255 - t0 * 120), g1 = Math.round(255 - t1 * 120);
          const r0 = Math.round(40 + t0 * 30), r1 = Math.round(40 + t1 * 30);

          if (i === 0) { ctx.save(); ctx.shadowColor = '#39ff14'; ctx.shadowBlur = 16; }
          const grad = ctx.createLinearGradient(ax, ay, bx, by);
          grad.addColorStop(0, `rgb(${r0},${g0},10)`);
          grad.addColorStop(1, `rgb(${r1},${g1},10)`);
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
          ctx.strokeStyle = grad; ctx.lineWidth = R * 2;
          ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
          if (i === 0) ctx.restore();
        }

        // Belly stripe — skip wall-crossing segments
        ctx.save();
        ctx.strokeStyle = 'rgba(180,255,120,0.18)';
        ctx.lineWidth = R * 0.7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        let bellyStarted = false;
        for (let i = 0; i < ipos.length; i++) {
          const ax = ipos[i].x, ay = ipos[i].y;
          if (!bellyStarted) { ctx.beginPath(); ctx.moveTo(ax, ay); bellyStarted = true; continue; }
          const px = ipos[i-1].x, py = ipos[i-1].y;
          if (Math.hypot(ax - px, ay - py) > C * 1.5) {
            ctx.stroke(); ctx.beginPath(); ctx.moveTo(ax, ay);
          } else { ctx.lineTo(ax, ay); }
        }
        ctx.stroke(); ctx.restore();

        // Scale dots
        for (let i = 1; i < ipos.length; i += 2) {
          const t = i / (ipos.length - 1);
          ctx.beginPath(); ctx.arc(ipos[i].x, ipos[i].y, R * 0.28, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,0,0,${0.22 - t * 0.1})`; ctx.fill();
        }
      }

      // Head
      const hx = ipos[0].x, hy = ipos[0].y;
      ctx.save(); ctx.shadowColor = '#39ff14'; ctx.shadowBlur = 22;
      ctx.beginPath(); ctx.arc(hx, hy, R * 1.08, 0, Math.PI * 2);
      ctx.fillStyle = '#4eff20'; ctx.fill();
      ctx.restore();

      // Head highlight
      ctx.beginPath(); ctx.arc(hx - R * 0.3, hy - R * 0.3, R * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();

      // Tongue
      const perp = { x: -dir.y, y: dir.x };
      const tbase = { x: hx + dir.x * R * 0.85, y: hy + dir.y * R * 0.85 };
      const ttip  = { x: hx + dir.x * R * 1.55, y: hy + dir.y * R * 1.55 };
      ctx.strokeStyle = '#ff2255'; ctx.lineWidth = C * 0.06; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tbase.x, tbase.y); ctx.lineTo(ttip.x, ttip.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ttip.x, ttip.y);
      ctx.lineTo(ttip.x + (dir.x + perp.x * 0.8) * C * 0.16, ttip.y + (dir.y + perp.y * 0.8) * C * 0.16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ttip.x, ttip.y);
      ctx.lineTo(ttip.x + (dir.x - perp.x * 0.8) * C * 0.16, ttip.y + (dir.y - perp.y * 0.8) * C * 0.16); ctx.stroke();

      // Eyes
      [-1, 1].forEach(sd => {
        const ex = hx + perp.x * R * 0.58 * sd + dir.x * R * 0.3;
        const ey = hy + perp.y * R * 0.58 * sd + dir.y * R * 0.3;
        ctx.beginPath(); ctx.arc(ex, ey, R * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.beginPath(); ctx.arc(ex + dir.x * R * 0.1, ey + dir.y * R * 0.1, R * 0.18, 0, Math.PI * 2);
        ctx.fillStyle = '#111'; ctx.fill();
        ctx.beginPath(); ctx.arc(ex + dir.x * R * 0.05 - R * 0.08, ey + dir.y * R * 0.05 - R * 0.08, R * 0.07, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();
      });

      // Speed up flash
      if (speedFlashRef.current > 0) {
        speedFlashRef.current--;
        const a = Math.min(speedFlashRef.current / 40, 1);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.shadowColor = '#ffdd00'; ctx.shadowBlur = 20;
        ctx.fillStyle = '#ffdd00';
        ctx.font = `bold ${C * 0.9}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('⚡ SPEED UP!', SIZE / 2, SIZE / 2);
        ctx.restore();
      }

      // Floating +10 texts
      floatersRef.current = floatersRef.current.filter(f => f.life > 0.02);
      floatersRef.current.forEach(f => {
        f.y -= 1.2;
        f.life *= 0.94;
        ctx.save();
        ctx.globalAlpha = f.life;
        ctx.shadowColor = '#39ff14'; ctx.shadowBlur = 10;
        ctx.fillStyle = '#39ff14';
        ctx.font = `bold ${C * 0.7}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('+10', f.x, f.y);
        ctx.restore();
      });

      // Particles
      particlesRef.current = particlesRef.current.filter(p => p.life > 0.02);
      particlesRef.current.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vx *= 0.91; p.vy *= 0.91; p.life *= 0.87;
        ctx.globalAlpha = p.life;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color; ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Overlays
      if (over) {
        ctx.fillStyle = 'rgba(8,12,16,0.82)'; ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.save();
        ctx.shadowColor = '#ff4444'; ctx.shadowBlur = 30;
        ctx.fillStyle = '#ff4444'; ctx.font = `bold ${C * 1.4}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('GAME OVER', SIZE / 2, SIZE / 2 - C * 1.2);
        ctx.restore();
        ctx.fillStyle = '#39ff14'; ctx.font = `${C * 0.8}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`Score: ${stateRef.current.score}`, SIZE / 2, SIZE / 2 - C * 0.1);
        ctx.fillStyle = 'rgba(57,255,20,0.45)'; ctx.font = `${C * 0.55}px monospace`;
        ctx.fillText('Enter name below to save', SIZE / 2, SIZE / 2 + C * 0.9);
      }

      if (!running && !over && stateRef.current.started) {
        ctx.fillStyle = 'rgba(8,12,16,0.6)'; ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.save();
        ctx.shadowColor = '#39ff14'; ctx.shadowBlur = 20;
        ctx.fillStyle = '#39ff14'; ctx.font = `bold ${C * 1.2}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('⏸ PAUSED', SIZE / 2, SIZE / 2);
        ctx.restore();
        ctx.fillStyle = 'rgba(57,255,20,0.45)'; ctx.font = `${C * 0.55}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('Press P to resume', SIZE / 2, SIZE / 2 + C * 1.1);
      }

      if (!running && !over && !stateRef.current.started) {
        ctx.fillStyle = 'rgba(8,12,16,0.7)'; ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.save();
        ctx.shadowColor = '#39ff14'; ctx.shadowBlur = 30;
        ctx.fillStyle = '#39ff14'; ctx.font = `bold ${C * 1.5}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🐍 SNAKE', SIZE / 2, SIZE / 2 - C);
        ctx.restore();
        ctx.fillStyle = 'rgba(57,255,20,0.6)'; ctx.font = `${C * 0.65}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('Press SPACE or click Start', SIZE / 2, SIZE / 2 + C * 0.4);
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const handleSave = () => {
    if (!name.trim()) return;
    setScores(persistScore(name.trim(), state.score));
    setSaved(true);
  };

  const restart = () => {
    particlesRef.current = []; floatersRef.current = []; shakeRef.current = 0;
    speedRef.current = 130; speedFlashRef.current = 0;
    setLevel(1);
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(move, 130);
    scoreAnimRef.current = { current: 0, target: 0 };
    lerpRef.current = 0; lastTickRef.current = Date.now();
    setDisplayScore(0); setName(''); setSaved(false);
    setState(initState());
  };

  const SIZE = GRID * cell;

  return (
    <div style={s.root}>
      {/* Sidebar */}
      <div style={s.sidebar}>
        <div style={s.logo}>🐍 SNAKE</div>

        <div style={s.card}>
          <div style={s.cardLabel}>SCORE</div>
          <div style={s.cardVal}>{displayScore}</div>
        </div>

        <div style={s.card}>
          <div style={s.cardLabel}>BEST</div>
          <div style={s.cardVal}>{scores[0]?.score ?? 0}</div>
        </div>

        <div style={s.card}>
          <div style={s.cardLabel}>LEVEL</div>
          <div style={s.cardVal}>{level}</div>
          <div style={s.progressBg}>
            <div style={{ ...s.progressFill, width: `${(state.score % 50) / 50 * 100}%` }} />
          </div>
          <div style={s.progressLabel}>{state.score % 50}/50</div>
        </div>

        <div style={s.divider} />

        {!state.running && !state.over && !state.started && (
          <button style={s.btn} onClick={() => setState(st => ({ ...st, running: true, started: true }))}>▶ START</button>
        )}

        {state.over && (
          <div style={s.gameOverPanel}>
            <div style={s.gameOverText}>GAME OVER</div>
            {!saved ? (
              <>
                <input
                  style={s.input}
                  placeholder="Your name"
                  value={name}
                  maxLength={12}
                  autoFocus
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                />
                <button style={s.btn} onClick={handleSave}>💾 SAVE</button>
              </>
            ) : <div style={s.savedMsg}>✓ Saved!</div>}
            <button style={{ ...s.btn, ...s.btnSecondary }} onClick={restart}>↺ RESTART</button>
          </div>
        )}

        {state.running && (
          <>
            <button style={s.btn} onClick={() => {
              setState(st => ({ ...st, running: false }));
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }}>⏸ PAUSE</button>
            <div style={s.hint}>
              <div>↑ ↓ ← → Move</div>
              <div style={{ marginTop: 4 }}>Eat 🍎 to grow</div>
            </div>
          </>
        )}

        {!state.running && !state.over && state.started && (
          <button style={s.btn} onClick={() => {
            lastTickRef.current = Date.now();
            intervalRef.current = setInterval(move, speedRef.current);
            setState(st => ({ ...st, running: true }));
          }}>▶ RESUME</button>
        )}

        <div style={s.divider} />

        <div style={s.lbTitle}>🏆 LEADERBOARD</div>
        {scores.length === 0
          ? <div style={s.lbEmpty}>No scores yet</div>
          : scores.map((sc, i) => (
            <div key={i} style={s.lbRow}>
              <span style={{ ...s.lbRank, color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#4ecca366' }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
              </span>
              <span style={s.lbName}>{sc.name}</span>
              <span style={s.lbScore}>{sc.score}</span>
            </div>
          ))
        }
      </div>

      {/* Canvas */}
      <div style={s.canvasWrap}>
        <div style={{ ...s.boardGlow, width: SIZE, height: SIZE }}>
          <canvas ref={canvasRef} width={SIZE} height={SIZE} style={s.canvas} />
        </div>
      </div>
    </div>
  );
}

const s = {
  root: { display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', background: '#050d05', fontFamily: "'Courier New', monospace", color: '#eee' },
  sidebar: { width: 200, minWidth: 200, height: '100vh', background: '#071007', borderRight: '1px solid #39ff1420', display: 'flex', flexDirection: 'column', padding: '20px 16px', gap: 10, overflowY: 'auto' },
  logo: { fontSize: 18, fontWeight: 'bold', color: '#39ff14', letterSpacing: 3, textShadow: '0 0 20px #39ff14, 0 0 40px #39ff1466', marginBottom: 4, textAlign: 'center' },
  card: { background: '#050d05', border: '1px solid #39ff1420', borderRadius: 8, padding: '10px 14px', textAlign: 'center' },
  cardLabel: { fontSize: 10, letterSpacing: 3, color: '#39ff1466', marginBottom: 2 },
  cardVal: { fontSize: 28, fontWeight: 'bold', color: '#39ff14', textShadow: '0 0 12px #39ff1499' },
  divider: { height: 1, background: '#39ff1418', margin: '4px 0' },
  btn: { padding: '10px 0', background: 'linear-gradient(135deg, #39ff1422, #39ff1410)', border: '1px solid #39ff14', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', color: '#39ff14', fontSize: 13, letterSpacing: 2, textShadow: '0 0 8px #39ff14', boxShadow: '0 0 14px #39ff1430', width: '100%', transition: 'all 0.15s' },
  btnSecondary: { background: 'transparent', border: '1px solid #39ff1440', color: '#39ff1488', textShadow: 'none', boxShadow: 'none', marginTop: 4 },
  gameOverPanel: { display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch' },
  gameOverText: { textAlign: 'center', color: '#ff4444', fontSize: 13, fontWeight: 'bold', letterSpacing: 2, textShadow: '0 0 12px #ff4444' },
  input: { padding: '8px 10px', background: '#050d05', border: '1px solid #39ff1440', borderRadius: 6, color: '#eee', fontFamily: 'inherit', fontSize: 13, outline: 'none', width: '100%' },
  savedMsg: { textAlign: 'center', color: '#39ff14', fontSize: 13 },
  hint: { fontSize: 11, color: '#39ff1455', lineHeight: 1.6, textAlign: 'center' },
  lbTitle: { fontSize: 10, letterSpacing: 3, color: '#39ff1466', textAlign: 'center', marginBottom: 2 },
  lbEmpty: { fontSize: 11, color: '#39ff1433', textAlign: 'center' },
  lbRow: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 2px', borderBottom: '1px solid #ffffff06' },
  lbRank: { fontSize: 13, width: 22, textAlign: 'center' },
  lbName: { flex: 1, fontSize: 12, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  lbScore: { fontSize: 12, color: '#39ff14', fontWeight: 'bold' },
  progressBg: { height: 5, background: '#39ff1418', borderRadius: 4, marginTop: 6, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'linear-gradient(90deg, #39ff14, #aaff00)', borderRadius: 4, transition: 'width 0.3s ease', boxShadow: '0 0 6px #39ff14' },
  progressLabel: { fontSize: 9, color: '#39ff1455', textAlign: 'right', marginTop: 2, letterSpacing: 1 },
  canvasWrap: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  boardGlow: { borderRadius: 6, boxShadow: '0 0 80px #39ff1415, 0 0 160px #39ff1408', border: '1px solid #39ff1425', overflow: 'hidden' },
  canvas: { display: 'block' },
};
