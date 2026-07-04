import React, { useEffect, useState } from 'react';

export const SystemHUD = () => {
  const [fps, setFps] = useState(0);
  const [velocity, setVelocity] = useState(0);
  const [temp, setTemp] = useState(42);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animationFrameId: number;
    let lastMouse = { x: 0, y: 0, time: performance.now() };

    const update = () => {
      const now = performance.now();
      frameCount++;
      
      if (now - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        setTemp(40 + Math.random() * 8); // Simulate temp fluctuation
        frameCount = 0;
        lastTime = now;
      }
      
      animationFrameId = requestAnimationFrame(update);
    };

    const onMouseMove = (e: MouseEvent) => {
      const now = performance.now();
      const dt = now - lastMouse.time;
      if (dt > 0) {
        const dx = e.clientX - lastMouse.x;
        const dy = e.clientY - lastMouse.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        setVelocity(Math.round(dist / dt * 100)); // pixels per 100ms
      }
      lastMouse = { x: e.clientX, y: e.clientY, time: now };
    };

    animationFrameId = requestAnimationFrame(update);
    window.addEventListener('mousemove', onMouseMove);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return (
    <div className="fixed bottom-4 left-4 z-[9999] font-mono text-[10px] text-indigo-400/50 pointer-events-none flex flex-col gap-1 text-left mix-blend-screen">
      <div>SYS_FPS: {fps.toString().padStart(3, '0')}</div>
      <div>MS_VEL: {velocity.toString().padStart(4, '0')}px/s</div>
      <div>CORE_TMP: {temp.toFixed(1)}°C</div>
    </div>
  );
};
