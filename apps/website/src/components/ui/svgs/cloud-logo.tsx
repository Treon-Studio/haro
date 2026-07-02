'use client';
import React, { useEffect, useRef, useState } from 'react';

export function CloudLogo({ className, style }: { className?: string; style?: React.CSSProperties } = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftEyeRef = useRef<SVGCircleElement>(null);
  const rightEyeRef = useRef<SVGCircleElement>(null);
  const leftPupilRef = useRef<SVGCircleElement>(null);
  const rightPupilRef = useRef<SVGCircleElement>(null);
  
  const [isBlinking, setIsBlinking] = useState(false);
  const [isTalking, setIsTalking] = useState(false);

  // Mouse move eye tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const updateEye = (eye: SVGCircleElement | null, pupil: SVGCircleElement | null) => {
        if (!eye || !pupil) return;
        const eyeRect = eye.getBoundingClientRect();
        
        const eyeCenterX = eyeRect.left + eyeRect.width / 2;
        const eyeCenterY = eyeRect.top + eyeRect.height / 2;
        
        const dx = e.clientX - eyeCenterX;
        const dy = e.clientY - eyeCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const maxMove = 4.5; // Max distance pupil can move in SVG units
        const move = Math.min(distance / 4, maxMove);
        
        if (distance > 0) {
          const angle = Math.atan2(dy, dx);
          const tx = move * Math.cos(angle);
          const ty = move * Math.sin(angle);
          pupil.style.transform = `translate(${tx}px, ${ty}px)`;
        } else {
          pupil.style.transform = 'translate(0px, 0px)';
        }
      };

      updateEye(leftEyeRef.current, leftPupilRef.current);
      updateEye(rightEyeRef.current, rightPupilRef.current);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Blinking effect interval
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const triggerBlink = () => {
      setIsBlinking(true);
      setTimeout(() => {
        setIsBlinking(false);
      }, 200);

      const nextDelay = Math.random() * 4000 + 4000;
      timeoutId = setTimeout(triggerBlink, nextDelay);
    };

    timeoutId = setTimeout(triggerBlink, Math.random() * 3000 + 1000);
    return () => clearTimeout(timeoutId);
  }, []);

  // Mouth gentle bobbing effect interval
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const triggerTalk = () => {
      setIsTalking(true);
      setTimeout(() => {
        setIsTalking(false);
      }, 2000); // Bob for 2s (exactly 2 smooth cycles)

      const nextDelay = Math.random() * 5000 + 4000; // Every 4-9s
      timeoutId = setTimeout(triggerTalk, nextDelay);
    };

    timeoutId = setTimeout(triggerTalk, Math.random() * 4000 + 2000);
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div ref={containerRef} className={`cloud-container ${className || ''}`} style={style} aria-live="polite">
      <style>{`
        .cloud-container {
          position: relative;
          margin: auto;
          width: 120px;
        }
        .cloud-spin-wrapper {
          width: 100%;
          height: auto;
          display: block;
          transform-origin: center center;
        }
        .cloud-spin-wrapper > svg {
          width: 100%;
          height: auto;
          display: block;
          filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.25));
        }
        .cloud-face {
          animation: face-float 4s ease-in-out infinite;
        }
        .cloud-eye.blink {
          animation: cloud-blink 0.2s ease-in-out;
        }
        .cloud-mouth-group {
          transition: transform 0.3s ease-in-out;
        }
        .cloud-mouth-group.moving {
          animation: mouth-bob 1s ease-in-out infinite;
        }
        @keyframes face-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(5px); }
        }
        @keyframes cloud-blink {
          0% { transform: scaleY(1); }
          50% { transform: scaleY(0); }
          100% { transform: scaleY(1); }
        }
        @keyframes mouth-bob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
        }
      `}</style>
      <div className="cloud-spin-wrapper">
        <svg viewBox="0 0 160 140" version="1.1" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="cloudGrad" x1="16" y1="15" x2="144" y2="128" gradientUnits="userSpaceOnUse">
              <animate attributeName="x1" dur="8s" repeatCount="indefinite" values="16; 40; 16" keyTimes="0; 0.5; 1" calcMode="spline" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" />
              <animate attributeName="y1" dur="10s" repeatCount="indefinite" values="15; -10; 15" keyTimes="0; 0.5; 1" calcMode="spline" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" />
              <animate attributeName="x2" dur="9s" repeatCount="indefinite" values="144; 120; 144" keyTimes="0; 0.5; 1" calcMode="spline" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" />
              <animate attributeName="y2" dur="12s" repeatCount="indefinite" values="128; 150; 128" keyTimes="0; 0.5; 1" calcMode="spline" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" />
              
              <stop offset="0%" stopColor="#e6f0fa">
                <animate attributeName="stop-color" values="#e6f0fa; #d0e4f7; #e6f0fa" dur="10s" repeatCount="indefinite" />
              </stop>
              <stop offset="40%" stopColor="#c5dcf5">
                <animate attributeName="offset" values="0.35; 0.48; 0.35" dur="8s" repeatCount="indefinite" />
                <animate attributeName="stop-color" values="#c5dcf5; #a4c9f2; #c5dcf5" dur="8s" repeatCount="indefinite" />
              </stop>
              <stop offset="75%" stopColor="#7ab0eb">
                <animate attributeName="offset" values="0.70; 0.82; 0.70" dur="11s" repeatCount="indefinite" />
                <animate attributeName="stop-color" values="#7ab0eb; #66a3e6; #7ab0eb" dur="11s" repeatCount="indefinite" />
              </stop>
              <stop offset="100%" stopColor="#9ec9f0">
                <animate attributeName="stop-color" values="#9ec9f0; #8abcf0; #9ec9f0" dur="9s" repeatCount="indefinite" />
              </stop>
            </linearGradient>
          </defs>

          {/* Fluffy Cloud Background with Pronounced, Distinct Outer Puffs */}
          <g fill="url(#cloudGrad)">
            <circle cx="80" cy="75" r="38" />
            <circle cx="80" cy="46" r="34" />
            <circle cx="45" cy="65" r="29" />
            <circle cx="115" cy="65" r="29" />
            <circle cx="38" cy="94" r="24" />
            <circle cx="122" cy="94" r="24" />
            <circle cx="65" cy="102" r="26" />
            <circle cx="95" cy="102" r="26" />
          </g>

          {/* Perfectly Symmetrical Animated Face */}
          <g className="cloud-face">
            {/* Left Eye */}
            <g className={`cloud-eye ${isBlinking ? 'blink' : ''}`} style={{ transformOrigin: '58px 66px' }}>
              <circle ref={leftEyeRef} cx="58" cy="66" r="11" fill="#ffffff" />
              <circle ref={leftPupilRef} cx="58" cy="66" r="5" fill="#0d5c7c" style={{ transition: 'transform 0.05s linear' }} />
            </g>

            {/* Right Eye */}
            <g className={`cloud-eye ${isBlinking ? 'blink' : ''}`} style={{ transformOrigin: '102px 66px' }}>
              <circle ref={rightEyeRef} cx="102" cy="66" r="11" fill="#ffffff" />
              <circle ref={rightPupilRef} cx="102" cy="66" r="5" fill="#0d5c7c" style={{ transition: 'transform 0.05s linear' }} />
            </g>

            {/* Symmetrical Simple Curved Smile (Lowered 4px, smoothly shifts up and down slightly) */}
            <g className={`cloud-mouth-group ${isTalking ? 'moving' : ''}`}>
              <path d="M 74 80 Q 80 89 86 80" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
