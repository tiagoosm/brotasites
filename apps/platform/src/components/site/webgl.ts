// WebGL for the home page's decorations, only where a GPU draws it. Drawn in software (no GPU,
// a blocked one, a headless browser) the shaders run on the main thread and freeze the page,
// and these effects are only decoration, so they stay off instead.

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software/i;

export function acceleratedWebgl2(
  canvas: HTMLCanvasElement,
  options: WebGLContextAttributes,
): WebGL2RenderingContext | null {
  const gl = canvas.getContext("webgl2", { ...options, failIfMajorPerformanceCaveat: true });
  if (!gl) return null;
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  if (SOFTWARE.test(renderer)) {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  }
  return gl;
}
