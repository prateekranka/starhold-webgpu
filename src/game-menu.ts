import './game-menu.css';

type MenuScreen='main'|'new'|'confirm'|'options'|'settings'|'how'|'about';
type DefaultFaction='ask'|'0'|'1';
type MenuSize='compact'|'standard'|'large';
interface MenuPrefs {
 defaultFaction:DefaultFaction;
 minimapOnStart:boolean;
 confirmNewGame:boolean;
 menuSize:MenuSize;
 highContrast:boolean;
 showTips:boolean;
}
const STORAGE='starhold.game-menu.v1';
const FACTIONS=['Dawnward Compact','Cinderwake Reavers'] as const;
const body=document.body,root=document.documentElement;
const defaults:MenuPrefs={defaultFaction:'ask',minimapOnStart:true,confirmNewGame:true,menuSize:'standard',highContrast:false,showTips:true};
function readPrefs():MenuPrefs {
 try{
  const raw=JSON.parse(localStorage.getItem(STORAGE)??'null') as Partial<MenuPrefs>|null;
  if(!raw)return {...defaults};
  const defaultFaction:DefaultFaction=raw.defaultFaction==='0'||raw.defaultFaction==='1'?raw.defaultFaction:'ask';
  const menuSize:MenuSize=raw.menuSize==='compact'||raw.menuSize==='large'?raw.menuSize:'standard';
  return {...defaults,...raw,defaultFaction,menuSize};
 }catch{return {...defaults};}
}
let prefs=readPrefs(),screen:MenuScreen='main',pendingFaction:0|1|null=null,lastMode=-1,lastOutcome=-1,lastNoHud=false;
const dialog=document.createElement('dialog');dialog.id='game-menu';dialog.setAttribute('aria-labelledby','game-menu-title');
const toggle=document.createElement('button');toggle.id='game-menu-toggle';toggle.type='button';toggle.textContent='MENU';toggle.setAttribute('aria-label','Open game menu');
document.body.append(toggle,dialog);
function writePrefs(){localStorage.setItem(STORAGE,JSON.stringify(prefs));applyPrefs();}
function applyPrefs(){
 body.classList.toggle('menu-high-contrast',prefs.highContrast);body.classList.toggle('menu-tips-off',!prefs.showTips);
 root.style.setProperty('--game-menu-scale',prefs.menuSize==='compact'?'.9':prefs.menuSize==='large'?'1.12':'1');
}
function currentState(){return window.__APP.getState();}
function activeGame(){const s=currentState();return s.mode===1&&s.outcome===0;}
function setNoHud(on:boolean){
 if(lastNoHud===on)return;lastNoHud=on;
 if(on)root.style.setProperty('--hud-h','0px');else root.style.removeProperty('--hud-h');
 requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
}
function syncChrome(){
 const s=currentState(),showcase=s.mode===0,noHud=showcase||dialog.open;
 body.classList.toggle('showcase-mode',showcase);body.classList.toggle('game-menu-open',dialog.open);toggle.hidden=dialog.open;
 setNoHud(noHud);
 if(s.mode!==lastMode||s.outcome!==lastOutcome){
  const returnedToShowcase=lastMode===1&&s.mode===0;
  lastMode=s.mode;lastOutcome=s.outcome;
  if(returnedToShowcase){screen='main';openMenu();return;}
  if(dialog.open)render();
 }
}
function openMenu(next:MenuScreen='main'){
 screen=next;if(!dialog.open)dialog.showModal();body.classList.add('game-menu-open');syncChrome();render();
}
function closeMenu(){if(dialog.open)dialog.close();screen='main';pendingFaction=null;syncChrome();}
function labelForMode(){const s=currentState();return s.mode===0?'LIVE SHOWCASE':s.outcome===0?'LIVE MATCH':'MATCH COMPLETE';}
function menuHeader(title:string,sub:string){return `<header class="gm-head"><div><p class="gm-kicker">STARHOLD · THE VESPER MARCH</p><h1 id="game-menu-title">${title}</h1><p>${sub}</p></div><span class="gm-live"><i></i>${labelForMode()}</span></header>`;}
function mainScreen(){
 const s=currentState(),canResume=s.mode===1&&s.outcome===0;
 const resumeNote=canResume?`${FACTIONS[s.player]} · Age ${s.age+1}`:'No active game in this browser tab';
 return `${menuHeader('MAIN MENU','The frontier keeps moving while you choose what comes next.')}
 <div class="gm-actions">
  <button class="gm-primary" data-action="resume" ${canResume?'':'disabled'}><strong>Resume Game</strong><small>${resumeNote}</small></button>
  <button data-action="new"><strong>New Game</strong><small>Choose a civilization and begin a fresh march</small></button>
  ${s.mode===0?'<button data-action="watch"><strong>Watch Showcase</strong><small>Hide the menu and watch the colony run</small></button>':''}
  <button data-action="options"><strong>Options</strong><small>New-game behavior and map preferences</small></button>
  <button data-action="settings"><strong>Settings</strong><small>Menu display and accessibility</small></button>
  <button data-action="how"><strong>How to Play</strong><small>Controls, building, training and research</small></button>
  <button data-action="about"><strong>About</strong><small>What this build is and where Starhold is going</small></button>
 </div>
 ${s.mode===1?'<button class="gm-text gm-danger" data-action="showcase">Return to Showcase</button>':''}
 <footer class="gm-tip">Resume is intentionally session-only for now; persistent save files are not implemented yet.</footer>`;
}
function newGameScreen(){
 const active=activeGame(),defaultValue=prefs.defaultFaction;
 return `${menuHeader('NEW GAME',active?'Starting a new game replaces the current in-tab match.':'Choose the civilization you want to command.')}
 <div class="gm-factions">
  <button data-faction="0" class="${defaultValue==='0'?'gm-default':''}"><span class="gm-faction-mark dawn">D</span><span><strong>Dawnward Compact</strong><small>Ordered expansion · defensive infrastructure · disciplined lines</small></span>${defaultValue==='0'?'<em>DEFAULT</em>':''}</button>
  <button data-faction="1" class="${defaultValue==='1'?'gm-default':''}"><span class="gm-faction-mark cinder">C</span><span><strong>Cinderwake Reavers</strong><small>Mobile raiding · salvage industry · Ash Jackal pressure</small></span>${defaultValue==='1'?'<em>DEFAULT</em>':''}</button>
 </div>
 <footer class="gm-tip">This is the live skirmish simulation, not a pre-rendered demo.</footer>${backButton()}`;
}
function confirmScreen(){const f=pendingFaction??0;return `${menuHeader('REPLACE CURRENT GAME',`Start a fresh ${FACTIONS[f]} match?`)}<p class="gm-copy">The current match exists only in this browser tab and will be discarded.</p><div class="gm-inline"><button class="gm-primary" data-action="confirm-start"><strong>Start New Game</strong></button><button data-action="back-new"><strong>Cancel</strong></button></div>`;}
function optionsScreen(){return `${menuHeader('OPTIONS','Gameplay-facing defaults for starting a new match.')}
 <div class="gm-form">
  <label><span>Default civilization</span><select id="gm-default-faction"><option value="ask" ${prefs.defaultFaction==='ask'?'selected':''}>Ask every time</option><option value="0" ${prefs.defaultFaction==='0'?'selected':''}>Dawnward Compact</option><option value="1" ${prefs.defaultFaction==='1'?'selected':''}>Cinderwake Reavers</option></select></label>
  <label class="gm-check"><input id="gm-minimap-start" type="checkbox" ${prefs.minimapOnStart?'checked':''}><span><strong>Open minimap at match start</strong><small>You can still close or drag it during play.</small></span></label>
  <label class="gm-check"><input id="gm-confirm-new" type="checkbox" ${prefs.confirmNewGame?'checked':''}><span><strong>Confirm before replacing an active match</strong><small>Recommended until persistent saves exist.</small></span></label>
 </div>${backButton()}`;}
function settingsScreen(){return `${menuHeader('SETTINGS','Display and accessibility controls for the menu layer.')}
 <div class="gm-form">
  <label><span>Menu size</span><select id="gm-menu-size"><option value="compact" ${prefs.menuSize==='compact'?'selected':''}>Compact</option><option value="standard" ${prefs.menuSize==='standard'?'selected':''}>Standard</option><option value="large" ${prefs.menuSize==='large'?'selected':''}>Large</option></select></label>
  <label class="gm-check"><input id="gm-contrast" type="checkbox" ${prefs.highContrast?'checked':''}><span><strong>High-contrast menu</strong><small>Brighter borders and focus states without changing the game renderer.</small></span></label>
  <label class="gm-check"><input id="gm-tips" type="checkbox" ${prefs.showTips?'checked':''}><span><strong>Show menu tips</strong><small>Small context notes at the bottom of menu screens.</small></span></label>
  <button data-action="fullscreen"><strong>${document.fullscreenElement?'Exit Fullscreen':'Enter Fullscreen'}</strong><small>Uses the browser fullscreen API when available.</small></button>
  <button class="gm-text" data-action="reset-settings">Reset menu settings</button>
 </div>${backButton()}`;}
function howScreen(){return `${menuHeader('HOW TO PLAY','A compact field guide for the current build.')}
 <div class="gm-prose"><ol><li><strong>Select</strong> units or buildings by clicking/tapping them.</li><li><strong>Build and train</strong> from the context bar. Construction and production spend Alloy and Charge.</li><li><strong>Research</strong> civilization upgrades when the required producer, age and resources are available.</li><li><strong>Move the camera</strong> with drag/pan, quarter-turn rotation and zoom controls; the minimap can jump across the world.</li><li><strong>Win the skirmish</strong> by using your faction's economy, positioning and combat roster rather than treating the showcase as the game.</li></ol><p>On touch devices every primary control is sized for direct manipulation. The Workshop contains deeper development/testing tools but is not part of the production game UI.</p></div>${backButton()}`;}
function aboutScreen(){return `${menuHeader('ABOUT STARHOLD','An isometric RTS about two civilizations pushing into the Vesper March.')}
 <div class="gm-prose"><p><strong>Dawnward Compact</strong> establishes order through civic infrastructure and disciplined defensive lines. <strong>Cinderwake Reavers</strong> move fast, salvage aggressively and turn expedition machinery into weapons.</p><p>The animated scene behind this menu is the actual deterministic Rust/WASM simulation rendered through Starhold's WebGPU renderer. It stays alive on the title screen so the menu also acts as a glimpse of the systems and factions still being built.</p><p class="gm-muted">Pre-release prototype · WebGPU renderer · deterministic simulation · desktop, iPad and iPhone targets.</p>${import.meta.env.DEV?'<p><a href="/tools/">Open Developer Workshop ↗</a></p>':''}</div>${backButton()}`;}
function backButton(){return '<button class="gm-text gm-back" data-action="back">← Back to Main Menu</button>';}
function render(){
 if(!dialog.open)return;
 dialog.innerHTML=screen==='main'?mainScreen():screen==='new'?newGameScreen():screen==='confirm'?confirmScreen():screen==='options'?optionsScreen():screen==='settings'?settingsScreen():screen==='how'?howScreen():aboutScreen();
 queueMicrotask(()=>dialog.querySelector<HTMLElement>('button:not([disabled]), select, input')?.focus());
}
function ensureMinimapPreference(){requestAnimationFrame(()=>{
 const state=currentState(),open=state.minimap.open;
 if(prefs.minimapOnStart&&!open)document.getElementById('hud-minimap')?.click();
 if(!prefs.minimapOnStart&&open)document.getElementById('minimap-close')?.click();
});}
function startFaction(faction:0|1){pendingFaction=null;window.__APP.startMatch(faction);ensureMinimapPreference();closeMenu();}
function changeScreen(next:MenuScreen){screen=next;render();}
function installAppHooks(){
 const app=window.__APP,originalStart=app.startMatch.bind(app),originalReset=app.resetShowcase.bind(app);
 app.startMatch=(faction)=>{originalStart(faction);closeMenu();syncChrome();};
 app.resetShowcase=()=>{originalReset();screen='main';openMenu();};
}
dialog.addEventListener('click',event=>{
 const target=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!target)return;
 const faction=target.dataset.faction;if(faction==='0'||faction==='1'){
  const f=faction==='1'?1:0;
  if(activeGame()&&prefs.confirmNewGame){pendingFaction=f;changeScreen('confirm');}else startFaction(f);
  return;
 }
 switch(target.dataset.action){
  case 'resume':closeMenu();break;
  case 'new':changeScreen('new');break;
  case 'watch':closeMenu();break;
  case 'options':changeScreen('options');break;
  case 'settings':changeScreen('settings');break;
  case 'how':changeScreen('how');break;
  case 'about':changeScreen('about');break;
  case 'back':case 'back-new':changeScreen('main');pendingFaction=null;break;
  case 'confirm-start':startFaction(pendingFaction??0);break;
  case 'showcase':window.__APP.resetShowcase();break;
  case 'fullscreen':void (document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.()).catch(()=>{});break;
  case 'reset-settings':prefs={...defaults};writePrefs();render();break;
 }
});
dialog.addEventListener('change',event=>{
 const target=event.target;
 if(target instanceof HTMLSelectElement&&target.id==='gm-default-faction'){prefs.defaultFaction=target.value as DefaultFaction;writePrefs();}
 if(target instanceof HTMLSelectElement&&target.id==='gm-menu-size'){prefs.menuSize=target.value as MenuSize;writePrefs();}
 if(target instanceof HTMLInputElement&&target.id==='gm-minimap-start'){prefs.minimapOnStart=target.checked;writePrefs();}
 if(target instanceof HTMLInputElement&&target.id==='gm-confirm-new'){prefs.confirmNewGame=target.checked;writePrefs();}
 if(target instanceof HTMLInputElement&&target.id==='gm-contrast'){prefs.highContrast=target.checked;writePrefs();}
 if(target instanceof HTMLInputElement&&target.id==='gm-tips'){prefs.showTips=target.checked;writePrefs();}
});
dialog.addEventListener('cancel',event=>{event.preventDefault();if(screen!=='main'){changeScreen('main');pendingFaction=null;}else closeMenu();});
dialog.addEventListener('close',syncChrome);toggle.onclick=()=>openMenu('main');
document.addEventListener('fullscreenchange',()=>{if(dialog.open&&screen==='settings')render();});
function waitForApp(){
 if(!window.__APP){requestAnimationFrame(waitForApp);return;}
 installAppHooks();applyPrefs();openMenu('main');syncChrome();setInterval(syncChrome,200);
}
waitForApp();
