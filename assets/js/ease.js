// Small timing helpers shared by the Inside the Mac modules.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const seg = (p, a, b) => clamp((p - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const ease = (p, a, b) => smooth(seg(p, a, b));
export const lerp = (a, b, t) => a + (b - a) * t;
