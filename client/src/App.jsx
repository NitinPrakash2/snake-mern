import { useEffect, useRef, useState, useCallback } from 'react';

const GRID = 20;
const CELL = 24;
const SIZE = GRID * CELL;
const SPEED = 130;

const randomPos = () => ({
  x: Math.floor(Math.random() * GRID),
  y: Math.floor(Math.random() * GRID),
});

const initState = () => ({
  snake: [{ x: 10, y: 10 }],
  dir: { x: 1, y: 0 },
  food: randomPos(),
  running: false,
  over: false,
  score: 0,
});

export default function App() {
  const [state, setState] = useState(initState());
  const [displayScore, setDisplayScore] = useState(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const shakeRef = useRef(0);
  const foodPulseRef = useRef(0);
  const animRef = useRef(null);
  const scoreAnimRef = useRef({ current: 0, target: 0 });

  // Spawn particles on food eaten
  const spawnParticles = (x, y) => {
    for (let i = 0; i < 18; i++) {
      const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.3;
      const speed = 1.5 + Math.random() * 2.5;
      particlesRef.current.push({
        x: x * CELL + CELL / 2,
        y: y * CELL + CELL / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        size: 2 + Math.random() * 3,
        color: `hsl(${160 + Math.random() * 60}, 100%, 65%)`,
      });
    }
  };

  const move = useCallback(() => {
    const { snake, dir, food, running, over } = stateRef.current;
    if (!running || over) return;

    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    if (
      head.x < 0 || head.x >= GRID ||
      head.y < 0 || head.y >= GRID ||
      snake.some(s => s.x === head.x && s.y === head.y)
    ) {
      shakeRef.current = 18;
      setState(s => ({ ...s, running: false, over: true }));
      return;
    }

    const ate = head.x === food.x && head.y === food.y;
    if (ate) spawnParticles(food.x, food.y);

    const newSnake = ate ? [head, ...snake] : [head, ...snake.slice(0, -1)];
    setState(s => {
      const newScore = ate ? s.score + 10 : s.score;
      scoreAnimRef.current.target = newScore;
      return { ...s, snake: newSnake, food: ate ? randomPos() : food, score: newScore };
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(move, SPEED);
    return () => clearInterval(interval);
  }, [move]);

  useEffect(() => {
    const handleKey = (e) => {
      const dirs = {
        ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
      };
      if (dirs[e.key]) {
        e.preventDefault();
        const cur = stateRef.current.dir;
        const next = dirs[e.key];
        if (next.x !== -cur.x || next.y !== -cur.y)
          setState(s => ({ ...s, dir: next }));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Canvas draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      const { snake, food, over, running } = stateRef.current;
      foodPulseRef.current += 0.07;

      // Score animation
      const sa = scoreAnimRef.current;
      if (sa.current < sa.target) {
        sa.current = Math.min(sa.current + 2, sa.target);
        setDisplayScore(sa.current);
      }

      // Screen shake
      let sx = 0, sy = 0;
      if (shakeRef.current > 0) {
        sx = (Math.random() - 0.5) * shakeRef.current;
        sy = (Math.random() - 0.5) * shakeRef.current;
        shakeRef.current *= 0.8;
        if (shakeRef.current < 0.5) shakeRef.current = 0;
      }

      ctx.save();
      ctx.translate(sx, sy);

      // Background
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(-10, -10, SIZE + 20, SIZE + 20);

      // Grid dots
      ctx.fillStyle = 'rgba(78,204,163,0.07)';
      for (let x = 0; x < GRID; x++)
        for (let y = 0; y < GRID; y++)
          ctx.fillRect(x * CELL + CELL / 2 - 1, y * CELL + CELL / 2 - 1, 2, 2);

      // Food glow + pulse
      const pulse = 1 + Math.sin(foodPulseRef.current) * 0.18;
      const fx = food.x * CELL + CELL / 2;
      const fy = food.y * CELL + CELL / 2;
      const fr = (CELL / 2 - 2) * pulse;

      ctx.save();
      ctx.shadowColor = '#e94560';
      ctx.shadowBlur = 18 * pulse;
      ctx.beginPath();
      ctx.arc(fx, fy, fr, 0, Math.PI * 2);
      ctx.fillStyle = '#e94560';
      ctx.fill();
      // shine
      ctx.beginPath();
      ctx.arc(fx - fr * 0.3, fy - fr * 0.3, fr * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fill();
      ctx.restore();

      // Snake
      snake.forEach((seg, i) => {
        const t = i / snake.length;
        const r = CELL / 2 - 1;
        const cx = seg.x * CELL + CELL / 2;
        const cy = seg.y * CELL + CELL / 2;

        // glow on head
        if (i === 0) {
          ctx.save();
          ctx.shadowColor = '#4ecca3';
          ctx.shadowBlur = 16;
        }

        // gradient color head→tail
        const green = Math.round(204 - t * 80);
        const alpha = 1 - t * 0.3;
        ctx.fillStyle = `rgba(78,${green},163,${alpha})`;
        ctx.beginPath();
        ctx.roundRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2, i === 0 ? 6 : 4);
        ctx.fill();

        if (i === 0) {
          // eyes
          const { dir } = stateRef.current;
          const ex = dir.x, ey = dir.y;
          const perp = { x: -ey, y: ex };
          [[1, 1], [1, -1]].forEach(([fd, sd]) => {
            const ex2 = cx + ex * r * 0.45 * fd + perp.x * r * 0.4 * sd;
            const ey2 = cy + ey * r * 0.45 * fd + perp.y * r * 0.4 * sd;
            ctx.beginPath();
            ctx.arc(ex2, ey2, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = '#0d1117';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(ex2 + 0.5, ey2 - 0.5, 1, 0, Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.fill();
          });
          ctx.restore();
        }
      });

      // Particles
      particlesRef.current = particlesRef.current.filter(p => p.life > 0.02);
      particlesRef.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.92;
        p.vy *= 0.92;
        p.life *= 0.88;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Game over overlay
      if (over) {
        ctx.fillStyle = 'rgba(13,17,23,0.75)';
        ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.save();
        ctx.shadowColor = '#e94560';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#e94560';
        ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', SIZE / 2, SIZE / 2 - 16);
        ctx.restore();
        ctx.fillStyle = '#4ecca3';
        ctx.font = '18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Score: ${stateRef.current.score}`, SIZE / 2, SIZE / 2 + 18);
      }

      // Start screen
      if (!running && !over) {
        ctx.fillStyle = 'rgba(13,17,23,0.6)';
        ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.fillStyle = '#4ecca3';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Press Start', SIZE / 2, SIZE / 2);
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const restart = () => {
    particlesRef.current = [];
    shakeRef.current = 0;
    scoreAnimRef.current = { current: 0, target: 0 };
    setDisplayScore(0);
    setState(initState());
  };

  return (
    <div style={s.container}>
      <h1 style={s.title}>🐍 Snake</h1>
      <div style={s.scoreBox}>
        <span style={s.scoreLabel}>SCORE</span>
        <span style={s.scoreVal}>{displayScore}</span>
      </div>
      <div style={s.boardWrap}>
        <canvas ref={canvasRef} width={SIZE} height={SIZE} style={s.canvas} />
      </div>
      <div style={s.btnRow}>
        {!state.running && !state.over && (
          <button style={s.btn} onClick={() => setState(st => ({ ...st, running: true }))}>▶ Start</button>
        )}
        {state.over && (
          <button style={s.btn} onClick={restart}>↺ Restart</button>
        )}
      </div>
      <p style={s.hint}>Arrow keys to move</p>
    </div>
  );
}

const s = {
  container: { display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#0d1117', minHeight: '100vh', color: '#eee', fontFamily: 'monospace', padding: 24 },
  title: { color: '#4ecca3', margin: '0 0 4px', fontSize: 32, letterSpacing: 4, textShadow: '0 0 20px #4ecca3' },
  scoreBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 12 },
  scoreLabel: { fontSize: 11, letterSpacing: 3, color: '#4ecca388' },
  scoreVal: { fontSize: 36, fontWeight: 'bold', color: '#4ecca3', textShadow: '0 0 12px #4ecca3', lineHeight: 1.1 },
  boardWrap: { border: '2px solid #4ecca344', borderRadius: 6, boxShadow: '0 0 40px #4ecca322, inset 0 0 30px #00000066', overflow: 'hidden' },
  canvas: { display: 'block' },
  btnRow: { marginTop: 16, minHeight: 44 },
  btn: { padding: '10px 32px', background: 'transparent', border: '2px solid #4ecca3', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', color: '#4ecca3', fontSize: 16, letterSpacing: 2, textShadow: '0 0 8px #4ecca3', boxShadow: '0 0 16px #4ecca344', transition: 'all 0.2s' },
  hint: { color: '#4ecca344', fontSize: 12, marginTop: 8, letterSpacing: 2 },
};
