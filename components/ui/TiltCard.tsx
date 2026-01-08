
import React, { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const TiltCard: React.FC<TiltCardProps> = ({ children, className = "", onClick }) => {
  const ref = useRef<HTMLDivElement>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Smooth out the mouse movement
  const mouseX = useSpring(x, { stiffness: 500, damping: 100 });
  const mouseY = useSpring(y, { stiffness: 500, damping: 100 });

  // Map mouse position to rotation degrees
  const rotateX = useTransform(mouseY, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-10deg", "10deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;

    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        rotateY,
        rotateX,
        transformStyle: "preserve-3d",
      }}
      className={`relative transition-all duration-200 ease-linear transform-gpu ${className}`}
    >
      <div 
        style={{ 
          transform: "translateZ(0px)", // Base layer
          transformStyle: "preserve-3d" 
        }} 
        className="h-full w-full"
      >
        {children}
      </div>
      
      {/* Glossy Reflection Effect */}
      <motion.div
        className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-40 pointer-events-none transition-opacity duration-500"
        style={{
          background: useTransform(
            mouseX,
            [-0.5, 0.5],
            [
              "linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.1) 100%)",
              "linear-gradient(to right, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)"
            ]
          ),
          zIndex: 10
        }}
      />
    </motion.div>
  );
};
