/*
  Pointer-origin specular ripple — "sun play" on brushed metal.

  A single WebGL canvas is shared across every surface that uses the effect.
  Only one element can be hovered at a time and the ripple fires once from the
  entry point rather than tracking the pointer, so one canvas (and therefore one
  GL context) is enough for the whole page. It is re-parented into whichever
  element was just entered, which also means the host's existing
  `overflow: hidden` clips it for free.
*/

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y; // match DOM coordinates, y down
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;

varying vec2 vUv;

uniform vec2  uResolution; // host size, px
uniform vec2  uOrigin;     // pointer entry point, px, y down
uniform float uProgress;   // 0 -> 1 across the ripple's life
uniform vec3  uTint;
uniform float uIntensity;
uniform float uAniso;      // how far the gleam smears along the grain

void main() {
  vec2 fragPx = vUv * uResolution;
  vec2 delta = fragPx - uOrigin;

  /*
    Brushed metal reflects anisotropically: a highlight smears along the brush
    grain rather than staying round. The grain here runs horizontally, so x is
    scaled down to stretch the wavefronts into the wide arcs a brushed surface
    actually produces. A circular ripple reads as water, not metal.
  */
  vec2 aniso = vec2(uAniso, 1.0);
  float dist = length(delta / aniso);
  float maxR = length(uResolution / aniso);
  float r = dist / max(maxR, 1.0);

  float front = uProgress;

  /*
    Broad, smooth wavefronts. High ring frequencies read as noise or moire —
    "itchy" — rather than as a reflection, so this stays deliberately low.
  */
  float rings = sin((r - front) * 11.0);

  // The wave exists only just inside the advancing front, fading out behind it.
  float lead = 1.0 - smoothstep(front - 0.06, front + 0.02, r);
  float trail = smoothstep(front - 0.5, front - 0.05, r);
  float signal = lead * trail * rings;

  /*
    Bipolar, and this is the part that matters: crests lighten, troughs darken.
    A purely additive white gleam is mathematically invisible on a near-white
    surface — there is no headroom left to brighten into — which is why earlier
    passes vanished on the light rows while blowing out the dark nav. Carrying
    the dark half of the wave means the same shader registers on both.
  */
  float a = clamp(abs(signal) * uIntensity * sin(uProgress * 3.14159), 0.0, 1.0);
  vec3 col = signal >= 0.0 ? uTint : vec3(0.0);

  gl_FragColor = vec4(col * a, a); // premultiplied
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export interface RippleRunner {
  trigger(host: HTMLElement, x: number, y: number): void;
  destroy(): void;
}

/** Reads a space-separated "R G B" custom property into 0..1 floats. */
function readTint(host: HTMLElement): [number, number, number] {
  const raw = getComputedStyle(host).getPropertyValue("--fx-ripple-light").trim();
  const parts = raw.split(/[\s,]+/).map(Number);
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return [1, 1, 1];
  return [parts[0]! / 255, parts[1]! / 255, parts[2]! / 255];
}

function readNumber(host: HTMLElement, prop: string, fallback: number): number {
  const raw = getComputedStyle(host).getPropertyValue(prop).trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function createRippleRunner(): RippleRunner | null {
  const canvas = document.createElement("canvas");
  canvas.className = "fx-ripple-canvas";
  canvas.setAttribute("aria-hidden", "true");

  const gl =
    (canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false }) as
      | WebGLRenderingContext
      | null) ?? null;
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;

  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uResolution = gl.getUniformLocation(prog, "uResolution");
  const uOrigin = gl.getUniformLocation(prog, "uOrigin");
  const uProgress = gl.getUniformLocation(prog, "uProgress");
  const uTint = gl.getUniformLocation(prog, "uTint");
  const uIntensity = gl.getUniformLocation(prog, "uIntensity");
  const uAniso = gl.getUniformLocation(prog, "uAniso");

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  let raf = 0;
  let currentHost: HTMLElement | null = null;

  function detach() {
    raf = 0;
    canvas.remove();
    currentHost = null;
  }

  function trigger(host: HTMLElement, x: number, y: number) {
    if (raf) cancelAnimationFrame(raf);

    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w <= 0 || h <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    if (currentHost !== host) {
      host.appendChild(canvas);
      currentHost = host;
    }

    const duration = readNumber(host, "--fx-ripple-duration", 900);
    const intensity = readNumber(host, "--fx-ripple-intensity", 1);
    const aniso = readNumber(host, "--fx-ripple-aniso", 2.6);
    const tint = readTint(host);

    gl!.viewport(0, 0, canvas.width, canvas.height);
    gl!.uniform2f(uResolution, w, h);
    gl!.uniform2f(uOrigin, x, y);
    gl!.uniform3f(uTint, tint[0], tint[1], tint[2]);
    gl!.uniform1f(uIntensity, intensity);
    gl!.uniform1f(uAniso, aniso);

    const start = performance.now();

    const frame = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      gl!.uniform1f(uProgress, p);
      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      // Detach when finished so no GL work or stray canvas is left behind.
      raf = p < 1 ? requestAnimationFrame(frame) : 0;
      if (!raf) detach();
    };

    raf = requestAnimationFrame(frame);
  }

  function destroy() {
    if (raf) cancelAnimationFrame(raf);
    detach();
  }

  return { trigger, destroy };
}
