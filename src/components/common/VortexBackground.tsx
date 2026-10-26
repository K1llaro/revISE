import React, { useEffect, useRef } from 'react';

const SPIRAL_TEXT =
  "Open your potential! " +
  "Stop reading this. Go and study! " +
  "Your API Key is safe. Don't worry! " +
  "git commit -m 'no bugs bro, trust me' " +
  "Open your terminal, look up to the cloud and see... " +
  "revISE — master the craft. " +
  "while (alive) { learn(); practice(); build(); } " +
  "git commit -m 'no bugs' — async await dream(); " +
  "01010011 01001111 01010011 — 404: Limits Not Found. " +
  "function elevate() { return knowledge; } " +
  "Epstein's equation... Oh wait, that's wrong. ";

export const VortexBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number | null = null;
    let isRunning = true;
    let width = 0;
    let height = 0;
    let cx = 0;
    let cy = 0;

    let offCanvas: HTMLCanvasElement | null = null;
    let offSize = 0;
    let textGradient: CanvasGradient | null = null;

    // 1. Ограничиваем DPR единицей: фоновому эффекту не нужно 4K-разрешение
    const bakeSpiral = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      cx = width / 2;
      cy = height / 2;

      canvas.width = width;
      canvas.height = height;

      textGradient = ctx.createLinearGradient(0, 0, width, 0);
      textGradient.addColorStop(0, '#3c4acb44');
      textGradient.addColorStop(0.44, '#4a4fde2e');
      textGradient.addColorStop(0.56, '#38f8a823');
      textGradient.addColorStop(1, '#02c73d21');

      const maxR = Math.sqrt(cx * cx + cy * cy) * 1.05;
      const minR = Math.min(width, height) * 0.10;

      offSize = Math.ceil(maxR * 2 + 60);
      offCanvas = document.createElement('canvas');
      offCanvas.width = offSize;
      offCanvas.height = offSize;

      const offCtx = offCanvas.getContext('2d');
      if (!offCtx) return;

      const offCx = offSize / 2;
      const offCy = offSize / 2;

      const TURNS = 15;
      const maxTheta = TURNS * 2 * Math.PI;

      let theta = 0;
      let textIdx = 0;

      offCtx.textAlign = 'center';
      offCtx.textBaseline = 'middle';

      while (theta < maxTheta) {
        const progress = theta / maxTheta;
        const r = minR + (maxR - minR) * Math.pow(progress, 1.28);
        if (r > maxR) break;

        const fontSize = Math.round(11 + (67 - 5) * progress);
        offCtx.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;

        const char = SPIRAL_TEXT[textIdx % SPIRAL_TEXT.length];

        const x = offCx + Math.cos(theta) * r;
        const y = offCy + Math.sin(theta) * r;
        const tangent = theta + Math.PI / 2;

        let alpha = 0.85;
        if (progress < 0.08) {
          alpha = progress / 0.08;
        } else if (progress > 0.88) {
          alpha = (1 - progress) / 0.12;
        }

        offCtx.save();
        offCtx.translate(x, y);
        offCtx.rotate(tangent);
        offCtx.globalAlpha = Math.max(0, alpha);

        offCtx.fillStyle = '#ffffff';
        offCtx.fillText(char, 0, 0);
        offCtx.restore();

        const charWidth = fontSize * 0.58;
        const dTheta = charWidth / r;
        theta += dTheta;
        textIdx++;
      }
    };

    bakeSpiral();
    window.addEventListener('resize', bakeSpiral, { passive: true });

    let currentRotation = 0;
    let lastTime = performance.now();
    let lastRenderTime = performance.now();
    const ROTATION_SPEED = 0.04;
    const TARGET_INTERVAL = 1000 / 30; // Ограничение 30 FPS для нулевой нагрузки на GPU

    const render = (now: number) => {
      if (!isRunning) return;

      const delta = now - lastRenderTime;

      // Пропускаем лишние кадры, если монитор 144Hz / 60Hz
      if (delta >= TARGET_INTERVAL) {
        lastRenderTime = now - (delta % TARGET_INTERVAL);

        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;
        currentRotation += ROTATION_SPEED * dt;

        ctx.clearRect(0, 0, width, height);

        if (offCanvas && textGradient) {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(currentRotation);
          ctx.drawImage(offCanvas, -offSize / 2, -offSize / 2, offSize, offSize);
          ctx.restore();

          ctx.save();
          ctx.globalCompositeOperation = 'source-in';
          ctx.fillStyle = textGradient;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        }
      }

      animId = requestAnimationFrame(render);
    };

    // Запуск единичного цикла
    animId = requestAnimationFrame(render);

    // 2. Железная защита от размножения циклов при переключении вкладок
    const handleVisibility = () => {
      if (document.hidden) {
        isRunning = false;
        if (animId !== null) {
          cancelAnimationFrame(animId);
          animId = null;
        }
      } else {
        if (!isRunning) {
          isRunning = true;
          lastTime = performance.now();
          lastRenderTime = performance.now();
          if (animId !== null) cancelAnimationFrame(animId);
          animId = requestAnimationFrame(render);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isRunning = false;
      if (animId !== null) cancelAnimationFrame(animId);
      window.removeEventListener('resize', bakeSpiral);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      aria-hidden="true"
    />
  );
};