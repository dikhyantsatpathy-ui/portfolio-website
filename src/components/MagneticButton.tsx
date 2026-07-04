import React, { useRef } from 'react';
import { motion, useSpring, useMotionValue } from 'motion/react';

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  href?: string;
  target?: string;
  rel?: string;
}

export const MagneticButton = ({ children, className = "", onClick, href, target, rel }: MagneticButtonProps) => {
  const ref = useRef<HTMLButtonElement | HTMLAnchorElement>(null);
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const springX = useSpring(x, { stiffness: 150, damping: 15, mass: 0.1 });
  const springY = useSpring(y, { stiffness: 150, damping: 15, mass: 0.1 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distanceX = e.clientX - centerX;
    const distanceY = e.clientY - centerY;
    
    // Magnetic pull strength (closer to edge = more pull)
    x.set(distanceX * 0.2);
    y.set(distanceY * 0.2);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const commonProps = {
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
    className: `magnetic inline-block ${className}`,
    style: { x: springX, y: springY }
  };

  if (href) {
    return (
      <motion.a 
        ref={ref as any} 
        href={href} 
        target={target}
        rel={rel}
        {...commonProps}
      >
        {children}
      </motion.a>
    );
  }

  return (
    <motion.button 
      ref={ref as any} 
      onClick={onClick} 
      {...commonProps}
    >
      {children}
    </motion.button>
  );
};
