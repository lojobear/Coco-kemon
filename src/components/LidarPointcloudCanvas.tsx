import React, { useEffect, useRef } from 'react';

interface LidarPointcloudCanvasProps {
  itemA: string;
  itemB: string;
  progress: number; // 0 to 100
  emergingEmoji?: string;
  width?: number;
  height?: number;
  isDarkMode?: boolean;
}

interface Point3D {
  // Dispersed turbulent initial position
  ix: number;
  iy: number;
  iz: number;
  // Target materialized 3D topology
  tx: number;
  ty: number;
  tz: number;
  // Current position
  x: number;
  y: number;
  z: number;
  // LiDAR properties
  elevationNorm: number; // 0 to 1 for false color
  baseRadius: number;
  jitterPhase: number;
  laserPing: number; // 0 to 1 glow decay
}

// Simple deterministic string hash
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Classic LiDAR False-Color Gradient (Blue -> Cyan -> Green -> Yellow -> Red)
function getLidarColor(val: number, alpha: number, ping: number): string {
  const clamped = Math.max(0, Math.min(1, val));
  let r = 0;
  let g = 0;
  let b = 0;

  if (clamped < 0.25) {
    // Deep Blue to Cyan
    const t = clamped / 0.25;
    r = Math.round(10 + 10 * t);
    g = Math.round(130 + 100 * t);
    b = Math.round(230 + 25 * t);
  } else if (clamped < 0.5) {
    // Cyan to Emerald
    const t = (clamped - 0.25) / 0.25;
    r = Math.round(20 + 10 * t);
    g = Math.round(230 + 20 * t);
    b = Math.round(255 * (1 - t) + 120 * t);
  } else if (clamped < 0.75) {
    // Emerald to Neon Amber / Yellow
    const t = (clamped - 0.5) / 0.25;
    r = Math.round(30 + 220 * t);
    g = Math.round(250 * (1 - t * 0.2) + 210 * t);
    b = Math.round(120 * (1 - t));
  } else {
    // Yellow to Laser Red / Hot Coral
    const t = (clamped - 0.75) / 0.25;
    r = Math.round(250 + 5 * t);
    g = Math.round(210 * (1 - t) + 50 * t);
    b = Math.round(30 + 70 * t);
  }

  // If laser pinged, push towards bright white-cyan
  if (ping > 0.05) {
    r = Math.round(r * (1 - ping) + 255 * ping);
    g = Math.round(g * (1 - ping) + 255 * ping);
    b = Math.round(b * (1 - ping) + 255 * ping);
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

export function LidarPointcloudCanvas({
  itemA,
  itemB,
  progress,
  emergingEmoji,
  width = 280,
  height = 280,
  isDarkMode = true,
}: LidarPointcloudCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotXRef = useRef<number>(0.2);
  const rotYRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointsRef = useRef<Point3D[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);

  // Generate deterministic 3D topology based on combining elements
  useEffect(() => {
    const combinedKey = `${itemA}+${itemB}`;
    const seed = hashString(combinedKey);
    const archetype = seed % 4; // 0: Geoid/Icosahedron, 1: Torus Knot, 2: Crystal Lattice, 3: Orbital Helix

    const TOTAL_POINTS = 1450;
    const pts: Point3D[] = [];

    for (let i = 0; i < TOTAL_POINTS; i++) {
      // 1. Initial turbulent dispersed position (radius 80 - 160)
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const initR = 75 + Math.random() * 85;

      const ix = initR * Math.sin(phi) * Math.cos(theta);
      const iy = initR * Math.sin(phi) * Math.sin(theta);
      const iz = initR * Math.cos(phi);

      // 2. Target 3D materialized topology
      let tx = 0;
      let ty = 0;
      let tz = 0;
      let elevNorm = 0.5;

      const tIdx = i / TOTAL_POINTS;

      if (archetype === 0) {
        // Faceted Geoid / Pulsing Harmonic Sphere
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        const yCoord = 1 - (i / (TOTAL_POINTS - 1)) * 2;
        const radiusAtY = Math.sqrt(1 - yCoord * yCoord);
        const thetaSp = goldenAngle * i;

        // Spherical harmonic undulation
        const harmonic =
          Math.sin(thetaSp * 4) * Math.cos(yCoord * 5) * 12 +
          Math.sin(thetaSp * 2) * 8;
        const R = 54 + harmonic;

        tx = Math.cos(thetaSp) * radiusAtY * R;
        ty = yCoord * R;
        tz = Math.sin(thetaSp) * radiusAtY * R;
        elevNorm = (yCoord + 1) / 2;
      } else if (archetype === 1) {
        // Quantum Torus Knot / Particle Ring Vortex
        const p = 2;
        const q = 3;
        const t = tIdx * Math.PI * 2 * 3; // wrap multiple times
        const rTorus = 48 + 14 * Math.cos(q * t);
        const tubeJitter = (Math.random() - 0.5) * 10;

        tx = (rTorus + tubeJitter) * Math.cos(p * t);
        ty = 22 * Math.sin(q * t) + tubeJitter;
        tz = (rTorus + tubeJitter) * Math.sin(p * t);
        elevNorm = (ty + 35) / 70;
      } else if (archetype === 2) {
        // Crystalline Octahedron / Polyhedral Matrix
        const uCoord = Math.random() * 2 - 1;
        const vCoord = Math.random() * 2 - 1;
        const wCoord = Math.random() * 2 - 1;
        // Project onto octahedron (|x| + |y| + |z| = 1)
        const sum = Math.abs(uCoord) + Math.abs(vCoord) + Math.abs(wCoord) || 1;
        const scale = 58 + (i % 5 === 0 ? 8 : 0);
        tx = (uCoord / sum) * scale;
        ty = (vCoord / sum) * scale;
        tz = (wCoord / sum) * scale;
        elevNorm = (ty + 60) / 120;
      } else {
        // Double-Helix Molecular Spire with Central Core
        const isCore = i < 300;
        if (isCore) {
          const coreR = Math.random() * 24;
          const coreTheta = Math.random() * Math.PI * 2;
          const corePhi = Math.random() * Math.PI;
          tx = coreR * Math.sin(corePhi) * Math.cos(coreTheta);
          ty = coreR * Math.sin(corePhi) * Math.sin(coreTheta);
          tz = coreR * Math.cos(corePhi);
          elevNorm = 0.5;
        } else {
          const strand = i % 2 === 0 ? 0 : Math.PI;
          const heightNorm = (i - 300) / (TOTAL_POINTS - 300); // 0 to 1
          const yH = (heightNorm - 0.5) * 110;
          const helixTheta = heightNorm * Math.PI * 6 + strand;
          const helixR = 46 + (Math.random() - 0.5) * 6;
          tx = Math.cos(helixTheta) * helixR;
          ty = yH;
          tz = Math.sin(helixTheta) * helixR;
          elevNorm = heightNorm;
        }
      }

      pts.push({
        ix,
        iy,
        iz,
        tx,
        ty,
        tz,
        x: ix,
        y: iy,
        z: iz,
        elevationNorm: Math.max(0, Math.min(1, elevNorm)),
        baseRadius: Math.hypot(tx, ty, tz),
        jitterPhase: Math.random() * Math.PI * 2,
        laserPing: 0,
      });
    }

    pointsRef.current = pts;
  }, [itemA, itemB]);

  // Main 3D Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI displays
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    let isMounted = true;

    const render = () => {
      if (!isMounted) return;
      timeRef.current += 0.02;
      const t = timeRef.current;

      // Auto rotation when not dragging
      if (!isDraggingRef.current) {
        rotYRef.current += 0.012;
        rotXRef.current = 0.22 + Math.sin(t * 0.6) * 0.08;
      }

      const rotX = rotXRef.current;
      const rotY = rotYRef.current;

      // LiDAR radar sweep beam angle
      const sweepAngle = (t * 2.8) % (Math.PI * 2);
      // Sweeping horizontal laser slice (moves up and down)
      const laserY = Math.sin(t * 2.2) * 45;

      // Normalized synthesis progress factor (0 to 1) with smooth cubic easing
      const normProgress = Math.max(0, Math.min(1, progress / 100));
      // Ease in-out
      const easeP =
        normProgress < 0.5
          ? 4 * normProgress * normProgress * normProgress
          : 1 - Math.pow(-2 * normProgress + 2, 3) / 2;

      // Clear with dark tactical LiDAR scope background
      ctx.clearRect(0, 0, width, height);

      // Radar Scope Background
      ctx.fillStyle = isDarkMode ? '#0a0d14' : '#080c14';
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      // --- PASS 1: Tactical HUD & Rangefinder Reticle ---
      ctx.save();
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.18)'; // subtle cyan grid
      ctx.lineWidth = 1;

      // Concentric range rings
      const rings = [36, 72, 108];
      rings.forEach((r, idx) => {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();

        // Distance text
        ctx.fillStyle = 'rgba(6, 182, 212, 0.4)';
        ctx.font = '8px monospace';
        ctx.fillText(`${(idx + 1) * 10}m`, centerX + r - 16, centerY - 3);
      });

      // Axis crosshairs
      ctx.beginPath();
      ctx.moveTo(centerX - 115, centerY);
      ctx.lineTo(centerX + 115, centerY);
      ctx.moveTo(centerX, centerY - 115);
      ctx.lineTo(centerX, centerY + 115);
      ctx.stroke();

      // Rotating Radar Sector Beam (LiDAR Scanning Fan)
      const sweepGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        115
      );
      sweepGrad.addColorStop(0, 'rgba(6, 182, 212, 0.25)');
      sweepGrad.addColorStop(0.8, 'rgba(16, 185, 129, 0.15)');
      sweepGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, 115, sweepAngle - 0.35, sweepAngle);
      ctx.closePath();
      ctx.fillStyle = sweepGrad;
      ctx.fill();

      // Sweeping beam leading edge line
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(sweepAngle) * 115,
        centerY + Math.sin(sweepAngle) * 115
      );
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();

      // --- PASS 2: 3D Point Cloud Transformation & Projection ---
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      const fov = 260; // Field of view perspective
      const points = pointsRef.current;

      interface ProjectedPoint {
        sx: number;
        sy: number;
        sz: number;
        size: number;
        color: string;
        alpha: number;
        ping: number;
      }

      const projected: ProjectedPoint[] = [];

      for (let i = 0; i < points.length; i++) {
        const pt = points[i];

        // Atmospheric turbulence jitter that dampens as progress finishes
        const jitterAmt = (1 - easeP) * 16;
        const jx = Math.sin(t * 3 + pt.jitterPhase) * jitterAmt;
        const jy = Math.cos(t * 3 + pt.jitterPhase) * jitterAmt;
        const jz = Math.sin(t * 2 + pt.jitterPhase * 1.5) * jitterAmt;

        // Interpolate between dispersed initial coords and coherent target coords
        const curX = pt.ix * (1 - easeP) + pt.tx * easeP + jx;
        const curY = pt.iy * (1 - easeP) + pt.ty * easeP + jy;
        const curZ = pt.iz * (1 - easeP) + pt.tz * easeP + jz;

        // 3D Rotation: Yaw around Y axis
        const x1 = curX * cosY - curZ * sinY;
        const z1 = curZ * cosY + curX * sinY;

        // Pitch around X axis
        const y2 = curY * cosX - z1 * sinX;
        const z2 = z1 * cosX + curY * sinX;
        const x2 = x1;

        // Check proximity to horizontal laser scanning slice
        const distToLaser = Math.abs(y2 - laserY);
        if (distToLaser < 8) {
          pt.laserPing = 1.0;
        } else {
          pt.laserPing *= 0.88; // decay
        }

        // Perspective projection
        const depth = z2 + 200; // camera offset
        if (depth > 10) {
          const scale = fov / depth;
          const sx = centerX + x2 * scale;
          const sy = centerY + y2 * scale;

          // Depth fog & size attenuation
          const depthNorm = Math.max(0.2, Math.min(1.4, scale));
          const ptSize = (1.1 + pt.laserPing * 1.8) * depthNorm;
          const baseAlpha = Math.max(0.25, Math.min(0.95, 0.45 * depthNorm + 0.3));

          // Color based on elevation + laser intensity
          const col = getLidarColor(pt.elevationNorm, baseAlpha, pt.laserPing);

          projected.push({
            sx,
            sy,
            sz: z2,
            size: ptSize,
            color: col,
            alpha: baseAlpha,
            ping: pt.laserPing,
          });
        }
      }

      // Sort by depth (Z-order) for proper depth blending
      projected.sort((a, b) => b.sz - a.sz);

      // --- PASS 3: Render Glowing LiDAR Points ---
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];

        // Draw primary point
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, Math.max(0.6, p.size), 0, Math.PI * 2);
        ctx.fill();

        // Specular glow halo on laser-pinged points
        if (p.ping > 0.3) {
          ctx.fillStyle = `rgba(255, 255, 255, ${(p.ping * 0.7).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, p.size * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // --- PASS 4: Horizontal Laser Scan Slice Plane Visualization ---
      ctx.save();
      const laserScreenY = centerY + laserY * 1.1;
      const laserGrad = ctx.createLinearGradient(
        centerX - 95,
        laserScreenY,
        centerX + 95,
        laserScreenY
      );
      laserGrad.addColorStop(0, 'rgba(34, 211, 238, 0)');
      laserGrad.addColorStop(0.3, 'rgba(34, 211, 238, 0.35)');
      laserGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.85)');
      laserGrad.addColorStop(0.7, 'rgba(34, 211, 238, 0.35)');
      laserGrad.addColorStop(1, 'rgba(34, 211, 238, 0)');

      ctx.strokeStyle = laserGrad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(centerX - 95, laserScreenY);
      ctx.lineTo(centerX + 95, laserScreenY);
      ctx.stroke();
      ctx.restore();

      // --- PASS 5: Emerging Core Hologram (when progress > 70%) ---
      if (normProgress > 0.65 && emergingEmoji) {
        const coreAlpha = Math.min(1, (normProgress - 0.65) / 0.3);
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Glowing backdrop ring
        const haloGrad = ctx.createRadialGradient(
          centerX,
          centerY,
          4,
          centerX,
          centerY,
          45
        );
        haloGrad.addColorStop(0, `rgba(16, 185, 129, ${0.45 * coreAlpha})`);
        haloGrad.addColorStop(0.7, `rgba(6, 182, 212, ${0.2 * coreAlpha})`);
        haloGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');

        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 45, 0, Math.PI * 2);
        ctx.fill();

        // Emerging emoji with pulse
        const emojiScale = 22 + Math.sin(t * 5) * 3;
        ctx.font = `${emojiScale}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
        ctx.globalAlpha = coreAlpha * 0.9;
        ctx.fillText(emergingEmoji, centerX, centerY);
        ctx.restore();
      }

      // --- PASS 6: Tactical LiDAR Telemetry & Frame HUD ---
      ctx.save();
      // Outer corner brackets
      const bLen = 14;
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
      ctx.lineWidth = 1.5;

      // Top-left
      ctx.beginPath();
      ctx.moveTo(10, 10 + bLen);
      ctx.lineTo(10, 10);
      ctx.lineTo(10 + bLen, 10);
      ctx.stroke();

      // Top-right
      ctx.beginPath();
      ctx.moveTo(width - 10 - bLen, 10);
      ctx.lineTo(width - 10, 10);
      ctx.lineTo(width - 10, 10 + bLen);
      ctx.stroke();

      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(10, height - 10 - bLen);
      ctx.lineTo(10, height - 10);
      ctx.lineTo(10 + bLen, height - 10);
      ctx.stroke();

      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(width - 10 - bLen, height - 10);
      ctx.lineTo(width - 10, height - 10);
      ctx.lineTo(width - 10, height - 10 - bLen);
      ctx.stroke();

      // Telemetry Text
      ctx.fillStyle = 'rgba(34, 211, 238, 0.75)';
      ctx.font = '8px monospace';
      ctx.fillText('LIDAR SCAN • 905nm', 16, 22);

      // Animated scan rate
      ctx.fillStyle = 'rgba(16, 185, 129, 0.85)';
      ctx.fillText(`PTS: ${points.length}`, 16, 32);

      // Coordinates
      const simX = (Math.sin(rotY) * 42).toFixed(1);
      const simY = (Math.cos(rotX) * 28).toFixed(1);
      ctx.fillStyle = 'rgba(161, 161, 170, 0.7)';
      ctx.fillText(`X:${simX} Y:${simY}`, width - 78, 22);

      // Elevation scale on the right
      ctx.fillStyle = 'rgba(6, 182, 212, 0.4)';
      ctx.fillRect(width - 18, 50, 4, height - 100);
      const elevY = 50 + (height - 100) * (1 - easeP);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(width - 20, elevY - 2, 8, 4);

      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isMounted = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [width, height, isDarkMode, progress, emergingEmoji]);

  // Mouse / Touch 3D Rotation Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    rotYRef.current += dx * 0.015;
    rotXRef.current = Math.max(-1.2, Math.min(1.2, rotXRef.current + dy * 0.015));
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <div className="relative flex flex-col items-center select-none group">
      {/* 3D LiDAR Point Cloud Viewport */}
      <div className="relative rounded-2xl overflow-hidden border border-cyan-500/40 shadow-[0_0_25px_rgba(6,182,212,0.25)] bg-[#0a0d14]">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ width: `${width}px`, height: `${height}px` }}
          className="cursor-grab active:cursor-grabbing block touch-none"
          title="Drag to rotate 3D point cloud in real time"
        />

        {/* Live scanning badge */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/50 text-[10px] font-mono text-cyan-300 font-semibold flex items-center gap-1.5 shadow-sm pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span>LIDAR 3D RESOLUTION</span>
        </div>

        {/* Rotational hint */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-mono text-cyan-400/60 uppercase tracking-wider pointer-events-none whitespace-nowrap">
          DRAG TO ROTATE 360°
        </div>
      </div>
    </div>
  );
}
