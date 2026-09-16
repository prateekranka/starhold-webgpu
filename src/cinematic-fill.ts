import './cinematic-fill.css';
import {RENDER_HEIGHT,RENDER_WIDTH} from './renderer';

const viewport=document.querySelector<HTMLElement>('#viewport')!;
const touchLayout=navigator.maxTouchPoints>0||matchMedia('(pointer: coarse)').matches;
const read=(name:string)=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))||0;

/**
 * Laptops and tablet-class touch devices use a full-bleed 16:9 cover scale.
 * Phones keep the existing hand-tuned fit/overlay policy in main.ts.
 */
function cinematicEligible(availW:number,availH:number):boolean {
 return !touchLayout||Math.min(availW,availH)>=700;
}
function applyCinematicFill():void {
 const safeL=read('--safe-l'),safeR=read('--safe-r'),safeT=read('--safe-t'),safeB=read('--safe-b');
 const availW=Math.max(1,innerWidth-safeL-safeR),availH=Math.max(1,innerHeight-safeT-safeB);
 const cinematic=cinematicEligible(availW,availH);
 document.body.classList.toggle('cinematic-fill',cinematic);
 if(!cinematic){
  viewport.style.left='';viewport.style.top='';viewport.style.transform='';
  return;
 }
 const scale=Math.max(availW/RENDER_WIDTH,availH/RENDER_HEIGHT);
 viewport.style.width=`${RENDER_WIDTH*scale}px`;
 viewport.style.height=`${RENDER_HEIGHT*scale}px`;
 viewport.style.left=`${safeL+availW/2}px`;
 viewport.style.top=`${safeT+availH/2}px`;
 viewport.style.transform='translate(-50%,-50%)';
}
let queued=false;
function queueApply(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;applyCinematicFill();});}
window.addEventListener('resize',queueApply);
window.addEventListener('orientationchange',queueApply);
document.addEventListener('fullscreenchange',queueApply);
applyCinematicFill();
