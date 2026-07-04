import React, { useEffect, useState, useRef } from 'react';

const CHARS = '!<>-_\\/[]{}—=+*^?#________';

export const ScrambleText = ({ text }: { text: string }) => {
  const [output, setOutput] = useState('');
  const ref = useRef<HTMLSpanElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [trigger, setTrigger] = useState(0);
  const isAnimatingRef = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated) {
          setHasAnimated(true);
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) {
      observer.observe(ref.current);
    }
    return () => observer.disconnect();
  }, [hasAnimated]);

  useEffect(() => {
    if (!hasAnimated && trigger === 0) {
       let initialScramble = '';
       for(let i=0; i<text.length; i++) {
         initialScramble += `<span class="opacity-30 text-indigo-500 font-mono">${CHARS[Math.floor(Math.random() * CHARS.length)]}</span>`;
       }
       setOutput(initialScramble);
       return;
    }

    isAnimatingRef.current = true;
    let frame = 0;
    const queue: { from: string, to: string, start: number, end: number, char?: string }[] = [];
    
    for (let i = 0; i < text.length; i++) {
      queue.push({
        from: CHARS[Math.floor(Math.random() * CHARS.length)],
        to: text[i],
        start: Math.floor(Math.random() * 40),
        end: Math.floor(Math.random() * 40) + Math.floor(Math.random() * 40),
      });
    }

    let animationFrame: number;
    const update = () => {
      let complete = 0;
      let newOutput = '';
      
      for (let i = 0; i < queue.length; i++) {
        let { from, to, start, end, char } = queue[i];
        if (frame >= end) {
          complete++;
          newOutput += to;
        } else if (frame >= start) {
          if (!char || Math.random() < 0.28) {
            char = CHARS[Math.floor(Math.random() * CHARS.length)];
            queue[i].char = char;
          }
          newOutput += `<span class="opacity-50 text-indigo-400 font-mono">${char}</span>`;
        } else {
          newOutput += `<span class="opacity-30 text-indigo-500 font-mono">${from}</span>`;
        }
      }
      
      setOutput(newOutput);

      if (complete === queue.length) {
        isAnimatingRef.current = false;
        cancelAnimationFrame(animationFrame);
      } else {
        animationFrame = requestAnimationFrame(update);
        frame += 0.5;
      }
    };
    
    update();
    return () => cancelAnimationFrame(animationFrame);
  }, [hasAnimated, text, trigger]);

  const handleMouseEnter = () => {
    if (!isAnimatingRef.current) {
      setTrigger(t => t + 1);
    }
  };

  return <span ref={ref} onMouseEnter={handleMouseEnter} dangerouslySetInnerHTML={{ __html: output }} className="inline-block min-w-max" />;
};
