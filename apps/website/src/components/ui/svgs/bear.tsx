'use client';
import React, { useEffect, useRef, useState } from 'react';

export function BearLogo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftEyeRef = useRef<HTMLDivElement>(null);
  const rightEyeRef = useRef<HTMLDivElement>(null);
  const leftPupilRef = useRef<HTMLDivElement>(null);
  const rightPupilRef = useRef<HTMLDivElement>(null);
  const [isBlinking, setIsBlinking] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const updateEye = (eye: HTMLDivElement | null, pupil: HTMLDivElement | null) => {
        if (!eye || !pupil) return;
        const eyeRect = eye.getBoundingClientRect();
        const radius = eyeRect.width / 3;
        
        const eyeCenterX = eyeRect.left + eyeRect.width / 2;
        const eyeCenterY = eyeRect.top + eyeRect.height / 2;
        
        const dx = e.clientX - eyeCenterX;
        const dy = e.clientY - eyeCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > radius) {
          const angle = Math.atan2(dy, dx);
          pupil.style.top = `calc(50% + ${radius * Math.sin(angle)}px)`;
          pupil.style.left = `calc(50% + ${radius * Math.cos(angle)}px)`;
        } else {
          pupil.style.top = `calc(50% + ${dy}px)`;
          pupil.style.left = `calc(50% + ${dx}px)`;
        }
      };

      updateEye(leftEyeRef.current, leftPupilRef.current);
      updateEye(rightEyeRef.current, rightPupilRef.current);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

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

  return (
    <div ref={containerRef} className="bear-container" aria-live="polite">
      <style>{`
        .bear-container {
          position: relative;
          margin: auto;
          width: 100px;
        }
        .bear-container > svg {
          width: 100%;
          height: auto;
          display: block;
        }
        .bear-eye {
          width: 12%;
          padding-top: 12%;
          box-sizing: border-box;
          background-color: white;
          border-radius: 100%;
          overflow: hidden;
          position: absolute;
          margin-top: 20%;
          z-index: 10;
        }
        .bear-eye.left {
          left: 19%;
        }
        .bear-eye.right {
          right: 19%;
        }
        .bear-eye.blink {
          animation: bear-blink 0.2s ease-in-out;
        }
        .bear-pupil {
          width: 38.8%;
          height: 38.8%;
          box-sizing: border-box;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          background-color: #0d5c7c;
        }
        .bear-nose-t {
          animation: bear-scratch 10s ease infinite;
        }
        @keyframes bear-blink {
          0% { transform: scaleY(1); }
          50% { transform: scaleY(0); }
          100% { transform: scaleY(1); }
        }
        @keyframes bear-scratch {
          0% { transform: translateY(0); }
          96% { transform: translateY(0); }
          98% { transform: translateY(-5%); }
          100% { transform: translateY(0); }
        }
      `}</style>
      <div ref={leftEyeRef} className={`bear-eye left ${isBlinking ? 'blink' : ''}`}>
        <div ref={leftPupilRef} className="bear-pupil" />
      </div>
      <div ref={rightEyeRef} className={`bear-eye right ${isBlinking ? 'blink' : ''}`}>
        <div ref={rightPupilRef} className="bear-pupil" />
      </div>
      <svg width="148px" height="139px" viewBox="0 0 148 139" version="1.1" xmlns="http://www.w3.org/2000/svg">
        <g fillRule="nonzero">
          <path d="M147.2,57.8 C141.8,53.1 137.9,47.8 135.3,41.3 C140.8,37 140.8,37 142.8,30.2 C143.2,28.9 143.7,27.4 143.6,26.1 C142.7,18.6 140.1,12.4 132.9,9.6 C131.5,9 130.2,8.1 128.7,7.7 C127.4,7.3 126,7.1 124.7,7.3 C119.3,8.1 114.4,10.5 109.8,13.5 C109.1,13.9 108,14 107.3,13.7 C104.3,12.6 101.4,11.3 98.5,10 C97.8,9.7 97.1,9.4 96.4,9.2 C97,9.1 97.6,8.9 98.3,8.8 C91.3,4.6 83.9,3.5 75.8,4.7 C77.4,4 79,3.4 81,2.6 C71,-0.5 61.8,1.6 52.8,6.6 C53.8,4.5 54.9,2.4 56,0.1 C48.5,3.2 42.8,7.9 38.4,13.8 C38,13.7 37.6,13.6 37.3,13.5 C34.7,12.2 32.2,10.5 29.5,9.3 C24.4,7.1 19.5,6.3 14.1,9.4 C8.9,12.4 5.2,16.2 4.1,22.5 C3.8,24.1 3.2,25.8 3.5,27.3 C4.6,32.7 5.9,38.3 11.2,41 C11.4,41.1 11.5,41.2 12,41.5 C10.1,44.6 8.5,47.6 6.6,50.4 C4.7,53.2 2.6,55.8 0.8,58.2 C2.1,58.4 4.5,58.9 6.5,59.2 C4.9,63.5 3.1,68 1.8,72.6 C0.5,77.3 0.4,82.2 1.2,87.3 C2.8,85 4.2,83 5.6,80.9 C5.9,86.4 6.3,91.5 8.1,96.5 C9.9,101.4 12.7,105.5 16.6,109.3 C16.3,107 16.1,105.2 15.8,103.3 C18.8,111.6 23.8,117.8 31.4,122.1 C30.8,120.1 30.3,118.5 29.8,116.9 C33.3,122 37.9,125.4 43,128.5 C42.6,127 42.3,125.7 41.9,124.4 C45.2,128.2 49.2,131 54,133.1 C53.3,131.9 52.9,130.5 52.4,129.3 C56.1,132.5 60.3,134.7 65.2,136.2 C64.1,134.6 63.3,132.8 62.5,131.4 C62.5,131.4 62.5,131.4 62.5,131.4 L62.5,131.4 C62.5,131.4 62.5,131.4 62.5,131.4 C62.9,131.4 63.2,131.5 63.6,131.5 C67.5,132.3 73.4,136.7 72.4,138.2 L74.4,136.7 L74.4,136.7 C77,134.7 81,132 83.5,131.4 C83.7,131.4 84,131.3 84.2,131.3 L84.2,131.3 C83.4,132.7 82.6,134.5 81.5,136.1 C86.4,134.6 90.6,132.4 94.3,129.2 C93.9,130.4 93.4,131.7 92.7,133 C97.5,130.9 101.4,128.1 104.7,124.4 C104.3,125.8 104,127 103.6,128.5 C108.8,125.3 113.4,121.9 116.9,116.8 C116.4,118.4 115.9,120.1 115.4,122.1 C123,117.8 127.9,111.5 131,103.3 C130.8,105.2 130.5,107 130.2,109.2 C138.3,101.5 141.2,91.9 141.2,80.9 C142.6,83 144,85 145.6,87.3 C146.9,76.9 144.6,67.6 139.7,59.1 C142.4,58.7 144.8,58.3 147.2,57.8 Z" fill="#51431D"></path>
          <ellipse fill="#BF914C" cx="73.4" cy="61.6" rx="28.6" ry="26.8"></ellipse>
          <path d="M84.8,48.6 C84.7,48.5 84.4,48.5 84.1,48.4 C84.1,48.4 84.1,48.4 84.1,48.4 L84.1,48.4 C84,48.4 83.9,48.4 83.8,48.3 C82,47.9 78.1,47.6 73.4,47.6 C68.3,47.6 64.6,47.9 62.8,48.3 C60.6,48.8 58.9,50.8 58.9,53.2 C58.9,56 61.1,58.2 63.9,58.2 L65.3,58.2 C66.1,58.2 66.9,58.6 67.4,59.1 C67.9,59.6 68.3,60.4 68.3,61.2 L68.3,69.6 C68.3,72.4 70.5,74.6 73.3,74.6 C76.1,74.6 78.3,72.4 78.3,69.6 L78.3,61 C78.4,60.3 78.7,59.6 79.2,59.1 C79.7,58.6 80.5,58.2 81.3,58.2 L82.8,58.2 C85.6,58.2 87.8,56 87.8,53.2 C87.9,51.1 86.6,49.4 84.8,48.6 Z" className="bear-nose-t" fill="#3A3016"></path>
          <path d="M132.2,19 C128.5,15.5 122.4,16 118.4,19.8 C120.6,21.2 122.8,22.9 124.9,24.9 C127.8,27.6 130.2,30.5 132,33.3 C136,28.9 136.1,22.5 132.2,19 Z" fill="#3A3016"></path>
          <path d="M14.5,20.5 C11.3,24.5 12.2,30.5 16.4,34.2 C17.6,31.9 19.2,29.6 21,27.4 C23.5,24.3 26.1,21.7 28.8,19.7 C24.1,16 17.7,16.4 14.5,20.5 Z" fill="#3A3016"></path>
          <path d="M74,118.5 C45.6,118.5 20.7,106.1 6.1,87.2 C6.5,90.4 7,93.5 8.1,96.5 C9.9,101.4 12.7,105.5 16.6,109.3 C16.3,107 16.1,105.2 15.8,103.3 C18.8,111.6 23.8,117.8 31.4,122.1 C30.8,120.1 30.3,118.5 29.8,116.9 C33.3,122 37.9,125.4 43,128.5 C42.6,127 42.3,125.7 41.9,124.4 C45.2,128.2 49.2,131 54,133.1 C53.3,131.9 52.9,130.5 52.4,129.3 C56.1,132.5 60.3,134.7 65.2,136.2 C64.1,134.6 63.3,132.8 62.5,131.4 C62.5,131.4 62.5,131.4 62.5,131.4 L62.5,131.4 C62.5,131.4 62.5,131.4 62.5,131.4 C62.9,131.4 63.2,131.5 63.6,131.5 C67.5,132.3 73.4,136.7 72.4,138.2 L74.4,136.7 L74.4,136.7 C77,134.7 81,132 83.5,131.4 C83.7,131.4 84,131.3 84.2,131.3 L84.2,131.3 C83.4,132.7 82.6,134.5 81.5,136.1 C86.4,134.6 90.6,132.4 94.3,129.2 C93.9,130.4 93.4,131.7 92.7,133 C97.5,130.9 101.4,128.1 104.7,124.4 C104.3,125.8 104,127 103.6,128.5 C108.8,125.3 113.4,121.9 116.9,116.8 C116.4,118.4 115.9,120.1 115.4,122.1 C123,117.8 127.9,111.5 131,103.3 C130.8,105.2 130.5,107 130.2,109.2 C136.4,103.3 139.5,96.4 140.7,88.5 C126.1,106.7 101.7,118.5 74,118.5 Z" fill="#3A3016"></path>
        </g>
      </svg>
    </div>
  );
}
