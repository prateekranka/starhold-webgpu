import './cinematic-fill.css';
import { RENDER_HEIGHT, RENDER_WIDTH } from './renderer';

const viewport = document.querySelector<HTMLElement>('#viewport')!;
const touchLayout = navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
const read = (name: string) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;

/**
 * Laptops and tablet-class devices use a full-bleed 16:9 cover scale.
 * In portrait match mode, the canvas must fit above the 3-row HUD bar so it stays playable.
 */
function cinematicEligible(availW: number, availH: number): boolean {
  const isPortrait = availW < availH;
  const isMatch = !document.body.classList.contains('showcase-mode') && !document.body.classList.contains('game-menu-open');
  if (isPortrait && isMatch) return false;

  return !touchLayout || Math.min(availW, availH) >= 700 || availW > availH;
}

export function applyCinematicFill(): void {
  const safeL = read('--safe-l'), safeR = read('--safe-r'), safeT = read('--safe-t'), safeB = read('--safe-b');
  const availW = Math.max(1, innerWidth - safeL - safeR), availH = Math.max(1, innerHeight - safeT - safeB);
  const cinematic = cinematicEligible(availW, availH);
  document.body.classList.toggle('cinematic-fill', cinematic);
  if (!cinematic) {
    viewport.style.left = ''; viewport.style.top = ''; viewport.style.transform = '';
    document.documentElement.style.removeProperty('--cinematic-crop-x');
    document.documentElement.style.removeProperty('--cinematic-crop-y');
    window.dispatchEvent(new CustomEvent('starhold-cinematic-fill', { detail: { hudLeftInset: 0, hudBottomInset: 0 } }));
    return;
  }
  const scale = Math.max(availW / RENDER_WIDTH, availH / RENDER_HEIGHT);
  viewport.style.width = `${RENDER_WIDTH * scale}px`;
  viewport.style.height = `${RENDER_HEIGHT * scale}px`;
  viewport.style.left = `${safeL + availW / 2}px`;
  viewport.style.top = `${safeT + availH / 2}px`;
  viewport.style.transform = 'translate(-50%,-50%)';
  const cropX = Math.max(0, (RENDER_WIDTH * scale - availW) / 2);
  const cropY = Math.max(0, (RENDER_HEIGHT * scale - availH) / 2);
  document.documentElement.style.setProperty('--cinematic-crop-x', `${cropX}px`);
  document.documentElement.style.setProperty('--cinematic-crop-y', `${cropY}px`);
  // Renderer HUD geometry uses half-resolution logical pixels. Convert the
  // equal left/right cover crop from backing pixels before placing its labels.
  const hudLeftInset = Math.ceil(Math.max(0, RENDER_WIDTH - availW / scale) / 4);
  const hudBottomInset = Math.ceil((cropY + read('--hud-h')) / (2 * scale));
  window.dispatchEvent(new CustomEvent('starhold-cinematic-fill', { detail: { hudLeftInset, hudBottomInset } }));
}

let queued = false;
export function queueApply(): void {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    applyCinematicFill();
  });
}
window.addEventListener('resize', queueApply);
window.addEventListener('orientationchange', queueApply);
document.addEventListener('fullscreenchange', queueApply);
applyCinematicFill();
