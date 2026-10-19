import React, { useEffect, useRef } from 'react';

// Текст, который непрерывно закручивается в спираль (отсылка к Bohemian Rhapsody + revISE)
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

    let animId: number;
    let width = 0;
    let height = 0;
    let cx = 0;
    let cy = 0;

    // Оффскрин-холст для предварительной отрисовки (гарантирует отсутствие лагов)
    let offCanvas: HTMLCanvasElement | null = null;
    let offSize = 0;
    let textGradient: CanvasGradient | null = null;

    // Создаем спираль из чисто белых букв с прозрачностями
    const bakeSpiral = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      cx = width / 2;
      cy = height / 2;

      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Создаем градиент для динамической раскраски:
      // Слева (на синем фоне) -> Зелёный
      // Справа (на зелёном фоне) -> Ярко-голубой
      textGradient = ctx.createLinearGradient(0, 0, width, 0);
      textGradient.addColorStop(0, '#3c4acb44');    // Неоновый зеленый слева
      textGradient.addColorStop(0.44, '#4a4fde2e'); // Мягкий переход к центру
      textGradient.addColorStop(0.56, '#38f8a823'); // Переход в небесно-голубой
      textGradient.addColorStop(1, '#02c73d21');    // Насыщенный синий справа

      const maxR = Math.sqrt(cx * cx + cy * cy) * 1.05;
      const minR = Math.min(width, height) * 0.10; // Круглая дыра в центре

      offSize = Math.ceil(maxR * 2 + 100);
      offCanvas = document.createElement('canvas');
      offCanvas.width = offSize * dpr;
      offCanvas.height = offSize * dpr;

      const offCtx = offCanvas.getContext('2d');
      if (!offCtx) return;
      offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const offCx = offSize / 2;
      const offCy = offSize / 2;

      // Настройки спирали
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

        // Рисуем чистым белым цветом — маска сама перекрасит его в градиент
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
    const ROTATION_SPEED = 0.04;

    const render = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.08);
      lastTime = now;

      currentRotation += ROTATION_SPEED * dt;

      ctx.clearRect(0, 0, width, height);

      if (offCanvas && textGradient) {
        // 1. Отрисовываем вращающуюся спираль
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(currentRotation);
        ctx.drawImage(offCanvas, -offSize / 2, -offSize / 2, offSize, offSize);
        ctx.restore();

        // 2. Мгновенно тонируем буквы градиентом в координатах экрана
        // 'source-in' оставляет цвет градиента ТОЛЬКО на пикселях букв
        ctx.save();
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = textGradient;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animId);
      } else {
        lastTime = performance.now();
        animId = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelAnimationFrame(animId);
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