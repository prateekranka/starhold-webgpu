// Starhold Authoritative Actor Specifications
// Single source of truth for architectural details, procedural rigs, roles, and silhouettes
// Shared across the Main Game, Roster Lab, Civilization Codex, Asset Forge, and Encounter Lab.

export const BUILDING_ARCHITECTURAL_DETAILS: Record<number, string[]> = {
  10: [
    'Comms dish & telemetry spire rotating atop 5-meter tower peak',
    'Dual battlements searchlights sweeping forward perimeter in real time',
    'Four stepped ivory bastions with corner gold civic finials',
    'Paired muster banners fluttering above arched civic gate',
  ],
  11: [
    'Automated monorail hoist track with traveling alloy container',
    'Projecting 3-meter gantry crane over central freight apron',
    'Suspended alloy cargo pod and loading mouth warning strobe',
    'Quayside stacked alloy build kits on cobblestone foundation',
  ],
  12: [
    'Pulsating energy containment rings rising along crystal spire',
    'Four peripheral solar tracking mirror vanes aligning to sun angle',
    'Raised cyan prism lens on tripod pylon anchoring Prism Lattice',
    'Hexagonal wellhead basin with shimmering energy motes',
  ],
  13: [
    'Tactical dummy with armor plate in exterior training yard',
    'Vaulted 3-tier stepped roof with reinforced ridge beam',
    'Paired heavy iron portcullis gates with flank shield racks',
    'High observation lantern and fluttering company standard',
  ],
  14: [
    'Dense billowing voxel smoke plume drifting realistically with wind',
    'Heavy reciprocating molten drop hammer striking with sparks',
    'High-speed cooling ventilation turbine spinning on flank',
    'Open furnace mouth with glowing orange hearth and anvil apron',
  ],
  15: [
    'Atmospheric vapor condenser spinning atop central living dome',
    'Flashing green/teal environmental beacon on high mast',
    'Triple vaulted civic domes on low stone retaining plinth',
    'Rooftop ventilation chimney venting pale chimney smoke',
  ],
  16: [
    'Revolving crystalline laser focusing rings around turret emitter',
    'Stepped triple-tier bastion tower with corner buttresses',
    'Base capacitor banks with pulsing energy status conduits',
    'High-energy optical aperture ready for long-range defense',
  ],
  17: [
    'Marching runway deck sequenced approach landing lights',
    'Elevated flight control hut with spinning radar antenna',
    'Traversing heavy gantry crane with skiff mooring cradle',
    'Crescent landing pier edge overhanging open harbor slip',
  ],
  60: [
    'Billowing dark soot plume from aft stack and furnace embers',
    'Pointed barge runners with exposed caged ember core',
    'Suspended aft boarding hook mast with swaying iron chains',
    'Armor plates locked at unequal elevations with salvaged trim',
  ],
  61: [
    'Grinding crusher tooth rolls chewing incoming salvage scrap',
    'Flying metallic scrap sparks erupting on active crusher cycle',
    'Tilted sorting conveyor chute with climbing breaker teeth',
    'Armored salvage intake bulwarks with pneumatic cutter ram',
  ],
  62: [
    'Rocking walking-beam pump jack with polished plunger rod',
    'Jointed siphon arm pivoting over caged star ember',
    'High-pressure steam relief vent puffs exhausting periodically',
    'Reinforced cage struts anchored into asymmetrical wedge base',
  ],
  63: [
    'Central roaring iron skull brazier blazing with flame particles',
    'Swaying trophy cage and perimeter weapon racks on spiked posts',
    'Circular fighting pit ringed by 8 hooked barrier pylons',
    'Salvaged armor trim and soot-blackened foundation runners',
  ],
  64: [
    'Traversing overhead gantry bridge feeding reciprocating tooth press',
    'Molten spark scatter on hydraulic downward compression cycle',
    'Suspended chain lift hoist carriage raising salvage containers',
    'Unequal gantry towers with exposed drive sprockets and cables',
  ],
  65: [
    'Rapidly spinning scrap metal wind turbine on elevated mast',
    'Rusted chimney stack venting dark soot puffs into wind',
    'Stacked stilt shelters with patched canvas tarps and swaying lantern',
    'Offset salvage platforms connected by welded ladders',
  ],
  66: [
    'Rotating harpoon launcher turret actively scanning the horizon',
    'Tensioned recovery chain winch with coiled steel cable',
    'Forward-thrown harpoon head with barbed boarding hook',
    'Lookout platform with orange warning beacon and searchlight',
  ],
  67: [
    'Twin launch rails with traveling magnetic spark discharges',
    'Hydraulic clamping docking arms on twin slip gantries',
    'Alternating hazard strobe beacons on twin launch towers',
    'Reinforced arrested landing cables and open skyway slip',
  ],
};

export const UNIT_PROCEDURAL_DETAILS: Record<number, string[]> = {
  20: [
    'Heavy industrial tracked chassis with gait stride articulation',
    'Pneumatic rivet drill with strike flash and welding arc',
    'Hydraulic manipulator claw and rear ore storage hopper',
    'Stepped ivory torso with cyan slit sensor glass',
  ],
  21: [
    'Low armored hexapod chassis with six animated stepping legs',
    'Hydraulic cargo flatbed carrying strapped alloy crates',
    'Heavy domed carapace and sensory antennules',
    'Passive retreat behavior with defensive posture tucking',
  ],
  22: [
    'Massive tower shield forward with pulsing cyan energy emitter',
    'Upright armored legionary torso with gold crest helm',
    'Power spear arm with animated forward jab attack cycle',
    'Shield bash stagger frame followed by armor piercing thrust',
  ],
  23: [
    'Braced pavise shield mount with deployed bipod stabilizer',
    'Long kinetic lance-rifle with muzzle flash and two-pixel recoil',
    'Optical scope visor on upright knight chassis',
    'High-damage single-target sniper attack from range 7',
  ],
  24: [
    'Gull-wing aerodynamic hover skiff with cyan drive sails',
    'Rear pulse thrusters emitting glowing blue ion exhaust motes',
    'Underslung cargo winch with single-crate belly clamp',
    'High-speed aerial courier movement with banking roll',
  ],
  25: [
    'Tall tactical banner pole carrying fluttering standard',
    'Hovering crystal prism lantern with pulsating resonance light',
    'Protective ward projector expanding an energy field to nearby allies',
    'Empowers local repair rates and reduces incoming projectile damage',
  ],
  26: [
    'Heavy tracked dreadnought chassis with articulated continuous treads',
    'Elevated shoulder mortar with recoil shockwave and shell ejection',
    'Heavy forward hydraulic power ram head on reinforced rails',
    'Twin diesel boilers with smoking exhaust ticks and rumble vibration',
  ],
  30: [
    'Articulated 4-legged runner chassis fused to centaur archer torso',
    'Drawn composite ember bow with arrow release and tracer trail',
    'Rear quiver rack with flame fletchings and stabilizing tail fin',
    'High-mobility skirmisher firing on the run with running draw',
  ],
  31: [
    'Reverse-jointed heavy bipedal walker with hydraulic shock struts',
    'Rear-mounted arcing incendiary mortar cannon',
    'Pronounced stance sway with arcing projectile shell ejection',
    'Heavy fire support unit that damages fortifications over obstacles',
  ],
  32: [
    'Crouched scavenger chassis with salvage hood and optic visor',
    'Articulated pry lever arm and magnetic salvage hook',
    'Backpack junk collector hopper emitting salvage puffs on harvest',
    'Dismantles wrecks to recover 35% of building and unit alloy',
  ],
  33: [
    'Four-legged pack walker chassis with articulated head bob',
    'Dual flank salvage hooks carrying hanging scrap bundles',
    'Rapid hauler chassis outrunning standard infantry',
    'Open engine bay with reciprocating drive belts and soot puff',
  ],
  34: [
    'Armored boarding dreadnought with reinforced plank shield',
    'Heavy boarding hook cleaver with forward drag and chop animation',
    'Massive spiked power fist with orange furnace heat vents',
    'Pins fast enemy units and prevents tactical retreat',
  ],
  35: [
    'Swept-wing mechanical ornithopter glider with hover bob cycle',
    'Twin underslung ember dart launcher pods',
    'Thermal soot contrail motes trailing swept wingtips',
    'Fast aerial raider with dart spit attack and swift scouting speed',
  ],
  36: [
    'Torch-bearer silhouette carrying blazing ember brand',
    'Off-hand mark glyph projector with target beacon reveal flash',
    'Crackling ember sparks and fluttering red trail sash',
    'Marks high-value targets to reduce their armor and reveal terrain',
  ],
};

export interface ActorRoleProfile {
  role: string;
  silhouette: string;
  motion: string;
  lore: string;
}

export const ACTOR_PROFILES: Record<number, ActorRoleProfile> = {
  10: {
    role: 'Colony Command Citadel',
    silhouette: 'Central 4x4 keep with tiered ivory bastions and communications spire',
    motion: 'Rotating telemetry dish, sweeping battlements spotlights, fluttering muster banners',
    lore: 'The sovereign heart of every Dawnward settlement, coordinating defense, supply, and colony expansion.',
  },
  11: {
    role: 'Logistics Distribution Hub',
    silhouette: 'Low-slung 3x3 depot with high gantry crane and monorail loading apron',
    motion: 'Traversing hoist hoist carriage, container loading strobe, quayside workers',
    lore: 'Collects raw alloy from beetle haulers and routes material build kits to active construct sites.',
  },
  12: {
    role: 'Power Generation & Prism Node',
    silhouette: 'Slender 2x2 energy spire with crystal containment and solar vanes',
    motion: 'Pulsing energy rings, rotating solar mirrors, shimmering field particles',
    lore: 'Harnesses atmospheric solar radiation to generate continuous charge for advanced weaponry.',
  },
  13: {
    role: 'Infantry Barracks & Drill Yard',
    silhouette: 'Vaulted 3x3 training hall with iron portcullis gates and flag mast',
    motion: 'Rooftop banner flutter, training yard dummy swings, lantern glow',
    lore: 'Equips and drills Ward Sentinels and Sunlance marksmen for frontline deployment.',
  },
  14: {
    role: 'Heavy Armory & Mechanical Foundry',
    silhouette: 'Industrial 3x3 forge with twin smoking chimneys and open furnace hearth',
    motion: 'Reciprocating drop hammer strikes with spark bursts, spinning turbine vent',
    lore: 'Casts reinforced plating and mechanical chassis for Star Rams and armored siege engines.',
  },
  15: {
    role: 'Living Quarters & Habitat Pods',
    silhouette: 'Clustered 3x2 domed habitats with vapor condensers and vents',
    motion: 'Spinning roof condenser, pale chimney smoke, beacon strobe',
    lore: 'Provides life support, sustenance, and workforce capacity for the growing colony.',
  },
  16: {
    role: 'Defensive Laser Turret',
    silhouette: 'Fortified 2x2 stepped pylon with revolving crystal emitter head',
    motion: 'Focusing rings spinning on target lock, base capacitor pulse',
    lore: 'Focuses high-yield coherent beams across defensive perimeter sectors.',
  },
  17: {
    role: 'Aerial Docking Slip & Flight Deck',
    silhouette: 'Extended 4x3 crescent runway pier with elevated control tower',
    motion: 'Sequenced landing strobes, radar sweep, traversing skiff cradle',
    lore: 'Services, repairs, and launches high-altitude skiffs and transport skimmers.',
  },
  20: {
    role: 'Heavy Resource Harvester & Builder',
    silhouette: 'Blocky tracked chassis with pneumatic rivet arm and collector hopper',
    motion: 'Reciprocating tracked crawl with drilling strikes and welding sparks',
    lore: 'The tireless backbone of Dawnward logistics, excavating rock and erecting buildings.',
  },
  21: {
    role: 'Armored Cargo Transport',
    silhouette: 'Low-profile hexapod with domed chitin carapace and crate flatbed',
    motion: 'Rhythmic 6-legged crawl with defensive tuck on damage',
    lore: 'Transports raw alloy from mineral outcroppings to the colony keep under enemy fire.',
  },
  22: {
    role: 'Frontline Defensive Vanguard',
    silhouette: 'Towering knight with massive crest shield and hydraulic lance',
    motion: 'Heavy forward march with shield bash impact and thrusting spear stroke',
    lore: 'Forms unbreakable defensive phalanxes that absorb incoming assault waves.',
  },
  23: {
    role: 'Precision Long-Range Sniper',
    silhouette: 'Slender marksman silhouette with braced pavise shield and long rail-lance',
    motion: 'Stationary sniper crouch with heavy two-pixel weapon recoil',
    lore: 'Picks off hostile leaders and artillery engines from long distance before they reach walls.',
  },
  24: {
    role: 'Rapid Recon Skimmer',
    silhouette: 'Swept-wing gull craft hovering low over terrain with glowing thruster motes',
    motion: 'Dynamic banking turns, altitude bob, trailing blue thruster sparks',
    lore: 'Patrols outer canyons and spots hostile incursions through the fog of war.',
  },
  25: {
    role: 'Tactical Support & Ward Buffer',
    silhouette: 'Robed technician with hovering resonance crystal lantern and company standard',
    motion: 'Pulsating lantern oscillation and defensive ward aura emission',
    lore: 'Channels protective energy fields that mitigate damage to adjacent allied formations.',
  },
  26: {
    role: 'Heavy Siege Walker & Demolisher',
    silhouette: 'Massive dual-track titan with front hydraulic ram and shoulder mortar',
    motion: 'Heavy ground-rumbling tread cycle, mortar blast recoil, smoke venting',
    lore: 'Smashes fortified enemy encampments and reduces heavy structures to rubble.',
  },
  30: {
    role: 'High-Mobility Centaur Archer',
    silhouette: 'Four-legged quadruped runner with mounted archer chassis and ember bow',
    motion: 'Galloping stride with running arrow draw and fiery projectile release',
    lore: 'Strikes quickly from the desert flanks and vanishes before heavy defenders can engage.',
  },
  31: {
    role: 'Artillery Walker & Area Denial',
    silhouette: 'Reverse-jointed heavy biped walker with arcing incendiary mortar battery',
    motion: 'Hydraulic leg compression on mortar fire, arcing shell trail, smoke puff',
    lore: 'Bombards defensive positions with high-trajectory incendiary munitions.',
  },
  32: {
    role: 'Battlefield Scavenger & Reclaimer',
    silhouette: 'Crouched scavenger chassis with magnetic pry arm and junk collector hopper',
    motion: 'Prying salvage strikes, scrap puffs, rapid scuttle',
    lore: 'Recovers critical alloy from wreckage and dismantled structures amidst active battles.',
  },
  33: {
    role: 'Fast Salvage Hauler',
    silhouette: 'Four-legged pack chassis carrying dangling scrap bundles on flank hooks',
    motion: 'Rapid head-bobbing trot with swaying cargo bundles and drive-belt rotation',
    lore: 'Transports recovered scrap back to Cinderwake scrap maws with superior speed.',
  },
  34: {
    role: 'Heavy Boarding Cleaver & Brawler',
    silhouette: 'Armored reaver dreadnought with spiked iron shield and barbed boarding hook',
    motion: 'Brutal overhead cleaver chops and forward hydraulic dragging pull',
    lore: 'Breaches enemy lines and locks defenders in close-quarters melee combat.',
  },
  35: {
    role: 'Aerial Raider & Flanker',
    silhouette: 'Mechanical ornithopter with swept wings and twin incendiary dart pods',
    motion: 'Rapid flapping wing cycle with soot contrail motes trailing wingtips',
    lore: 'Strikes rear worker columns and vulnerable power infrastructure from the air.',
  },
  36: {
    role: 'Beacon Projector & Target Spotter',
    silhouette: 'Hooded torchbearer carrying blazing ember brand and off-hand projector',
    motion: 'Sweeping brand sparks and targeting beam projection',
    lore: 'Marks high-value targets to weaken their armor and illuminate fogged terrain.',
  },
  60: {
    role: 'Scrap Iron Command Barge',
    silhouette: 'Heavy 4x4 tracked barge fortress with exposed furnace core and boarding crane',
    motion: 'Massive soot stack plumes, swaying chain hoists, glowing firebox',
    lore: 'The mobile warlord stronghold of the Cinderwake Reavers, leading raiding columns.',
  },
  61: {
    role: 'Automated Scrap Shredder & Refinery',
    silhouette: 'Industrial 3x3 crusher mill with rotating tooth rollers and conveyor chute',
    motion: 'Grinding roller teeth with metal spark eruptions and reciprocating ram',
    lore: 'Recycles harvested battlefield salvage into pure usable alloy ingots.',
  },
  62: {
    role: 'Star Ember Extraction Siphon',
    silhouette: 'Asymmetrical 2x2 walking-beam pump jack anchored over caged star ember',
    motion: 'Pivoting pump beam, rising plunger rod, escaping steam puffs',
    lore: 'Draws volatile thermal energy from subterranean planetary magma fractures.',
  },
  63: {
    role: 'Gladiator Arena & Raider Pit',
    silhouette: 'Circular 3x3 fighting yard with central iron skull brazier and spiked posts',
    motion: 'Roaring skull flames, swaying trophy cages, weapon sparks',
    lore: 'Breeds hardened Ash Jackal skirmishers and boarding fighters.',
  },
  64: {
    role: 'Heavy Mech Assembly Works',
    silhouette: 'Massive 3x3 industrial press with overhead traveling gantry crane',
    motion: 'Hydraulic press smash with spark scatter, traveling hoist carriage',
    lore: 'Assembles heavy Cinder Strider artillery walkers and armored dreadnoughts.',
  },
  65: {
    role: 'Rooftop Flier Roosts & Scrap Shack',
    silhouette: 'Multi-level 3x2 stilt platform with scrap wind turbine and rusted smokestack',
    motion: 'Spinning scrap metal turbine blades, intermittent chimney soot puffs',
    lore: 'Houses and maintains mechanical Sootwing gliders and rapid scouts.',
  },
  66: {
    role: 'Perimeter Harpoon Spire',
    silhouette: 'Fortified 2x2 defense tower with rotating heavy harpoon launcher',
    motion: 'Turret target scanning, orange warning strobe, tensioned cable winch',
    lore: 'Fires high-tensile steel harpoons that impale and slow incoming attackers.',
  },
  67: {
    role: 'Volatile Rift Mooring & Air Slip',
    silhouette: 'Twin-rail 4x3 air slipway with arresting cables and launch towers',
    motion: 'Rail spark discharges, clamping docking arms, hazard beacon strobes',
    lore: 'Catapults fast raiding skiffs and gliders across the planetary frontier.',
  },
};

export function getActorDetails(kind: number): {
  details: string[];
  role: string;
  silhouette: string;
  motion: string;
  lore: string;
} {
  const details = UNIT_PROCEDURAL_DETAILS[kind] ?? BUILDING_ARCHITECTURAL_DETAILS[kind] ?? [];
  const profile = ACTOR_PROFILES[kind] ?? {
    role: 'Field Asset',
    silhouette: 'Procedural voxel model',
    motion: 'Animated procedural cycle',
    lore: 'Operates in the Vesper March.',
  };
  return { details, ...profile };
}
