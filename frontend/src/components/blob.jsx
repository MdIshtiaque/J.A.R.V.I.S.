import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Move } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Fixed visual parameters — tuned for high aesthetic reactive orb   */
/* ------------------------------------------------------------------ */
const BASE = {
  rotationSpeedX: 0.0012,
  rotationSpeedY: 0.0025,
  timeScale: 0.8,
  plasmaScale: 0.2,
  plasmaBrightness: 1.25,
  voidThreshold: 0.09,
  colorDeep: 0x001433,
  colorMid: 0x0084ff,
  colorBright: 0x00ffe1,
  shellColor: 0x0066ff,
  shellOpacity: 0.41,
};

const noiseFunctions = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
      const vec2  C = vec2(1.0/6.0, 1.0/3.0);
      const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3  ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  float fbm(vec3 p) {
      float total = 0.0;
      float amplitude = 0.5;
      float frequency = 1.0;
      for (int i = 0; i < 3; i++) {
          total += snoise(p * frequency) * amplitude;
          amplitude *= 0.5;
          frequency *= 2.0;
      }
      return total;
  }
`;

const SHELL_VERT = `
  uniform float uTime;
  uniform float uDisplacement;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  ${noiseFunctions}
  void main() {
    vNormal = normalize(normalMatrix * normal);
    float noise = fbm(position * 2.2 + vec3(0.0, uTime * 0.4, 0.0));
    vec3 newPosition = position + normal * (noise * uDisplacement);
    vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const SHELL_FRAG = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    float fresnel = pow(1.0 - dot(normalize(vNormal), normalize(vViewPosition)), 2.5);
    gl_FragColor = vec4(uColor, fresnel * uOpacity);
  }
`;

const PLASMA_VERT = `
  uniform float uTime;
  uniform float uDisplacement;
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  ${noiseFunctions}
  void main() {
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    float noise = fbm(position * 2.2 + vec3(0.0, uTime * 0.4, 0.0));
    vec3 newPosition = position + normal * (noise * uDisplacement);
    vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const PLASMA_FRAG = `
  uniform float uTime;
  uniform float uScale;
  uniform float uBrightness;
  uniform float uThreshold;
  uniform vec3 uColorDeep;
  uniform vec3 uColorMid;
  uniform vec3 uColorBright;
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  ${noiseFunctions}
  void main() {
    vec3 p = vPosition * uScale;
    vec3 q = vec3(
      fbm(p + vec3(0.0, uTime * 0.025, 0.0)),
      fbm(p + vec3(5.2, 1.3, 2.8) + uTime * 0.025),
      fbm(p + vec3(2.2, 8.4, 0.5) - uTime * 0.015)
    );
    float density = fbm(p + 2.0 * q);
    float t = (density + 0.4) * 0.8;
    float alpha = smoothstep(uThreshold, 0.7, t);
    vec3 cWhite = vec3(1.0, 1.0, 1.0);
    vec3 color = mix(uColorDeep, uColorMid, smoothstep(uThreshold, 0.5, t));
    color = mix(color, uColorBright, smoothstep(0.5, 0.8, t));
    color = mix(color, cWhite, smoothstep(0.8, 1.0, t));
    float facing = dot(normalize(vNormal), normalize(vViewPosition));
    float depthFactor = (facing + 1.0) * 0.5;
    float finalAlpha = alpha * (0.02 + 0.98 * depthFactor);
    gl_FragColor = vec4(color * uBrightness, finalAlpha);
  }
`;

const PARTICLE_VERT = `
  uniform float uTime;
  attribute float aSize;
  varying float vAlpha;
  void main() {
    vec3 pos = position;
    pos.y += sin(uTime * 0.15 + pos.x) * 0.015;
    pos.x += cos(uTime * 0.12 + pos.z) * 0.015;
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float baseSize = 8.0 * aSize + 4.0;
    gl_PointSize = baseSize * (1.0 / -mvPosition.z);
    vAlpha = 0.8 + 0.2 * sin(uTime * 0.8 + aSize * 10.0);
  }
`;

const PARTICLE_FRAG = `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    if (dist > 0.5) discard;
    float glow = 1.0 - (dist * 2.0);
    glow = pow(glow, 1.8);
    gl_FragColor = vec4(uColor, glow * vAlpha);
  }
`;

export default function VoiceReactiveOrb({ blobConfig, onPositionChange, isAiSpeaking, isMicActive }) {
  const mountRef = useRef(null);
  const rafRef = useRef(null);
  const sceneStateRef = useRef(null);
  const audioRef = useRef({ ctx: null, analyser: null, data: null, stream: null, source: null });
  const volumeRef = useRef(0);
  const materialsRef = useRef({ plasmaMat: null, shellFrontMat: null, shellBackMat: null });
  const isAiSpeakingRef = useRef(isAiSpeaking);
  const isMicActiveRef = useRef(isMicActive);

  useEffect(() => {
    isAiSpeakingRef.current = isAiSpeaking;
  }, [isAiSpeaking]);

  useEffect(() => {
    isMicActiveRef.current = isMicActive;
  }, [isMicActive]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const startMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      if (ctx.state === 'suspended') {
        const resumeAudio = () => {
          ctx.resume();
          window.removeEventListener('click', resumeAudio);
          window.removeEventListener('pointerdown', resumeAudio);
        };
        window.addEventListener('click', resumeAudio);
        window.addEventListener('pointerdown', resumeAudio);
      }

      audioRef.current = {
        ctx,
        analyser,
        data: new Uint8Array(analyser.frequencyBinCount),
        stream,
        source,
      };
    } catch (err) {
      console.warn('Microphone auto-start request notice:', err);
    }
  }, []);

  // Update dynamic colors whenever blobConfig color properties change
  useEffect(() => {
    if (!materialsRef.current.plasmaMat) return;
    const brightHex = blobConfig?.brightColor || '#00ffe1';
    const midHex = blobConfig?.midColor || '#0084ff';
    const deepHex = blobConfig?.deepColor || '#001433';

    materialsRef.current.plasmaMat.uniforms.uColorBright.value.set(brightHex);
    materialsRef.current.plasmaMat.uniforms.uColorMid.value.set(midHex);
    materialsRef.current.plasmaMat.uniforms.uColorDeep.value.set(deepHex);

    if (materialsRef.current.shellFrontMat) {
      materialsRef.current.shellFrontMat.uniforms.uColor.value.set(midHex);
    }
  }, [blobConfig?.brightColor, blobConfig?.midColor, blobConfig?.deepColor]);

  // Initialize Three.js scene & auto-start microphone
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    startMic();

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 2.8;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    mount.appendChild(renderer.domElement);

    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    const pointLight = new THREE.PointLight(0x0088ff, 2.0, 10);
    mainGroup.add(pointLight);

    const shellGeo = new THREE.SphereGeometry(0.95, 64, 64);

    const shellBackMat = new THREE.ShaderMaterial({
      vertexShader: SHELL_VERT,
      fragmentShader: SHELL_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uDisplacement: { value: 0.03 },
        uColor: { value: new THREE.Color(0x000055) },
        uOpacity: { value: 0.3 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    });

    const shellFrontMat = new THREE.ShaderMaterial({
      vertexShader: SHELL_VERT,
      fragmentShader: SHELL_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uDisplacement: { value: 0.03 },
        uColor: { value: new THREE.Color(blobConfig?.midColor || BASE.shellColor) },
        uOpacity: { value: BASE.shellOpacity },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      depthWrite: false,
    });

    mainGroup.add(new THREE.Mesh(shellGeo, shellBackMat));
    mainGroup.add(new THREE.Mesh(shellGeo, shellFrontMat));

    const plasmaGeo = new THREE.SphereGeometry(0.948, 128, 128);
    const plasmaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDisplacement: { value: 0.03 },
        uScale: { value: BASE.plasmaScale },
        uBrightness: { value: BASE.plasmaBrightness },
        uThreshold: { value: BASE.voidThreshold },
        uColorDeep: { value: new THREE.Color(blobConfig?.deepColor || BASE.colorDeep) },
        uColorMid: { value: new THREE.Color(blobConfig?.midColor || BASE.colorMid) },
        uColorBright: { value: new THREE.Color(blobConfig?.brightColor || BASE.colorBright) },
      },
      vertexShader: PLASMA_VERT,
      fragmentShader: PLASMA_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    materialsRef.current = { plasmaMat, shellFrontMat, shellBackMat };

    const plasmaMesh = new THREE.Mesh(plasmaGeo, plasmaMat);
    mainGroup.add(plasmaMesh);

    const pCount = 500;
    const pPos = new Float32Array(pCount * 3);
    const pSizes = new Float32Array(pCount);
    const sphereRadius = 0.85;
    for (let i = 0; i < pCount; i++) {
      const r = sphereRadius * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pPos[i * 3 + 2] = r * Math.cos(phi);
      pSizes[i] = Math.random();
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSizes, 1));

    const pMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xffffff) } },
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(pGeo, pMat);
    mainGroup.add(particles);

    sceneStateRef.current = { smoothVolume: 0 };

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const clock = new THREE.Clock();

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const s = sceneStateRef.current;

      const a = audioRef.current;
      let level = 0;
      if (isMicActiveRef.current && a.analyser && a.data) {
        if (a.ctx && a.ctx.state === 'suspended') {
          a.ctx.resume();
        }
        a.analyser.getByteFrequencyData(a.data);
        let sum = 0;
        const numBins = Math.min(35, a.data.length);
        for (let i = 1; i < numBins; i++) sum += a.data[i];
        const avg = (sum / numBins) / 255;
        const gain = blobConfig?.sensitivity !== undefined ? blobConfig.sensitivity : 5.5;
        level = Math.min(1, avg * gain);
      }

      // Filter background mic noise jitter
      const cleanLevel = level < 0.015 ? 0 : level;
      
      // Check if AI is vocalizing (LLM Speech output) vs user mic input level
      let effectiveLevel = cleanLevel;
      if (isAiSpeakingRef.current) {
        // High-energy, rhythmic synthetic AI speech modulation waveform
        const aiPulse = Math.sin(t * 15.0) * 0.28 + Math.cos(t * 9.0) * 0.18;
        const aiLevel = Math.abs(aiPulse) + 0.42;
        effectiveLevel = Math.max(effectiveLevel, aiLevel);
      }

      // Silk-smooth exponential lerp (0.18 attack, 0.04 release)
      const rate = effectiveLevel > s.smoothVolume ? 0.18 : 0.04;
      s.smoothVolume += (effectiveLevel - s.smoothVolume) * rate;
      const v = s.smoothVolume;
      volumeRef.current = v;

      // Serene ambient breathing
      const idle = Math.sin(t * 0.5) * 0.008 + Math.cos(t * 0.3) * 0.004;
      const userScale = blobConfig?.scale || 1.0;
      mainGroup.scale.setScalar(userScale * (1 + idle + v * 0.35));

      // Dynamic surface vertex noise displacement (creates liquid wavy edge contours on speech)
      const displacement = 0.03 + v * 0.18;
      shellFrontMat.uniforms.uTime.value = t;
      shellFrontMat.uniforms.uDisplacement.value = displacement;
      shellBackMat.uniforms.uTime.value = t;
      shellBackMat.uniforms.uDisplacement.value = displacement;

      plasmaMat.uniforms.uTime.value = t * (BASE.timeScale + v * 2.2);
      plasmaMat.uniforms.uDisplacement.value = displacement;
      plasmaMat.uniforms.uBrightness.value = BASE.plasmaBrightness + v * 1.8;
      plasmaMat.uniforms.uThreshold.value = Math.max(0.02, BASE.voidThreshold - v * 0.06);
      shellFrontMat.uniforms.uOpacity.value = Math.min(1, BASE.shellOpacity + v * 0.4);
      pointLight.intensity = 2.0 + v * 5.0;
      pMat.uniforms.uTime.value = t * (1.0 + v * 1.5);

      plasmaMesh.rotation.y = t * (0.05 + v * 0.1);
      mainGroup.rotation.x += BASE.rotationSpeedX * (1 + v * 2);
      mainGroup.rotation.y += BASE.rotationSpeedY * (1 + v * 2);

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();

      const a = audioRef.current;
      if (a.stream) a.stream.getTracks().forEach((tr) => tr.stop());
      if (a.ctx && a.ctx.state !== 'closed') a.ctx.close();
      audioRef.current = { ctx: null, analyser: null, data: null, stream: null, source: null };

      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      shellGeo.dispose();
      plasmaGeo.dispose();
      pGeo.dispose();
      shellBackMat.dispose();
      shellFrontMat.dispose();
      plasmaMat.dispose();
      pMat.dispose();
      renderer.dispose();
    };
  }, [startMic, blobConfig?.scale]);

  // Drag & Drop Handlers
  const handlePointerDown = (e) => {
    if (!blobConfig?.isDragEnabled) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - (blobConfig?.position?.x || 0),
      y: e.clientY - (blobConfig?.position?.y || 0),
    });
  };

  const handlePointerMove = (e) => {
    if (!isDragging || !blobConfig?.isDragEnabled) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    if (onPositionChange) {
      onPositionChange({ x: newX, y: newY });
    }
  };

  const handlePointerUp = () => {
    if (isDragging) setIsDragging(false);
  };

  const posX = blobConfig?.position?.x || 0;
  const posY = blobConfig?.position?.y || 0;

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        ...styles.root,
        transform: `translate(${posX}px, ${posY}px)`,
        cursor: blobConfig?.isDragEnabled ? 'grab' : 'default',
        touchAction: 'none',
      }}
      className={`transition-shadow rounded-3xl ${
        blobConfig?.isDragEnabled
          ? 'ring-2 ring-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.3)] bg-purple-950/10'
          : ''
      }`}
    >
      {/* Visual Drag Handle Overlay when Drag Mode is active */}
      {blobConfig?.isDragEnabled && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-950/80 border border-purple-400/60 backdrop-blur-md text-purple-200 font-mono text-xs shadow-lg animate-pulse">
          <Move className="w-3.5 h-3.5 text-purple-400" />
          <span>DRAG MODE ACTIVE — MOVE BLOB FREELY</span>
        </div>
      )}

      <div ref={mountRef} style={styles.canvasHost} />
    </div>
  );
}

const styles = {
  root: {
    position: 'relative',
    width: '100%',
    height: '520px',
    maxHeight: '75vh',
    background: 'transparent',
    overflow: 'visible',
    userSelect: 'none',
  },
  canvasHost: {
    position: 'absolute',
    inset: 0,
    background: 'transparent',
  },
};
