"use client";

// A vine that follows the cursor: thin stems that taper to the tip and sway a little, with
// small leaves sprouting along the way and fading out. The stems come from Ribbons by React
// Bits (https://reactbits.dev, MIT + Commons Clause), adapted to TypeScript; the leaves are
// drawn on a 2D canvas in the shape of the home page stem's leaves.
//
// It only animates while the cursor moves and stops on its own once the vine settles.

import { useEffect, useRef } from "react";

const POINTS = 50;
const DETAIL = 4;
const SAMPLES = (POINTS - 1) * DETAIL + 1;
const STRIDE = 6;
const STEP = 1 / 120;

const VERTEX = `#version 300 es
in vec2 a_position;
in vec4 a_shape;
uniform vec2 u_resolution;
out vec4 v_shape;
void main() {
  v_shape = a_shape;
  vec2 clip = a_position / u_resolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec3 u_color;
uniform float u_opacity;
uniform float u_fade;
uniform float u_softness;
in vec4 v_shape;
out vec4 outColor;

void main() {
  float halfWidth = v_shape.y;
  float dist = abs(v_shape.x) * v_shape.z;
  float edge = max(halfWidth, 0.5);
  float soft = u_softness * edge;
  float alpha = 1.0 - smoothstep(edge - soft - 0.6, edge + 0.6, dist);
  alpha *= clamp(halfWidth / 0.5, 0.0, 1.0);
  alpha *= mix(1.0, 1.0 - smoothstep(0.0, 1.0, v_shape.w), u_fade);
  alpha *= u_opacity;
  if (alpha <= 0.002) discard;
  outColor = vec4(u_color * alpha, alpha);
}
`;

// The home page stem's leaf (stem.tsx), 40 x 24 units, base at (0, 12).
const LEAF = new Path2D("M0 12C9 1 26 0 38 9 26 18 10 20 0 12Z");
const LEAF_VEIN = new Path2D("M2 12 33 9");

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const hash = (value: number) => {
  const s = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const hexToRgb = (hex: string): [number, number, number] => {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
};

// A growing shoot: a fine tip at the cursor, fuller along the stem, thinning toward the end.
const profile = (u: number) => smoothstep(0, 0.18, u) * (1 - 0.45 * u);

const compile = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
};

interface Ribbon {
  x: number;
  y: number;
  vx: number;
  vy: number;
  points: Float32Array;
  pull: number;
  drag: number;
  width: number;
  lift: number;
  nudge: number;
  phase: number;
}

const createRibbon = (index: number, x: number, y: number): Ribbon => {
  const points = new Float32Array(POINTS * 2);
  for (let i = 0; i < POINTS; i++) {
    points[i * 2] = x;
    points[i * 2 + 1] = y;
  }
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    points,
    pull: 0.35 + 1.3 * hash(index + 3),
    drag: 0.9 + 0.2 * hash(index + 5),
    width: 0.95 + 0.1 * hash(index + 7),
    lift: hash(index + 13) - 0.5,
    nudge: hash(index + 17) - 0.5,
    phase: hash(index + 19) * Math.PI * 2,
  };
};

interface Leaf {
  x: number;
  y: number;
  angle: number;
  size: number;
  born: number;
}

export interface VineTrailProps {
  /** Stem colors, back to front. */
  stems?: string[];
  leafFill?: string;
  leafStroke?: string;
  thickness?: number;
  length?: number;
  spread?: number;
  stiffness?: number;
  bounce?: number;
  wave?: number;
  opacity?: number;
  /** Distance the cursor travels between two leaves, in pixels. */
  leafEvery?: number;
  /** How long a leaf lives, in seconds. */
  leafLife?: number;
  /** Leaf size, as a fraction of the home page stem leaf (40 x 24 px). */
  leafSize?: number;
  className?: string;
}

export default function VineTrail({
  stems = ["#9CC5A6", "#2F5D45"],
  leafFill = "#E2EFE4",
  leafStroke = "#2F5D45",
  thickness = 4,
  length = 2.8,
  spread = 5,
  stiffness = 0.45,
  bounce = 0.3,
  wave = 0.3,
  opacity = 0.7,
  leafEvery = 64,
  leafLife = 1.6,
  leafSize = 0.42,
  className = "",
}: VineTrailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const leafCanvasRef = useRef<HTMLCanvasElement>(null);
  const settings = {
    colors: stems.map(hexToRgb),
    leafFill,
    leafStroke,
    thickness,
    length: clamp(length, 0.1, 5),
    spread,
    stiffness: clamp(stiffness, 0, 1),
    bounce: clamp(bounce, 0, 1),
    wave: clamp(wave, 0, 1),
    opacity: clamp(opacity, 0, 1),
    leafEvery,
    leafLife,
    leafSize,
  };
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = glCanvasRef.current;
    const leafCanvas = leafCanvasRef.current;
    if (!container || !canvas || !leafCanvas) return;
    // A trail only makes sense with a mouse, and never for people who asked for less motion.
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!finePointer || reduced) return;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    });
    const ctx = leafCanvas.getContext("2d");
    if (!gl || !ctx) return;
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    // A WebGL call, not a React hook.
    // biome-ignore lint/correctness/useHookAtTopLevel: see above
    gl.useProgram(program);

    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < uniformCount; i++) {
      const info = gl.getActiveUniform(program, i);
      if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name);
    }

    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const position = gl.getAttribLocation(program, "a_position");
    const shapeAttribute = gl.getAttribLocation(program, "a_shape");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, STRIDE * 4, 0);
    gl.enableVertexAttribArray(shapeAttribute);
    gl.vertexAttribPointer(shapeAttribute, 4, gl.FLOAT, false, STRIDE * 4, 8);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const pointX = new Float32Array(POINTS);
    const pointY = new Float32Array(POINTS);
    const spacing = new Float32Array(POINTS);
    const sampleX = new Float32Array(SAMPLES);
    const sampleY = new Float32Array(SAMPLES);
    const sampleSpacing = new Float32Array(SAMPLES);
    let vertices = new Float32Array(0);

    const state = {
      alive: true,
      raf: 0,
      last: 0,
      time: 0,
      visible: true,
      width: 1,
      height: 1,
      ratio: 1,
      ribbons: [] as Ribbon[],
      mouseX: 0,
      mouseY: 0,
      placed: false,
      accumulator: 0,
      leaves: [] as Leaf[],
      travelled: 0,
      lastX: 0,
      lastY: 0,
      side: 1,
    };

    const resize = () => {
      // The vine may cover the whole window, so keep the canvases light.
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      state.width = width;
      state.height = height;
      state.ratio = ratio;
      const pixelWidth = Math.max(1, Math.round(width * ratio));
      const pixelHeight = Math.max(1, Math.round(height * ratio));
      for (const target of [canvas, leafCanvas]) {
        if (target.width !== pixelWidth || target.height !== pixelHeight) {
          target.width = pixelWidth;
          target.height = pixelHeight;
        }
      }
    };

    const syncRibbons = () => {
      const count = settingsRef.current.colors.length;
      while (state.ribbons.length < count) {
        state.ribbons.push(createRibbon(state.ribbons.length, state.mouseX, state.mouseY));
      }
      state.ribbons.length = count;
    };

    const simulate = (dt: number) => {
      const s = settingsRef.current;
      const spring = 0.03 * 4 ** (2 * s.stiffness - 1);
      const zeta = clamp(0.3 ** (2 * s.bounce), 0.05, 1);
      const follow = 1 - 0.183 ** ((1 / s.length) * dt * 60);
      const count = state.ribbons.length;
      const center = (count - 1) / 2;
      for (let i = 0; i < count; i++) {
        const ribbon = state.ribbons[i] as Ribbon;
        const omega = 60 * Math.sqrt(spring * ribbon.pull);
        const damping = 2 * zeta * 60 * Math.sqrt(spring) * ribbon.drag;
        const tx = state.mouseX + (i - center + ribbon.nudge * 0.2) * s.spread;
        const ty = state.mouseY + ribbon.lift * s.spread;
        ribbon.vx += (omega * omega * (tx - ribbon.x) - damping * ribbon.vx) * dt;
        ribbon.vy += (omega * omega * (ty - ribbon.y) - damping * ribbon.vy) * dt;
        ribbon.x += ribbon.vx * dt;
        ribbon.y += ribbon.vy * dt;
        const { points } = ribbon;
        points[0] = ribbon.x;
        points[1] = ribbon.y;
        for (let j = 1; j < POINTS; j++) {
          const p = j * 2;
          points[p] =
            (points[p] as number) + ((points[p - 2] as number) - (points[p] as number)) * follow;
          points[p + 1] =
            (points[p + 1] as number) +
            ((points[p - 1] as number) - (points[p + 1] as number)) * follow;
        }
      }

      // Leaves sprout along the path of the main stem, alternating sides.
      const head = state.ribbons[count - 1];
      if (!head) return;
      const moved = Math.hypot(head.x - state.lastX, head.y - state.lastY);
      if (moved > 0.01) {
        const heading = Math.atan2(head.y - state.lastY, head.x - state.lastX);
        state.travelled += moved;
        if (state.travelled >= s.leafEvery) {
          state.travelled = 0;
          state.side *= -1;
          state.leaves.push({
            x: head.x,
            y: head.y,
            angle: heading + Math.PI + state.side * (0.75 + 0.3 * hash(state.time * 13)),
            size: s.leafSize * (1 + 0.3 * hash(state.time * 7)),
            born: state.time,
          });
          if (state.leaves.length > 24) state.leaves.shift();
        }
      }
      state.lastX = head.x;
      state.lastY = head.y;
    };

    const build = (ribbon: Ribbon, out: Float32Array, offset: number) => {
      const s = settingsRef.current;
      const { points } = ribbon;
      let total = 0;
      for (let j = 0; j < POINTS; j++) {
        pointX[j] = points[j * 2] as number;
        pointY[j] = points[j * 2 + 1] as number;
        if (j > 0)
          total += Math.hypot(
            (pointX[j] as number) - (pointX[j - 1] as number),
            (pointY[j] as number) - (pointY[j - 1] as number),
          );
      }
      if (total < 0.5) return 0;
      for (let j = 0; j < POINTS; j++) {
        const prev = Math.max(j - 1, 0);
        const next = Math.min(j + 1, POINTS - 1);
        spacing[j] = Math.hypot(
          (pointX[next] as number) - (pointX[prev] as number),
          (pointY[next] as number) - (pointY[prev] as number),
        );
      }
      if (s.wave > 0) {
        const amplitude = s.wave * Math.min(s.thickness * 3, total * 0.05);
        let nx = 0;
        let ny = 0;
        for (let j = 0; j < POINTS; j++) {
          const prev = Math.max(j - 1, 0);
          const next = Math.min(j + 1, POINTS - 1);
          const dx = (pointX[next] as number) - (pointX[prev] as number);
          const dy = (pointY[next] as number) - (pointY[prev] as number);
          const len = Math.hypot(dx, dy);
          if (len > 1e-3) {
            nx = -dy / len;
            ny = dx / len;
          }
          const u = j / (POINTS - 1);
          const swing =
            Math.sin(u * Math.PI * 3 - state.time * 2.4 + ribbon.phase) *
            Math.sin(Math.PI * u) *
            amplitude;
          pointX[j] = (pointX[j] as number) + nx * swing;
          pointY[j] = (pointY[j] as number) + ny * swing;
        }
      }

      const px = (i: number) => pointX[i] as number;
      const py = (i: number) => pointY[i] as number;
      let k = 0;
      for (let j = 0; j < POINTS - 1; j++) {
        const a = Math.max(j - 1, 0);
        const b = j;
        const c = j + 1;
        const d = Math.min(j + 2, POINTS - 1);
        for (let step = 0; step < DETAIL; step++) {
          const t = step / DETAIL;
          const t2 = t * t;
          const t3 = t2 * t;
          sampleX[k] =
            0.5 *
            (2 * px(b) +
              (px(c) - px(a)) * t +
              (2 * px(a) - 5 * px(b) + 4 * px(c) - px(d)) * t2 +
              (3 * px(b) - px(a) - 3 * px(c) + px(d)) * t3);
          sampleY[k] =
            0.5 *
            (2 * py(b) +
              (py(c) - py(a)) * t +
              (2 * py(a) - 5 * py(b) + 4 * py(c) - py(d)) * t2 +
              (3 * py(b) - py(a) - 3 * py(c) + py(d)) * t3);
          sampleSpacing[k] =
            (spacing[j] as number) + ((spacing[j + 1] as number) - (spacing[j] as number)) * t;
          k++;
        }
      }
      sampleX[k] = px(POINTS - 1);
      sampleY[k] = py(POINTS - 1);
      sampleSpacing[k] = spacing[POINTS - 1] as number;

      const half = s.thickness * 0.5 * ribbon.width * smoothstep(0, s.thickness * 1.5, total);
      let normalX = 0;
      let normalY = 1;
      let cursor = offset;
      for (let i = SAMPLES - 1; i >= 0; i--) {
        const prev = Math.max(i - 1, 0);
        const next = Math.min(i + 1, SAMPLES - 1);
        const dx = (sampleX[next] as number) - (sampleX[prev] as number);
        const dy = (sampleY[next] as number) - (sampleY[prev] as number);
        const len = Math.hypot(dx, dy);
        if (len > 1e-4) {
          normalX = -dy / len;
          normalY = dx / len;
        }
        const u = i / (SAMPLES - 1);
        const width = half * profile(u) * smoothstep(0, 1.5, sampleSpacing[i] as number);
        const reach = width + 1.5;
        for (let side = -1; side <= 1; side += 2) {
          out[cursor++] = (sampleX[i] as number) + normalX * reach * side;
          out[cursor++] = (sampleY[i] as number) + normalY * reach * side;
          out[cursor++] = side;
          out[cursor++] = width;
          out[cursor++] = reach;
          out[cursor++] = u;
        }
      }
      return SAMPLES * 2;
    };

    const drawLeaves = () => {
      const s = settingsRef.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, leafCanvas.width, leafCanvas.height);
      state.leaves = state.leaves.filter((leaf) => state.time - leaf.born < s.leafLife);
      for (const leaf of state.leaves) {
        const age = (state.time - leaf.born) / s.leafLife;
        // Unfurl quickly, rest, then fade.
        const grow = 1 - (1 - smoothstep(0, 0.25, age)) ** 3;
        const alpha = (1 - smoothstep(0.45, 1, age)) * s.opacity * 1.4;
        if (alpha <= 0.01) continue;
        ctx.setTransform(state.ratio, 0, 0, state.ratio, 0, 0);
        ctx.translate(leaf.x, leaf.y);
        ctx.rotate(leaf.angle);
        ctx.scale(leaf.size * grow, leaf.size * grow);
        ctx.translate(0, -12);
        ctx.globalAlpha = clamp(alpha, 0, 1);
        ctx.fillStyle = s.leafFill;
        ctx.strokeStyle = s.leafStroke;
        ctx.lineWidth = 1.1 / leaf.size;
        ctx.lineJoin = "round";
        ctx.fill(LEAF);
        ctx.stroke(LEAF);
        ctx.globalAlpha = clamp(alpha * 0.7, 0, 1);
        ctx.lineWidth = 0.8 / leaf.size;
        ctx.stroke(LEAF_VEIN);
      }
      ctx.globalAlpha = 1;
    };

    const draw = () => {
      const s = settingsRef.current;
      resize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      syncRibbons();
      const count = state.ribbons.length;
      const needed = count * SAMPLES * 2 * STRIDE;
      if (vertices.length < needed) vertices = new Float32Array(needed);
      const ranges: [number, number][] = [];
      for (let i = 0; i < count; i++) {
        const offset = i * SAMPLES * 2 * STRIDE;
        ranges.push([offset / STRIDE, build(state.ribbons[i] as Ribbon, vertices, offset)]);
      }
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices.subarray(0, needed), gl.DYNAMIC_DRAW);
      gl.uniform2f(uniforms.u_resolution ?? null, state.width, state.height);
      gl.uniform1f(uniforms.u_opacity ?? null, s.opacity);
      gl.uniform1f(uniforms.u_fade ?? null, 1);
      gl.uniform1f(uniforms.u_softness ?? null, 0.2);
      for (let i = 0; i < count; i++) {
        const [first, size] = ranges[i] as [number, number];
        if (!size) continue;
        gl.uniform3fv(uniforms.u_color ?? null, s.colors[i] as [number, number, number]);
        gl.drawArrays(gl.TRIANGLE_STRIP, first, size);
      }
      drawLeaves();
    };

    // The vine is at rest when every stem has caught up with the cursor and no leaf is left.
    const settled = () =>
      state.leaves.length === 0 &&
      state.ribbons.every((ribbon) => {
        const { points } = ribbon;
        const tailX = points[(POINTS - 1) * 2] as number;
        const tailY = points[(POINTS - 1) * 2 + 1] as number;
        return (
          Math.hypot(ribbon.vx, ribbon.vy) < 0.5 &&
          Math.hypot(tailX - ribbon.x, tailY - ribbon.y) < 0.5
        );
      });

    const frame = (now: number) => {
      state.raf = 0;
      if (!state.alive) return;
      const dt = state.last ? Math.min(0.05, (now - state.last) / 1000) : 1 / 60;
      state.last = now;
      state.time += dt;
      syncRibbons();
      state.accumulator += dt;
      while (state.accumulator >= STEP) {
        simulate(STEP);
        state.accumulator -= STEP;
      }
      draw();
      if (state.visible && !settled()) state.raf = requestAnimationFrame(frame);
      else state.last = 0;
    };

    const wake = () => {
      if (!state.raf && state.alive && state.visible) state.raf = requestAnimationFrame(frame);
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
      if (!state.placed) {
        // Start the vine where the cursor first appears, not in the middle of the page.
        for (const ribbon of state.ribbons) {
          ribbon.x = x;
          ribbon.y = y;
          for (let i = 0; i < POINTS; i++) {
            ribbon.points[i * 2] = x;
            ribbon.points[i * 2 + 1] = y;
          }
        }
        state.lastX = x;
        state.lastY = y;
      }
      state.mouseX = x;
      state.mouseY = y;
      state.placed = true;
      wake();
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
      draw();
    });
    resizeObserver.observe(container);

    const visibility = new IntersectionObserver((entries) => {
      state.visible = entries.some((entry) => entry.isIntersecting);
      if (state.visible) wake();
    });
    visibility.observe(container);

    const onLost = (event: Event) => {
      event.preventDefault();
      state.alive = false;
      cancelAnimationFrame(state.raf);
    };

    canvas.addEventListener("webglcontextlost", onLost);
    window.addEventListener("pointermove", onMove, { passive: true });

    resize();
    syncRibbons();

    return () => {
      state.alive = false;
      cancelAnimationFrame(state.raf);
      resizeObserver.disconnect();
      visibility.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      window.removeEventListener("pointermove", onMove);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none relative h-full w-full ${className}`}
    >
      <canvas ref={glCanvasRef} className="absolute inset-0 block h-full w-full" />
      <canvas ref={leafCanvasRef} className="absolute inset-0 block h-full w-full" />
    </div>
  );
}
