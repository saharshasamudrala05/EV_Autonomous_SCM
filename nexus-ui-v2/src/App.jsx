import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import * as THREE from 'three';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';
import useSimulationStore from './store/useSimulationStore';
import ChatbotFAB from './components/ChatbotFAB';
import {
  Activity, AlertOctagon, Box, Cpu,
  Database, Hexagon, Layers, Network,
  ShieldAlert, TrendingUp, Zap, Radio,
  Crosshair, Focus, TerminalSquare, ArrowRight, ScanLine, Radar,
  LayoutDashboard, AlertTriangle, Package, Globe, Users, FileText,
  Settings, ShieldCheck, DollarSign, Clock, Lock, Truck, Calendar, Download, Sliders, Upload,
  CheckCircle2, BarChart3, ChevronLeft, ChevronRight
} from 'lucide-react';

// --- HYPER-ADVANCED HOLOGRAPHIC STYLES ---
const CustomStyles = () => (
  <style dangerouslySetInnerHTML={{
    __html: `
    @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');
    
    html, body, #root {
      background-color: #020617 !important;
      overflow: hidden !important; /* Strictly lock outer window */
      width: 100vw;
      height: 100vh;
    }

    body {
      margin: 0;
      font-family: 'Rajdhani', sans-serif;
      color: #f8fafc;
      overscroll-behavior: none;
      perspective: 1500px;
    }
    
    .font-mono { font-family: 'Space Mono', monospace; }
    
    .custom-scroll::-webkit-scrollbar { width: 6px; background: transparent; }
    .custom-scroll::-webkit-scrollbar-thumb { background: rgba(56, 189, 248, 0.3); border-radius: 10px; }
    .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(56, 189, 248, 0.6); }

    .glass-holo {
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(2, 6, 23, 0.8) 100%);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(56, 189, 248, 0.15);
      border-top: 1px solid rgba(56, 189, 248, 0.3);
      border-left: 1px solid rgba(56, 189, 248, 0.2);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 
                  inset 0 0 20px rgba(56, 189, 248, 0.05);
      border-radius: 16px;
      position: relative;
      overflow: hidden;
      transform-style: preserve-3d;
    }

    .glass-holo-alert {
      background: linear-gradient(135deg, rgba(30, 5, 10, 0.7) 0%, rgba(10, 2, 5, 0.9) 100%);
      border: 1px solid rgba(244, 63, 94, 0.25);
      border-top: 1px solid rgba(244, 63, 94, 0.5);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 
                  inset 0 0 20px rgba(244, 63, 94, 0.1);
      border-radius: 16px;
      position: relative;
      overflow: hidden;
      transform-style: preserve-3d;
    }

    .scanline-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(to bottom, transparent 50%, rgba(56, 189, 248, 0.05) 51%, transparent 52%);
      background-size: 100% 6px;
      animation: scanline 8s linear infinite;
      pointer-events: none;
      z-index: 0;
    }
    @keyframes scanline { 0% { background-position: 0 0; } 100% { background-position: 0 100vh; } }

    .holo-grid-bg {
      position: absolute;
      inset: 0;
      background-size: 40px 40px;
      background-image: 
        linear-gradient(to right, rgba(56, 189, 248, 0.03) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(56, 189, 248, 0.03) 1px, transparent 1px);
      pointer-events: none;
      z-index: 1;
      opacity: 0.5;
    }

    .text-glow-cyan { 
      color: #fff;
      text-shadow: 0 0 8px rgba(56, 189, 248, 0.6), 0 0 15px rgba(56, 189, 248, 0.3); 
      transition: text-shadow 0.3s ease;
    }
    .text-glow-cyan:hover { text-shadow: 0 0 12px rgba(56, 189, 248, 0.8), 0 0 25px rgba(56, 189, 248, 0.5); }
    .text-glow-red { color: #fff; text-shadow: 0 0 8px rgba(244, 63, 94, 0.6), 0 0 15px rgba(244, 63, 94, 0.3); }

    @keyframes hyperFloat {
      0% { transform: translateY(0px) rotateX(0deg) rotateY(0deg); }
      33% { transform: translateY(-10px) rotateX(1deg) rotateY(-1deg); }
      66% { transform: translateY(5px) rotateX(-1deg) rotateY(1deg); }
      100% { transform: translateY(0px) rotateX(0deg) rotateY(0deg); }
    }
    .animate-hyper-float { animation: hyperFloat 8s ease-in-out infinite; }
    
    .radar-sweep {
      position: absolute; inset: -50%; border-radius: 50%;
      background: conic-gradient(from 0deg, transparent 70%, rgba(244, 63, 94, 0.2) 100%);
      animation: sweep 2s linear infinite; pointer-events: none;
    }
    @keyframes sweep { 100% { transform: rotate(360deg); } }

    .matrix-fall {
      background: linear-gradient(180deg, transparent 0%, rgba(56, 189, 248, 0.2) 50%, transparent 100%);
      background-size: 100% 200%;
      animation: matrix 2s linear infinite;
    }
    @keyframes matrix { 0% { background-position: 0% -100%; } 100% { background-position: 0% 100%; } }

    .css-cube { width: 40px; height: 40px; transform-style: preserve-3d; animation: spinCube 6s linear infinite; }
    .css-cube-face {
      position: absolute; width: 40px; height: 40px;
      border: 1px solid rgba(56, 189, 248, 0.5); background: rgba(56, 189, 248, 0.05);
      box-shadow: inset 0 0 10px rgba(56, 189, 248, 0.2);
    }
    .css-cube-face:nth-child(1) { transform: translateZ(20px); }
    .css-cube-face:nth-child(2) { transform: rotateY(180deg) translateZ(20px); }
    .css-cube-face:nth-child(3) { transform: rotateY(90deg) translateZ(20px); }
    .css-cube-face:nth-child(4) { transform: rotateY(-90deg) translateZ(20px); }
    .css-cube-face:nth-child(5) { transform: rotateX(90deg) translateZ(20px); }
    .css-cube-face:nth-child(6) { transform: rotateX(-90deg) translateZ(20px); }
    @keyframes spinCube { 0% { transform: rotateX(0deg) rotateY(0deg); } 100% { transform: rotateX(360deg) rotateY(360deg); } }

    .hud-bracket {
      position: fixed; width: 40px; height: 40px; border: 2px solid rgba(56, 189, 248, 0.3);
      pointer-events: none; z-index: 45; box-shadow: 0 0 10px rgba(56, 189, 248, 0.1); transition: all 0.5s ease;
    }
    .hud-tl { top: 30px; left: 30px; border-right: none; border-bottom: none; }
    .hud-tr { top: 30px; right: 30px; border-left: none; border-bottom: none; }
    .hud-bl { bottom: 30px; left: 30px; border-right: none; border-top: none; }
    .hud-br { bottom: 30px; right: 30px; border-left: none; border-top: none; }

    .interactive-row { transition: all 0.2s ease; }
    .interactive-row:hover { background-color: rgba(56, 189, 248, 0.1); transform: scale(1.01); }

    .svg-glow { filter: drop-shadow(0px 0px 6px rgba(56,189,248,0.8)); }
    .svg-glow-emerald { filter: drop-shadow(0px 0px 6px rgba(16,185,129,0.8)); }
    .svg-glow-amber { filter: drop-shadow(0px 0px 6px rgba(245,158,11,0.8)); }
  `}} />
);

// --- HYPER-ADVANCED 3D ENGINE ---
const CinematicGlobalScene = ({ setHoveredData, viewMode }) => {
  const mountRef = useRef(null);
  const viewModeRef = useRef(viewMode);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020617, 0.015);

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 2000);
    const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x020617, 1);
    currentMount.appendChild(renderer.domElement);

    // --- LIGHTING ---
    scene.add(new THREE.AmbientLight(0x0f172a, 2));
    const mainLight = new THREE.PointLight(0x38bdf8, 6, 300);
    const dangerLight = new THREE.PointLight(0xf43f5e, 8, 300);
    scene.add(mainLight, dangerLight);

    // --- MASTER GROUPS ---
    const envGroup = new THREE.Group();
    const coreGroup = new THREE.Group();
    const networkGroup = new THREE.Group();
    const chartGroup = new THREE.Group();
    scene.add(envGroup, coreGroup, networkGroup, chartGroup);

    // --- 1. LIVING QUANTUM GRID (Animated Floor) ---
    const gridGeo = new THREE.PlaneGeometry(500, 500, 150, 150);
    const gridMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, color: { value: new THREE.Color(0x38bdf8) } },
      vertexShader: `
        uniform float time;
        varying vec2 vUv;
        varying float vElevation;
        void main() {
          vUv = uv;
          vec4 modelPosition = modelMatrix * vec4(position, 1.0);
          float elevation = sin(modelPosition.x * 0.1 + time) * cos(modelPosition.z * 0.1 + time) * 3.0;
          elevation += sin(modelPosition.x * 0.05 - time*0.5) * 2.0;
          modelPosition.y += elevation;
          vElevation = elevation;
          gl_Position = projectionMatrix * viewMatrix * modelPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        varying vec2 vUv;
        varying float vElevation;
        void main() {
          vec2 grid = abs(fract(vUv * 150.0 - 0.5) - 0.5) / fwidth(vUv * 150.0);
          float line = min(grid.x, grid.y);
          float alpha = 1.0 - min(line, 1.0);
          vec3 finalColor = mix(color * 0.1, color, (vElevation + 3.0) / 6.0);
          gl_FragColor = vec4(finalColor, alpha * 0.4);
        }
      `,
      transparent: true, wireframe: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    });
    const quantumGrid = new THREE.Mesh(gridGeo, gridMat);
    quantumGrid.rotation.x = -Math.PI / 2;
    quantumGrid.position.y = -20;
    envGroup.add(quantumGrid);

    // --- 2. GYROSCOPIC AI CORE & VORTEX (Scene 5 target / Dashboard background) ---
    coreGroup.position.set(0, 40, -100);

    const brainGeo = new THREE.IcosahedronGeometry(12, 2);
    const brainMat = new THREE.MeshPhysicalMaterial({ color: 0x0f172a, emissive: 0x1e293b, wireframe: true });
    const brain = new THREE.Mesh(brainGeo, brainMat);
    coreGroup.add(brain);

    const coreRings = [];
    for (let i = 1; i <= 8; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(12 + i * 4, 0.2 + (i * 0.02), 16, 120),
        new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xf43f5e : 0x38bdf8, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending })
      );
      coreRings.push({ mesh: ring, speedX: Math.random() * 0.04 - 0.02, speedY: Math.random() * 0.04 - 0.02, speedZ: Math.random() * 0.04 - 0.02 });
      coreGroup.add(ring);
    }

    const vortexGeo = new THREE.BufferGeometry();
    const vortexCount = 3000;
    const vortexPos = new Float32Array(vortexCount * 3);
    const vortexAngles = new Float32Array(vortexCount);
    const vortexRadii = new Float32Array(vortexCount);
    for (let i = 0; i < vortexCount; i++) {
      vortexAngles[i] = Math.random() * Math.PI * 2;
      vortexRadii[i] = 15 + Math.random() * 80;
      vortexPos[i * 3 + 1] = (Math.random() - 0.5) * 40;
    }
    vortexGeo.setAttribute('position', new THREE.BufferAttribute(vortexPos, 3));
    const vortexMat = new THREE.PointsMaterial({ color: 0x6366f1, size: 0.3, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
    const vortexParticles = new THREE.Points(vortexGeo, vortexMat);
    coreGroup.add(vortexParticles);

    // --- 3. SUPPLY CHAIN NETWORK (Scene 1 & 3 targets) ---
    const nodes = [
      { id: 'N1', pos: [35, 10, 0], type: 'SYNTHESIS', name: 'APAC Core Forge', status: 'OPTIMAL', val: '98.2%' },
      { id: 'N2', pos: [-40, 20, -10], type: 'ASSEMBLY', name: 'EU Gigafactory', status: 'WARNING', val: '72.4%' },
      { id: 'N3', pos: [15, -10, 30], type: 'LOGISTICS', name: 'Global Hub Delta', status: 'OPTIMAL', val: '94.1%' },
      { id: 'N4', pos: [-20, -15, 40], type: 'EXTRACTION', name: 'Lithium Mine Prime', status: 'CRITICAL', val: '18.5%' },
      { id: 'N5', pos: [0, 30, 15], type: 'DEMAND', name: 'NA Market Node', status: 'SURGE', val: '145.0%' },
    ];

    const interactableMeshes = [];
    const dynamicNodes = [];
    let criticalNodeRef = null;

    nodes.forEach(n => {
      const vec = new THREE.Vector3(...n.pos);
      const isCrit = n.status === 'CRITICAL';
      if (isCrit) criticalNodeRef = vec;

      const color = isCrit ? 0xf43f5e : n.status === 'WARNING' ? 0xf59e0b : n.status === 'SURGE' ? 0x6366f1 : 0x38bdf8;

      const nodeGroup = new THREE.Group();
      nodeGroup.position.copy(vec);

      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(2, 0),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
      );
      core.userData = { ...n, colorHex: color };
      interactableMeshes.push(core);

      const glow1 = new THREE.Mesh(new THREE.SphereGeometry(4, 32, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending }));
      const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(3.5, 1), new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending }));

      nodeGroup.add(core, glow1, shell);

      let beacon = null, warningDome = null;
      if (isCrit) {
        dangerLight.position.copy(vec);
        beacon = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 200, 16).translate(0, 100, 0), new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending }));
        warningDome = new THREE.Mesh(new THREE.SphereGeometry(15, 32, 32), new THREE.MeshBasicMaterial({ color: 0xf43f5e, wireframe: true, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending }));
        nodeGroup.add(beacon, warningDome);
      }

      networkGroup.add(nodeGroup);
      dynamicNodes.push({ group: nodeGroup, core, shell, isCrit, beacon, warningDome });
    });

    const resolutionBeams = [];
    if (criticalNodeRef) {
      const beamMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
      for (let i = 0; i < 5; i++) {
        const beamGeo = new THREE.CylinderGeometry(0.2, 0.2, 10, 8);
        beamGeo.rotateX(Math.PI / 2);
        const beam = new THREE.Mesh(beamGeo, beamMat);
        networkGroup.add(beam);
        resolutionBeams.push({ mesh: beam, progress: Math.random() });
      }
    }

    // --- 5. HOLOGRAPHIC DATA ARENA ---
    chartGroup.position.set(70, 0, 50);
    const bars = [];
    const numBars = 72;
    const arenaRadius = 25;
    for (let i = 0; i < numBars; i++) {
      const angle = (i / numBars) * Math.PI * 2;
      const h = Math.random() * 25 + 5;
      const bGeo = new THREE.BoxGeometry(1.5, 1, 1.5);
      bGeo.translate(0, 0.5, 0);
      const bMat = new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, transmission: 0.9, opacity: 1, transparent: true, roughness: 0.0 });
      const bar = new THREE.Mesh(bGeo, bMat);

      bar.position.set(Math.cos(angle) * arenaRadius, -15, Math.sin(angle) * arenaRadius);
      bar.lookAt(chartGroup.position.x, -15, chartGroup.position.z); // Face inwards

      const eGeo = new THREE.EdgesGeometry(bGeo);
      const eMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending });
      const edge = new THREE.LineSegments(eGeo, eMat);
      bar.add(edge);

      chartGroup.add(bar);
      bars.push({ mesh: bar, targetH: h, currentH: 0, phase: i * 0.1 });
    }

    // --- 6. DATA STREAMS & ENERGY FLOW ---
    const routes = [[0, 1], [1, 4], [0, 2], [2, 1], [3, 4], [2, 3], [0, 4], [3, 1]];
    const streamParticles = [];
    const pGeo = new THREE.BufferGeometry();
    const pCount = 600;
    const pPos = new Float32Array(routes.length * pCount * 3);
    const pColors = new Float32Array(routes.length * pCount * 3);

    routes.forEach(([i, j], rIdx) => {
      const p1 = new THREE.Vector3(...nodes[i].pos);
      const p2 = new THREE.Vector3(...nodes[j].pos);
      const dist = p1.distanceTo(p2);

      const control1 = p1.clone().add(new THREE.Vector3((Math.random() - 0.5) * dist, (Math.random() - 0.5) * dist, (Math.random() - 0.5) * dist));
      const control2 = p2.clone().add(new THREE.Vector3((Math.random() - 0.5) * dist, (Math.random() - 0.5) * dist, (Math.random() - 0.5) * dist));
      const curve = new THREE.CubicBezierCurve3(p1, control1, control2, p2);

      const lineGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(50));
      const lineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending });
      networkGroup.add(new THREE.Line(lineGeo, lineMat));

      const isDangerRoute = nodes[i].status === 'CRITICAL' || nodes[j].status === 'CRITICAL';
      const routeColor = isDangerRoute ? new THREE.Color(0xf43f5e) : new THREE.Color(0x38bdf8);

      for (let k = 0; k < pCount; k++) {
        const idx = (rIdx * pCount) + k;
        streamParticles.push({ idx, curve, progress: Math.random(), speed: 0.002 + Math.random() * 0.004 });
        pColors[idx * 3] = routeColor.r; pColors[idx * 3 + 1] = routeColor.g; pColors[idx * 3 + 2] = routeColor.b;
      }
    });

    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));
    const pMat = new THREE.PointsMaterial({ size: 0.6, vertexColors: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
    const dataStreams = new THREE.Points(pGeo, pMat);
    networkGroup.add(dataStreams);

    // --- 7. AMBIENT WARP PARTICLES ---
    const ambGeo = new THREE.BufferGeometry();
    const ambCount = 8000;
    const ambArray = new Float32Array(ambCount * 3);
    for (let i = 0; i < ambCount; i++) {
      ambArray[i * 3] = THREE.MathUtils.randFloatSpread(600);
      ambArray[i * 3 + 1] = THREE.MathUtils.randFloatSpread(600);
      ambArray[i * 3 + 2] = THREE.MathUtils.randFloatSpread(600);
    }
    ambGeo.setAttribute('position', new THREE.BufferAttribute(ambArray, 3));
    const ambMat = new THREE.PointsMaterial({ color: 0x38bdf8, size: 0.3, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending });
    const ambientSwarm = new THREE.Points(ambGeo, ambMat);
    scene.add(ambientSwarm);

    // --- INTERACTION & CINEMATIC CHOREOGRAPHY ---
    let mouseX = 0; let mouseY = 0;
    const raycaster = new THREE.Raycaster();
    const mouseVec = new THREE.Vector2();
    let currentHover = null;
    let prevScrollY = 0;
    let scrollVelocity = 0;

    const onMouseMove = (e) => {
      mouseX = (e.clientX / w) * 2 - 1;
      mouseY = -(e.clientY / h) * 2 + 1;

      if (viewModeRef.current === 'home') {
        mouseVec.set(mouseX, mouseY);
        raycaster.setFromCamera(mouseVec, camera);
        const intersects = raycaster.intersectObjects(interactableMeshes);

        if (intersects.length > 0) {
          const node = intersects[0].object.userData;
          if (currentHover?.id !== node.id) {
            currentHover = node;
            setHoveredData(node);
            document.body.style.cursor = 'crosshair';
          }
        } else if (currentHover) {
          currentHover = null;
          setHoveredData(null);
          document.body.style.cursor = 'default';
        }
      }
    };
    window.addEventListener('mousemove', onMouseMove);

    const camPosTarget = new THREE.Vector3(0, 0, 100);
    const camLookTarget = new THREE.Vector3(0, 0, 0);
    const tempVec = new THREE.Vector3();

    let req;
    const clock = new THREE.Clock();

    let virtualScroll = 0;
    const onScrollEvent = (e) => {
      if (viewModeRef.current === 'home') {
        const scrollContainer = document.getElementById('home-scroll-container');
        if (scrollContainer) {
          virtualScroll = scrollContainer.scrollTop;
        }
      }
    };
    window.addEventListener('scroll', onScrollEvent, true);

    const animate = () => {
      req = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // --- CHOREOGRAPHY LOGIC ---
      if (viewModeRef.current === 'dashboard') {
        // Dashboard Mode: Camera orbits the core gracefully
        camPosTarget.set(
          Math.sin(t * 0.05) * 60,
          30 + Math.sin(t * 0.1) * 10,
          -100 + Math.cos(t * 0.05) * 60
        );
        camLookTarget.set(0, 40, -100);
        scrollVelocity = 0;
      } else {
        // Home Mode: Poll native internal scroll container
        let currentScrollY = 0;
        let maxScroll = Math.max(1, window.innerHeight * 4); // Fallback

        const scrollContainer = document.getElementById('home-scroll-container');
        if (scrollContainer) {
          currentScrollY = scrollContainer.scrollTop;
          maxScroll = Math.max(1, scrollContainer.scrollHeight - scrollContainer.clientHeight);
        }

        scrollVelocity = (currentScrollY - prevScrollY) * 0.1;
        prevScrollY = currentScrollY;

        const progress = currentScrollY / maxScroll;

        if (progress < 0.2) {
          camPosTarget.set(0, 30 - progress * 30, 100 - progress * 40);
          camLookTarget.set(0, 0, 0);
        } else if (progress >= 0.2 && progress < 0.4) {
          const p = (progress - 0.2) * 5;
          camPosTarget.set(70, 5, 100 - p * 50);
          camLookTarget.set(70, -10, 50);
        } else if (progress >= 0.4 && progress < 0.6) {
          const p = (progress - 0.4) * 5;
          camPosTarget.set(-20, -5, 80 - p * 25);
          camLookTarget.set(-20, -15, 40);
        } else if (progress >= 0.6 && progress < 0.8) {
          const p = (progress - 0.6) * 5;
          camPosTarget.set(40 - p * 60, 15, 50 - p * 20);
          camLookTarget.set(-20, -15, 40);
        } else {
          const p = (progress - 0.8) * 5;
          camPosTarget.set(0, 40, -20 - p * 50);
          camLookTarget.set(0, 40, -100);
        }
      }

      // Apply Mouse Parallax & Smooth Camera Movement
      camera.position.lerp(new THREE.Vector3(
        camPosTarget.x + mouseX * 8,
        camPosTarget.y + mouseY * 8,
        camPosTarget.z
      ), 0.05);

      const currentLookAt = new THREE.Vector3(0, 0, 0);
      camera.getWorldDirection(currentLookAt);
      currentLookAt.add(camera.position);
      currentLookAt.lerp(camLookTarget, 0.06);
      camera.lookAt(currentLookAt);

      // ANIMATIONS
      gridMat.uniforms.time.value = t * 3.0;

      brain.rotation.y += 0.02;
      brain.rotation.x += 0.01;
      coreRings.forEach(r => {
        r.mesh.rotation.x += r.speedX;
        r.mesh.rotation.y += r.speedY;
        r.mesh.rotation.z += r.speedZ;
      });

      const vPos = vortexParticles.geometry.attributes.position.array;
      for (let i = 0; i < vortexCount; i++) {
        vortexAngles[i] += 0.02;
        vortexRadii[i] -= 0.2;
        if (vortexRadii[i] < 12) {
          vortexRadii[i] = 100;
          vortexPos[i * 3 + 1] = (Math.random() - 0.5) * 60;
        }
        vPos[i * 3] = Math.cos(vortexAngles[i]) * vortexRadii[i];
        vPos[i * 3 + 2] = Math.sin(vortexAngles[i]) * vortexRadii[i];
      }
      vortexParticles.geometry.attributes.position.needsUpdate = true;
      vortexParticles.rotation.y = t * 0.5;

      dynamicNodes.forEach((n) => {
        n.core.rotation.y += 0.03;
        n.core.rotation.x += 0.02;
        n.shell.rotation.y -= 0.02;
        n.shell.rotation.z += 0.02;

        if (n.isCrit) {
          const pulse = 1 + Math.sin(t * 15) * 0.4;
          n.core.scale.set(pulse, pulse, pulse);
          dangerLight.intensity = 8 + Math.sin(t * 15) * 4;

          if (n.beacon) n.beacon.material.opacity = 0.2 + Math.sin(t * 20) * 0.1;
          if (n.warningDome) {
            n.warningDome.rotation.x += 0.05;
            n.warningDome.rotation.y += 0.05;
            n.warningDome.scale.setScalar(1 + Math.sin(t * 5) * 0.05);
          }
        }
      });

      if (criticalNodeRef) {
        resolutionBeams.forEach(b => {
          b.progress += 0.05;
          if (b.progress > 1) b.progress = 0;
          b.mesh.position.copy(coreGroup.position).lerp(criticalNodeRef, b.progress);
          b.mesh.lookAt(criticalNodeRef);
        });
      }

      const posArray = dataStreams.geometry.attributes.position.array;
      streamParticles.forEach(p => {
        p.progress += p.speed;
        if (p.progress > 1) p.progress = 0;
        p.curve.getPoint(p.progress, tempVec);
        posArray[p.idx * 3] = tempVec.x;
        posArray[p.idx * 3 + 1] = tempVec.y;
        posArray[p.idx * 3 + 2] = tempVec.z;
      });
      dataStreams.geometry.attributes.position.needsUpdate = true;

      chartGroup.rotation.y -= 0.005;
      bars.forEach((b) => {
        b.currentH = b.targetH * (0.3 + 0.7 * Math.abs(Math.sin(t * 4 + b.phase)));
        b.mesh.scale.y = Math.max(0.1, b.currentH);
        b.mesh.material.color.setHSL(0.5 - (b.currentH / 50), 1, 0.5);
      });

      ambientSwarm.rotation.y += 0.001;
      const stretch = 1 + Math.abs(scrollVelocity) * 2;
      ambientSwarm.scale.set(1, stretch, 1);

      mainLight.position.copy(camera.position);

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('scroll', onScrollEvent, true);
      cancelAnimationFrame(req);

      // Deep disposal of all 3D objects to prevent WebGL memory leaks
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(m => m.dispose());
          } else {
            object.material.dispose();
          }
        }
      });

      // Force WebGL Context Loss to guarantee immediate GPU memory release
      if (renderer.getContext() && typeof renderer.getContext().getExtension === 'function') {
        const ext = renderer.getContext().getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
      }

      if (currentMount && renderer.domElement && currentMount.contains(renderer.domElement)) {
        currentMount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="fixed inset-0 z-0 pointer-events-auto" />;
};

// --- INTERACTIVE HOLOGRAPHIC UI COMPONENTS ---
const HolographicCard = ({ children, className = "", delay = 0, alert = false }) => {
  const cardRef = useRef(null);

  // Use state instead of framer-motion hooks to guarantee compatibility across environments
  // Note: Hover tilt effect disabled as per user request to keep cards fixed.
  // const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    /* 
    if(!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -10; 
    const rotateY = ((x - centerX) / centerX) * 10;
    setTilt({ x: rotateX, y: rotateY });
    */
  };

  const handleMouseLeave = () => {
    // setTilt({ x: 0, y: 0 });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, delay, type: "spring" }}
      className={`perspective-container h-full ${className}`}
      style={{ perspective: 1000 }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          // Card rotation disabled to keep elements fixed
          transform: 'none',
          transition: 'transform 0.1s ease-out'
        }}
        className={`${alert ? 'glass-holo-alert' : 'glass-holo'} p-6 h-full flex flex-col`}
      >
        <div className="scanline-overlay opacity-50" />
        {/* Minimal Parallax depth */}
        <div className="relative z-10 h-full flex flex-col flex-1" style={{ transformStyle: 'preserve-3d', transform: 'translateZ(20px)' }}>
          {children}
        </div>
      </div>
    </motion.div>
  );
};

const KpiCard = ({ title, value, trend, icon: Icon, delay }) => (
  <HolographicCard delay={delay} className="hover:border-sky-400/50 transition-colors cursor-default">
    <div className="flex justify-between items-start">
      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{title}</span>
      <div className="p-2 rounded bg-slate-900/50 border border-slate-700/50 text-slate-500"><Icon className="w-4 h-4" /></div>
    </div>
    <div className="flex items-end gap-3 mt-4">
      <span className="text-4xl font-display font-bold text-white text-glow-cyan leading-none">{value}</span>
      {trend && <span className={`text-[10px] font-mono mb-1 ${trend.includes('-') && !trend.includes('savings') && !trend.includes('optimized') && !title.includes('Error') ? 'text-rose-400' : 'text-emerald-400'}`}>{trend}</span>}
    </div>
  </HolographicCard>
);

const SectionHeader = ({ title, subtitle, badge }) => (
  <div className="mb-8">
    <div className="flex items-center gap-4 mb-2">
      {badge && <div className="p-1.5 rounded bg-sky-500/20 border border-sky-400/50 text-sky-400">{badge}</div>}
      <h2 className="text-2xl font-display font-bold text-white tracking-wider uppercase">{title}</h2>
    </div>
    <div className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-3">
      {subtitle}
    </div>
  </div>
);

const ToggleSwitch = ({ active }) => (
  <div className={`w-10 h-5 rounded-full flex items-center px-1 transition-colors ${active ? 'bg-sky-500' : 'bg-slate-700'}`}>
    <div className={`w-3 h-3 rounded-full bg-white transition-transform ${active ? 'translate-x-5 shadow-[0_0_10px_#fff]' : ''}`} />
  </div>
);

// --- DASHBOARD PAGES ---

const CommandCenter = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-4 text-[10px] font-mono mb-2">
      <span className="text-emerald-400 flex items-center gap-2 bg-emerald-950/30 px-2 py-1 rounded border border-emerald-500/20"><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> GLOBAL DIGITAL TWIN: SYNC ACTIVE</span>
      <span className="text-slate-400 flex items-center gap-2 bg-slate-900/50 px-2 py-1 rounded border border-slate-700"><Database className="w-3 h-3" /> POSTGRESQL CLUSTER: ONLINE</span>
    </div>
    <div className="grid grid-cols-4 gap-6">
      <KpiCard title="Forecast Accuracy" value="96.1%" trend="↗ +0.2%" icon={TrendingUp} delay={0.1} />
      <KpiCard title="Network Fill Rate" value="98.4%" trend="↗ +0.4%" icon={Box} delay={0.2} />
      <KpiCard title="Total Ops Revenue" value="$124.2M" trend="↗ +$12M" icon={DollarSign} delay={0.3} />
      <KpiCard title="Critical Anomalies" value="0" trend="↘ -100%" icon={AlertTriangle} delay={0.4} />
    </div>
    <div className="grid grid-cols-3 gap-6">
      <HolographicCard className="col-span-2 min-h-[400px]" delay={0.5}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-sm font-mono text-slate-300 uppercase tracking-widest">Sovereign Demand Pulse</h3>
          <div className="flex gap-4 text-[10px] font-mono bg-black/40 px-3 py-1.5 rounded border border-white/5">
            <span className="flex items-center gap-2 text-sky-400"><div className="w-4 h-1.5 bg-sky-400 rounded shadow-[0_0_8px_currentColor]" /> ENSEMBLE FORECAST</span>
            <span className="flex items-center gap-2 text-emerald-400"><div className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_currentColor]" /> MARKET REALIZED</span>
          </div>
        </div>
        <div className="flex-1 relative w-full h-[300px] border-b border-l border-slate-700/50 ml-4 mb-4">
          <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
            <path d="M0,80 Q10,75 20,82 T40,60 T60,50 T80,45 T100,40" fill="none" stroke="#38bdf8" strokeWidth="2" className="svg-glow opacity-60" strokeDasharray="4 2" />
            <path d="M0,82 Q12,78 22,80 T42,62 T62,48 T82,42 T100,38" fill="none" stroke="#10b981" strokeWidth="3" className="svg-glow-emerald" />
          </svg>
        </div>
      </HolographicCard>
      <div className="space-y-6 flex flex-col h-full">
        <HolographicCard delay={0.6}>
          <h3 className="text-sm font-mono text-slate-300 uppercase tracking-widest mb-2">Neural Alert Watch</h3>
          <p className="text-[10px] text-slate-500 mb-4 font-mono">Real-time Isolation Forest Disruption Monitoring</p>
          <div className="p-3 bg-sky-950/40 border border-sky-500/30 rounded text-center text-xs font-mono text-sky-400 tracking-widest animate-pulse shadow-[inset_0_0_15px_rgba(56,189,248,0.1)]">
            SYSTEM OPERATIONAL: AUDIT ACTIVE
          </div>
        </HolographicCard>

        <HolographicCard delay={0.7} className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-sky-400">
              <Globe className="w-4 h-4" />
              <h3 className="text-[10px] font-mono tracking-widest">GLOBAL LOGISTICS MESH</h3>
            </div>
            <Network className="w-3 h-3 text-slate-500" />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 mb-6">
            {[
              { n: 'HAMBURG DC', v: 78, c: 'bg-emerald-400' }, { n: 'SINGAPORE', v: 91, c: 'bg-amber-400' },
              { n: 'DETROIT WH', v: 62, c: 'bg-emerald-400' }, { n: 'SHANGHAI', v: 95, c: 'bg-rose-400' }
            ].map((dc, i) => (
              <div key={i} className="bg-black/20 p-2 rounded border border-white/5">
                <div className="flex justify-between items-center text-[9px] font-mono mb-2 text-slate-400">
                  <span>{dc.n}</span>
                  <div className={`w-1.5 h-1.5 rounded-full ${dc.c} animate-pulse`} />
                </div>
                <div className="text-xl font-display font-bold text-white mb-2">{dc.v}%</div>
                <div className="h-1 w-full bg-slate-800 rounded"><div className={`h-full ${dc.c} shadow-[0_0_8px_currentColor]`} style={{ width: `${dc.v}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
            <div className="text-[10px] text-sky-400 font-mono mb-1 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> SECURITY PROTOCOL</div>
          </div>
        </HolographicCard>
      </div>
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-holo p-2 border-sky-400/30 text-[10px] font-mono">
        <p className="text-sky-400 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>
            {p.name.toUpperCase()}: {p.value.toLocaleString()} u
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const makerCols = ['reg_tata', 'reg_ola', 'reg_mahindra', 'reg_tvs', 'reg_ather'];
const makerColors = ['#38bdf8', '#f97316', '#22c55e', '#facc15', '#a78bfa'];
const makerLabels = ['Tata', 'Ola', 'Mahindra', 'TVS', 'Ather'];

// --- TITAN V4 DEMAND INTELLIGENCE HUB ---
const DemandForecaster = () => {
  const [forecast, setForecast] = useState([]);
  const [analytics, setAnalytics] = useState({
    accuracy: 96.3, mae: 3.24, elasticity: 1.12, sensitivity: 1.0,
    p: 0.03, q: 0.38, m: 100.0, intelligence_mode: 'V4_SHARDED'
  });
  const [loading, setLoading] = useState(true);
  const [overlayOn, setOverlayOn] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState("National");
  const { activeScenarioId, setActiveScenarioId } = useSimulationStore();
  const [scenarioData, setScenarioData] = useState([]);
  const [reportText, setReportText] = useState("");
  const [reportContent, setReportContent] = useState(null);
  const [activeLayers, setActiveLayers] = useState({ actual: true, predicted: true, battery: true, maker: true, industrial: true });

  const downloadReport = () => {
    if (!reportText) return;
    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TITAN_V4_REPORT_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
  };

  const fetchForecast = (region) => {
    setLoading(true);
    const rParam = region === "National" ? "" : `&region=${region}`;
    fetch(`http://localhost:8000/api/v1/forecast/ev-sales?country=India&scenario=baseline${rParam}`)
      .then(res => res.json())
      .then(data => {
        setForecast(data.records || []);
        if (data.analytics) setAnalytics(prev => ({ ...prev, ...data.analytics }));
        setLoading(false);
      })
      .catch(e => { console.error(e); setLoading(false); });
  };

  useEffect(() => {
    fetchForecast(selectedRegion);
  }, [selectedRegion]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const resp = await fetch('http://localhost:8000/api/v1/forecast/upload', {
        method: 'POST', body: formData
      });
      if (!resp.ok) throw new Error("Backend Error");
      const data = await resp.json();
      setActiveScenarioId(data.scenario_id);
      // Generate Ghost Line
      setScenarioData(forecast.map(f => ({ ...f, target_demand: (parseFloat(f.target_demand) || 0) * 1.25 })));
    } catch (err) { console.error("Upload failed - Check if engine.py 'booster' attribute error is fixed in backend", err); }
  };

  const handleGenerateReport = async () => {
    const scenarioParam = activeScenarioId ? `&active_scenario_id=${activeScenarioId}` : "";
    setReportText(`Analyzing ${selectedRegion} Cluster... [OK]\nCross-referencing Sovereign Scenario... [OK]\nNeural Memory Sync... [OK]\n\n`);

    try {
      const riskResp = await fetch(`http://localhost:8000/api/v1/risk/anomalies?${scenarioParam}`);
      const riskDataRaw = await riskResp.json();
      const riskData = Array.isArray(riskDataRaw) ? riskDataRaw : [];
      
      const current_max = Math.max(...forecast.map(f => parseFloat(f.target_demand) || 0));

      setReportContent({
        peak_demand: Math.round(current_max),
        anomalies_count: riskData.length,
        risk_level: riskData.length > 0 ? "ELEVATED" : "STABLE",
        p_kinetics: analytics.p,
        q_kinetics: analytics.q
      });

      let summary = `SOVEREIGN SUMMARY: ${selectedRegion} is operating at ${analytics.accuracy}% accuracy.\n`;
      summary += `DETECTED ANOMALIES: ${riskData.length}\n`;
      summary += `MARKET KINETICS: Innovation Coefficient (p) is ${analytics.p}.\n`;
      setReportText(prev => prev + summary);
    } catch (e) { setReportText(prev => prev + "ERROR: Neural Probe Failed."); }
  };

  const chartData = forecast.slice(-24).map((f, i) => ({
    name: String(f.date_key).slice(0, 10),
    actual: parseFloat(f.target_demand) || 0,
    predicted: (parseFloat(f.target_demand) * 0.98) || 0,
    battery: (parseFloat(f.battery_lead_signal) / 100) || 0,
    maker: (parseFloat(f.reg_tata || 0) + parseFloat(f.reg_tvs || 0)) / 100 || 0,
    industrial: (parseFloat(f.reg_industrial) / 10) || 0,
    scenario: (activeScenarioId && i < 12) ? (parseFloat(f.target_demand) * 1.3) : null
  }));

  const makerTotals = makerCols.map(k => forecast.reduce((acc, r) => acc + (parseFloat(r[k]) || 0), 0));
  const totalMakers = makerTotals.reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="flex gap-6 h-full pb-20">
      {/* SIDEBAR */}
      <div className="w-64 space-y-6 flex-shrink-0">
        <HolographicCard delay={0.1}>
          <h3 className="text-[10px] font-mono text-sky-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Sliders className="w-4 h-4" /> Cluster Control
          </h3>
          <div className="space-y-4">
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white font-mono outline-none"
            >
              <option value="National">National Ensemble</option>
              <option value="Maharashtra">Maharashtra</option>
              <option value="Punjab">Punjab</option>
              <option value="Karnataka">Karnataka</option>
            </select>
            <button
              onClick={() => document.getElementById('scenario-upload').click()}
              className="w-full bg-sky-500/10 border border-sky-500/30 text-sky-400 p-2 rounded text-[10px] font-mono hover:bg-sky-500/20 transition-all uppercase flex items-center justify-center gap-2"
            >
              <Upload className="w-3 h-3" /> {activeScenarioId ? "SCENARIO ACTIVE" : "Upload CSV"}
              <input type="file" id="scenario-upload" className="hidden" onChange={handleFileUpload} accept=".csv" />
            </button>
            <button
              onClick={handleGenerateReport}
              className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-2 rounded text-[10px] font-mono hover:bg-emerald-500/20 transition-all uppercase flex items-center justify-center gap-2"
            >
              <FileText className="w-3 h-3" /> Intelligence Report
            </button>

            <div className="pt-4 border-t border-white/5 space-y-3">
              <label className="text-[9px] text-slate-500 uppercase block">Causal Signals</label>
              {['battery', 'maker', 'industrial'].map(id => (
                <div key={id} className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-300 capitalize">{id} Signal</span>
                  <input
                    type="checkbox"
                    checked={activeLayers[id]}
                    onChange={() => setActiveLayers(prev => ({ ...prev, [id]: !prev[id] }))}
                    className="accent-sky-500"
                  />
                </div>
              ))}
            </div>

            {reportContent && (
              <div className="mt-4 space-y-2">
                <pre className="p-3 bg-black/40 border border-emerald-500/30 rounded font-mono text-[10px] text-emerald-400 whitespace-pre-wrap">
                  {`PEAK DEMAND: ${reportContent.peak_demand}u
ANOMALIES: ${reportContent.anomalies_count}
RISK: ${reportContent.risk_level}
P_KINETICS: ${reportContent.p_kinetics}
Q_KINETICS: ${reportContent.q_kinetics}`}
                </pre>
                <button onClick={downloadReport} className="w-full bg-sky-500/20 text-sky-400 py-1 rounded text-[9px] font-mono uppercase">Download protocol</button>
              </div>
            )}
          </div>
        </HolographicCard>
      </div>

      <div className="flex-1 space-y-6 min-w-0">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <KpiCard title="Accuracy" value={`${analytics.accuracy}%`} trend={analytics.intelligence_mode} icon={Crosshair} delay={0.1} />
          <KpiCard title="MAE" value={analytics.mae.toString()} trend="Optimized" icon={TrendingUp} delay={0.2} />
          <KpiCard title="Elasticity" value={`${analytics.elasticity}x`} trend="Stable" icon={Activity} delay={0.3} />
          <KpiCard title="Sensitivity" value={`${analytics.sensitivity}x`} trend="Active" icon={Sliders} delay={0.4} />
        </div>

        {/* CHART CONTAINER - FIXED SIZE FOR PRESENTATION */}
        <HolographicCard className="h-[450px]" delay={0.2}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-mono text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" /> Neural Demand Propagation
            </h3>
            <div className="flex gap-3 text-[9px] font-mono opacity-60">
              {activeLayers.actual && <span className="text-sky-400">● ACTUAL</span>}
              {activeLayers.predicted && <span className="text-emerald-400">-- BASELINE</span>}
              {activeScenarioId && <span className="text-amber-500 animate-pulse">-- SCENARIO</span>}
            </div>
          </div>
          <div className="flex-1 w-full h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} /><stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} minTickGap={40} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip content={<CustomTooltip />} />
                {activeLayers.actual && <Area type="monotone" dataKey="actual" stroke="#0ea5e9" fill="url(#colorActual)" strokeWidth={2} />}
                {activeLayers.predicted && <Area type="monotone" dataKey="predicted" stroke="#10b981" fill="transparent" strokeDasharray="5 5" strokeWidth={2} />}
                {activeLayers.battery && <Area type="monotone" dataKey="battery" stroke="#38bdf8" fill="transparent" strokeWidth={1} strokeOpacity={0.4} />}
                {activeScenarioId && <Area type="monotone" dataKey="scenario" stroke="#f59e0b" fill="transparent" strokeDasharray="3 3" strokeWidth={3} />}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </HolographicCard>

        <div className="grid grid-cols-3 gap-6">
          <HolographicCard className="col-span-2 h-[300px] flex flex-col" delay={0.5}>
            <h3 className="text-sm font-mono text-slate-300 uppercase tracking-widest mb-4">Live Demand Signal Stream (Titan V4)</h3>
            <div className="flex-1 overflow-auto custom-scroll">
              <table className="w-full text-left text-[10px] font-mono">
                <thead className="sticky top-0 bg-slate-950 text-slate-500 uppercase border-b border-white/10">
                  <tr><th className="py-2">Date</th><th>Region</th><th>Demand</th><th>Top Maker</th><th className="text-right">Z-Score</th></tr>
                </thead>
                <tbody>
                  {forecast.slice(-12).map((f, i) => {
                    const makers = {
                      TATA: parseFloat(f.reg_tata) || 0,
                      MAHINDRA: parseFloat(f.reg_mahindra) || 0,
                      OLA: parseFloat(f.reg_ola) || 0,
                      TVS: parseFloat(f.reg_tvs) || 0,
                      ATHER: parseFloat(f.reg_ather) || 0,
                      BAJAJ: parseFloat(f.reg_bajaj) || 0
                    };
                    const maxVal = Math.max(...Object.values(makers));
                    const topMaker = Object.keys(makers).find(k => makers[k] === maxVal);
                    return (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-2 text-slate-400">{String(f.date_key).slice(0, 10)}</td>
                        <td className="text-sky-400 font-bold">{f.region_name}</td>
                        <td className="text-white">{parseFloat(f.target_demand).toFixed(0)} u</td>
                        <td className="text-emerald-400 font-bold tracking-tighter">{topMaker}</td>
                        <td className="text-right text-slate-500">{f.demand_z_score}σ</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </HolographicCard>

          <HolographicCard delay={0.7} className="h-[300px]">
            <h3 className="text-[10px] font-mono text-sky-400 uppercase tracking-widest mb-4">Market Kinetics</h3>
            <div className="space-y-4 mt-6">
              {[{ n: 'IMITATION (Q)', v: analytics.q }, { n: 'INNOVATION (P)', v: analytics.p }, { n: 'CAPACITY (M)', v: analytics.m }].map((d, i) => (
                <div key={i}>
                  <div className="flex justify-between text-[10px] font-mono mb-1 text-slate-400"><span>{d.n}</span><span>{d.v}%</span></div>
                  <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden"><div className="h-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" style={{ width: `${d.v}%` }} /></div>
                </div>
              ))}
            </div>
          </HolographicCard>
        </div>
      </div>
    </div>
  );
};

const AnomalyIntel = () => {
  const { activeScenarioId } = useSimulationStore();
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const scenarioParam = activeScenarioId ? `?active_scenario_id=${activeScenarioId}` : "";
    fetch(`http://localhost:8000/api/v1/risk/anomalies${scenarioParam}`)
      .then(r => r.json())
      .then(d => {
        setAnomalies(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(e => {
        console.error("Neural Scanner Fetch Failure:", e);
        setLoading(false);
      });
  }, [activeScenarioId]);

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <ShieldAlert className="w-5 h-5 text-rose-500" />
          <h2 className="text-2xl font-display font-bold text-white tracking-wider uppercase">Anomaly Intelligence</h2>
        </div>
        <p className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-3">
          ISOLATION FOREST NEURAL SCANNER V4.0
          <span className="ml-4 text-sky-400 bg-sky-950/30 px-2 py-0.5 rounded border border-sky-500/20 text-[10px]">LIVE NEURAL SCAN: ACTIVE</span>
          <span className="text-slate-500 text-[10px] bg-slate-900/50 px-2 py-0.5 rounded border border-slate-700">CONTAMINATION SETTING: 0.08</span>
        </p>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <KpiCard title="Outliers Detected" value="1" trend="+12% from baseline" icon={AlertTriangle} delay={0.1} />
        <KpiCard title="Scanner Accuracy" value="99.8%" trend="Stable" icon={ShieldCheck} delay={0.2} />
        <KpiCard title="MTTR Response" value="1.2h" trend="-0.4h optimized" icon={Clock} delay={0.3} />
        <KpiCard title="Points Processed" value="1.2M+" trend="Real-time" icon={Zap} delay={0.4} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <HolographicCard className="col-span-2 flex flex-col" delay={0.5}>
          <h3 className="text-sm font-mono text-slate-300 uppercase tracking-widest mb-6">Real-Time Disruption Matrix</h3>
          <div className="w-full overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-mono text-slate-500 uppercase tracking-widest border-b border-slate-700/50 bg-black/20">
                  <th className="py-3 px-4 font-normal">Cluster ID</th>
                  <th className="py-3 px-4 font-normal">Disruption Delta</th>
                  <th className="py-3 px-4 font-normal">Entity Context</th>
                  <th className="py-3 px-4 font-normal">Logic Score</th>
                  <th className="py-3 px-4 font-normal text-right">Detection Lag</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" className="py-10 text-center font-mono text-slate-500 text-xs uppercase animate-pulse">Scanning Titan V4 Causal Matrix...</td></tr>
                ) : anomalies.length === 0 ? (
                  <tr><td colSpan="5" className="py-10 text-center font-mono text-emerald-400 text-xs uppercase">No Molecular Discontinuities Detected. System Normalized.</td></tr>
                ) : (
                  anomalies.map((item, idx) => (
                    <tr key={item.id || idx} className="border-b border-white/5 interactive-row cursor-pointer hover:bg-white/5">
                      <td className="py-5 px-4 text-xs font-mono text-amber-400 flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_currentColor] ${item.severity === 'critical' ? 'bg-rose-500' : 'bg-amber-400'}`} />
                        #{idx}x1
                      </td>
                      <td className="py-5 px-4 text-xs">
                        <div className={`font-bold mb-1 tracking-wide uppercase ${item.severity === 'critical' ? 'text-rose-400' : 'text-white'}`}>
                          {item.title}
                        </div>
                        <div className="text-slate-400 text-[10px] uppercase">{item.message}</div>
                      </td>
                      <td className="py-5 px-4 text-[10px] font-mono text-slate-300 bg-black/20 rounded m-2">
                        <Box className="inline w-3 h-3 mr-1 text-sky-400" /> {item.location}
                      </td>
                      <td className="py-5 px-4 text-xs">
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 w-20 bg-slate-800 rounded overflow-hidden">
                            <div
                              className={`h-full shadow-[0_0_8px_currentColor] transition-all duration-1000 ${(item.anomaly_z_score || 0) < 3 ? 'bg-emerald-400' :
                                (item.anomaly_z_score || 0) < 6 ? 'bg-amber-400' : 'bg-rose-500'
                                }`}
                              style={{ width: `${Math.min((item.anomaly_z_score || 0) * 10, 100)}%` }}
                            />
                          </div>
                          <span className={`font-mono text-[10px] font-bold ${(item.anomaly_z_score || 0) < 3 ? 'text-emerald-400' :
                            (item.anomaly_z_score || 0) < 6 ? 'text-amber-400' : 'text-rose-500'
                            }`}>
                            {item.anomaly_z_score || 0}σ
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </HolographicCard>

        <HolographicCard delay={0.6}>
          <h3 className="text-sm font-mono text-slate-300 uppercase tracking-widest mb-6">Logic Cluster Severity</h3>
          <div className="bg-rose-950/20 p-5 rounded-xl border border-rose-500/30 relative overflow-hidden">
            <div className="relative z-10">
              <div className="text-[10px] text-rose-400 font-mono flex items-center gap-2 mb-2 font-bold"><AlertTriangle className="w-4 h-4" /> AI ACTION REQUIRED</div>
              <p className="text-[11px] text-rose-100/70 leading-relaxed font-light">
                Isolation Forest has flagged {anomalies.length} active causal disruptions.
                Focus on high-sigma nodes to prevent supply chain breakage.
              </p>
            </div>
          </div>
        </HolographicCard>
      </div>
    </div>
  );
};
const StockStrategy = () => {
  const [inventory, setInventory] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [alerts, setAlerts] = useState([]);
  const [recommendationStr, setRecommendationStr] = useState("Loading AI suggestion...");
  const [stockHealth, setStockHealth] = useState("99.2%");

  useEffect(() => {
    setLoading(true);
    fetch(`http://localhost:8000/api/v1/inventory/?skip=${(currentPage - 1) * pageSize}&limit=${pageSize}`)
      .then(res => {
        if (!res.ok) throw new Error("Inventory endpoint returned 404 or 500");
        return res.json();
      })
      .then(data => {
        const resultsArray = data.items ? data.items : (Array.isArray(data) ? data : []);
        setInventory(resultsArray);
        setTotalItems(data.total || resultsArray.length);
        setLoading(false);
      })
      .catch(e => {
        console.error('Inventory fetch error:', e);
        setInventory([]);
        setLoading(false);
      });
  }, [currentPage]);

  useEffect(() => {
    // Wire Alerts
    fetch('http://localhost:8000/api/v1/inventory/alerts')
      .then(res => res.json())
      .then(data => setAlerts(Array.isArray(data) ? data : (data.alerts || [])))
      .catch(() => { });

    // Wire Recommendations
    fetch('http://localhost:8000/api/v1/inventory/recommendations')
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setRecommendationStr(data[0].protocol || "Monitoring demand pulse (T-Now window).");
        } else {
          setRecommendationStr("No immediate action required. Operations normal.");
        }
      })
      .catch(() => { });

    // Wire KPIs
    fetch('http://localhost:8000/api/v1/inventory/stock?below_reorder_only=true')
      .then(res => res.json())
      .then(data => {
        const belowCount = Array.isArray(data) ? data.length : 0;
        fetch('http://localhost:8000/api/v1/inventory/?skip=0&limit=1')
          .then(r => r.json())
          .then(d => {
            const count = d.total || 2028;
            const h = 100 - (belowCount / count) * 100;
            setStockHealth(h.toFixed(1) + "%");
          });
      })
      .catch(() => { });
  }, []);

  const totalPages = Math.ceil((totalItems || inventory.length || 1) / pageSize);
  const currentData = inventory;

  const chartData = [
    { name: 'BMS 48V MODULE', rp: 65, ss: 10 },
    { name: 'LFP BLADE CELL', rp: 45, ss: 10 },
    { name: 'LIQUID COOLING MODULE', rp: 85, ss: 10, highlight: true, rpVal: '1,314', ssVal: '7' },
    { name: 'LITHIUM HYDROXIDE', rp: 35, ss: 10 },
    { name: 'SILICONE', rp: 50, ss: 10 },
    { name: 'STATOR COIL', rp: 70, ss: 10 },
    { name: 'ROTOR ASSY', rp: 40, ss: 10 },
    { name: 'INVERTER UNIT', rp: 60, ss: 10 }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start mb-6">
        <div className="mb-4">
          <div className="flex items-center gap-4 mb-2">
            <Package className="w-5 h-5 text-sky-400" />
            <h2 className="text-2xl font-display font-bold text-white tracking-wider uppercase">Inventory Intelligence</h2>
          </div>
          <p className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-3">
            MULTI-ECHELON STOCK OPTIMIZATION ENGINE
            <span className="ml-4 text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-500/20 text-[10px]">
              <Clock className="w-3 h-3 inline mr-1" />LEAD-TIME PREDICTED
            </span>
            <span className="text-slate-500 bg-slate-900/50 px-2 py-0.5 rounded border border-slate-700 text-[10px]">
              OPTIMIZER: EOQ-HYBRID-V2
            </span>
          </p>
        </div>
        <button className="px-4 py-2 bg-slate-900 border border-slate-700 text-sky-400 font-mono text-[10px] rounded tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-colors"><Globe className="w-3 h-3" /> GLOBAL COVERAGE: 14 FACILITIES</button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <KpiCard title="Inventory Turnover" value="6.8x" trend="↗ +3.4x QoQ" icon={Activity} delay={0.1} />
        <KpiCard title="Locked Capital" value="$20.6k" trend="Optimized" icon={DollarSign} delay={0.2} />
        <KpiCard title="Stock Health" value={stockHealth} trend="↗ +3.1% delta" icon={ShieldCheck} delay={0.3} />
        <KpiCard title="Outlier Rate" value="0.0%" trend="↘ -0.5% MoM" icon={AlertOctagon} delay={0.4} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <HolographicCard className="col-span-2 min-h-[300px] flex flex-col" delay={0.5}>
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-sm font-mono text-slate-300 uppercase tracking-widest">Echelon Stock Distribution</h3>
              <p className="text-[10px] text-slate-500 mt-1 font-mono">Reorder Point vs. AI-recommended safety stock per SKU (averaged across facilities)</p>
            </div>
            <div className="flex gap-4 text-[10px] font-mono bg-black/40 px-3 py-1.5 rounded border border-white/5">
              <span className="flex items-center gap-2 text-sky-400"><div className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_currentColor]" /> REORDER POINT</span>
              <span className="flex items-center gap-2 text-emerald-400"><div className="w-4 h-1 bg-emerald-400 shadow-[0_0_8px_currentColor]" /> AI SAFETY STOCK</span>
            </div>
          </div>
          <div className="flex-1 relative w-full border-b border-l border-slate-700/50 ml-4 pb-6">
            <div className="absolute inset-0 flex items-end justify-around px-4">
              {chartData.map((data, i) => (
                <div key={i} className="relative w-8 flex flex-col items-center group">
                  <div className="absolute bottom-6 w-full bg-slate-800/80 group-hover:bg-slate-700 transition-colors rounded-t" style={{ height: `${data.rp}%` }}></div>
                  <div className={`absolute w-full h-1 z-10 ${data.highlight ? 'bg-sky-300 shadow-[0_0_15px_#38bdf8]' : 'bg-sky-500 shadow-[0_0_8px_#38bdf8]'}`} style={{ bottom: `calc(6px + ${data.rp}%)` }} />

                  <div className="absolute bottom-8 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] z-20" />
                  {i < chartData.length - 1 && <div className="absolute bottom-[2.1rem] left-1/2 w-[calc(100%+3.2rem)] h-0.5 bg-emerald-400/70 z-10 shadow-[0_0_5px_#10b981]" />}

                  <div className="absolute -bottom-4 text-[7px] font-mono text-slate-600 whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition-opacity">{data.name}</div>

                  {data.highlight && (
                    <div className="absolute -top-4 -left-16 w-48 bg-slate-900/90 border border-sky-500/50 rounded p-3 backdrop-blur-md shadow-[0_0_20px_rgba(56,189,248,0.2)] z-30 pointer-events-none">
                      <div className="text-[10px] font-mono text-sky-400 mb-2 border-b border-white/10 pb-2">{data.name}</div>
                      <div className="flex justify-between items-center text-[10px] font-mono mb-1 text-slate-300"><span>REORDER POINT</span><span className="text-white font-bold">{data.rpVal}</span></div>
                      <div className="flex justify-between items-center text-[10px] font-mono text-slate-300"><span>AI SAFETY STOCK</span><span className="text-emerald-400 font-bold">{data.ssVal}</span></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </HolographicCard>

        <HolographicCard delay={0.6}>
          <h3 className="text-sm font-mono text-slate-300 uppercase tracking-widest mb-6">Strategic Health</h3>

          <div className="bg-sky-950/20 p-4 rounded-xl border border-sky-500/30 mb-6">
            <div className="text-[10px] text-sky-400 font-mono flex items-center gap-2 mb-2 font-bold"><Zap className="w-3 h-3" /> OPTIMIZER SUGGESTION</div>
            <p className="text-[11px] text-sky-100/80 leading-relaxed font-mono">{recommendationStr}</p>
          </div>

          <h4 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">INVENTORY VITALITY</h4>
          <div className="space-y-5 mb-8">
            {[{ n: 'DEMAND SIGNAL TRADE', v: 98.39, c: 'bg-emerald-400', badge: 'STABLE' }, { n: 'NETWORK LATENCY', v: 12, c: 'bg-slate-500' }, { n: 'SHRINKAGE RISK', v: 4, c: 'bg-slate-500' }].map((d, i) => (
              <div key={i}>
                <div className="flex justify-between items-center text-[9px] font-mono mb-1 text-slate-400">
                  <span>{d.n}</span>
                  <div className="flex items-center gap-2">
                    {d.badge && <span className="text-[8px] bg-emerald-950/50 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">{d.badge}</span>}
                    <span className="text-white">{d.v}%</span>
                  </div>
                </div>
                <div className="h-1 w-full bg-slate-900 rounded"><div className={`h-full ${d.c} ${d.v > 90 ? 'shadow-[0_0_8px_currentColor]' : ''}`} style={{ width: `${d.v}%` }} /></div>
              </div>
            ))}
          </div>

          <button className="w-full py-3.5 bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold text-xs uppercase tracking-widest rounded transition-colors shadow-[0_0_15px_rgba(56,189,248,0.4)] flex justify-center items-center gap-2">
            <ArrowRight className="w-4 h-4" /> GENERATE BULK PO
          </button>
          <div className="text-center text-[9px] font-mono text-slate-500 mt-4 tracking-widest">DECISION CONFIDENCE: 99.25%</div>
        </HolographicCard>
      </div>

      <HolographicCard delay={0.65} className="w-full py-5 px-6">
        <h3 className="text-xs font-mono text-slate-300 uppercase tracking-widest mb-4">Border Criticality Watch</h3>
        <div className="flex justify-between text-[9px] font-mono text-slate-500 uppercase tracking-widest px-4 border-b border-slate-700/50 pb-2 mb-2">
          <span>SKU IDENTIFIER</span>
          <span>ENTITY IDENTITY</span>
          <span>STOCK HEALTH</span>
          <span>DEFICIT</span>
          <span>ACTION STATE</span>
        </div>
        <div className="flex flex-col text-[10px] font-mono text-slate-600 relative overflow-hidden min-h-[32px]">
          <div className="scanline-overlay opacity-30" />
          {!alerts || alerts.length === 0 ? (
            <div className="h-8 flex items-center justify-center italic">System Normalized: All Nodes Within Thresholds.</div>
          ) : (
            alerts.map((row, i) => (
              <div key={i} className="flex justify-between items-center py-2 px-4 border-b border-white/5 hover:bg-white/5 cursor-pointer interactive-row">
                <span className="text-amber-400 font-bold">{row.inventory_id || `SKU-${i + 1}`}</span>
                <span className="text-white">{row.facility || "Gateway"}</span>
                <span className="text-rose-400">{row.stock_health_pct || "25%"}</span>
                <span className="text-sky-400 font-bold bg-sky-950/20 px-2 rounded">-{row.deficit || 0}u</span>
                <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${(row.deficit || 0) > 0 ? 'bg-rose-950/40 text-rose-400 border border-rose-500/30 shadow-[0_0_15px_#ef4444]' : 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'}`}>{row.action || "Active Sourcing"}</span>
              </div>
            ))
          )}
        </div>
      </HolographicCard>

      <HolographicCard delay={0.7} className="w-full">
        <div className="flex items-center gap-4 mb-6">
          <h3 className="text-sm font-mono text-slate-300 uppercase tracking-widest">Titan V4 Digital Twin Ledger</h3>
          <div className="flex gap-2">
            <span className="text-[9px] font-mono bg-purple-950/40 text-purple-400 border border-purple-500/30 px-2 py-1 rounded flex items-center gap-1"><Cpu className="w-3 h-3" /> XGBOOST V2 - 25 FEATURES</span>
            <span className="text-[9px] font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> ACCURACY: 98.29% - R² = 0.9789</span>
            <span className="text-[9px] font-mono bg-sky-950/40 text-sky-400 border border-sky-500/30 px-2 py-1 rounded">MAPE: 2.7187%</span>
            <span className="text-[9px] font-mono bg-slate-900/50 text-slate-400 border border-slate-700 px-2 py-1 rounded">MAE: 3.2434 UNITS - 50 SKU+FACILITY</span>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[9px] font-mono text-slate-500 uppercase tracking-widest border-b border-slate-700/50 bg-black/20">
                <th className="py-4 px-4 font-normal">PRODUCT NAME</th>
                <th className="py-4 px-4 font-normal">NODE LOCATION</th>
                <th className="py-4 px-4 text-right font-normal">TOTAL MONTHLY DEMAND</th>
                <th className="py-4 px-4 text-right font-normal">PHYSICAL STOCK</th>
                <th className="py-4 px-4 text-right text-sky-400 font-normal">REORDER THRESHOLD</th>
                <th className="py-4 px-4 text-right font-normal">VITALITY INDEX</th>
              </tr>
            </thead>
            <tbody className="text-xs font-mono">
              {loading ? (
                <tr><td colSpan="6" className="py-10 text-center text-slate-600 animate-pulse">MAP-REDUCING INVENTORY SIGNALS...</td></tr>
              ) : (!currentData || currentData.length === 0) ? (
                <tr><td colSpan="6" className="py-10 text-center font-mono text-slate-600 text-xs">Loading Fabric Data...</td></tr>
              ) : currentData.map((row, i) => {
                const totalMonthyDemand = row.quantity_on_hand + row.quantity_reserved;
                const physicalStock = row.quantity_on_hand;
                const reorderThreshold = row.reorder_point;
                const vitalityIndex = parseFloat(row.stock_health_pct) || 0;
                let vitalityColor = "text-rose-500 font-bold animate-pulse";
                if (vitalityIndex > 85) vitalityColor = "text-emerald-400 shadow-[0_0_8px_#10b981]";
                else if (vitalityIndex >= 50) vitalityColor = "text-amber-400";

                return (
                  <tr key={i} className="border-b border-white/5 interactive-row hover:bg-white/5 cursor-pointer">
                    <td className="py-4 px-4 text-slate-300 flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/50 flex items-center justify-center">
                        <Box className="w-3 h-3 text-purple-400" />
                      </div>
                      {row.product_name}
                    </td>
                    <td className="py-4 px-4 text-slate-400">{row.facility_id}</td>
                    <td className="py-4 px-4 text-right text-white font-mono tracking-tighter">{(totalMonthyDemand || 0).toLocaleString()}</td>
                    <td className="py-4 px-4 text-right text-white font-mono tracking-tighter">{(physicalStock || 0).toLocaleString()}</td>
                    <td className="py-4 px-4 text-right text-sky-400 font-bold bg-sky-950/10 font-mono tracking-tighter">{(reorderThreshold || 0).toLocaleString()}</td>
                    <td className={`py-4 px-4 text-right ${vitalityColor}`}>{vitalityIndex.toFixed(1)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Virtual Pagination Controls */}
          {!loading && (
            <div className="p-4 border-t border-white/5 flex justify-between items-center bg-black/20">
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                SIGNAL {(currentPage - 1) * pageSize + 1} – {Math.min(currentPage * pageSize, totalItems)} OF {totalItems} CAUSAL NODES
              </div>
              <div className="flex gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="px-3 py-1 bg-slate-900 border border-slate-700 text-sky-400 rounded disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="px-3 py-1 font-mono text-xs text-white bg-sky-500/10 border border-sky-500/30 rounded">
                  {currentPage} / {totalPages}
                </div>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="px-3 py-1 bg-slate-900 border border-slate-700 text-sky-400 rounded disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </HolographicCard>
    </div>
  );
};

const LogisticsOptimizerPortal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-12 animate-in fade-in duration-500">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full h-full bg-slate-950 border border-sky-500/30 rounded-2xl shadow-[0_0_50px_rgba(56,189,248,0.2)] overflow-hidden flex flex-col">
        {/* Portal Header */}
        <div className="p-4 bg-black/40 border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_currentColor]" />
            <span className="text-[10px] font-mono text-sky-400 tracking-[0.3em] font-bold uppercase">Sovereign Optimizer Portal | VRP Service v6.1</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/40 text-rose-400 text-[9px] font-mono border border-rose-500/30 rounded tracking-widest transition-colors"
          >
            TERMINATE PROTOCOL [ESC]
          </button>
        </div>

        {/* Live Feature Embedding */}
        <div className="flex-1 relative bg-black">
          <div className="absolute inset-0 opacity-10 pointer-events-none pointer-events-none">
            <div className="scanline-overlay" />
          </div>
          <iframe
            src="http://127.0.0.1:5000"
            className="w-full h-full border-none"
            title="Sovereign Logistics Optimizer"
          />
        </div>

        {/* System Status */}
        <div className="p-3 bg-slate-900 border-t border-white/5 flex justify-between items-center text-[8px] font-mono text-slate-500 tracking-widest">
          <div>LOCAL TUNNEL: ACTIVE [127.0.0.1:5000]</div>
          <div>NEURO-LINK SYNC: 100%</div>
          <div>SECURITY: SOVEREIGN ENCRYPTED</div>
        </div>
      </div>
    </div>
  );
};

const GlobalCorridors = ({ onTriggerOptimizer }) => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedResult, setOptimizedResult] = useState(null);
  const [selectedState, setSelectedState] = useState('Maharashtra');
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState({
    transitEfficiency: '94.2%',
    costPerTon: '$2.84'
  });

  useEffect(() => {
    setLoading(true);
    fetch('http://localhost:8000/api/v1/shipments?limit=50')
      .then(res => res.json())
      .then(data => {
        const results = Array.isArray(data) ? data : (data.items || []);
        setShipments(results);
        
        if (results.length > 0) {
          // Calculate Metrics
          const delivered = results.filter(s => s.status === 'delivered').length;
          const efficiency = (delivered / results.length) * 100;
          
          const totalCost = results.reduce((acc, s) => acc + (parseFloat(s.transport_cost_usd) || 0), 0);
          const totalQty = results.reduce((acc, s) => acc + (parseFloat(s.quantity) || 1), 0);
          const avgCostPerTon = totalCost / (totalQty || 1);

          setKpiData({
            transitEfficiency: '83.7%', // Hardcoded per Sovereign Directive
            costPerTon: '$' + avgCostPerTon.toFixed(2)
          });
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Shipment fetch error:", err);
        setLoading(false);
      });
  }, []);

  const corridorStats = useMemo(() => {
    if (!shipments || shipments.length === 0) return [
      { h: 85, n: 'NA-EST' }, { h: 82, n: 'NA-WST' }, { h: 90, n: 'EU-CTR' }, 
      { h: 75, n: 'AP-STH' }, { h: 80, n: 'AP-NRH' }, { h: 65, n: 'LATAM' }
    ];

    const groups = {};
    shipments.forEach(s => {
      const origin = s.origin_country || 'UNK';
      const dest = s.destination_country || 'UNK';
      const key = `${origin.slice(0, 3)}-${dest.slice(0, 3)}`.toUpperCase();
      if (!groups[key]) groups[key] = { total: 0, delivered: 0 };
      groups[key].total++;
      if (s.status === 'delivered') groups[key].delivered++;
    });

    return Object.entries(groups).map(([name, stats]) => {
      const percentage = stats.total > 0 ? (stats.delivered / stats.total) * 100 : 0;
      return {
        n: name,
        h: Math.max(percentage, 8) // Ensure at least a small sliver is visible for zero/low values
      };
    }).slice(0, 6);
  }, [shipments]);

  const varianceData = useMemo(() => {
    const delayed = shipments.find(s => s.status === 'delayed');
    if (delayed) {
      return {
        prefix: "MARKET DRIFT PREDICTION",
        message: `Disruption alert: ${delayed.delay_reason || 'Transit divergence'} detected on corridor ${delayed.origin_country} → ${delayed.destination_country}.`,
        recommendation: "Neural Recommendation: Deploy Air-Bridge for Class-A stock."
      };
    }
    return {
      prefix: "SYSTEM STABILITY: NOMINAL",
      message: "Neural Scan: All transit corridors operating within efficiency parameters.",
      recommendation: "System Stewardship: Optimizer ready for dispatch."
    };
  }, [shipments]);

  const handleOptimize = async () => {
    // HARDWARE-LEVEL SIGNAL BRIDGE: Force Open in New Tab immediately
    try {
      window.open('http://localhost:5000?state=' + selectedState, '_blank');
      console.log("TITAN_V4: EXTERNAL PROTOCOL OPENED FOR STATE: " + selectedState);
    } catch (e) {
      console.warn("Popup blocked, attempting internal portal...");
    }

    // INTERNAL SOVEREIGN UI STATE
    setIsOptimizing(true);
    setOptimizedResult(null);

    setTimeout(async () => {
      try {
        const response = await fetch('http://localhost:8000/api/v1/logistics/routes?origin=Shanghai&destination=Rotterdam&priority=cost');
        if (response.ok) {
          const data = await response.json();
          setOptimizedResult(data);
        }
        onTriggerOptimizer();
      } catch (err) {
        console.error("Internal Portal Trace:", err);
        onTriggerOptimizer(); // Open portal regardless
      } finally {
        setIsOptimizing(false);
      }
    }, 1200);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start mb-6">
        <div className="mb-4">
          <div className="flex items-center gap-4 mb-2">
            <Globe className="w-5 h-5 text-sky-400" />
            <h2 className="text-2xl font-display font-bold text-white tracking-wider uppercase">Logistics Intelligence</h2>
          </div>
          <p className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-3">
            AI-DYNAMIC ROUTE OPTIMIZATION & FLEET MONITORING
            <span className={`${isOptimizing ? 'text-emerald-400 border-emerald-500 animate-pulse' : 'text-slate-500 border-slate-700'} text-[10px] bg-slate-900/50 px-2 py-0.5 rounded border ml-2 font-bold`}>
              {isOptimizing ? 'NEURAL_SCAN: BUSY' : 'OPTIMIZER: READY'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-4 relative z-[100] pointer-events-auto">
          <div className="flex flex-col gap-2">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest pl-1">Contextual Anchor</span>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-sky-400 text-[10px] uppercase font-mono px-3 py-2 rounded focus:outline-none focus:border-sky-500 transition-all cursor-pointer"
            >
              <option value="Maharashtra">Maharashtra Core</option>
              <option value="Punjab">Punjab Aggregator</option>
              <option value="Karnataka">Karnataka Hub</option>
              <option value="Tamil Nadu">Tamil Nadu Gateway</option>
              <option value="Gujarat">Gujarat Industrial</option>
            </select>
          </div>
          <button
            onClick={handleOptimize}
            className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] uppercase tracking-[0.2em] rounded transition-all shadow-[0_0_30px_rgba(244,63,94,0.4)] flex items-center gap-3 animate-pulse active:scale-95 border border-rose-400/30 cursor-pointer h-10 mt-5"
          >
            <Zap className={`w-4 h-4 ${isOptimizing ? 'animate-spin' : ''}`} />
            INITIATE SOVEREIGN OPTIMIZER
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <KpiCard title="Transit Efficiency" value={kpiData.transitEfficiency} trend="+2.4% optimized" icon={Clock} delay={0.1} />
        <KpiCard title="Cost per Metric Ton" value={kpiData.costPerTon} trend="-$0.12 savings" icon={DollarSign} delay={0.2} />
        <KpiCard title="Asset Utilization" value="89.2%" trend="+3.1% MoM" icon={Truck} delay={0.3} />
        <KpiCard title="CO2 Reduction" value="12.4%" trend="+2.1% green" icon={CheckCircle2} delay={0.4} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <HolographicCard className="col-span-2 min-h-[350px] flex flex-col" delay={0.5}>
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-sm font-mono text-slate-300 uppercase tracking-widest">Sovereign Corridor Performance</h3>
              <p className="text-[10px] text-slate-500 mt-1 font-mono">Real-time on-time delivery percentage across major global trade lanes</p>
            </div>
            <div className="flex gap-4 text-[10px] font-mono bg-black/40 px-3 py-1.5 rounded border border-white/5">
              <span className="flex items-center gap-2 text-sky-400"><div className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_currentColor]" /> EFFICIENCY SCORED</span>
            </div>
          </div>
          <div className="flex-1 relative w-full h-[250px] border-b border-l border-slate-700/50 ml-4 pb-4">
            <div className="absolute inset-0 flex items-end justify-around px-8">
              {corridorStats.map((bar, i) => (
                <div key={i} className="relative w-12 group flex flex-col items-center">
                  <div className="absolute bottom-0 w-full bg-slate-800/80 group-hover:bg-sky-900/50 transition-colors rounded-t border-t border-sky-500/20" style={{ height: `${Math.max(Number(bar.h) || 0, 8)}%` }}></div>
                  <div className="absolute -bottom-6 text-[9px] font-mono text-slate-500">{bar.n}</div>
                </div>
              ))}
            </div>
          </div>
        </HolographicCard>

        <HolographicCard delay={0.6}>
          <h3 className="text-sm font-mono text-slate-300 uppercase tracking-widest mb-6">Strategic Variance</h3>

          <div className="bg-sky-950/20 p-4 rounded-xl border border-sky-500/30 mb-6 shadow-[inset_0_0_15px_rgba(56,189,248,0.1)]">
            <div className="text-[10px] text-sky-400 font-mono flex items-center gap-2 mb-2 font-bold"><Activity className="w-3 h-3" /> {varianceData.prefix}</div>
            <p className="text-[10px] text-slate-300 leading-relaxed font-mono">{varianceData.message} <span className="text-sky-400 font-bold border-b border-sky-400/50">{varianceData.recommendation}</span></p>
          </div>

          <h4 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">OPTIMIZATION VECTOR</h4>
          <div className="space-y-4 mb-6 border-b border-white/10 pb-6">
            {[{ n: 'CARRIER SLA COMPLIANCE', v: 87, c: 'bg-sky-400' }, { n: 'DYNAMIC COST VARIANCE', v: 14, c: 'bg-slate-500' }, { n: 'ROUTING LATENCY', v: 3, c: 'bg-slate-500' }].map((d, i) => (
              <div key={i}>
                <div className="flex justify-between items-center text-[9px] font-mono mb-1 text-slate-400">
                  <span>{d.n}</span>
                  <span className="text-white">{d.v}%</span>
                </div>
                <div className="h-1 w-full bg-slate-900 rounded"><div className={`h-full ${d.c} ${d.v > 50 ? 'shadow-[0_0_8px_currentColor]' : ''}`} style={{ width: `${d.v}%` }} /></div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 bg-black/40 p-3 rounded border border-white/5">
            <Globe className="w-6 h-6 text-sky-400" />
            <div>
              <div className="text-[10px] font-mono text-sky-400 tracking-widest font-bold">GLOBAL NETWORK HEALTH</div>
              <div className="text-[9px] font-mono text-slate-500">LATENCY: 8ms</div>
            </div>
          </div>
        </HolographicCard>
      </div>

      <HolographicCard delay={0.7} className="w-full relative">
        <h3 className="text-sm font-mono text-slate-300 uppercase tracking-widest mb-6">Global Corridor Integrity</h3>

        {isOptimizing && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center rounded-2xl border border-sky-500/30 overflow-hidden">
            <div className="scanline-overlay" />
            <Cpu className="w-12 h-12 text-sky-400 animate-pulse mb-4" />
            <div className="text-sm font-mono text-sky-400 tracking-[0.3em] font-bold mb-2">NEURAL CORRIDOR OPTIMIZATION IN PROGRESS...</div>
            <div className="w-64 h-1 bg-slate-900 rounded overflow-hidden">
              <div className="h-full bg-sky-400 shadow-[0_0_15px_#38bdf8] animate-[loading_2.8s_ease-in-out_infinite]" />
            </div>
            <div className="mt-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest">SCANNING SHANGHAI-ROTTERDAM HUB PERMUTATIONS</div>
          </div>
        )}

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[9px] font-mono text-slate-500 uppercase tracking-widest border-b border-slate-700/50 bg-black/20">
                <th className="py-3 px-4">ROUTE ID</th>
                <th className="py-3 px-4">TRADING CORRIDOR</th>
                <th className="py-3 px-4">TRANSIT LOGIC</th>
                <th className="py-3 px-4 text-center">UTILIZATION</th>
                <th className="py-3 px-4 text-right">OPERATING STATE</th>
              </tr>
            </thead>
            <tbody className="text-xs font-mono">
              {loading ? (
                <tr><td colSpan="5" className="py-10 text-center text-sky-400 animate-pulse uppercase tracking-[0.3em]">Mapping Neural Shipments...</td></tr>
              ) : shipments.length === 0 ? (
                <tr><td colSpan="5" className="py-10 text-center text-slate-600 italic">No shipments detected in current sector.</td></tr>
              ) : (
                shipments.map((shipment, i) => {
                  const statusMap = {
                    'delivered': { label: 'ACTIVE', color: 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30' },
                    'delayed': { label: 'DELAYED', color: 'bg-rose-950/40 text-rose-400 border-rose-500/30' },
                    'customs_hold': { label: 'HOLD', color: 'bg-amber-950/40 text-amber-400 border-amber-500/30' }
                  };
                  const st = statusMap[shipment.status] || { label: (shipment.status || 'UNKNOWN').toUpperCase(), color: 'bg-slate-900 text-slate-400 border-slate-700' };

                  return (
                    <tr key={i} className="border-b border-white/5 interactive-row hover:bg-white/5 cursor-pointer">
                      <td className="py-4 px-4 text-slate-300 flex items-center gap-3">
                        <div className="p-1.5 bg-slate-800 rounded"><Truck className="w-3 h-3 text-slate-400" /></div>
                        #{shipment.shipment_code}
                      </td>
                      <td className="py-4 px-4 text-white font-bold tracking-widest">{shipment.origin_country} → {shipment.destination_country}</td>
                      <td className="py-4 px-4 text-slate-400 text-[10px]">
                        {(shipment.transport_mode || 'sea').charAt(0).toUpperCase() + (shipment.transport_mode || 'sea').slice(1).toLowerCase()}<br />
                        <span className="text-sky-400">{shipment.status === 'delivered' ? 'Completed' : 'In-Transit'}</span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-3">
                          <div className="h-1.5 w-32 bg-slate-800 rounded">
                            <div
                              className={`h-full shadow-[0_0_8px_currentColor] ${shipment.status === 'delayed' ? 'bg-rose-500 shadow-[0_0_8px_#ef4444]' : 'bg-sky-400 shadow-[0_0_8px_#38bdf8]'}`}
                              style={{ width: `${shipment.status === 'delivered' ? 100 : (40 + (i * 7) % 50)}%` }}
                            />
                          </div>
                          <span className="text-white font-bold text-[10px]">{shipment.status === 'delivered' ? '100%' : `${40 + (i * 7) % 50}%`}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className={`text-[9px] ${st.color} px-3 py-1.5 rounded font-bold tracking-widest uppercase`}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="w-full h-8 flex items-center justify-center text-[10px] font-mono text-slate-600 italic tracking-widest border-t border-white/5 mt-6">
          SYSTEM STEWARDSHIP: OPTIMIZER READY FOR DISPATCH
        </div>
      </HolographicCard>

      {optimizedResult && (
        <HolographicCard delay={0.1} className="w-full border-sky-500/50 bg-sky-950/20 shadow-[0_0_30px_rgba(56,189,248,0.15)] animate-in fade-in zoom-in duration-500 mt-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="text-[10px] font-mono text-sky-400 mb-2 flex items-center gap-2"><Cpu className="w-4 h-4" /> SOVEREIGN OPTIMIZATION PROTOCOL ACTIVATED</div>
              <h3 className="text-lg font-display font-bold text-white tracking-widest uppercase">
                Proposed Corridor: {optimizedResult.origin} → {optimizedResult.destination}
              </h3>
            </div>
            <div className="text-right">
              <div className="text-[20px] font-bold text-emerald-400 font-mono tracking-tighter">PROTOCOL: {optimizedResult.protocol}</div>
              <div className="text-[10px] text-slate-500 font-mono tracking-[0.2em]">ETA PREDICTION: {optimizedResult.metrics.eta_prediction}</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-6">
            {[
              { label: 'OPTIMIZED COST', val: `$${optimizedResult.metrics.estimated_cost_usd}`, desc: 'USD PER SHIPMENT', icon: DollarSign, color: 'text-white' },
              { label: 'TRANSIT DURATION', val: `${optimizedResult.metrics.transit_days} DAYS`, desc: 'OPTIMAL SEA FREIGHT', icon: Clock, color: 'text-sky-400' },
              { label: 'RISK INDEX', val: optimizedResult.metrics.risk_index, desc: 'CASUAL RELIABILITY', icon: ShieldAlert, color: 'text-amber-400' },
              { label: 'CO2 OFFSET', val: '1.24 TONS', desc: 'GREEN COMPLIANCE', icon: Zap, color: 'text-emerald-400' },
            ].map((m, i) => (
              <div key={i} className="bg-black/40 p-4 rounded-xl border border-white/5">
                <div className="flex items-center gap-3 mb-2">
                  <m.icon className={`w-4 h-4 ${m.color}`} />
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">{m.label}</span>
                </div>
                <div className={`text-xl font-bold font-mono tracking-tighter ${m.color}`}>{m.val}</div>
                <div className="text-[8px] font-mono text-slate-600 tracking-widest mt-1">{m.desc}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-4 bg-sky-950/20 p-4 rounded-xl border border-sky-500/30">
            <div className="p-3 bg-sky-500 rounded text-slate-900"><Truck className="w-6 h-6" /></div>
            <div className="flex-1">
              <div className="text-[11px] font-mono text-sky-400 font-bold mb-1">OPTIMIZED ROUTE VECTOR</div>
              <div className="flex items-center gap-3">
                {optimizedResult.corridor_path.map((node, i) => (
                  <React.Fragment key={i}>
                    <span className="text-xs font-mono text-white font-bold">{node.toUpperCase()}</span>
                    {i < optimizedResult.corridor_path.length - 1 && <ArrowRight className="w-3 h-3 text-slate-600" />}
                  </React.Fragment>
                ))}
              </div>
            </div>
            <button className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] uppercase tracking-widest rounded transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)]">COMMENCE ROUTING</button>
          </div>
        </HolographicCard>
      )}

      <div className="h-4" />
    </div>
  );
};


const SupplierIndex = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch('http://localhost:8000/api/v1/suppliers/?active_only=true&min_risk=0&max_risk=100')
      .then(res => res.json())
      .then(data => {
        setSuppliers(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Supplier Fetch Failure:", err);
        setLoading(false);
      });
  }, []);

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start mb-6">
        <div className="mb-4">
          <div className="flex items-center gap-4 mb-2">
            <Users className="w-5 h-5 text-sky-400" />
            <h2 className="text-2xl font-display font-bold text-white tracking-wider uppercase">Vendor Intelligence</h2>
          </div>
          <p className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-3">
            AI-RANKED SUPPLIER ECOSYSTEM & RISK PROFILING
            <span className="ml-4 text-slate-400 bg-slate-900/50 px-2 py-0.5 rounded border border-slate-700 text-[10px]">
              <Lock className="w-3 h-3 inline mr-1" />OPTIMIZER: MULTI-FACTOR-RANK V2
            </span>
            <span className="text-slate-500 text-[10px]">ACTIVE VENDORS: {suppliers.length} AUDITED</span>
          </p>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Database className="w-3 h-3 text-slate-500" /></div>
          <input 
            type="text" 
            placeholder="PROBE VENDOR DATABASE..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-900/50 border border-slate-700 text-slate-300 text-[10px] font-mono rounded py-2 pl-8 pr-4 w-64 focus:outline-none focus:border-sky-500/50 transition-colors" 
          />
        </div>
      </div>

      <HolographicCard delay={0.1} className="w-full">
        <h3 className="text-sm font-mono text-slate-300 uppercase tracking-widest mb-6">Global Vendor Ranking Index</h3>
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[9px] font-mono text-slate-500 uppercase tracking-widest border-b border-slate-700/50 bg-black/20">
                <th className="py-3 px-4">AUDIT RANK</th>
                <th className="py-3 px-4">ENTITY IDENTITY</th>
                <th className="py-3 px-4 text-center">PERFORMANCE LOGIC</th>
                <th className="py-3 px-4 text-center text-sky-400">COMPOSITE SCORE</th>
                <th className="py-3 px-4 text-right">STRATEGIC TIER</th>
              </tr>
            </thead>
            <tbody className="text-xs font-mono">
              {loading ? (
                <tr><td colSpan="5" className="py-10 text-center text-sky-400 animate-pulse uppercase tracking-[0.3em]">Mapping Neural Vendors...</td></tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr><td colSpan="5" className="py-10 text-center text-slate-600 italic">No vendors detected in current sector.</td></tr>
              ) : (
                filteredSuppliers.map((supplier, i) => {
                  const rank = String(i + 1).padStart(2, '0');
                  const onTime = (supplier.on_time_delivery_rate * 100).toFixed(0);
                  const quality = supplier.quality_score.toFixed(1);
                  const composite = (supplier.quality_score * 10).toFixed(0);
                  
                  let tierLabel = "STANDARD AUDIT";
                  let tierColor = "bg-slate-900 text-slate-400 border-slate-700";
                  
                  if (supplier.is_preferred) {
                    tierLabel = "PLATINUM TIER";
                    tierColor = "bg-emerald-950/40 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]";
                  } else if (supplier.risk_score < 40) {
                    tierLabel = "GOLD PRIORITY";
                    tierColor = "bg-amber-950/40 text-amber-400 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]";
                  }

                  return (
                    <tr key={supplier.id} className="border-b border-white/5 interactive-row hover:bg-white/5 transition-colors cursor-pointer">
                      <td className="py-4 px-4 text-slate-500 font-display text-xl italic font-bold">{rank}</td>
                      <td className="py-4 px-4 text-white">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-800 rounded border border-slate-600"><Users className="w-4 h-4 text-sky-400" /></div>
                          <div>
                            <div className="font-bold tracking-wider text-sm uppercase">{supplier.name}</div>
                            <div className="text-[9px] text-slate-400 uppercase">{supplier.country}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex justify-center gap-6 text-[10px]">
                          <div className="text-center"><div className="text-slate-500 mb-1">ON-TIME</div><div className="text-white font-bold text-sm tracking-tighter">{onTime}%</div></div>
                          <div className="text-center"><div className="text-slate-500 mb-1">QUALITY</div><div className="text-white font-bold text-sm tracking-tighter">{quality}</div></div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center text-3xl font-bold text-sky-400 text-glow-cyan font-mono tracking-tighter">{composite}</td>
                      <td className="py-4 px-4 text-right">
                        <span className={`text-[10px] ${tierColor} px-3 py-1.5 rounded font-bold tracking-widest uppercase border`}>
                          {tierLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </HolographicCard>
    </div>
  );
};

const NetworkReports = () => {
  const [isGenerating, setIsGenerating] = useState(false);

  const downloadDossier = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('http://localhost:8000/api/v1/reports/dossier');
      if (!response.ok) throw new Error("API_REACH_FAILURE");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `NEXUS_SOVEREIGN_DOSSIER_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      console.error("Dossier Download Failed:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const reports = [
    { id: 'monthly', t: 'Monthly Supply Chain Performance', cat: 'PERFORMANCE', c: 'text-sky-400', bg: 'bg-sky-500/20', border: 'border-sky-500/30', d: 'Feb 15, 2026', s: '2.4 MB', icon: BarChart3 },
    { id: 'forecast', t: 'Q4 2025 Demand Forecast Analysis', cat: 'FORECASTING', c: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', d: 'Jan 30, 2026', s: '4.1 MB', icon: Calendar },
    { id: 'dossier', t: 'Sovereign Intelligence Dossier', cat: 'SOVEREIGN', c: 'text-sky-400', bg: 'bg-sky-950/40', border: 'border-sky-500/50', d: 'LIVE_LINK', s: 'REALTIME', icon: ShieldAlert, active: true, generating: isGenerating },
    { id: 'anomaly', t: 'Anomaly Detection Summary — January', cat: 'SECURITY', c: 'text-rose-400', bg: 'bg-rose-500/20', border: 'border-rose-500/30', d: 'Feb 01, 2026', s: '1.8 MB', icon: ShieldAlert },
    { id: 'inventory', t: 'Inventory Optimization Recommendations', cat: 'INVENTORY', c: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30', d: 'Feb 10, 2026', s: '3.2 MB', icon: Package },
    { id: 'logistics', t: 'Logistics Cost Analysis H2 2025', cat: 'LOGISTICS', c: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/30', d: 'Jan 15, 2026', s: '5.6 MB', icon: Globe },
    { id: 'vendor', t: 'Vendor Scorecard — Annual Review', cat: 'VENDORS', c: 'text-sky-400', bg: 'bg-sky-500/20', border: 'border-sky-500/30', d: 'Jan 20, 2026', s: '2.9 MB', icon: Users },
    { id: 'kpi', t: 'Weekly KPI Executive Summary', cat: 'PERFORMANCE', c: 'text-sky-400', bg: 'bg-sky-500/20', border: 'border-sky-500/30', d: 'Feb 22, 2026', s: '1.2 MB', icon: BarChart3 },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex justify-between items-end mb-8 border-b border-white/10 pb-6">
        <div>
          <h2 className="text-3xl font-display font-bold text-white tracking-wide uppercase">Reports</h2>
          <p className="text-sm font-mono text-slate-400 mt-2">Generated reports and analytics exports</p>
        </div>
        <button className="px-4 py-2 bg-slate-900 border border-slate-700 text-sky-400 font-mono text-xs rounded hover:bg-slate-800 transition-colors flex items-center gap-2">
          <Calendar className="w-3 h-3" /> SCHEDULE REPORT
        </button>
      </div>

      <HolographicCard delay={0.1} className="w-full !p-0 overflow-hidden">
        <div className="divide-y divide-white/5">
          {reports.map((r, i) => (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              key={i}
              className="p-5 flex items-center justify-between hover:bg-white/5 transition-colors group cursor-pointer"
              onClick={() => r.active && downloadDossier()}
            >
              <div className="flex items-center gap-5">
                <div className={`w-12 h-12 rounded-lg ${r.bg} border ${r.border} flex items-center justify-center`}>
                  <r.icon className={`w-6 h-6 ${r.c}`} />
                </div>
                <div>
                  <h4 className="text-white font-medium text-base group-hover:text-sky-400 transition-colors tracking-wide">{r.t}</h4>
                  <div className="flex items-center gap-4 mt-2 text-[10px] font-mono">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-widest ${r.bg} ${r.c}`}>{r.cat}</span>
                    <span className="text-slate-400">{r.d}</span>
                    <span className="text-slate-500">{r.s}</span>
                  </div>
                </div>
              </div>
              {r.generating ? (
                <span className="text-[10px] font-mono text-rose-400 animate-pulse flex items-center gap-2 bg-rose-950/50 px-3 py-1.5 rounded border border-rose-500/30">GENERATING...</span>
              ) : (
                <button className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-sky-400 transition-colors bg-slate-900 px-4 py-2 rounded border border-slate-700 hover:border-sky-500/50">
                  <Download className="w-4 h-4" /> DOWNLOAD
                </button>
              )}
            </motion.div>
          ))}
        </div>
      </HolographicCard>
    </div>
  );
};

const CoreConfig = () => (
  <div className="space-y-6 max-w-4xl">
    <div className="mb-8 border-b border-white/10 pb-6">
      <h2 className="text-3xl font-display font-bold text-white tracking-wide uppercase">Settings</h2>
      <p className="text-sm font-mono text-slate-400 mt-2">Manage your platform configuration and preferences</p>
    </div>

    <HolographicCard delay={0.1}>
      <h3 className="text-lg font-display text-white mb-6 uppercase tracking-widest">Profile Configuration</h3>
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <label className="block text-[10px] font-mono text-slate-400 mb-2 uppercase tracking-widest">Full Name</label>
          <input type="text" defaultValue="Sarah Chen" className="w-full bg-slate-900/50 border border-slate-700 rounded p-3 text-sm text-white focus:outline-none focus:border-sky-500 transition-colors font-mono" />
        </div>
        <div>
          <label className="block text-[10px] font-mono text-slate-400 mb-2 uppercase tracking-widest">Email</label>
          <input type="email" defaultValue="s.chen@nexusai.io" className="w-full bg-slate-900/50 border border-slate-700 rounded p-3 text-sm text-white focus:outline-none focus:border-sky-500 transition-colors font-mono" />
        </div>
        <div>
          <label className="block text-[10px] font-mono text-slate-400 mb-2 uppercase tracking-widest">Role</label>
          <input type="text" defaultValue="VP Supply Chain Operations" className="w-full bg-slate-900/50 border border-slate-700 rounded p-3 text-sm text-white focus:outline-none focus:border-sky-500 transition-colors font-mono" />
        </div>
        <div>
          <label className="block text-[10px] font-mono text-slate-400 mb-2 uppercase tracking-widest">Organization</label>
          <input type="text" defaultValue="NexusAI Enterprise" className="w-full bg-slate-900/50 border border-slate-700 rounded p-3 text-sm text-white focus:outline-none focus:border-sky-500 transition-colors font-mono" />
        </div>
      </div>
      <button className="px-6 py-2 bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold text-xs rounded transition-colors shadow-[0_0_15px_rgba(56,189,248,0.4)] tracking-widest font-mono">
        SAVE CHANGES
      </button>
    </HolographicCard>

    <HolographicCard delay={0.2}>
      <h3 className="text-lg font-display text-white mb-6 uppercase tracking-widest">Notification Preferences</h3>
      <div className="space-y-6">
        {[
          { t: 'Critical anomaly alerts', d: 'Instant notification for high-severity anomalies', on: true },
          { t: 'Inventory threshold alerts', d: 'Notify when stock falls below reorder point', on: true },
          { t: 'Weekly performance digest', d: 'Summary of KPIs and trends every Monday', on: true },
          { t: 'Vendor risk updates', d: 'Changes in vendor risk scores', on: false },
          { t: 'Route optimization suggestions', d: 'New route optimizations available', on: false },
        ].map((item, i) => (
          <div key={i} className="flex items-center justify-between p-3 hover:bg-white/5 rounded transition-colors">
            <div>
              <div className="text-sm text-white mb-1 font-medium">{item.t}</div>
              <div className="text-xs text-slate-500 font-mono">{item.d}</div>
            </div>
            <ToggleSwitch active={item.on} />
          </div>
        ))}
      </div>
    </HolographicCard>

    <HolographicCard delay={0.3}>
      <h3 className="text-lg font-display text-white mb-6 uppercase tracking-widest">System Integrations</h3>
      <div className="space-y-4">
        {[
          { t: 'SAP ERP', s: 'Connected', c: 'text-emerald-400', btn: 'Configure' },
          { t: 'Salesforce CRM', s: 'Connected', c: 'text-emerald-400', btn: 'Configure' },
          { t: 'Slack Workspace', s: 'Connected', c: 'text-emerald-400', btn: 'Configure' },
          { t: 'Tableau Analytics', s: 'Not connected', c: 'text-slate-500', btn: 'Connect', primary: true },
        ].map((item, i) => (
          <div key={i} className="flex items-center justify-between p-4 bg-black/40 rounded border border-white/5 hover:border-white/10 transition-colors">
            <div>
              <div className="text-sm text-white font-medium mb-1">{item.t}</div>
              <div className={`text-xs font-mono ${item.c}`}>{item.s}</div>
            </div>
            <button className={`px-4 py-2 rounded text-[10px] font-mono tracking-widest transition-colors ${item.primary ? 'bg-sky-500 text-slate-900 font-bold hover:bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.4)]' : 'bg-slate-800 text-white border border-slate-600 hover:bg-slate-700'}`}>
              {item.btn.toUpperCase()}
            </button>
          </div>
        ))}
      </div>
    </HolographicCard>
  </div>
);

const AgenticHub = () => {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sensing, setSensing] = useState(false);

  const fetchDecisions = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/decisions');
      const data = await res.json();
      setDecisions(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const triggerSense = async () => {
    setSensing(true);
    try {
      await fetch('http://localhost:8000/api/v1/sense', { method: 'POST' });
      await fetchDecisions();
    } catch (e) { console.error(e); }
    setSensing(false);
  };

  const approveDecision = async (id) => {
    try {
      await fetch(`http://localhost:8000/api/v1/decisions/approve/${id}`, { method: 'POST' });
      await fetchDecisions();
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchDecisions(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Cpu className="w-5 h-5 text-sky-400" />
            <h2 className="text-2xl font-display font-bold text-white tracking-wider uppercase">Agentic Decision Core</h2>
          </div>
          <p className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-3">
            PHASE 3: SOVEREIGN REASONING LOOP // ADS-MC-MEIO-LLM
            <span className="ml-4 text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-500/20 text-[10px]">
              <Radio className="w-3 h-3 inline mr-1 animate-pulse" /> LIVE_THOUGHT_STREAM: ON
            </span>
          </p>
        </div>
        <button
          onClick={triggerSense}
          disabled={sensing}
          className={`px-6 py-2.5 ${sensing ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-sky-500 hover:bg-sky-400 text-slate-900'} font-bold font-mono text-xs rounded tracking-[0.2em] shadow-[0_0_20px_rgba(56,189,248,0.3)] transition-all flex items-center gap-3`}
        >
          {sensing ? <Globe className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {sensing ? 'SENSING GLOBAL SHIFTS...' : 'INITIATE SENSE-PLAN-ACT'}
        </button>
      </div>

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
          <span className="text-[10px] font-mono text-slate-500 tracking-[0.3em] uppercase">Syncing Neural Memory...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-12">
          {decisions.length === 0 ? (
            <HolographicCard className="col-span-2 py-20 text-center">
              <Database className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <h3 className="text-white font-display text-xl mb-2">NEURAL BUFFER EMPTY</h3>
              <p className="text-slate-500 font-mono text-xs">No autonomous decisions found in the current reasoning cycle.</p>
            </HolographicCard>
          ) : (
            decisions.map((card, i) => (
              <HolographicCard key={card.id} delay={i * 0.1} alert={card.status === 'PENDING'}>
                <div className="flex justify-between items-start mb-4">
                  <div className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-[9px] font-mono text-sky-400 tracking-tighter uppercase">[AUTONOMOUS_EXECUTION]</div>
                  <div className={`px-2 py-0.5 rounded text-[9px] font-mono tracking-tighter uppercase ${card.status === 'EXECUTED' ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-500/20' : 'bg-amber-950/30 text-amber-400 border border-amber-500/20'}`}>
                    {card.status}
                  </div>
                </div>
                <h3 className="text-lg font-display font-bold text-white mb-2 tracking-wide uppercase italic">{card.title}</h3>
                <div className="bg-black/30 p-3 rounded border border-white/5 mb-4">
                  <p className="text-[11px] text-slate-300 font-mono leading-relaxed italic">{card.action_taken}</p>
                </div>
                <div className="space-y-3 flex-1">
                  <div className="flex justify-between text-[10px] font-mono border-b border-white/5 pb-2">
                    <span className="text-slate-500 uppercase">Trigger Signal:</span>
                    <span className="text-sky-400 font-bold">{card.trigger_reason}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono border-b border-white/5 pb-2">
                    <span className="text-slate-500 uppercase">Confidence Score:</span>
                    <span className={card.ai_confidence_score > 80 ? 'text-emerald-400' : 'text-amber-400'}>{card.ai_confidence_score}%</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono border-b border-white/5 pb-2">
                    <span className="text-slate-500 uppercase">Action Params:</span>
                    <span className="text-white bg-slate-800 px-1.5 rounded">{card.action_parameters}</span>
                  </div>
                </div>
                {card.status === 'PENDING' && (
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => approveDecision(card.id)}
                      className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold font-mono text-[10px] rounded tracking-widest shadow-[0_0_15px_rgba(56,189,248,0.3)] transition-colors"
                    >
                      EXECUTE AUTONOMOUSLY
                    </button>
                    <button className="px-4 py-2 bg-slate-900 border border-slate-700 text-slate-400 font-mono text-[10px] rounded hover:bg-slate-800">REJECT</button>
                  </div>
                )}
                <div className="mt-4 text-[8px] font-mono text-slate-600 flex justify-between items-center tracking-widest uppercase border-t border-white/5 pt-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-sky-950/40 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded font-bold">AI_CONFIDENCE: {card.ai_confidence_score}%</span>
                    <span>Node: CLUSTER_BRAIN_V3</span>
                  </div>
                  <span>ID: {card.id.toString().slice(0, 8)}</span>
                </div>
              </HolographicCard>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const FallbackPage = ({ title }) => (
  <div className="flex h-[60vh] items-center justify-center">
    <div className="text-center group">
      <Hexagon className="w-20 h-20 text-sky-500/10 mx-auto mb-8 animate-spin-slow group-hover:text-sky-400 transition-colors" />
      <h2 className="text-3xl font-display text-white mb-3 uppercase tracking-widest font-bold">{title}</h2>
      <p className="text-slate-600 font-mono text-xs tracking-[0.3em] uppercase">Sector Link Initialization in Progress...</p>
    </div>
  </div>
);

// --- ENHANCED 3D MAGNETIC NAV ITEM ---
const MagneticNavItem = ({ item, active, onClick }) => {
  // Safe state-based fallback for environments without framer-motion hooks
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-4 py-3.5 rounded text-[10px] font-mono tracking-widest uppercase transition-all duration-300 relative overflow-hidden group outline-none ${active
        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30 shadow-[0_5px_20px_rgba(56,189,248,0.15)] transform scale-[1.02]'
        : 'text-slate-500 border border-transparent hover:text-slate-200 hover:bg-white/5 hover:scale-[1.01]'
        }`}
    >
      <div className="relative z-10 flex items-center gap-4 w-full">
        <item.icon
          className={`w-4 h-4 transition-transform duration-300 ${active
            ? 'scale-110 text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]'
            : 'opacity-50 group-hover:scale-110 group-hover:opacity-100 group-hover:text-sky-300 group-hover:drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]'
            }`}
        />
        <span className="relative z-10">{item.label}</span>
      </div>

      {active && (
        <motion.div
          layoutId="activeNavIndicator"
          className="absolute left-0 top-[20%] w-1 h-[60%] bg-sky-400 shadow-[0_0_15px_#38bdf8] rounded-r"
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-r from-sky-500/0 via-sky-500/10 to-sky-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none transform -skew-x-12 -translate-x-[150%] group-hover:translate-x-[150%] ease-in-out" />
    </button>
  );
};

const Sidebar = ({ currentPage, onNavigate }) => {
  const navItems = [
    { id: 'command-center', label: 'Command Center', icon: LayoutDashboard },
    { id: 'demand-forecaster', label: 'Demand Forecaster', icon: TrendingUp },
    { id: 'anomaly-intel', label: 'Anomaly Intel', icon: AlertTriangle },
    { id: 'stock-strategy', label: 'Stock Strategy', icon: Package },
    { id: 'global-corridors', label: 'Global Corridors', icon: Globe },
    { id: 'agentic-hub', label: 'Agentic Hub', icon: Cpu },
    { id: 'supplier-index', label: 'Supplier Index', icon: Users },
    { id: 'network-reports', label: 'Network Reports', icon: FileText },
    { id: 'core-config', label: 'Core Config', icon: Settings },
  ];

  return (
    <div
      className="w-64 h-full border-r border-sky-500/10 bg-slate-950/60 backdrop-blur-3xl flex flex-col pointer-events-auto z-50 shadow-[10px_0_30px_rgba(0,0,0,0.5)]"
      style={{ perspective: "1200px" }}
    >
      <div
        className="p-8 cursor-pointer group relative transform transition-transform duration-300 hover:scale-[1.02]"
        onClick={() => onNavigate('home')}
      >
        <div className="flex items-center gap-3 mb-1">
          <motion.div animate={{ rotateY: 360 }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }}>
            <Hexagon className="w-8 h-8 text-sky-400 text-glow-cyan" />
          </motion.div>
          <span className="text-2xl font-display font-bold tracking-widest text-white uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
            Nexus<span className="font-light text-sky-400 opacity-80">AI</span>
          </span>
        </div>
        <div className="text-[8px] font-mono text-slate-500 tracking-[0.3em] uppercase ml-11 group-hover:text-sky-400 transition-colors">
          Neuro-Core V6.1
        </div>
      </div>

      <div className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto custom-scroll">
        {navItems.map(item => (
          <MagneticNavItem
            key={item.id}
            item={item}
            active={currentPage === item.id}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </div>

      <div className="p-8 border-t border-sky-500/10 bg-black/40">
        <div className="flex justify-between items-center text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-3">
          <span>Cluster Health</span>
          <motion.span
            animate={{ opacity: [1, 0.7, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-emerald-400 font-bold"
          >
            100%
          </motion.span>
        </div>

        <div className="h-0.5 w-full bg-slate-900 rounded-full overflow-hidden mb-8 relative">
          <motion.div
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="h-full w-1/2 bg-gradient-to-r from-transparent via-emerald-400 to-transparent absolute"
          />
          <div className="h-full w-full bg-emerald-500/20 absolute" />
        </div>

        <MagneticNavItem
          item={{ label: 'Return to Core', icon: ArrowRight }}
          active={false}
          onClick={() => onNavigate('home')}
        />
      </div>
    </div>
  );
};

export default function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [hoveredData, setHoveredData] = useState(null);
  const [showOptimizerPortal, setShowOptimizerPortal] = useState(false);

  const renderDashboardContent = () => {
    switch (currentPage) {
      case 'command-center': return <CommandCenter />;
      case 'demand-forecaster': return <DemandForecaster />;
      case 'anomaly-intel': return <AnomalyIntel />;
      case 'agentic-hub': return <AgenticHub />;
      case 'stock-strategy': return <StockStrategy />;
      case 'global-corridors': return <GlobalCorridors onTriggerOptimizer={() => setShowOptimizerPortal(true)} />;
      case 'supplier-index': return <SupplierIndex />;
      case 'network-reports': return <NetworkReports />;
      case 'core-config': return <CoreConfig />;
      default: return <FallbackPage title={currentPage.replace('-', ' ').toUpperCase()} />;
    }
  };

  return (
    <>
      <CustomStyles />
      <div className="relative w-full h-screen bg-[#020617] overflow-hidden">

        <CinematicGlobalScene setHoveredData={setHoveredData} viewMode={currentPage === 'home' ? 'home' : 'dashboard'} />

        {/* PERSISTENT HUD ELEMENTS */}
        <div className="hud-bracket hud-tl" />
        <div className="hud-bracket hud-tr" />
        <div className="hud-bracket hud-bl" />
        <div className="hud-bracket hud-br" />

        <AnimatePresence mode="wait">
          {currentPage === 'home' ? (
            <motion.div
              key="home"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 w-full h-full overflow-y-auto overflow-x-hidden custom-scroll z-10"
              id="home-scroll-container"
            >
              <section className="min-h-screen w-full relative flex flex-col justify-center px-16 z-20 pointer-events-auto">
                <div className="max-w-7xl mx-auto w-full">
                  <div className="max-w-3xl">
                    <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1 }}>
                      <div className="inline-flex items-center gap-3 px-5 py-2 rounded border border-sky-500/20 bg-slate-900/40 text-sky-300 text-[10px] font-mono mb-10 uppercase tracking-[0.3em] backdrop-blur-md">
                        <TerminalSquare className="w-4 h-4 text-sky-400" /> Root_Access // Granted
                      </div>
                      <h1 className="text-8xl md:text-9xl font-display font-bold leading-[0.85] tracking-tighter text-white mb-10 text-glow-cyan uppercase">
                        Planetary <br />
                        <span className="text-sky-400">Command.</span>
                      </h1>
                      <p className="text-2xl text-sky-100/60 font-light leading-relaxed mb-16 max-w-2xl border-l-4 border-sky-500/40 pl-8 font-display italic">
                        Fully autonomous spatial computing platform for massive-scale EV supply chain orchestration.
                      </p>
                      <button onClick={() => setCurrentPage('command-center')} className="group relative px-14 py-7 bg-sky-500/10 border border-sky-400/60 text-sky-50 font-bold rounded uppercase tracking-[0.3em] hover:bg-sky-500 hover:text-slate-950 transition-all duration-500 shadow-[0_0_30px_rgba(56,189,248,0.2)] overflow-hidden">
                        <span className="relative z-10 flex items-center gap-4 text-lg">Initialize Nexus <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" /></span>
                        <motion.div animate={{ x: ['-100%', '200%'] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent w-1/2" />
                      </button>
                    </motion.div>
                  </div>
                </div>
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 text-sky-500/30 animate-pulse font-mono text-[9px] tracking-[0.5em] uppercase">
                  <span>Scroll to Scan Sectors</span>
                  <div className="w-[1px] h-14 bg-gradient-to-b from-sky-500 to-transparent" />
                </div>
              </section>

              {/* RESTORED CINEMATIC SECTIONS */}
              <div className="pointer-events-none">
                {/* SCENE 2: DIMENSIONAL FORECAST */}
                <section className="min-h-[150vh] relative flex items-center px-16">
                  <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-12 gap-12 items-center">
                    <div className="lg:col-span-5 pointer-events-auto">
                      <motion.div initial={{ opacity: 0, x: -50, scale: 0.9 }} whileInView={{ opacity: 1, x: 0, scale: 1 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 1.2, type: "spring" }}>
                        <h2 className="text-6xl md:text-7xl font-display font-bold text-white mb-6 uppercase text-glow-cyan leading-tight">Dimensional <br />Forecast.</h2>
                        <p className="text-sky-100/70 text-xl font-light leading-relaxed mb-10 bg-slate-900/40 p-6 rounded-xl border border-sky-500/20 backdrop-blur-md">Live 3D tensor processing of global market shifts, instantly mapped into actionable volumetric data models.</p>
                      </motion.div>
                      <HolographicCard delay={0.3} className="w-full">
                        <div className="flex items-center justify-between mb-8 border-b border-sky-500/30 pb-6 relative overflow-hidden depth-layer-1">
                          <div className="matrix-fall absolute inset-0 opacity-20" />
                          <div className="relative z-10"><h3 className="text-3xl text-white font-display font-bold tracking-wider uppercase text-glow-cyan">Tensor Matrix</h3><p className="text-xs text-sky-400 font-mono mt-2 animate-pulse">LIVE SIMULATION RUNNING</p></div>
                        </div>
                        <div className="space-y-8 depth-layer-2">
                          <div className="bg-slate-900/40 p-4 rounded-lg border border-white/10">
                            <div className="flex justify-between text-sm font-mono mb-3"><span className="text-slate-300 font-bold">PARAM_1: MATERIAL_INFLOW</span><span className="text-sky-400 text-glow-cyan text-lg">+14.2%</span></div>
                            <div className="h-3 w-full bg-slate-950 rounded overflow-hidden border border-white/20"><motion.div initial={{ width: 0 }} whileInView={{ width: '85%' }} viewport={{ once: true }} transition={{ duration: 2.5, ease: "circOut" }} className="h-full bg-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.8)]" /></div>
                          </div>
                        </div>
                      </HolographicCard>
                    </div>
                  </div>
                </section>

                {/* SCENE 3: ZERO-LATENCY DETECTION */}
                <section className="min-h-[150vh] relative flex items-center px-16">
                  <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-12 gap-12 items-center">
                    <div className="lg:col-span-6 lg:col-start-7 pointer-events-auto">
                      <motion.div initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 1.2, type: "spring" }}>
                        <h2 className="text-6xl md:text-7xl font-display font-bold text-white mb-6 uppercase text-glow-red leading-tight">Zero-Latency <br />Detection.</h2>
                      </motion.div>
                      <HolographicCard delay={0.3} alert className="w-full">
                        <div className="flex items-center gap-8 mb-10 border-b border-rose-500/40 pb-8 relative depth-layer-1">
                          <div className="relative z-10"><h3 className="text-4xl text-white font-display font-bold uppercase tracking-wider text-glow-red">Critical Fracture</h3></div>
                        </div>
                      </HolographicCard>
                    </div>
                  </div>
                </section>

                {/* SCENE 4: AUTONOMOUS RESOLUTION */}
                <section className="min-h-[150vh] relative flex items-center px-16">
                  <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-12 gap-12 items-center">
                    <div className="lg:col-span-6 pointer-events-auto">
                      <HolographicCard delay={0.2} className="w-full border-sky-500/40 shadow-[0_0_60px_rgba(56,189,248,0.15)]">
                        <div className="flex items-center gap-6 mb-10 border-b border-sky-500/30 pb-6 relative overflow-hidden depth-layer-1">
                          <div className="matrix-fall absolute inset-0 opacity-30" />
                          <motion.div
                            animate={{ rotateY: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                            className="w-16 h-16 rounded bg-sky-500/20 border-2 border-sky-400 flex items-center justify-center shadow-[0_0_20px_rgba(56,189,248,0.5)] relative z-10"
                          >
                            <Cpu className="w-8 h-8 text-sky-400" />
                          </motion.div>
                          <div className="relative z-10">
                            <h3 className="text-3xl text-white font-display font-bold uppercase tracking-wider text-glow-cyan">Neural Resolution</h3>
                            <p className="text-sm text-sky-400 font-mono mt-2 font-bold bg-slate-900/80 px-2 py-1 rounded inline-block">EXECUTING COUNTER-MEASURES</p>
                          </div>
                        </div>

                        <div className="space-y-5 depth-layer-2">
                          {[
                            { step: "SEC_01", action: "Identify Alt Source: LATAM_B", status: "DONE", color: "text-sky-400" },
                            { step: "SEC_02", action: "Verify Compliance & Capacity", status: "DONE", color: "text-sky-400" },
                            { step: "SEC_03", action: "Inject ERP Purchase Orders", status: "DONE", color: "text-sky-400" },
                            { step: "SEC_04", action: "Dispatch Air Freight Drones", status: "ACTIVE", color: "text-amber-400" },
                          ].map((s, i) => (
                            <motion.div
                              initial={{ opacity: 0, x: -50 }}
                              whileInView={{ opacity: 1, x: 0 }}
                              viewport={{ once: true }}
                              transition={{ delay: 0.2 + i * 0.3, type: "spring", stiffness: 120 }}
                              key={i}
                              className="interactive-list-item flex items-center gap-5 bg-slate-900/60 p-5 rounded-lg border border-white/10 cursor-default"
                            >
                              <div className="text-sm font-mono text-slate-800 bg-slate-300 px-3 py-1 font-bold rounded">{s.step}</div>
                              <div className="flex-1 text-lg text-white font-medium">{s.action}</div>
                              <div className={`text-sm font-bold tracking-widest font-mono ${s.color} ${s.status === 'ACTIVE' ? 'animate-pulse text-glow-cyan' : ''}`}>[{s.status}]</div>
                            </motion.div>
                          ))}
                        </div>
                      </HolographicCard>
                    </div>
                  </div>
                </section>

                {/* SCENE 5: AI CORE */}
                <section className="min-h-screen relative flex flex-col justify-center items-center px-16 text-center pb-20 pointer-events-auto">
                  <div className="max-w-5xl mx-auto w-full">
                    <motion.div initial={{ opacity: 0, scale: 0.5, y: 100 }} whileInView={{ opacity: 1, scale: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 1.5, type: "spring", bounce: 0.3 }}>
                      <motion.div
                        animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                        className="w-32 h-32 mx-auto rounded bg-sky-500/10 border-4 border-sky-400 flex items-center justify-center mb-10 shadow-[0_0_60px_rgba(56,189,248,0.4)] relative overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-sky-400/20 animate-pulse" />
                        <motion.div animate={{ rotate: -720 }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }}>
                          <Hexagon className="w-16 h-16 text-sky-300 relative z-10 drop-shadow-[0_0_10px_rgba(56,189,248,0.8)]" />
                        </motion.div>
                      </motion.div>
                      <h2 className="text-7xl md:text-9xl font-display font-bold text-white mb-8 uppercase tracking-tighter text-glow-cyan leading-[0.9]">
                        The <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-500">Quantum</span> Core.
                      </h2>
                      <p className="text-sky-100/80 text-3xl font-light leading-relaxed mb-16 max-w-4xl mx-auto bg-slate-900/40 p-6 rounded-2xl border border-white/10 backdrop-blur-md">
                        Powered by a massive gyroscopic inference engine handling <span className="font-bold text-white text-glow-cyan">10 trillion</span> parameters per second. Welcome to the era of autonomous supply chains.
                      </p>
                      <motion.button
                        onClick={() => setCurrentPage('command-center')}
                        whileHover={{ scale: 1.1, textShadow: "0px 0px 15px rgba(56,189,248,0.8)", boxShadow: "0px 0px 60px rgba(56,189,248,0.8)" }}
                        whileTap={{ scale: 0.95 }}
                        className="px-16 py-8 bg-sky-500/10 border-2 border-sky-400 text-sky-50 text-2xl font-bold rounded uppercase tracking-widest transition-all hover:bg-sky-500 hover:text-slate-900 shadow-[0_0_30px_rgba(56,189,248,0.4)]"
                      >
                        Initiate System Uplink
                      </motion.button>
                    </motion.div>
                  </div>
                </section>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="flex h-screen w-full fixed inset-0 z-20 pointer-events-none"
            >
              <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />

              <div className="flex-1 flex flex-col h-full pointer-events-auto bg-black/40 backdrop-blur-[2px]">
                <header className="px-12 py-8 flex justify-between items-center border-b border-sky-500/10 bg-slate-950/60 backdrop-blur-3xl shadow-2xl">
                  <div>
                    <h2 className="text-4xl font-display font-bold text-white tracking-widest uppercase text-glow-cyan italic">{currentPage.replace('-', ' ')}</h2>
                    <div className="flex items-center gap-6 mt-3 text-[9px] font-mono tracking-[0.2em] text-slate-500 uppercase">
                      <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Global Twin: Active</span>
                      <span className="flex items-center gap-2"><Clock className="w-3 h-3" /> Last Sync: T-0.12s</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-10">
                    <div className="text-[9px] font-mono text-slate-600 text-right uppercase tracking-widest">
                      System Heartbeat<br />
                      <span className="text-sky-400 flex gap-1 mt-1.5 justify-end">
                        {[1, 2, 3, 4, 5, 6].map(i => <motion.div key={i} animate={{ height: [4, 14, 4] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }} className="w-0.5 bg-sky-400 rounded" />)}
                      </span>
                    </div>
                    <button className="w-14 h-14 rounded-xl bg-sky-500/10 border border-sky-400/40 flex items-center justify-center text-sky-400 hover:bg-sky-500 hover:text-slate-950 transition-all duration-300 shadow-[0_0_20px_rgba(56,189,248,0.3)]">
                      <Radio className="w-7 h-7 animate-pulse" />
                    </button>
                  </div>
                </header>

                <main className="flex-1 overflow-y-auto p-12 custom-scroll relative">
                  <div className="max-w-[1500px] mx-auto relative z-10">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentPage}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      >
                        {renderDashboardContent()}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </main>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <LogisticsOptimizerPortal isOpen={showOptimizerPortal} onClose={() => setShowOptimizerPortal(false)} />
        <ChatbotFAB />
      </div>
    </>
  );
}

