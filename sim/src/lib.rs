//! ABI kinds: 10 Keep, 11 Court, 12 Well, 13 Hall, 14 Forge, 15 Hearth,
//! 16 Bastion, 17 Wharf; 20 Riveter, 21 Beetle, 22 Sentinel, 23 Sunlance,
//! 24 Skiff, 30 Jackal, 31 Strider; 40 Ore, 41 Drone, 42 Freighter,
//! 43 Relief, 50 Projectile, 51 Impact, 52 Wreck.
//! States: 0 idle, 1 move, 2 attack, 3 work, 4 death, 5 construct,
//! 6 retreat, 7 dock, 8 repair, 9 inactive.
//! Snapshot: x,y,z,yaw,kind,state,anim_phase,health,selected,faction,param0,param1.
use std::cell::RefCell;
mod research;
mod actors;
mod nav;
mod lab;
#[cfg(test)] mod workshop_tests;
const CAP: usize = 160;
const STRIDE: usize = 12;
// Two staggered ranks on the eastern terrace. At yaw 0 adjacent centers
// project at least 13 pixels apart; every foot stays on the z=.5 mesa.
const RAID_POSTS: [(f32,f32);8] = [(26.6,16.),(26.6,18.6),(26.6,21.2),(28.3,15.1),(28.3,17.7),(28.3,20.3),(27.,23.6),(28.3,22.9)];
// Planted infantry screen in front of the buildings, with rifle support behind.
const GUARD_POSTS: [(f32,f32);6] = [(23.1,15.8),(23.2,18.4),(23.1,21.),(19.5,24.),(19.,18.8),(19.3,22.)];
#[derive(Clone, Copy)]
struct Entity { data: [f32; STRIDE], x: i32, y: i32, target: usize, timer: u32, route: usize, origin: [f32;3], destination: [f32;3], damage: f32, active: bool }
impl Entity {
    const EMPTY: Self = Self { data: [0.; STRIDE], x: 0, y: 0, target: 0, timer: 0, route: 0, origin: [0.;3], destination: [0.;3], damage: 0., active: false };
}
struct Sim { entities: [Entity; CAP], snapshot: [f32; CAP*STRIDE], ids: [usize; CAP], terrain: [f32;1024], world: Vec<f32>, count: usize, tick: u32, accumulator: f64, rng: u32, selected: usize, selected_group: [bool; CAP], alloy: u32, charge: u32, mode: u32, game: Match, research: research::ResearchState, actors: actors::ActorState, lab: lab::LabState }
thread_local! { static SIM: RefCell<Sim> = RefCell::new(Sim { entities:[Entity::EMPTY;CAP], snapshot:[0.;CAP*STRIDE], ids:[0;CAP], terrain:[0.;1024], world:Vec::new(), count:0,tick:0,accumulator:0.,rng:1,selected:CAP,selected_group:[false;CAP],alloy:160,charge:120,mode:0,game:Match::EMPTY,research:research::ResearchState::EMPTY,actors:actors::ActorState::EMPTY,lab:lab::LabState::EMPTY }); }
fn height(x:f32,y:f32)->f32 {
    if (7. ..25.).contains(&x) && (9. ..26.).contains(&y) || (23. ..29.).contains(&x) && (7. ..26.).contains(&y) || (3. ..10.).contains(&x) && (15. ..26.).contains(&y) || x>=24. && y<=14. {0.5}
    else if (7. ..14.).contains(&x) && (3. ..9.).contains(&y) {1.} else if x<2. || y<2. || x>30. || y>30. {-1.} else {0.}
}

// ---- Expansive world (LARGEMAP_SPEC §2). The showcase scenario above is
// frozen. This world is built only for a world match (mode 1) and never touches
// sim_init, its 32x32 terrain buffer, or the legacy height() function.
const WORLD: usize = 1024;         // tiles per side, 2^10 for cheap indexing
const METRES_PER_TILE: u32 = 10;   // world is 10.24 km x 10.24 km
/// Integer hash. Every world value comes from here, so the world is identical
/// on every platform and in every run of the same seed.
fn whash(seed:u32,x:i32,y:i32)->u32 {
    let mut h=seed^(x as u32).wrapping_mul(0x9E37_79B1)^(y as u32).wrapping_mul(0x85EB_CA77);
    h^=h>>15;h=h.wrapping_mul(0x2545_F491);h^=h>>13;h=h.wrapping_mul(0x27D4_EB2F);h^=h>>16;h
}
/// Bilinear value noise with a smoothstep, in 0..1. No transcendentals.
fn wnoise(seed:u32,x:f32,y:f32)->f32 {
    let xi=x.floor();let yi=y.floor();let (ix,iy)=(xi as i32,yi as i32);
    let xf=x-xi;let yf=y-yi;let u=xf*xf*(3.-2.*xf);let v=yf*yf*(3.-2.*yf);
    let a=whash(seed,ix,iy) as f32/4294967296.;
    let b=whash(seed,ix+1,iy) as f32/4294967296.;
    let c=whash(seed,ix,iy+1) as f32/4294967296.;
    let d=whash(seed,ix+1,iy+1) as f32/4294967296.;
    let top=a+(b-a)*u;let bottom=c+(d-c)*u;top+(bottom-top)*v
}
/// Four octaves of value noise, normalised to 0..1.
fn wfbm(seed:u32,x:f32,y:f32)->f32 {
    let mut sum=0.;let mut amp=1.;let mut freq=1.;let mut norm=0.;let mut i=0u32;
    while i<4 {sum+=amp*wnoise(seed.wrapping_add(i.wrapping_mul(7919)),x*freq,y*freq);norm+=amp;amp*=0.5;freq*=2.;i+=1;}
    sum/norm
}
/// The wild country retains its seeded coast and terrace variety. Fine detail
/// modulates broad landforms, rather than cutting an equal amount everywhere.
fn world_gen(seed:u32,tx:usize,ty:usize)->f32 {
    let x=tx as f32;let y=ty as f32;
    let big=wfbm(seed,x/104.,y/104.);
    let fine=wnoise(seed^0x51ED_2701,x/19.,y/19.);
    let h=big*0.82+fine*0.18;
    if h<0.436 {-1.} else if h<0.472 {0.} else if h<0.524 {0.5} else {1.}
}
/// Composition anchors index starting slots, never factions. Prepare these
/// sites before flat_site searches them. Renderer.worldRoutes shares this layout.
fn world_start(side:usize)->(i32,i32) {
    if side==0 {(WORLD as i32/5,WORLD as i32/3)}else{(WORLD as i32*4/5,WORLD as i32*2/3)}
}
fn world_route(side:usize,lane:usize)->[(f32,f32);6] {
    let (x,y)=world_start(side);let (x,y)=(x as f32,y as f32);
    let m=if side==0 {1.}else{-1.};let mid=WORLD as f32/2.;
    if lane==0 {[(x,y),(x,y-38.*m),(x+90.*m,y-32.*m),(mid,mid-64.*m),(mid,mid-24.*m),(mid,mid)]}
    else {[(x,y),(x-38.*m,y),(x-48.*m,y+70.*m),(x+52.*m,y+83.*m),(mid-64.*m,mid+64.*m),(mid,mid)]}
}
fn corridor_path(from_side: usize, lane_out: usize, lane_in: usize) -> [(f32, f32); 11] {
    let r_out = world_route(from_side, lane_out % 2);
    let to_side = 1 - from_side;
    let r_in = world_route(to_side, lane_in % 2);
    [
        r_out[0], r_out[1], r_out[2], r_out[3], r_out[4], r_out[5],
        r_in[4], r_in[3], r_in[2], r_in[1], r_in[0],
    ]
}
fn world_outcrop(side:usize,group:usize)->(i32,i32) {
    let (x,y)=world_start(side);let m=if side==0 {1}else{-1};
    let (dx,dy)=[(0,-44),(-48,70),(-44,0)][group];(x+dx*m,y+dy*m)
}
impl Sim {
 /// Height under a point, from the world heightfield in a world match and from
 /// the frozen showcase function otherwise.
 fn ground(&self,x:f32,y:f32)->f32 {
  if self.mode==1 {let n=self.side() as usize;let tx=x.floor();let ty=y.floor();if tx<0.||ty<0.||tx>=n as f32||ty>=n as f32 {return -1.;}self.world[ty as usize*n+tx as usize]} else {height(x,y)}
 }
 fn side(&self)->u32 {if self.mode==1 {if self.lab.active{64}else{WORLD as u32}}else{32}}
 /// Is the 11x11 patch around a tile one flat land level? Used to place starts.
 fn patch_flat(&self,cx:i32,cy:i32)->bool {
  if cx<7||cy<7||cx>=WORLD as i32-7||cy>=WORLD as i32-7 {return false;}
  let z=self.world[cy as usize*WORLD+cx as usize];
  if z<0. {return false;}
  for y in (cy-6)..=(cy+6) {for x in (cx-6)..=(cx+6) {if self.world[y as usize*WORLD+x as usize]!=z {return false;}}}
  true
 }
 /// Nearest land tile, searched ring by ring. Used to anchor world deposits.
 fn land_near(&self,cx:i32,cy:i32,max:i32)->Option<(f32,f32)> {
  for ring in 0..max {
   let mut step=-ring;
   while step<=ring {
    for (x,y) in [(cx+step,cy-ring),(cx+step,cy+ring),(cx-ring,cy+step),(cx+ring,cy+step)] {
     if x>=2&&y>=2&&x<WORLD as i32-2&&y<WORLD as i32-2&&self.world[y as usize*WORLD+x as usize]>=0. {return Some((x as f32+0.5,y as f32+0.5));}
    }
    step+=1;
   }
  }
  None
 }
 /// Check whether straight line between two points stays on solid ground.
 fn line_clear(&self, x0: f32, y0: f32, x1: f32, y1: f32, samples: usize) -> bool {
  let count = samples.max(2);
  for i in 1..count {
   let t = i as f32 / count as f32;
   let sx = x0 + (x1 - x0) * t;
   let sy = y0 + (y1 - y0) * t;
   if self.ground(sx, sy) < 0. { return false; }
  }
  true
 }
 /// Nearest flat site, searched ring by ring from a target tile. Deterministic.
 fn flat_site(&self,tx:i32,ty:i32)->Option<(f32,f32)> {
  for ring in 0..220i32 {
   let mut step=-ring;
   while step<=ring {
    for (cx,cy) in [(tx+step,ty-ring),(tx+step,ty+ring),(tx-ring,ty+step),(tx+ring,ty+step)] {
     if self.patch_flat(cx,cy) {return Some((cx as f32+0.5,cy as f32+0.5));}
    }
    step+=1;
   }
  }
  None
 }
 /// Bounded landform stamps, built only at match init. No runtime terrain work.
 fn world_ridge(&mut self,cx:i32,cy:i32,length:i32,vertical:bool,seed:u32) {
  // Long unbroken core, two terraces per flank, tapered asymmetric ends. The
  // little end variation comes from the seed, not per-tile edge pinholes.
  let half=length/2;let tip=4+(seed%5) as i32;
  for along in -half-8..=half+8 {for across in -9..=9i32 {
   let end=(along.abs()-half).max(0);
   let d=across.abs()+end*2+if along < -half+tip {1}else{0};
   if d>9 {continue;}
   let (x,y)=if vertical {(cx+across,cy+along)}else{(cx+along,cy+across)};
   if x<1||y<1||x>=WORLD as i32-1||y>=WORLD as i32-1 {continue;}
   self.world[y as usize*WORLD+x as usize]=if d<=2 {1.}else if d<=5 {0.5}else{0.};
  }}
 }
 fn world_corridor(&mut self,a:(f32,f32),b:(f32,f32),radius:f32) {
  let (dx,dy)=(b.0-a.0,b.1-a.1);let len=dx*dx+dy*dy;
  let x0=(a.0.min(b.0)-radius).max(0.) as usize;let x1=(a.0.max(b.0)+radius).min((WORLD-1) as f32) as usize;
  let y0=(a.1.min(b.1)-radius).max(0.) as usize;let y1=(a.1.max(b.1)+radius).min((WORLD-1) as f32) as usize;
  for y in y0..=y1 {for x in x0..=x1 {
   let t=(((x as f32-a.0)*dx+(y as f32-a.1)*dy)/len).clamp(0.,1.);
   let d=(x as f32-a.0-t*dx).powi(2)+(y as f32-a.1-t*dy).powi(2);
   // The road and its shoulders have the SAME height. Shade, not a raised
   // ribbon of geometry, tracks the 3-tile-wide travelled core in the renderer.
   if d<=radius*radius {self.world[y*WORLD+x]=0.5;}
  }}
 }
 fn compose_world(&mut self,seed:u32) {
  for side in 0..2 {
   let (bx,by)=world_start(side);let m=if side==0 {1}else{-1};
   // No canyon in the entire 121x121 opening box, including its corners.
   // Outside the quiet core this preserves the existing terraces and rises.
   for y in by-64..=by+64 {for x in bx-64..=bx+64 {
    let i=y as usize*WORLD+x as usize;self.world[i]=self.world[i].max(0.);
   }}
   for (j,(dx,dy,len,vertical)) in [(0,-36,54,false),(-36,0,48,true),(38,22,54,true)].iter().enumerate() {
    self.world_ridge(bx+dx*m,by+dy*m,*len,*vertical,whash(seed,side as i32,j as i32));
   }
   // Ore outcrops occupy a low shelf at a ridge foot, not isolated crystals
   // floating over whatever noise happened to land under a random coordinate.
   for group in 0..3 {
    let (x,y)=world_outcrop(side,group);
    self.world_ridge(x+7*m,y,28,true,whash(seed,x,y));
   }
   // A 62–68 tile clearing, not a square terrace filling the whole camera.
   // A radius-31 disc is guaranteed flat; noise only moves its outer boundary.
   for y in by-34..=by+34 {for x in bx-34..=bx+34 {
    let d=((x-bx)*(x-bx)+(y-by)*(y-by)) as f32;
    let radius=31.+3.*wnoise(seed,x as f32/12.,y as f32/12.);
    if d<=radius*radius {
     self.world[y as usize*WORLD+x as usize]=0.5;
    }
   }}
  }
  // Two contested middle outcrops and two remote provinces, all clustered.
  for (j,(x,y)) in [(488,472),(544,550),(128,800),(896,224)].iter().enumerate() {
   self.world_ridge(*x+7,*y,40,true,whash(seed,j as i32,73));
  }
  // Stamp the connected network last: neither ridges nor ore can sever it.
  // Broad shoulders bridge canyons; a three-tile core is visibly distinct.
  for side in 0..2 {for lane in 0..2 {
   let points=world_route(side,lane);
   for j in 0..points.len()-1 {self.world_corridor(points[j],points[j+1],7.);}
  }}
 }
 fn random(&mut self)->u32 { let mut x=self.rng; x^=x<<13;x^=x>>17;x^=x<<5;self.rng=x;x }
 // The legacy initializer always adds slot zero first. Reset its mode here so
 // sim_init itself stays byte-identical, including when called after a match.
 // Match actors use match_add, and never pass through this showcase helper.
 fn add(&mut self,id:usize,kind:u32,x:f32,y:f32,faction:f32) { if id==0 {self.mode=0;} let mut e=Entity::EMPTY;e.active=true;e.x=(x*1024.) as i32;e.y=(y*1024.) as i32;e.data=[x,y,height(x,y),0.,kind as f32,0.,0.,1.,0.,faction,1.,0.];self.entities[id]=e; }
  fn pack(&mut self) { self.count=0;for i in 0..CAP {if self.entities[i].active {self.entities[i].data[8]=if self.selected==i||self.selected_group[i] {1.} else {0.};self.ids[self.count]=i;self.snapshot[self.count*STRIDE..(self.count+1)*STRIDE].copy_from_slice(&self.entities[i].data);self.count+=1;}} }
  fn walk(&mut self, id: usize, x: f32, y: f32, speed: f32) -> bool {
   if self.mode == 0 {
       let arrived;
       {
           let e = &mut self.entities[id];
           let dx = (x * 1024.) as i32 - e.x;
           let dy = (y * 1024.) as i32 - e.y;
           let dist = ((dx as f64).powi(2) + (dy as f64).powi(2)).sqrt();
           let step = (speed * 1024. / 60.) as i32;
           if dist <= step as f64 { e.x = (x * 1024.) as i32; e.y = (y * 1024.) as i32; }
           else { e.x += (dx as f64 / dist * step as f64).round() as i32; e.y += (dy as f64 / dist * step as f64).round() as i32; }
           e.data[0] = e.x as f32 / 1024.;
           e.data[1] = e.y as f32 / 1024.;
           e.data[3] = (dy as f32).atan2(dx as f32);
           e.data[5] = 1.;
           arrived = dist <= step as f64;
       }
       let (px, py) = (self.entities[id].data[0], self.entities[id].data[1]);
       let gz = self.ground(px, py);
       let previous = self.entities[id].data[2].max(0.);
       self.entities[id].data[2] = if gz < 0. { previous } else { gz };
       return arrived;
   }
   // Mode 1: World match with obstacle & canyon-aware steering.
   let kind = self.entities[id].data[4] as u32;
   let flying = aircraft(kind);
   let (px, py) = (self.entities[id].data[0], self.entities[id].data[1]);
   let (dx, dy) = (x - px, y - py);
   let dist = (dx * dx + dy * dy).sqrt();
   let step = speed / 60.;
   if dist <= step {
       let gz = self.ground(x, y);
       let e = &mut self.entities[id];
       e.x = (x * 1024.).round() as i32;
       e.y = (y * 1024.).round() as i32;
       e.data[0] = x;
       e.data[1] = y;
       e.data[3] = dy.atan2(dx);
       e.data[5] = 1.;
       e.data[2] = if flying { gz.max(0.) + 3. } else if gz >= 0. { gz } else { e.data[2].max(0.) };
       return true;
   }
   let theta = dy.atan2(dx);
   if flying {
       let nx = px + theta.cos() * step;
       let ny = py + theta.sin() * step;
       let gz = self.ground(nx, ny);
       let e = &mut self.entities[id];
       e.x = (nx * 1024.).round() as i32;
       e.y = (ny * 1024.).round() as i32;
       e.data[0] = nx;
       e.data[1] = ny;
       e.data[3] = theta;
       e.data[5] = 1.;
       e.data[2] = gz.max(0.) + 3.;
       return false;
   }
   // If ground unit is currently over void, steer toward nearest land.
   if self.ground(px, py) < 0. {
       if let Some((lx, ly)) = self.land_near(px.floor() as i32, py.floor() as i32, 30) {
           let (ldx, ldy) = (lx - px, ly - py);
           let ltheta = ldy.atan2(ldx);
           let nx = px + ltheta.cos() * step;
           let ny = py + ltheta.sin() * step;
           let gz = self.ground(nx, ny);
           let e = &mut self.entities[id];
           e.x = (nx * 1024.).round() as i32;
           e.y = (ny * 1024.).round() as i32;
           e.data[0] = nx;
           e.data[1] = ny;
           e.data[3] = ltheta;
           e.data[5] = 1.;
           if gz >= 0. { e.data[2] = gz; }
           return false;
       }
   }
   // Ground unit: test direct step first.
   let nx = px + theta.cos() * step;
   let ny = py + theta.sin() * step;
   let gz = self.ground(nx, ny);
   if gz >= 0. && nx >= 2. && ny >= 2. && nx < (WORLD - 2) as f32 && ny < (WORLD - 2) as f32 {
       let e = &mut self.entities[id];
       e.x = (nx * 1024.).round() as i32;
       e.y = (ny * 1024.).round() as i32;
       e.data[0] = nx;
       e.data[1] = ny;
       e.data[3] = theta;
       e.data[5] = 1.;
       e.data[2] = gz;
       return false;
   }
   // Canyon/void obstacle ahead: probe angular deflections for valid ground.
   let cur_yaw = self.entities[id].data[3];
   let mut yaw_diff = cur_yaw - theta;
   while yaw_diff > std::f32::consts::PI { yaw_diff -= 2. * std::f32::consts::PI; }
   while yaw_diff < -std::f32::consts::PI { yaw_diff += 2. * std::f32::consts::PI; }
   let prefer_pos = yaw_diff >= 0.;
   let angles = [
       std::f32::consts::FRAC_PI_6,
       std::f32::consts::FRAC_PI_3,
       std::f32::consts::FRAC_PI_2,
       std::f32::consts::PI * 2. / 3.,
       std::f32::consts::PI * 5. / 6.,
   ];
   let mut deflections: [f32; 10] = [0.; 10];
   for (idx, &a) in angles.iter().enumerate() {
       if prefer_pos {
           deflections[idx * 2] = a;
           deflections[idx * 2 + 1] = -a;
       } else {
           deflections[idx * 2] = -a;
           deflections[idx * 2 + 1] = a;
       }
   }
   for da in deflections {
       let alt_theta = theta + da;
       let alt_x = px + alt_theta.cos() * step;
       let alt_y = py + alt_theta.sin() * step;
       let alt_gz = self.ground(alt_x, alt_y);
       if alt_gz >= 0. && alt_x >= 2. && alt_y >= 2. && alt_x < (WORLD - 2) as f32 && alt_y < (WORLD - 2) as f32 {
           let e = &mut self.entities[id];
           e.x = (alt_x * 1024.).round() as i32;
           e.y = (alt_y * 1024.).round() as i32;
           e.data[0] = alt_x;
           e.data[1] = alt_y;
           e.data[3] = alt_theta;
           e.data[5] = 1.;
           e.data[2] = alt_gz;
           return false;
       }
   }
   // Blocked by void on all probe angles: hold position on solid ground.
   let cur_gz = self.ground(px, py);
   let e = &mut self.entities[id];
   if cur_gz >= 0. { e.data[2] = cur_gz; }
   e.data[5] = 0.;
   false
  }
 fn tick(&mut self) {
  self.tick+=1;let t=self.tick; if t%30==0 {self.charge=(self.charge+1).min(200);}
  // Repair transactions spend actual stock, with a bounded visible repair beat.
  // Opening construction kits were prepaid; do not charge for those twice.
  if t%60==0 {for id in 0..27 {let k=self.entities[id].data[4] as u32;if self.entities[id].active&&self.entities[id].data[7]<1.&&self.alloy>24 {
   let hp=if k==10 {1500.}else if k==16 {900.}else if k<20 {600.}else if k==20 {70.}else if k==23 {110.}else{180.};
   self.alloy-=1;self.entities[id].data[7]=(self.entities[id].data[7]+25./hp).min(1.);
   let fx=(108..132).find(|&i|!self.entities[i].active);if let Some(fx)=fx {let e=self.entities[id];self.add(fx,51,e.data[0],e.data[1],0.);self.entities[fx].data[2]=e.data[2]+0.5;self.entities[fx].data[10]=20.;}
  }}}
  let starts=[0,1440,3240,4680];let durations=[1440,1800,1440,2520];
  for j in 0..4 {let site_id=4+j;let pair=if j%2==0 {14}else{16};let mut builders=0;for id in pair..pair+2 {let x=self.entities[site_id].data[0]+if id%2==0 {1.6}else{-1.6};let y=self.entities[site_id].data[1]+1.8;if (self.entities[id].data[0]-x).abs()<0.1&&(self.entities[id].data[1]-y).abs()<0.1 {builders+=1;}}let e=&mut self.entities[site_id];if t>starts[j]&&builders==2&&e.timer<durations[j] {e.timer+=1;}e.data[10]=(e.timer as f32/durations[j] as f32).min(1.);e.data[5]=if e.data[10]<1. {5.}else{0.};e.data[6]=(t%180) as f32/180.;}
  let site=if t<1440 {4}else if t<3240 {5}else if t<4680 {6}else{7};
  for id in 8..27 {
   let kind=self.entities[id].data[4] as u32;
   let animation_period=if self.entities[id].data[5]==1. {if kind==20 {24}else{36}}else{72};self.entities[id].data[6]=((t+id as u32*17)%animation_period) as f32/animation_period as f32;
   if kind==20 {
    if id>=14 {let assigned=if id<16 {if t<1440 {4}else{6}}else if t<3240 {5}else{7};let site=assigned;let x=self.entities[site].data[0]+if id%2==0 {1.6}else{-1.6};let y=self.entities[site].data[1]+1.8;if self.walk(id,x,y,1.4) {self.entities[id].data[5]=if site==4&&t<1440||site==5&&(1440..3240).contains(&t)||site==6&&(3240..4680).contains(&t)||site==7&&t>=4680 {3.}else{0.};}}
    else {let route=self.entities[id].route;let node=27+(id-8)*2;let x=if route==0 {self.entities[node].data[0]+0.6}else{7.+(id%3) as f32*0.45};let y=if route==0 {self.entities[node].data[1]+0.6}else{25.};if self.walk(id,x,y,1.4) {self.entities[id].data[5]=3.;self.entities[id].timer+=1;if self.entities[id].timer>=if route==0 {120}else{48} {self.entities[id].timer=0;if route==0 {self.entities[id].data[10]+=1.;if self.entities[id].data[10]>=4. {self.entities[id].route=1;}}else{self.alloy=(self.alloy+self.entities[id].data[10] as u32).min(300);self.entities[id].data[10]=0.;self.entities[id].route=0;}}}}
   } else if kind==21 {let route=self.entities[id].route;let (x,y)=if route==0 {(9.,24.)}else if route==1 {(11.,20.)}else if route==2 {(self.entities[site].data[0]+2.,self.entities[site].data[1]+2.)}else{(13.,18.)};if self.walk(id,x,y,1.) {self.entities[id].timer+=1;self.entities[id].data[5]=7.;if self.entities[id].timer>=48 {self.entities[id].timer=0;self.entities[id].route=(route+1)%4;self.entities[id].data[10]=if route==0 {16.}else{0.};}}}
   else if kind==24 {let points=[(21.5,22.),(16.,23.),(13.,17.),(19.,14.)];let r=self.entities[id].route;if self.walk(id,points[r].0,points[r].1,2.) {self.entities[id].route=(r+1)%4;}self.entities[id].data[2]=3.5+0.08*((t+id as u32*13) as f32/23.).sin();}
   else {
    let (x,y)=GUARD_POSTS[id-20];
    let threat=(40..52).any(|j|self.entities[j].active);
    let patrol=if threat {0.}else if self.entities[id].route==0 {-0.45}else{0.45};
    if self.walk(id,x+patrol,y,1.6) {self.entities[id].data[5]=0.;if !threat {self.entities[id].route=1-self.entities[id].route;}}
   }
  }
  if t>=2160 {let wave=(t-2160)/1800;let age=(t-2160)%1800;let n=if wave%4==0 {4}else if wave%4==3 {8}else{6};for j in 0..n {if age==j*72 {self.add(40+j as usize,30,30.5,13.8,1.);}}if wave%4>=2 && age==480 {self.add(50,31,29.,5.,1.);}if wave%4==3 && age==570 {self.add(51,31,30.,3.,1.);}
   // Each arrival owns a distinct lane all the way to its firing post. Earlier
   // arrivals take the farthest posts, allowing the staggered wave to fan out.
   for id in 40..52 {
    if !self.entities[id].active {continue;}
    let gait_period=if id>=50 {48}else{24};self.entities[id].data[6]=((t+id as u32*17)%gait_period) as f32/gait_period as f32;
    if age>=1740 {self.entities[id].active=false;continue;}
    let slot=if id<48 {(5+8-(id-40))%8}else{0};
    let (px,py)=if id>=50 {(28.,11.+(id-50) as f32*2.)}else{RAID_POSTS[slot]};
    // Enter from the causeway's south exit, beyond the old tower's kill zone.
    // Front rank assembles behind the screen before advancing together; this
    // repeats each raid, without changing spawn, attack, or retreat clocks.
    let (x,y)=if age>=1440 {(31.,2.)}else if id<48&&slot<3&&age<690 {(28.6,py+0.8)}else{(px,py)};
    if self.walk(id,x,y,if id>=50 {0.9}else{1.8}) {self.entities[id].route=1;self.entities[id].data[5]=0.;}
    if age>=1440 {self.entities[id].data[5]=6.;}
   }
  }
  for id in 0..52 {if !self.entities[id].active {continue;}let k=self.entities[id].data[4] as u32;if !(k==16||k==22||k==23||k==30||k==31)||self.entities[id].data[10]<1.||self.entities[id].data[5]==6. {continue;}
   let enemy=self.entities[id].data[9]==1.;
   let period=if k==16 {108}else if k==31 {144}else if k==23 {96}else if enemy {48}else{60};
   self.entities[id].data[11]=(self.entities[id].data[11]-1./period as f32).max(0.);
   let range=if k==16 {8.}else if k==23||k==31 {7.}else{5.};let mut nearest=CAP;let mut best=range*range;
   for j in 0..52 {let e=self.entities[j];let jk=e.data[4] as u32;if !e.active||e.data[9]==self.entities[id].data[9]||!(jk==16||jk==22||jk==23||jk==30||jk==31) {continue;}let d=(e.data[0]-self.entities[id].data[0]).powi(2)+(e.data[1]-self.entities[id].data[1]).powi(2);if d<best {best=d;nearest=j;}}
   if nearest<CAP {self.entities[id].data[5]=2.;let period=if k==16 {108}else if k==31 {144}else if k==23 {96}else if enemy {48}else{60};let offset=if k==16||id%4==0 {0}else{id as u32*7};self.entities[id].data[6]=((t+offset)%period) as f32/period as f32;self.entities[id].data[3]=(self.entities[nearest].data[1]-self.entities[id].data[1]).atan2(self.entities[nearest].data[0]-self.entities[id].data[0]);if (t+offset)%period==0 && (k!=16||self.charge>0) {if let Some(p)=(60..108).find(|&p|!self.entities[p].active) {if k==16 {self.charge-=1;}let e=self.entities[id];self.add(p,50,e.data[0],e.data[1],e.data[9]);let muzzle=if k==16 {3.2}else if k==31 {1.9}else if k==23 {0.99}else if k==22 {0.89}else{0.74};
    self.entities[id].data[11]=1.;
    let reach=if k==23 {1.464}else if k==16 {0.85}else if k==31 {0.952}else{0.976};
    let px=e.data[0]+e.data[3].cos()*reach;let py=e.data[1]+e.data[3].sin()*reach;
    let victim=self.entities[nearest];let shot=&mut self.entities[p];
    shot.x=(px*1024.) as i32;shot.y=(py*1024.) as i32;
    shot.data[0]=px;shot.data[1]=py;shot.data[2]=e.data[2]+muzzle;
    shot.data[3]=e.data[3];shot.target=nearest;shot.data[10]=k as f32;
    shot.origin=[px,py,shot.data[2]];shot.destination=[victim.data[0],victim.data[1],victim.data[2]+0.8];}}}
  }
  // Fixed launch endpoints make shells visibly dodgeable. All impact onsets and
  // muzzle/tracer lifetimes belong to simulation time, independent of rendering.
  for id in 108..144 {if self.entities[id].active {self.entities[id].timer+=1;self.entities[id].data[11]=self.entities[id].timer as f32/60.;let life=if self.entities[id].data[4]==52. {120}else if self.entities[id].data[10]==31. {51}else{24};if self.entities[id].timer>=life {self.entities[id].active=false;}}}
  for id in 60..108 {
   if !self.entities[id].active {continue;}
   let shot=self.entities[id];let k=shot.data[10] as u32;
   let distance=((shot.destination[0]-shot.origin[0]).powi(2)+(shot.destination[1]-shot.origin[1]).powi(2)).sqrt();
   let duration=if k==31 {54}else{(distance/if k==22 {16.}else if k==23 {40.}else{12.}*60.).ceil().max(1.) as u32};
   let age=shot.timer+1;let q=(age as f32/duration as f32).min(1.);
   let e=&mut self.entities[id];e.timer=age;e.data[11]=age as f32/60.;
   for axis in 0..3 {e.data[axis]=shot.origin[axis]+(shot.destination[axis]-shot.origin[axis])*q;}
   if k==31 {e.data[2]+=12.*q*(1.-q);}
   if age>=duration {
    let hit=self.entities[id];self.entities[id].active=false;
    let fx=(108..132).find(|&i|!self.entities[i].active).unwrap_or(108+(t as usize%24));
    self.add(fx,51,hit.data[0],hit.data[1],shot.data[9]);self.entities[fx].data[2]=hit.data[2];self.entities[fx].data[10]=k as f32;
    let target=shot.target;
    if self.entities[target].active {
     let victim=self.entities[target];let miss=(victim.data[0]-hit.data[0]).powi(2)+(victim.data[1]-hit.data[1]).powi(2);
     if k!=31||miss<1.44 {
      let hp=match victim.data[4] as u32 {16=>900.,22=>180.,23=>110.,30=>80.,31=>240.,_=>600.};
      let damage=match k {16=>30.,22=>12.,23=>25.,30=>4.,31=>14.,_=>2.};
      self.entities[target].data[7]-=damage/hp;
      if self.entities[target].data[7]<=0. {
       if target>=40 {
        self.entities[target].active=false;if self.selected==target {self.selected=CAP;}
        let wreck=(132..144).find(|&i|!self.entities[i].active).unwrap_or(132+t as usize%12);
        self.add(wreck,52,victim.data[0],victim.data[1],victim.data[9]);self.entities[wreck].data[10]=victim.data[4];
       }else{self.entities[target].data[7]=1.;}
      }
     }
    }
   }
  }
  for id in 0..4 {if self.entities[id].data[5]!=2. {self.entities[id].data[6]=((t+id as u32*31)%144) as f32/144.;}}
  for id in 52..54 {let phase=(t+id as u32*37) as f32/if id==52 {95.}else{124.};let x=if id==52 {16.}else{5.};let y=if id==52 {16.}else{18.};self.entities[id].data[0]=x+phase.cos()*2.4;self.entities[id].data[1]=y+phase.sin()*2.4;self.entities[id].data[2]=3.2;self.entities[id].data[6]=(t%120) as f32/120.;}
  self.pack();
 }
}
#[no_mangle] pub extern "C" fn sim_init(seed:u32) {SIM.with(|s| {let mut s=s.borrow_mut();s.research=research::ResearchState::EMPTY;s.actors.reset();s.lab=lab::LabState::EMPTY;s.entities.fill(Entity::EMPTY);s.tick=0;s.accumulator=0.;s.rng=seed.max(1);s.selected=7;s.selected_group.fill(false);s.alloy=160;s.charge=120;
for y in 0..32 {for x in 0..32 {s.terrain[y*32+x]=height(x as f32+0.5,y as f32+0.5);}}
for (id,(kind,x,y)) in [(10,16.,16.),(11,7.,23.),(12,10.,12.),(16,24.,8.),(13,16.,11.),(14,5.,18.),(15,17.,21.),(16,26.,12.)].iter().enumerate() {s.add(id,*kind,*x,*y,0.);if id>=4 {s.entities[id].data[10]=0.;s.entities[id].data[5]=5.;}}
for id in 8..27 {let kind=if id<18 {20}else if id<20 {21}else if id<24 {22}else if id<26 {23}else{24};s.add(id,kind,9.+(id%5) as f32,24.+(id%2) as f32,0.);if kind==20 {s.entities[id].data[10]=0.;}else if kind==22||kind==23 {s.add(id,kind,22.5+(id%3) as f32*0.8,11.+(id%2) as f32*2.,0.);}else if kind==24 {s.add(id,kind,21.5,22.,0.);s.entities[id].data[2]=3.5;}}
for id in 14..18 {let site=if id<16 {4}else{5};let x=s.entities[site].data[0]+if id%2==0 {1.6}else{-1.6};let y=s.entities[site].data[1]+1.8;s.add(id,20,x,y,0.);s.entities[id].data[10]=0.;}
for id in 27..39 {let j=id-27;let jitter=(s.random()%200) as f32/1000.;s.add(id,40,3.+(j%3) as f32*1.5+jitter,19.+(j/3) as f32*2.3,2.);s.entities[id].data[10]=80.;}
for id in 52..54 {s.add(id,41,16.,18.,2.);s.entities[id].data[2]=3.2;}
s.pack();});}
#[no_mangle] pub extern "C" fn sim_step(dt_ms:f32) {if !dt_ms.is_finite()||dt_ms<=0. {return;}SIM.with(|s| {let mut s=s.borrow_mut();let dt=if (dt_ms as f64-1000./60.).abs()<0.001 {1000./60.}else{dt_ms as f64};s.accumulator+=dt;while s.accumulator+0.00001>=1000./60. {s.accumulator-=1000./60.;if s.mode==1 {s.match_tick();}else{s.tick();}}});}
#[no_mangle] pub extern "C" fn sim_entity_count()->u32 {SIM.with(|s|s.borrow().count as u32)}
#[no_mangle] pub extern "C" fn sim_entity_stride()->u32 {STRIDE as u32}
#[no_mangle] pub extern "C" fn sim_entity_ptr()->*const f32 {SIM.with(|s|s.borrow().snapshot.as_ptr())}
#[no_mangle] pub extern "C" fn sim_select(index:i32) {SIM.with(|s| {let mut s=s.borrow_mut();s.selected_group.fill(false);s.selected=if index>=0&&(index as usize)<s.count {let id=s.ids[index as usize];let k=s.entities[id].data[4] as u32;if if s.mode==1 {roster(k).is_some()}else{matches!(k,10|11|12|13|14|15|16|17|20|21|22|23|24|30|31)} {s.selected_group[id]=true;id}else{CAP}}else{CAP};s.pack();});}
#[no_mangle] pub extern "C" fn sim_select_add(index:i32) {SIM.with(|s| {let mut s=s.borrow_mut();let id=if index>=0&&(index as usize)<s.count {s.ids[index as usize]}else if index>=0&&(index as usize)<CAP {index as usize}else{CAP};if id<CAP&&s.entities[id].active{let k=s.entities[id].data[4] as u32;let valid=if s.mode==1 {roster(k).is_some()}else{matches!(k,10|11|12|13|14|15|16|17|20|21|22|23|24|30|31)};if valid {s.selected_group[id]=true;if s.selected==CAP {s.selected=id;}}}s.pack();});}
#[no_mangle] pub extern "C" fn sim_select_clear() {SIM.with(|s| {let mut s=s.borrow_mut();s.selected=CAP;s.selected_group.fill(false);s.pack();});}
// Additive read-only terrain/resource exports; required entity ABI stays unchanged.
#[no_mangle] pub extern "C" fn sim_terrain_ptr()->*const f32 {SIM.with(|s|s.borrow().terrain.as_ptr())}
#[no_mangle] pub extern "C" fn sim_alloy()->u32 {SIM.with(|s|{let s=s.borrow();if s.mode==1 {s.game.sides[s.game.player].alloy}else{s.alloy}})}
#[no_mangle] pub extern "C" fn sim_charge()->u32 {SIM.with(|s|{let s=s.borrow();if s.mode==1 {s.game.sides[s.game.player].charge}else{s.charge}})}

// Match mode. The showcase tick and initializer above are deliberately frozen.
const MATCH_ACTORS: usize = 120; // Remaining slots are bounded projectiles/wrecks.
const ROSTER_STRIDE: usize = 8;
const OUTCOME_GRACE: u32 = 60; // One full second of continuous absence, at 60 Hz.
#[derive(Clone, Copy)]
struct Kind {
    kind: u32, faction: usize, tier: u32, klass: u32, producer: u32,
    alloy: u32, charge: u32, pop: u32, ticks: u32, width: f32, depth: f32,
    hp: f32, speed: f32, range: f32, damage: f32, cadence: u32,
}
macro_rules! building {
    ($k:expr,$f:expr,$t:expr,$a:expr,$c:expr,$s:expr,$w:expr,$d:expr,$hp:expr,$r:expr,$hit:expr,$beat:expr) => {
        Kind { kind:$k, faction:$f, tier:$t, klass:0, producer:0, alloy:$a,
            charge:$c, pop:0, ticks:$s*60, width:$w, depth:$d, hp:$hp,
            speed:0., range:$r, damage:$hit, cadence:$beat }
    };
}
macro_rules! unit {
    ($k:expr,$f:expr,$t:expr,$p:expr,$a:expr,$c:expr,$s:expr,$pop:expr,$hp:expr,$v:expr,$r:expr,$hit:expr,$beat:expr) => {
        Kind { kind:$k, faction:$f, tier:$t, klass:1, producer:$p, alloy:$a,
            charge:$c, pop:$pop, ticks:$s*60, width:0.6, depth:0.6, hp:$hp,
            speed:$v, range:$r, damage:$hit, cadence:$beat }
    };
}
// Civilizations §5–§8. Starting scouts are a scenario exception; replacements
// have tier 2. The single ABI producer is supplemented by support prerequisites.
const KINDS: [Kind; 30] = [
    building!(10,0,0,100,60,48,4.,4.,1500.,0.,0.,0),
    building!(11,0,0,24,0,24,3.,3.,600.,0.,0.,0),
    building!(12,0,0,32,20,30,2.,2.,600.,0.,0.,0),
    building!(15,0,0,20,8,24,3.,2.,600.,0.,0.,0),
    building!(13,0,1,28,12,24,3.,3.,600.,0.,0.,0),
    building!(14,0,1,36,16,30,3.,3.,600.,0.,0.,0),
    building!(16,0,2,40,24,42,2.,2.,900.,8.,30.,108),
    building!(17,0,2,48,24,30,4.,3.,600.,0.,0.,0),
    unit!(20,0,0,10,4,0,6,1,70.,1.4,0.,0.,0),
    unit!(21,0,0,11,8,2,10,1,180.,1.0,0.,0.,0),
    unit!(22,0,0,13,8,4,12,1,180.,1.6,5.,12.,60),
    unit!(24,0,2,17,12,6,18,2,150.,2.0,0.,0.,0),
    unit!(23,0,1,13,10,6,16,2,110.,1.4,7.,25.,96),
    unit!(25,0,1,13,14,10,22,2,100.,1.35,0.,0.,0),
    unit!(26,0,2,14,24,18,32,3,360.,0.75,7.,40.,144),
    building!(60,1,0,90,50,44,4.,4.,1350.,0.,0.,0),
    building!(61,1,0,22,0,21,3.,3.,525.,0.,0.,0),
    building!(62,1,0,30,18,27,2.,2.,500.,0.,0.,0),
    building!(65,1,0,18,6,20,3.,2.,450.,0.,0.,0),
    building!(63,1,1,26,10,22,3.,3.,525.,0.,0.,0),
    building!(64,1,1,34,14,28,3.,3.,650.,0.,0.,0),
    building!(66,1,2,38,20,38,2.,2.,750.,7.,22.,108),
    building!(67,1,2,44,22,28,4.,3.,550.,0.,0.,0),
    unit!(32,1,0,60,4,0,5,1,60.,1.55,0.,0.,0),
    unit!(33,1,0,61,7,2,9,1,150.,1.15,0.,0.,0),
    unit!(34,1,0,63,7,3,10,1,150.,1.8,1.5,10.,48),
    unit!(30,1,0,63,8,4,11,1,80.,1.8,5.,4.,48),
    unit!(35,1,2,67,11,5,16,2,120.,2.4,3.,2.,90),
    unit!(36,1,1,63,12,9,19,2,90.,1.5,0.,0.,0),
    unit!(31,1,2,64,22,16,28,3,240.,0.9,7.,14.,144),
];
const fn roster_data() -> [f32; 30 * ROSTER_STRIDE] {
    let mut data = [0.; 30 * ROSTER_STRIDE];
    let mut i = 0;
    while i < KINDS.len() {
        let k = KINDS[i];
        let row = [k.kind as f32, k.faction as f32, k.tier as f32, k.klass as f32,
            k.producer as f32, k.alloy as f32, k.charge as f32, k.pop as f32];
        let mut j = 0;
        while j < ROSTER_STRIDE { data[i * ROSTER_STRIDE + j] = row[j]; j += 1; }
        i += 1;
    }
    data
}
static ROSTER: [f32; 30 * ROSTER_STRIDE] = roster_data();
fn roster(kind: u32) -> Option<&'static Kind> { KINDS.iter().find(|k| k.kind == kind) }
fn worker(kind: u32) -> bool { matches!(kind, 20 | 32) }
fn carrier(kind: u32) -> bool { matches!(kind, 21 | 33) }
fn aircraft(kind: u32) -> bool { matches!(kind, 24 | 35) }
fn headquarters(faction: usize) -> u32 { if faction == 0 { 10 } else { 60 } }
fn housing(faction: usize) -> u32 { if faction == 0 { 15 } else { 65 } }
fn source(faction: usize) -> u32 { if faction == 0 { 12 } else { 62 } }
fn military(faction: usize) -> u32 { if faction == 0 { 13 } else { 63 } }
fn age_cost(age: u32) -> (u32, u32, u32) {
    match age { 0 => (60, 30, 40 * 60), 1 => (100, 60, 60 * 60), _ => (0, 0, 0) }
}
#[derive(Clone, Copy)]
struct Side { alloy: u32, charge: u32, age: u32, advancing: u32 }
impl Side { const START: Self = Self { alloy: 80, charge: 40, age: 0, advancing: 0 }; }
#[derive(Clone, Copy)]
struct Production { kind: u32, slot: usize, remaining: u32 }
impl Production { const EMPTY: Self = Self { kind: 0, slot: CAP, remaining: 0 }; }
#[derive(Clone, Copy, PartialEq, Eq)]
enum Order { Idle, Gather, Build(usize), Defend, Raid(u32), Return, Move(u16, u16), Target(usize) }
struct Match {
    player: usize, sides: [Side; 2], jobs: [Production; CAP], orders: [Order; CAP],
    homes: [(f32, f32); CAP], cooldowns: [u32; CAP], generations: [u32; CAP],
    defenders: [usize; 2], next_raid: u32, waves: u32, base: [(f32, f32); 2],
    outcome: u32, outcome_tick: u32, empty_since: [u32; 2],
    waypoints: [u8; CAP], lanes: [u8; CAP],
}
impl Match {
    const EMPTY: Self = Self { player: 0, sides: [Side::START; 2],
        jobs: [Production::EMPTY; CAP], orders: [Order::Idle; CAP],
        homes: [(0., 0.); CAP], cooldowns: [0; CAP], generations: [0; CAP],
        defenders: [CAP; 2], next_raid: 150 * 60, waves: 0, base: [(0., 0.); 2],
        outcome: 0, outcome_tick: 0, empty_since: [0; 2],
        waypoints: [0; CAP], lanes: [0; CAP] };
}
impl Sim {
    fn match_add(&mut self, id: usize, kind: u32, x: f32, y: f32, faction: usize) {
        let mut e = Entity::EMPTY;
        e.active = true;
        e.x = (x * 1024.) as i32;
        e.y = (y * 1024.) as i32;
        e.target = CAP;
        e.data = [x, y, self.ground(x, y), 0., kind as f32, 0., 0., 1., 0., faction as f32, 1., 0.];
        if worker(kind) || carrier(kind) { e.data[10] = 0.; }
        if aircraft(kind) { e.data[2] += 3.; }
        self.entities[id] = e;
        self.game.jobs[id] = Production::EMPTY;
        self.game.orders[id] = Order::Idle;
        self.game.homes[id] = (x, y);
        self.game.cooldowns[id] = 0;
        self.game.waypoints[id] = 0;
        self.game.lanes[id] = 0;
        self.game.generations[id] = self.game.generations[id].wrapping_add(1);
    }
    fn match_init(&mut self, seed: u32, faction: u32) {
        self.entities.fill(Entity::EMPTY);
        self.snapshot.fill(0.);
        self.ids.fill(0);
        self.tick = 0;
        self.accumulator = 0.;
        self.rng = seed.max(1);
        self.selected = CAP;
        self.selected_group.fill(false);
        self.mode = 1;
        self.game = Match::EMPTY;
        self.research = research::ResearchState::EMPTY;
        self.actors.reset();
        self.lab = lab::LabState::EMPTY;
        // The void ABI maps invalid faction inputs to Dawnward.
        self.game.player = usize::from(faction == 1);
        // The showcase's own 32x32 terrain buffer stays filled, so the legacy
        // read-only terrain ABI keeps answering in both modes.
        for y in 0..32 { for x in 0..32 {
            self.terrain[y * 32 + x] = height(x as f32 + 0.5, y as f32 + 0.5);
        } }
        // Build the 10.24 km world from the seed (LARGEMAP_SPEC §4). It is a pure
        // function of (seed, tile), so every run agrees tile for tile.
        let world_seed = self.rng ^ 0x5F35_6B21;
        // A 4 MB heap buffer, not a stack temporary: an inline array of this size
        // overflows the wasm stack while the thread-local initialises.
        self.world = vec![0.; WORLD * WORLD];
        for ty in 0..WORLD { for tx in 0..WORLD {
            self.world[ty * WORLD + tx] = world_gen(world_seed, tx, ty);
        } }
        // Close one-tile pinholes: a void tile ringed by land takes the lowest
        // level of its land neighbours, so a base apron never shows a crack.
        // Two passes reach pinholes that touch each other; real canyons stay.
        for _ in 0..2 {
            for ty in 1..WORLD - 1 { for tx in 1..WORLD - 1 {
                if self.world[ty * WORLD + tx] >= 0. { continue; }
                let mut land = 0; let mut lowest = 1.5f32;
                for dy in -1i32..=1 { for dx in -1i32..=1 {
                    if dx == 0 && dy == 0 { continue; }
                    let v = self.world[(ty as i32 + dy) as usize * WORLD + (tx as i32 + dx) as usize];
                    if v >= 0. { land += 1; if v < lowest { lowest = v; } }
                } }
                if land >= 6 { self.world[ty * WORLD + tx] = lowest; }
            } }
        }
        self.compose_world(world_seed);
        // Both starts belong in prepared clearings, far apart on opposite thirds.
        let targets = [world_start(0), world_start(1)];
        for side in 0..2 {
            // Base consumers and the ABI index by faction, not starting slot.
            let f = if side == 0 { self.game.player } else { 1 - self.game.player };
            self.game.base[f] = self.flat_site(targets[side].0, targets[side].1)
                .unwrap_or((targets[side].0 as f32 + 0.5, targets[side].1 as f32 + 0.5));
        }
        for side in 0..2 {
            let f = if side == 0 { self.game.player } else { 1 - self.game.player };
            let base = side * 13;
            let (hx, hy) = self.game.base[f];
            let kinds = if f == 0 { [10,11,12,20,21,22,24] } else { [60,61,62,32,33,30,35] };
            // The authored start package, anchored on the world site and mirrored
            // so each faction builds away from the map edge. Every offset below
            // stays inside the 13x13 flat patch flat_site guarantees.
            let m = if side == 0 { 1. } else { -1. };
            let buildings = [(hx, hy), (hx - 4. * m, hy + 4.), (hx - 2. * m, hy - 4.)];
            for j in 0..3 { self.match_add(base + j, kinds[j], buildings[j].0, buildings[j].1, f); }
            for j in 0..6 {
                // Every worker stays on the open west apron. A worker inside the
                // Keep's own silhouette cannot be tapped, because the building's
                // art is nearer to the camera along the pick ray.
                // Workers stand on the south apron. A tall building projects its
                // art upwards on screen, so a worker west of the Keep is hidden
                // behind it and cannot be tapped; south of it (larger x+y) the
                // worker is in front and stays reachable.
                let (x, y) = if j < 4 { (hx - 1. + (j % 2) as f32 * 2., hy + 4.5 + (j / 2) as f32 * 1.8) }
                    else { (hx + 3. + (j - 4) as f32, hy + 4.5 + (j - 4) as f32 * 1.5) };
                self.match_add(base + 3 + j, kinds[3], x, y, f);
                if j < 4 { self.game.orders[base + 3 + j] = Order::Gather; }
            }
            // Haulers load on the outer Court apron, away from the worker seam.
            self.match_add(base + 9, kinds[4], buildings[1].0 - 1.5 * m, buildings[1].1, f);
            for j in 0..2 {
                let (x, y) = (hx + 4. * m, hy - 2. + j as f32 * 4.);
                self.match_add(base + 10 + j, kinds[5], x, y, f);
                self.game.orders[base + 10 + j] = Order::Defend;
                if side == 1 { self.game.defenders[j] = base + 10 + j; }
            }
            self.match_add(base + 12, kinds[6], buildings[0].0, buildings[0].1, f);
        }
        // Opening stock stays six nodes per base at the same capacity; additional
        // deposits are compact groups on the composed route/ridge-foot shelves.
        for j in 0..12 {
            let jitter = (self.random() % 200) as f32 / 1000.;
            let holder = if j < 6 { 0 } else { 1 };
            let f = if holder == 0 { self.game.player } else { 1 - self.game.player };
            let (hx, hy) = self.game.base[f];
            // Mirror the seam the same way the base itself is mirrored.
            let m = if holder == 0 { 1. } else { -1. };
            let k = j % 6;
            // South-apron seam beside the workers, not behind the Court and not
            // inside its 3x3 footprint (x hx-5.5..hx-2.5 at y hy+2.5..hy+5.5).
            // The composed clearing, not a tiny site-search patch, holds this pocket.
            // The outer loading pocket gives the hauler a separate mine stop.
            // Keep the five south-seam stops fixed so worker approaches remain
            // familiar and small silhouettes do not merge with the hauler.
            let (dx,dy)=if k<5 {(-1.+k as f32*1.2,5.5)}else{(-7.,4.)};
            let x = hx + dx * m;
            let y = hy + dy + jitter * 0.2;
            self.match_add(26 + j, 40, x, y, 2);
            self.entities[26 + j].data[10] = 160.;
        }
        for group in 0..10 {
            let (ax,ay)=if group<6 {world_outcrop(group/3,group%3)}
                else {[(488,472),(544,550),(128,800),(896,224)][group-6]};
            for (j,(dx,dy)) in [(-2,-3),(1,0),(-1,4)].iter().enumerate() {
                if let Some((x,y))=self.land_near(ax+dx,ay+dy,12) {
                    let id=38+group*3+j;
                    self.match_add(id,40,x,y,2);self.entities[id].data[10]=160.;
                }
            }
        }
        self.pack();
    }
    fn complete(&self, id: usize, f: usize) -> bool {
        id < MATCH_ACTORS && self.entities[id].active && self.entities[id].data[9] == f as f32
            && self.entities[id].data[7] > 0. && self.entities[id].data[5] != 5.
            && roster(self.entities[id].data[4] as u32).is_some()
    }
    fn has(&self, f: usize, kind: u32) -> bool {
        (0..MATCH_ACTORS).any(|id| self.complete(id, f) && self.entities[id].data[4] == kind as f32)
    }
    fn population(&self, f: usize) -> (u32, u32) {
        let mut used = 0;
        let mut cap = 0;
        for id in 0..MATCH_ACTORS {
            let e = self.entities[id];
            if !e.active || e.data[9] != f as f32 { continue; }
            if let Some(k) = roster(e.data[4] as u32) {
                used += k.pop;
                if self.complete(id, f) {
                    if k.kind == headquarters(f) { cap += 15; }
                    if k.kind == housing(f) { cap += 5; }
                }
            }
            if let Some(k) = roster(self.game.jobs[id].kind) { used += k.pop; }
        }
        (used, cap)
    }
    fn free_actor(&self) -> Option<usize> {
        (0..MATCH_ACTORS).find(|&id| !self.entities[id].active
            && !self.game.jobs.iter().any(|p| p.kind != 0 && p.slot == id))
    }
    fn affordable(&self, f: usize, k: &Kind) -> bool {
        let side = self.game.sides[f];
        side.age >= k.tier && side.alloy >= k.alloy && side.charge >= k.charge
    }
    fn can_train(&self, f: usize, kind: u32, producer: usize) -> bool {
        let Some(k) = roster(kind) else { return false; };
        if k.klass != 1 || k.faction != f || !self.affordable(f, k)
            || !self.complete(producer, f) || self.game.jobs[producer].kind != 0 || self.research.busy(producer)
            || self.entities[producer].data[4] != k.producer as f32
            || self.free_actor().is_none() { return false; }
        let Some(p) = roster(k.producer) else { return false; };
        if self.game.sides[f].age < p.tier { return false; }
        if matches!(kind, 25 | 36) && !self.has(f, source(f)) { return false; }
        let (used, cap) = self.population(f);
        used + k.pop <= cap
    }
    fn train(&mut self, f: usize, kind: u32, producer: usize) -> bool {
        if !self.can_train(f, kind, producer) { return false; }
        let k = roster(kind).unwrap();
        let slot = self.free_actor().unwrap();
        self.game.sides[f].alloy -= k.alloy;
        self.game.sides[f].charge -= k.charge;
        self.game.jobs[producer] = Production { kind, slot, remaining: k.ticks };
        true
    }
    fn ready_builder(&self, f: usize, id: usize) -> bool {
        self.complete(id, f) && worker(self.entities[id].data[4] as u32)
            && !matches!(self.game.orders[id], Order::Build(_))
    }
    fn can_build(&self, f: usize, kind: u32, selected: usize) -> bool {
        let Some(k) = roster(kind) else { return false; };
        k.klass == 0 && k.faction == f && self.affordable(f, k)
            && self.ready_builder(f, selected) && self.free_actor().is_some()
    }
    fn placeable(&self, k: &Kind, tile: u32) -> bool {
        let side = self.side();
        if tile >= side * side { return false; }
        let x = (tile % side) as f32 + 0.5;
        let y = (tile / side) as f32 + 0.5;
        let (left, right, top, bottom) = (x - k.width / 2., x + k.width / 2., y - k.depth / 2., y + k.depth / 2.);
        if left < 2. || right > side as f32 - 2. || top < 2. || bottom > side as f32 - 2. { return false; }
        let z = self.ground(x, y);
        if z < 0. { return false; }
        // Check every terrain cell touched by the entire footprint, not just its center.
        for ty in top.floor() as u32..bottom.ceil() as u32 {
            for tx in left.floor() as u32..right.ceil() as u32 {
                if self.ground(tx as f32 + 0.5, ty as f32 + 0.5) != z { return false; }
            }
        }
        for e in &self.entities[..MATCH_ACTORS] {
            if !e.active { continue; }
            let ek = e.data[4] as u32;
            let (w, d) = if let Some(other) = roster(ek) {
                if aircraft(ek) { continue; }
                (other.width, other.depth)
            } else if ek == 40 { (1., 1.) } else { continue; };
            if (e.data[0] - x).abs() < (w + k.width) / 2.
                && (e.data[1] - y).abs() < (d + k.depth) / 2. { return false; }
        }
        true
    }
    fn nearest_builder(&self, f: usize, x: f32, y: f32) -> Option<usize> {
        let mut nearest = None;
        let mut distance = f32::INFINITY;
        for id in 0..MATCH_ACTORS {
            if !self.ready_builder(f, id) { continue; }
            let e = self.entities[id];
            let d = (e.data[0] - x).powi(2) + (e.data[1] - y).powi(2);
            if d < distance { distance = d; nearest = Some(id); }
        }
        nearest
    }
    // Read-only preview shares the complete acceptance path with build().
    fn can_place(&self, f: usize, kind: u32, tile: u32, selected: usize) -> bool {
        self.can_build(f, kind, selected) && roster(kind).is_some_and(|k| self.placeable(k, tile))
    }
    fn build(&mut self, f: usize, kind: u32, tile: u32, selected: usize) -> bool {
        if !self.can_place(f, kind, tile, selected) { return false; }
        let k = roster(kind).unwrap();
        let side = self.side();
        let (x, y) = ((tile % side) as f32 + 0.5, (tile / side) as f32 + 0.5);
        let Some(builder) = self.nearest_builder(f, x, y) else { return false; };
        let id = self.free_actor().unwrap();
        self.game.sides[f].alloy -= k.alloy;
        self.game.sides[f].charge -= k.charge;
        self.match_add(id, kind, x, y, f);
        self.entities[id].data[5] = 5.;
        self.entities[id].data[10] = 0.;
        self.entities[id].target = builder;
        self.entities[builder].timer = 0;
        self.game.orders[builder] = Order::Build(id);
        true
    }
    fn advance(&mut self, f: usize) -> bool {
        let s = &mut self.game.sides[f];
        let (alloy, charge, ticks) = age_cost(s.age);
        if ticks == 0 || s.advancing != 0 || s.alloy < alloy || s.charge < charge { return false; }
        s.alloy -= alloy;
        s.charge -= charge;
        s.advancing = ticks;
        true
    }
    // Cancellation is a full refund of an unfinished paid order. A builder or
    // its site can cancel construction; an HQ can cancel the faction advance.
    // Destroying a producer/site releases reservations without refunding costs.
    fn cancel(&mut self, f: usize, id: usize) -> bool {
        if id >= MATCH_ACTORS || !self.entities[id].active || self.entities[id].data[9] != f as f32 { return false; }
        if let Some(k) = roster(self.game.jobs[id].kind) {
            self.game.sides[f].alloy += k.alloy;
            self.game.sides[f].charge += k.charge;
            self.game.jobs[id] = Production::EMPTY;
            return true;
        }
        let site = if self.entities[id].data[5] == 5. { id }
            else if let Order::Build(site) = self.game.orders[id] { site } else { CAP };
        if site < MATCH_ACTORS && self.entities[site].active && self.entities[site].data[5] == 5. {
            let k = roster(self.entities[site].data[4] as u32).unwrap();
            self.game.sides[f].alloy += k.alloy;
            self.game.sides[f].charge += k.charge;
            self.remove_actor(site);
            return true;
        }
        if self.entities[id].data[4] == headquarters(f) as f32 && self.game.sides[f].advancing > 0 {
            let (alloy, charge, _) = age_cost(self.game.sides[f].age);
            self.game.sides[f].alloy += alloy;
            self.game.sides[f].charge += charge;
            self.game.sides[f].advancing = 0;
            return true;
        }
        false
    }
    fn command(&mut self, op: u32, a: u32, b: u32) -> bool {
        if self.mode != 1 { return false; }
        let f = self.game.player;
        let accepted = match op {
            0 => if (b as usize) < self.count { self.train(f, a, self.ids[b as usize]) } else { false },
            1 => self.build(f, a, b, self.selected),
            2 if a == 0 && b == 0 => self.advance(f),
            3 if a == 0 && b == 0 => self.cancel(f, self.selected),
            4 => self.order_move_group(f, a, b),
            5 => self.order_target_group(f, if (a as usize) < self.count { self.ids[a as usize] } else { a as usize }),
            6 => self.order_move(f, if (a as usize) < self.count { self.ids[a as usize] } else { a as usize }, (b >> 16) & 0xFFFF, b & 0xFFFF),
            7 => self.order_target(f, if (a as usize) < self.count { self.ids[a as usize] } else { a as usize }, if (b as usize) < self.count { self.ids[b as usize] } else { b as usize }),
            8 => {
                let foe = 1 - self.game.player;
                let lane = (a % 2) as usize;
                self.dispatch_raid(foe, lane, true);
                true
            }
            10 if b == 0 => self.research_start(f, a),
            11 if a == 0 && b == 0 => self.research_cancel(f),
            _ => false,
        };
        if accepted { self.pack(); }
        accepted
    }
    fn order_move_group(&mut self, f: usize, a: u32, b: u32) -> bool {
        let mut group = [CAP; MATCH_ACTORS];
        let mut count = 0;
        for i in 0..MATCH_ACTORS {
            if self.selected_group[i] && self.entities[i].active && self.entities[i].data[9] as usize == f {
                if let Some(k) = roster(self.entities[i].data[4] as u32) {
                    if k.klass != 0 {
                        group[count] = i;
                        count += 1;
                    }
                }
            }
        }
        if count == 0 {
            if self.selected < MATCH_ACTORS {
                return self.order_move(f, self.selected, a, b);
            }
            return false;
        }
        if count == 1 {
            return self.order_move(f, group[0], a, b);
        }
        let center_x = a as f32 / 10.;
        let center_y = b as f32 / 10.;
        let cols = if count <= 4 { 2 } else { 3 };
        let mut any_moved = false;
        for (idx, &unit_id) in group[..count].iter().enumerate() {
            let row = (idx / cols) as f32;
            let col = (idx % cols) as f32 - ((cols - 1) as f32 * 0.5);
            let mut target_x = center_x + col * 1.2;
            let mut target_y = center_y + row * 1.2;
            if self.ground(target_x, target_y) < 0. {
                target_x = center_x;
                target_y = center_y;
            }
            let tx = target_x.clamp(1., (WORLD - 1) as f32);
            let ty = target_y.clamp(1., (WORLD - 1) as f32);
            if self.order_move(f, unit_id, (tx * 10.) as u32, (ty * 10.) as u32) {
                any_moved = true;
            }
        }
        any_moved
    }
    fn order_target_group(&mut self, f: usize, target: usize) -> bool {
        let mut group = [CAP; MATCH_ACTORS];
        let mut count = 0;
        for i in 0..MATCH_ACTORS {
            if self.selected_group[i] && self.entities[i].active && self.entities[i].data[9] as usize == f {
                if let Some(k) = roster(self.entities[i].data[4] as u32) {
                    if k.klass != 0 {
                        group[count] = i;
                        count += 1;
                    }
                }
            }
        }
        if count == 0 {
            if self.selected < MATCH_ACTORS {
                return self.order_target(f, self.selected, target);
            }
            return false;
        }
        let mut any = false;
        for &id in &group[..count] {
            if self.order_target(f, id, target) {
                any = true;
            }
        }
        any
    }
    fn order_move(&mut self, f: usize, selected: usize, a: u32, b: u32) -> bool {
        if selected >= MATCH_ACTORS || !self.entities[selected].active || self.entities[selected].data[9] as usize != f {
            return false;
        }
        let Some(k) = roster(self.entities[selected].data[4] as u32) else { return false; };
        if k.klass == 0 { return false; } // Buildings do not move
        let mut tx = (a as f32 / 10.).clamp(2., (WORLD - 2) as f32);
        let mut ty = (b as f32 / 10.).clamp(2., (WORLD - 2) as f32);
        if self.mode == 1 && self.ground(tx, ty) < 0. {
            if let Some((lx, ly)) = self.land_near(tx.floor() as i32, ty.floor() as i32, 40) {
                tx = lx;
                ty = ly;
            }
        }
        self.game.orders[selected] = Order::Move((tx * 10.) as u16, (ty * 10.) as u16);
        self.game.homes[selected] = (tx, ty);
        self.entities[selected].timer = 0;
        self.entities[selected].target = CAP;

        let px = self.entities[selected].data[0];
        let py = self.entities[selected].data[1];
        let dist = ((tx - px).powi(2) + (ty - py).powi(2)).sqrt();
        if self.mode == 1 && dist > 35. && !self.line_clear(px, py, tx, ty, 6) {
            let from_faction = self.entities[selected].data[9] as usize;
            let mut best_lane = 0;
            let mut best_wp = 1;
            let mut min_total_d = f32::MAX;
            for lane in 0..2 {
                let path = corridor_path(from_faction, lane, lane);
                for (wp_idx, &(wx, wy)) in path.iter().enumerate() {
                    let d_start = ((wx - px).powi(2) + (wy - py).powi(2)).sqrt();
                    let d_goal = ((tx - wx).powi(2) + (ty - wy).powi(2)).sqrt();
                    let total = d_start + d_goal;
                    if total < min_total_d && self.line_clear(px, py, wx, wy, 4) {
                        min_total_d = total;
                        best_lane = lane as u8;
                        best_wp = (wp_idx + 1) as u8;
                    }
                }
            }
            self.game.lanes[selected] = best_lane;
            self.game.waypoints[selected] = best_wp;
        } else {
            self.game.waypoints[selected] = 0;
        }
        true
    }
    fn order_target(&mut self, f: usize, selected: usize, target: usize) -> bool {
        if selected >= MATCH_ACTORS || !self.entities[selected].active || self.entities[selected].data[9] as usize != f {
            return false;
        }
        if target >= MATCH_ACTORS || !self.entities[target].active {
            return false;
        }
        let sel_kind = self.entities[selected].data[4] as u32;
        let target_kind = self.entities[target].data[4] as u32;
        let target_f = self.entities[target].data[9] as usize;
        if target_kind == 40 {
            if worker(sel_kind) || carrier(sel_kind) {
                self.game.orders[selected] = Order::Gather;
                self.entities[selected].target = target;
                self.entities[selected].route = 0;
                return true;
            }
        } else if target_f == f {
            if worker(sel_kind) {
                if self.entities[target].data[5] == 5. {
                    self.game.orders[selected] = Order::Build(target);
                    return true;
                } else if self.entities[target].data[7] < 1. {
                    let (tx, ty) = self.edge(target, selected);
                    self.game.orders[selected] = Order::Move((tx * 10.) as u16, (ty * 10.) as u16);
                    return true;
                }
            }
        } else {
            self.game.orders[selected] = Order::Target(target);
            return true;
        }
        false
    }
}

impl Sim {
    fn remove_actor(&mut self, id: usize) {
        self.entities[id].active = false;
        self.game.jobs[id] = Production::EMPTY;
        self.game.orders[id] = Order::Idle;
        self.game.waypoints[id] = 0;
        self.game.lanes[id] = 0;
        self.actors.bows[id]=actors::BowAction::EMPTY;
        if id<self.actors.commands.len(){self.actors.commands[id]=None;self.actors.paths[id]=None;}
        if self.selected == id { self.selected = CAP; }
        self.selected_group[id] = false;
        for j in 0..MATCH_ACTORS {
            if self.game.orders[j] == Order::Build(id) {
                self.game.orders[j] = Order::Gather;
                self.entities[j].timer = 0;
            }
            if self.entities[j].active && self.entities[j].data[5] == 5. && self.entities[j].target == id {
                self.entities[j].target = CAP;
            }
        }
    }
    fn edge(&self, building: usize, from: usize) -> (f32, f32) {
        let e = self.entities[building];
        let k = roster(e.data[4] as u32).unwrap();
        let positions = [(e.data[0] - k.width / 2. - 0.5, e.data[1]),
            (e.data[0] + k.width / 2. + 0.5, e.data[1]),
            (e.data[0], e.data[1] - k.depth / 2. - 0.5),
            (e.data[0], e.data[1] + k.depth / 2. + 0.5)];
        let origin = self.entities[from];
        let mut result = positions[0];
        let mut distance = f32::INFINITY;
        for p in positions {
            let d = (p.0 - origin.data[0]).powi(2) + (p.1 - origin.data[1]).powi(2);
            if d < distance { distance = d; result = p; }
        }
        result
    }
    fn rally(&self, producer: usize) -> (f32, f32) {
        let e = self.entities[producer];
        let k = roster(e.data[4] as u32).unwrap();
        // East-side rally points keep new opponent troops behind their works.
        // The clamp follows the active map: at 32 tiles it is the authored island
        // bound, in a world match it is the 1024-tile edge.
        ((e.data[0] + k.width / 2. + 0.7).clamp(2.3, self.side() as f32 - 2.3), e.data[1])
    }
    fn match_production(&mut self) {
        for id in 0..MATCH_ACTORS {
            let job = self.game.jobs[id];
            if job.kind == 0 { continue; }
            if !self.entities[id].active { self.game.jobs[id] = Production::EMPTY; continue; }
            self.game.jobs[id].remaining -= 1;
            if self.game.jobs[id].remaining != 0 { continue; }
            let k = roster(job.kind).unwrap();
            let (x, y) = self.rally(id);
            self.game.jobs[id] = Production::EMPTY;
            self.match_add(job.slot, k.kind, x, y, k.faction);
            self.game.orders[job.slot] = if worker(k.kind) || carrier(k.kind) { Order::Gather }
                else if aircraft(k.kind) { Order::Idle } else { Order::Defend };
            if k.faction != self.game.player && k.damage > 0. && !aircraft(k.kind) {
                // Posts sit around the AI's own base. They used to be authored
                // island coordinates, which parked every replacement unit at the
                // far corner of a 10 km map.
                let (bx, by) = self.game.base[k.faction];
                if let Some(index) = self.game.defenders.iter().position(|&d| !self.complete(d, k.faction)) {
                    self.game.defenders[index] = job.slot;
                    self.game.homes[job.slot] = (bx - 2., by + 1. + index as f32 * 3.);
                } else {
                    self.game.homes[job.slot] = (bx + 1. + (job.slot % 2) as f32 * 0.6, by + 2. + (job.slot % 4) as f32);
                }
            }
        }
        // A lost builder pauses a site until the next available worker takes it.
        for id in 0..MATCH_ACTORS {
            let e = self.entities[id];
            if !e.active || e.data[5] != 5. { continue; }
            let f = e.data[9] as usize;
            if e.target < MATCH_ACTORS && self.complete(e.target, f)
                && self.game.orders[e.target] == Order::Build(id) { continue; }
            if let Some(builder) = self.nearest_builder(f, e.data[0], e.data[1]) {
                self.entities[id].target = builder;
                self.entities[builder].timer = 0;
                self.game.orders[builder] = Order::Build(id);
            }
        }
    }
    fn nearest_ore(&self, id: usize) -> Option<usize> {
        let e = self.entities[id];
        let mut distance = f32::INFINITY;
        let mut result = None;
        for j in 0..MATCH_ACTORS {
            let node = self.entities[j];
            if !node.active || node.data[4] != 40. || node.data[10] < 1. { continue; }
            let d = (node.data[0] - e.data[0]).powi(2) + (node.data[1] - e.data[1]).powi(2);
            if d < distance { distance = d; result = Some(j); }
        }
        result
    }
    fn dropoff(&self, id: usize) -> Option<usize> {
        let e = self.entities[id];
        let mut distance = f32::INFINITY;
        let mut result = None;
        for j in 0..MATCH_ACTORS {
            let depot = self.entities[j];
            if !self.complete(j, e.data[9] as usize) || !matches!(depot.data[4] as u32, 10 | 11 | 60 | 61) { continue; }
            let p = self.edge(j, id);
            let d = (p.0 - e.data[0]).powi(2) + (p.1 - e.data[1]).powi(2);
            if d < distance { distance = d; result = Some(j); }
        }
        result
    }
    fn gather(&mut self, id: usize, k: &Kind) {
        let e = self.entities[id];
        let cargo_cap = if carrier(k.kind) { 12. } else { 4. };
        if e.route == 1 || e.data[10] >= cargo_cap {
            self.entities[id].route = 1;
            if let Some(depot) = self.dropoff(id) {
                let (x, y) = self.edge(depot, id);
                if self.walk(id, x, y, k.speed) {
                    self.entities[id].data[5] = 7.;
                    self.entities[id].timer += 1;
                    if self.entities[id].timer >= 30 {
                        self.game.sides[k.faction].alloy = self.game.sides[k.faction].alloy.saturating_add(e.data[10] as u32);
                        self.entities[id].data[10] = 0.;
                        self.entities[id].timer = 0;
                        self.entities[id].route = 0;
                        self.entities[id].target = CAP;
                    }
                }
            } else { self.entities[id].data[5] = 0.; }
            return;
        }
        let target = e.target;
        let node = if target < MATCH_ACTORS && self.entities[target].active
            && self.entities[target].data[4] == 40. && self.entities[target].data[10] >= 1. { Some(target) }
            else { self.nearest_ore(id) };
        if let Some(node) = node {
            if e.target != node { self.entities[id].timer = 0; }
            self.entities[id].target = node;
            let ore = self.entities[node];
            if self.walk(id, ore.data[0] + 0.5, ore.data[1] + 0.3, k.speed) {
                self.entities[id].data[5] = 3.;
                self.entities[id].timer += 1;
                if self.entities[id].timer >= if carrier(k.kind) { 60 } else { 120 } {
                    self.entities[id].timer = 0;
                    self.entities[id].data[10] += 1.;
                    self.entities[node].data[10] -= 1.;
                }
            }
        } else {
            self.entities[id].data[5] = 0.;
            if e.data[10] > 0. { self.entities[id].route = 1; }
        }
    }
    fn enemy_near(&self, id: usize, radius: f32, fighters_only: bool) -> Option<usize> {
        let e = self.entities[id];
        let mut best = radius * radius;
        let mut result = None;
        for j in 0..MATCH_ACTORS {
            let other = self.entities[j];
            if !other.active || other.data[9] == e.data[9] { continue; }
            let Some(k) = roster(other.data[4] as u32) else { continue; };
            if fighters_only && (k.klass != 1 || k.damage == 0.) { continue; }
            let d = (other.data[0] - e.data[0]).powi(2) + (other.data[1] - e.data[1]).powi(2);
            if d <= best && (d < best || result.is_none()) { best = d; result = Some(j); }
        }
        result
    }
    fn repair(&mut self, id: usize, f: usize) {
        if self.tick % 60 != 0 || self.game.sides[f].alloy == 0 { return; }
        let e = self.entities[id];
        for j in 0..MATCH_ACTORS {
            let target = self.entities[j];
            if !self.complete(j, f) || target.data[7] >= 1. { continue; }
            let k = self.effective_kind(target.data[4] as u32).unwrap();
            if k.klass == 0 && (target.data[0] - e.data[0]).abs() <= k.width / 2. + 1.
                && (target.data[1] - e.data[1]).abs() <= k.depth / 2. + 1. {
                self.game.sides[f].alloy -= 1;
                self.entities[j].data[7] = (target.data[7] + 10. / k.hp).min(1.);
                self.entities[id].data[5] = 8.;
                break;
            }
        }
    }
    fn match_orders(&mut self) {
        for id in 0..MATCH_ACTORS {
            let e = self.entities[id];
            if !e.active { continue; }
            let Some(k) = self.effective_kind(e.data[4] as u32) else { continue; };
            if k.klass == 0 { continue; }
            if k.kind==30 && self.bow_locked(id){self.entities[id].data[5]=2.;continue;}
            self.entities[id].data[5] = 0.;
            if self.actor_order_tick(id,&k){continue;}
            if (worker(k.kind) || carrier(k.kind)) && self.enemy_near(id, 4., true).is_some() {
                if let Some(depot) = self.dropoff(id) {
                    let (x, y) = self.edge(depot, id);
                    self.walk(id, x, y, k.speed);
                }
                self.entities[id].data[5] = 6.;
                continue;
            }
            match self.game.orders[id] {
                Order::Gather => self.gather(id, &k),
                Order::Build(site) => {
                    if !self.entities[site].active || self.entities[site].data[5] != 5. {
                        self.game.orders[id] = Order::Gather;
                        continue;
                    }
                    let (x, y) = self.edge(site, id);
                    if self.walk(id, x, y, k.speed) {
                        self.entities[id].data[5] = 3.;
                        let building = roster(self.entities[site].data[4] as u32).unwrap();
                        self.entities[site].timer += 1;
                        self.entities[site].data[10] = (self.entities[site].timer as f32 / building.ticks as f32).min(1.);
                        if self.entities[site].timer >= building.ticks {
                            self.entities[site].data[5] = 0.;
                            self.entities[site].target = CAP;
                            self.game.orders[id] = Order::Gather;
                            self.entities[id].timer = 0;
                        }
                    }
                }
                Order::Raid(until) => {
                    if self.tick >= until {
                        self.game.orders[id] = Order::Return;
                        self.game.waypoints[id] = 1;
                    }
                    else if self.enemy_near(id, k.range, false).is_none() {
                        let foe = 1 - self.entities[id].data[9] as usize;
                        let foe_base = self.game.base[foe];
                        let (px, py) = (self.entities[id].data[0], self.entities[id].data[1]);
                        let dist_to_foe_base = ((foe_base.0 - px).powi(2) + (foe_base.1 - py).powi(2)).sqrt();
                        let target = if dist_to_foe_base <= 35. {
                            self.enemy_near(id, 40., false)
                        } else {
                            self.enemy_near(id, 12., false)
                        };
                        if let Some(j) = target {
                            self.walk(id, self.entities[j].data[0], self.entities[j].data[1], k.speed);
                        } else if dist_to_foe_base <= 20. {
                            self.walk(id, foe_base.0, foe_base.1, k.speed);
                        } else {
                            let from_faction = self.entities[id].data[9] as usize;
                            let lane = self.game.lanes[id] as usize;
                            let path = corridor_path(from_faction, lane, lane);
                            let wp = self.game.waypoints[id] as usize;
                            if wp < path.len() {
                                let (wx, wy) = path[wp];
                                let d2 = (wx - px).powi(2) + (wy - py).powi(2);
                                if d2 <= 25. {
                                    self.game.waypoints[id] = (wp as u8 + 1).min(path.len() as u8 - 1);
                                    let next_wp = self.game.waypoints[id] as usize;
                                    let (nwx, nwy) = path[next_wp];
                                    self.walk(id, nwx, nwy, k.speed);
                                } else {
                                    self.walk(id, wx, wy, k.speed);
                                }
                            } else {
                                self.walk(id, foe_base.0, foe_base.1, k.speed);
                            }
                        }
                    }
                }
                Order::Defend => {
                    if self.enemy_near(id, k.range, false).is_none() {
                        let home = self.game.homes[id];
                        // Defenders intercept nearby threats, but never pursue beyond
                        // six tiles of their assigned post.
                        let target = self.enemy_near(id, 6., true).filter(|&j| {
                            (self.entities[j].data[0] - home.0).powi(2) + (self.entities[j].data[1] - home.1).powi(2) <= 36.
                        });
                        let (x, y) = target.map(|j| (self.entities[j].data[0], self.entities[j].data[1])).unwrap_or(home);
                        if self.walk(id, x, y, k.speed) { self.entities[id].data[5] = 0.; }
                    }
                }
                Order::Return => {
                    let home = self.game.homes[id];
                    let (px, py) = (self.entities[id].data[0], self.entities[id].data[1]);
                    let d_home = ((home.0 - px).powi(2) + (home.1 - py).powi(2)).sqrt();
                    if d_home <= 25. {
                        if self.walk(id, home.0, home.1, k.speed) {
                            self.game.orders[id] = Order::Defend;
                            self.game.waypoints[id] = 0;
                        } else { self.entities[id].data[5] = 6.; }
                    } else {
                        let home_faction = self.entities[id].data[9] as usize;
                        let foe = 1 - home_faction;
                        let lane = self.game.lanes[id] as usize;
                        let path = corridor_path(foe, lane, lane);
                        let wp = self.game.waypoints[id] as usize;
                        if wp < path.len() {
                            let (wx, wy) = path[wp];
                            let d2 = (wx - px).powi(2) + (wy - py).powi(2);
                            if d2 <= 25. {
                                self.game.waypoints[id] = (wp as u8 + 1).min(path.len() as u8 - 1);
                                let next_wp = self.game.waypoints[id] as usize;
                                let (nwx, nwy) = path[next_wp];
                                self.walk(id, nwx, nwy, k.speed);
                            } else {
                                self.walk(id, wx, wy, k.speed);
                            }
                        } else {
                            if self.walk(id, home.0, home.1, k.speed) {
                                self.game.orders[id] = Order::Defend;
                                self.game.waypoints[id] = 0;
                            }
                        }
                        self.entities[id].data[5] = 6.;
                    }
                }
                Order::Idle => if worker(k.kind) { self.repair(id, k.faction); },
                Order::Move(tx_fixed, ty_fixed) => {
                    let (tx, ty) = (tx_fixed as f32 / 10., ty_fixed as f32 / 10.);
                    let wp = self.game.waypoints[id] as usize;
                    let lane = self.game.lanes[id] as usize;
                    let (px, py) = (self.entities[id].data[0], self.entities[id].data[1]);
                    let dist_to_goal = ((tx - px).powi(2) + (ty - py).powi(2)).sqrt();
                    if wp > 0 && wp <= 11 && dist_to_goal > 25. {
                        let from_faction = self.entities[id].data[9] as usize;
                        let path = corridor_path(from_faction, lane, lane);
                        let wp_idx = (wp - 1).min(path.len() - 1);
                        let (wx, wy) = path[wp_idx];
                        let d_wp2 = (wx - px).powi(2) + (wy - py).powi(2);
                        if d_wp2 <= 36. {
                            if self.line_clear(px, py, tx, ty, 6) || wp_idx + 1 >= path.len() {
                                self.game.waypoints[id] = 0;
                                self.walk(id, tx, ty, k.speed);
                            } else {
                                self.game.waypoints[id] = (wp as u8 + 1).min(path.len() as u8);
                                let next_idx = (wp_idx + 1).min(path.len() - 1);
                                let (nwx, nwy) = path[next_idx];
                                self.walk(id, nwx, nwy, k.speed);
                            }
                        } else {
                            self.walk(id, wx, wy, k.speed);
                        }
                    } else {
                        if self.walk(id, tx, ty, k.speed) {
                            self.game.orders[id] = if worker(k.kind) || carrier(k.kind) { Order::Idle } else { Order::Defend };
                            self.game.waypoints[id] = 0;
                        }
                    }
                }
                Order::Target(target_id) => {
                    if target_id >= MATCH_ACTORS || !self.entities[target_id].active || self.entities[target_id].data[7] <= 0. {
                        self.game.orders[id] = Order::Defend;
                    } else {
                        let (tx, ty) = (self.entities[target_id].data[0], self.entities[target_id].data[1]);
                        let d = ((tx - e.data[0]).powi(2) + (ty - e.data[1]).powi(2)).sqrt();
                        if d <= k.range {
                            self.entities[id].data[3] = (ty - e.data[1]).atan2(tx - e.data[0]);
                            self.entities[id].data[5] = 2.;
                        } else {
                            self.walk(id, tx, ty, k.speed);
                        }
                    }
                }
            }
            if aircraft(k.kind) { self.entities[id].data[2] = self.ground(self.entities[id].data[0], self.entities[id].data[1]) + 3.; }
        }
    }
    fn match_damage(&mut self, target: usize, damage: f32) {
        if !self.entities[target].active { return; }
        let victim = self.entities[target];
        let Some(k) = self.effective_kind(victim.data[4] as u32) else { return; };
        self.actor_event(3,target,CAP,damage.min(victim.data[7]*k.hp));
        self.entities[target].data[7] = (victim.data[7] - damage / k.hp).max(0.);
        if self.entities[target].data[7] > 0. { return; }
        self.actor_event(4,target,CAP,0.);
        self.remove_actor(target);
        if let Some(fx) = (148..CAP).find(|&i| !self.entities[i].active) {
            self.match_add(fx, 52, victim.data[0], victim.data[1], k.faction);
            self.entities[fx].data[10] = k.kind as f32;
        }
    }
    fn match_combat(&mut self) {
        for id in 0..MATCH_ACTORS {
            let e = self.entities[id];
            if !e.active || e.data[5] == 5. { continue; }
            let Some(k) = self.effective_kind(e.data[4] as u32) else { continue; };
            if k.damage == 0. { continue; }
            if self.lab.active&&self.lab.scenario==0&&e.data[9]!=self.game.player as f32{continue;}
            if k.kind==30{self.jackal_combat(id,&k);continue;}
            if k.klass == 0 { self.entities[id].data[5] = 0.; }
            self.game.cooldowns[id] = self.game.cooldowns[id].saturating_sub(1);
            if k.klass == 1 { self.entities[id].data[11] = self.game.cooldowns[id] as f32 / k.cadence as f32; }
            if self.game.orders[id] == Order::Return || e.data[5] == 6. { continue; }
            if self.actors.commands.get(id).and_then(|c|*c).is_some_and(|c|matches!(c,nav::Command::Move(_))){continue;}
            let command=self.actors.commands.get(id).and_then(|c|*c);
            let target=if let Some(nav::Command::Attack(handle))=command{self.actor_id(handle).filter(|&j|self.in_range(id,j,k.range)&&self.line_of_fire(id,j))}
                else if command.is_some(){self.visible_enemy(id,k.range)}else{self.enemy_near(id,k.range,false)};
            let Some(target)=target else{continue;};
            let victim = self.entities[target];
            self.entities[id].data[5] = 2.;
            self.entities[id].data[3] = (victim.data[1] - e.data[1]).atan2(victim.data[0] - e.data[0]);
            if self.game.cooldowns[id] > 0 { continue; }
            if matches!(k.kind, 16 | 66) {
                if self.game.sides[k.faction].charge == 0 { continue; }
                self.game.sides[k.faction].charge -= 1;
            }
            self.game.cooldowns[id] = k.cadence;
            if k.klass == 1 { self.entities[id].data[11] = 1.; }
            if let Some(shot) = (MATCH_ACTORS..148).find(|&j| !self.entities[j].active) {
                self.match_add(shot, 50, e.data[0], e.data[1], k.faction);
                let generation = self.game.generations[target] as usize;
                let yaw = self.entities[id].data[3];
                let p = &mut self.entities[shot];
                p.target = target;
                p.route = generation;
                p.data[2] = e.data[2] + if k.klass == 0 { 2. } else { 0.8 };
                p.data[3] = yaw;
                p.data[10] = k.kind as f32; p.damage=k.damage;
                p.origin = [e.data[0], e.data[1], p.data[2]];
                p.destination = [victim.data[0], victim.data[1], victim.data[2] + 0.5];
            } else {
                // Exhausting visual slots must not suppress a valid attack.
                let bonus = if k.kind == 26 && roster(victim.data[4] as u32).unwrap().klass == 0 { 2. } else { 1. };
                self.match_damage(target, k.damage * bonus);
            }
        }
        for id in MATCH_ACTORS..CAP {
            let e = self.entities[id];
            if !e.active { continue; }
            self.entities[id].timer += 1;
            self.entities[id].data[11] = self.entities[id].timer as f32 / 60.;
            if e.data[4] != 50. {
                if self.entities[id].timer >= if e.data[4] == 52. { 30 * 60 } else { 24 } { self.entities[id].active = false; }
                continue;
            }
            let k = roster(e.data[10] as u32).unwrap();
            let duration = if matches!(k.kind, 26 | 31) { 54 } else { 12 };
            let q = (self.entities[id].timer as f32 / duration as f32).min(1.);
            for axis in 0..3 { self.entities[id].data[axis] = e.origin[axis] + (e.destination[axis] - e.origin[axis]) * q; }
            if matches!(k.kind, 26 | 31) { self.entities[id].data[2] += 8. * q * (1. - q); }
            if self.entities[id].timer < duration { continue; }
            self.entities[id].data[4] = 51.;
            self.entities[id].timer = 0;
            self.entities[id].data[11] = 0.;
            let victim = self.entities[e.target];
            if !victim.active || self.game.generations[e.target] as usize != e.route { continue; }
            let distance = (victim.data[0] - e.destination[0]).powi(2) + (victim.data[1] - e.destination[1]).powi(2);
            if distance > 1.44 { continue; }
            let bonus = if k.kind == 26 && roster(victim.data[4] as u32).unwrap().klass == 0 { 2. } else { 1. };
            self.match_damage(e.target, e.damage * bonus);
            if k.kind == 31 {
                for j in 0..MATCH_ACTORS {
                    let other = self.entities[j];
                    if j != e.target && other.active && other.data[9] == victim.data[9]
                        && (other.data[0] - e.destination[0]).powi(2) + (other.data[1] - e.destination[1]).powi(2) <= 1.44 {
                        self.match_damage(j, e.damage / 2.);
                    }
                }
            }
        }
    }
    fn owned_count(&self, f: usize, kind: u32) -> usize {
        (0..MATCH_ACTORS).filter(|&id| self.entities[id].active && self.entities[id].data[9] == f as f32
            && self.entities[id].data[4] == kind as f32).count()
            + self.game.jobs.iter().filter(|p| p.kind == kind).count()
    }
    fn ai_build(&mut self, f: usize, kind: u32) -> bool {
        let Some(builder) = (0..MATCH_ACTORS).find(|&id| self.ready_builder(f, id)) else { return false; };
        if !self.can_build(f, kind, builder) { return false; }
        let k = roster(kind).unwrap();
        let side = self.side();
        let (bx, by) = self.game.base[f];
        let (cx, cy) = (bx.floor() as i32, by.floor() as i32);
        let reach = if self.mode == 1 { 26i32 } else { 8 };
        let mut tile = None;
        let mut distance = u32::MAX;
        // Stable nearest-tile search around this faction's own base, row-major
        // ties. The authored eastern approach only exists on the 32x32 island,
        // so a world AI that searched there never built anything at all.
        let (y0, y1) = ((cy - reach).max(2), (cy + reach).min(side as i32 - 3));
        let (x0, x1) = ((cx - reach).max(2), (cx + reach).min(side as i32 - 3));
        for y in y0..=y1 { for x in x0..=x1 {
            let candidate = x as u32 + y as u32 * side;
            let d = x.abs_diff(cx).pow(2) + y.abs_diff(cy).pow(2);
            if d < distance && self.placeable(k, candidate) { tile = Some(candidate); distance = d; }
        } }
        tile.is_some_and(|tile| self.build(f, kind, tile, builder))
    }
    fn ai_train(&mut self, f: usize, kind: u32) -> bool {
        if let Some(producer) = (0..MATCH_ACTORS).find(|&id| self.can_train(f, kind, id)) {
            self.train(f, kind, producer)
        } else { false }
    }
    fn opponent(&mut self) {
        let f = 1 - self.game.player;
        let t = self.tick;
        // Decisions every 5 s. Age requests start at 30 s / 180 s and retry
        // on that clock if stock is short. Save for Starhold from 120 s onward.
        if t % (5 * 60) == 0 {
            let side = self.game.sides[f];
            if (side.age == 0 && t >= 30 * 60) || (side.age == 1 && t >= 180 * 60) { self.advance(f); }
            let side = self.game.sides[f];
            let saving = side.advancing == 0 && ((side.age == 0 && t >= 30 * 60) || (side.age == 1 && t >= 120 * 60));
            if !saving {
                let (used, cap) = self.population(f);
                if t >= 10 * 60 && (self.owned_count(f, housing(f)) == 0 || used + 3 > cap)
                    && self.owned_count(f, housing(f)) < 3 { self.ai_build(f, housing(f)); }
                if side.age >= 1 && self.owned_count(f, military(f)) == 0 { self.ai_build(f, military(f)); }
                let forge = if f == 0 { 14 } else { 64 };
                if side.age == 2 && self.owned_count(f, forge) == 0 { self.ai_build(f, forge); }
                let worker_kind = if f == 0 { 20 } else { 32 };
                if self.owned_count(f, worker_kind) < 6 { self.ai_train(f, worker_kind); }
                let siege = if f == 0 { 26 } else { 31 };
                if side.age == 2 && self.owned_count(f, siege) < 1 { self.ai_train(f, siege); }
                let frontline = if f == 0 { 22 } else { 30 };
                let ranged = if f == 0 { 23 } else { 34 };
                if self.owned_count(f, frontline) < 6 { self.ai_train(f, frontline); }
                else if self.owned_count(f, ranged) < 3 { self.ai_train(f, ranged); }
            }
        }
        // At 150 s, then every 90 s: dispatch at most 3, 4, 5, then 6 paid
        // combat units, keeping two defenders. Raids last 35 s, then return.
        if t >= self.game.next_raid {
            let lane = (self.game.waves % 2) as usize;
            self.dispatch_raid(f, lane, false);
            self.game.waves += 1;
            self.game.next_raid += 90 * 60;
        }
    }
    fn dispatch_raid(&mut self, f: usize, lane: usize, allow_defenders: bool) -> u32 {
        let t = self.tick;
        let limit = (3 + self.game.waves as usize).min(6);
        let mut sent = 0;
        for id in 0..MATCH_ACTORS {
            if sent == limit { break; }
            if !self.complete(id, f) || self.game.defenders.contains(&id)
                || self.game.orders[id] != Order::Defend { continue; }
            let k = roster(self.entities[id].data[4] as u32).unwrap();
            if k.klass != 1 || k.damage == 0. || aircraft(k.kind) { continue; }
            let march = (990. / k.speed.max(0.1)).ceil() as u32;
            self.game.orders[id] = Order::Raid(t + (120 + march) * 60);
            self.game.waypoints[id] = 1;
            self.game.lanes[id] = (lane % 2) as u8;
            sent += 1;
        }
        if sent == 0 && allow_defenders {
            for id in 0..MATCH_ACTORS {
                if !self.complete(id, f) { continue; }
                let k = roster(self.entities[id].data[4] as u32).unwrap();
                if k.klass != 1 || k.damage == 0. || aircraft(k.kind) { continue; }
                let march = (990. / k.speed.max(0.1)).ceil() as u32;
                self.game.orders[id] = Order::Raid(t + (120 + march) * 60);
                self.game.waypoints[id] = 1;
                self.game.lanes[id] = (lane % 2) as u8;
                sent += 1;
                if sent >= 2 { break; }
            }
        }
        sent as u32
    }
    // Count only live roster actors, including unfinished sites. Neutral ore,
    // projectiles and lingering wrecks cannot keep a defeated side alive. Read
    // after production and damage, so a spawn/death within one tick is atomic.
    fn match_outcome(&mut self) {
        if self.mode != 1 || self.game.outcome != 0 { return; }
        let mut live = [false; 2];
        for e in &self.entities[..MATCH_ACTORS] {
            if e.active && e.data[7] > 0. && e.data[5] != 4. && e.data[9] < 2.
                && roster(e.data[4] as u32).is_some() {
                live[e.data[9] as usize] = true;
                if live[0] && live[1] { break; }
            }
        }
        // Player-first is the deterministic tie break for a simultaneous wipe.
        for f in [self.game.player, 1 - self.game.player] {
            if live[f] { self.game.empty_since[f] = 0; }
            else if self.game.empty_since[f] == 0 { self.game.empty_since[f] = self.tick; }
            else if self.tick - self.game.empty_since[f] >= OUTCOME_GRACE {
                self.game.outcome = if f == self.game.player { 1 } else { 2 };
                self.game.outcome_tick = self.tick;
                break;
            }
        }
    }
    fn match_tick(&mut self) {
        self.tick += 1;
        for side in &mut self.game.sides {
            if side.advancing > 0 {
                side.advancing -= 1;
                if side.advancing == 0 { side.age += 1; }
            }
        }
        self.match_production();
        self.research_tick();
        // Both starting haulers wait at the depot for the opening ten seconds.
        if self.tick == 10 * 60 {
            for id in 0..MATCH_ACTORS {
                if self.entities[id].active && carrier(self.entities[id].data[4] as u32) {
                    self.game.orders[id] = Order::Gather;
                }
            }
        }
        if self.tick % 60 == 0 {
            for f in 0..2 {
                let wells = (0..MATCH_ACTORS).filter(|&id| self.complete(id, f) && self.entities[id].data[4] == source(f) as f32).count();
                self.game.sides[f].charge = self.game.sides[f].charge.saturating_add(wells as u32);
            }
        }
        for e in &mut self.entities[..MATCH_ACTORS] {
            if e.active && e.data[4] == 40. {
                if self.tick % 180 == 0 { e.data[10] = (e.data[10] + 1.).min(160.); }
                e.data[11] = if e.data[10] >= 160. { 0. } else { (self.tick % 180) as f32 / 180. };
            }
        }
        if !self.lab.active{self.opponent();}
        self.match_orders();
        self.match_combat();
        self.match_outcome();
        for id in 0..MATCH_ACTORS {
            if !self.entities[id].active { continue; }
            if self.entities[id].data[4]==30. && self.actors.bows[id].target<CAP{continue;}
            let state = self.entities[id].data[5] as u32;
            let period = match state { 1 | 6 => 36, 2 => 60, _ => 120 };
            self.entities[id].data[6] = ((self.tick + id as u32 * 17) % period) as f32 / period as f32;
        }
        self.pack();
    }
}

#[no_mangle] pub extern "C" fn sim_match_init(seed: u32, faction: u32) { SIM.with(|s| s.borrow_mut().match_init(seed, faction)); }
// ---- Expansive-world read-only surface (LARGEMAP_SPEC §4) ------------------
/// 1024 while a world match is live, 0 when the showcase is running.
#[no_mangle] pub extern "C" fn sim_world_size() -> u32 { SIM.with(|s| { let s = s.borrow(); if s.mode == 1 { s.side() } else { 0 } }) }
#[no_mangle] pub extern "C" fn sim_world_ptr() -> *const f32 { SIM.with(|s| s.borrow().world.as_ptr()) }
#[no_mangle] pub extern "C" fn sim_metres_per_tile() -> u32 { METRES_PER_TILE }
/// Base site of a faction, so the camera can open on the player's own start.
#[no_mangle] pub extern "C" fn sim_base_x(f: u32) -> f32 { SIM.with(|s| { let s = s.borrow(); if s.mode == 1 { s.game.base[usize::from(f == 1)].0 } else { 16. } }) }
#[no_mangle] pub extern "C" fn sim_base_y(f: u32) -> f32 { SIM.with(|s| { let s = s.borrow(); if s.mode == 1 { s.game.base[usize::from(f == 1)].1 } else { 16. } }) }
#[no_mangle] pub extern "C" fn sim_mode() -> u32 { SIM.with(|s| s.borrow().mode) }
/// Match-end report: 0 none, 1 player defeat, 2 player victory. Sticky until init.
#[no_mangle] pub extern "C" fn sim_outcome() -> u32 { SIM.with(|s| { let s = s.borrow(); if s.mode == 1 { s.game.outcome } else { 0 } }) }
/// Decision tick (60 Hz), or 0 while undecided / in the frozen showcase.
#[no_mangle] pub extern "C" fn sim_outcome_tick() -> u32 { SIM.with(|s| { let s = s.borrow(); if s.mode == 1 { s.game.outcome_tick } else { 0 } }) }
#[no_mangle] pub extern "C" fn sim_player() -> u32 { SIM.with(|s| { let s = s.borrow(); if s.mode == 1 { s.game.player as u32 } else { 0 } }) }
#[no_mangle] pub extern "C" fn sim_age() -> u32 { SIM.with(|s| { let s = s.borrow(); if s.mode == 1 { s.game.sides[s.game.player].age } else { 0 } }) }
#[no_mangle] pub extern "C" fn sim_age_progress() -> f32 { SIM.with(|s| {
    let s = s.borrow();
    if s.mode != 1 { return 1.; }
    let side = s.game.sides[s.game.player];
    if side.advancing == 0 { 1. } else { 1. - side.advancing as f32 / age_cost(side.age).2 as f32 }
}) }
#[no_mangle] pub extern "C" fn sim_age_cost() -> u32 { age_cost(sim_age()).0 }
#[no_mangle] pub extern "C" fn sim_age_cost_charge() -> u32 { age_cost(sim_age()).1 }
#[no_mangle] pub extern "C" fn sim_pop_used() -> u32 { SIM.with(|s| {
    let s = s.borrow();
    if s.mode == 1 { s.population(s.game.player).0 } else {
        s.entities.iter().filter(|e| e.active && e.data[9] == 0.)
            .filter_map(|e| roster(e.data[4] as u32)).map(|k| k.pop).sum()
    }
}) }
#[no_mangle] pub extern "C" fn sim_pop_cap() -> u32 { SIM.with(|s| {
    let s = s.borrow();
    if s.mode == 1 { s.population(s.game.player).1 } else {
        s.entities.iter().filter(|e| e.active && e.data[9] == 0. && e.data[10] >= 1.)
            .map(|e| match e.data[4] as u32 { 10 => 15, 15 => 5, _ => 0 }).sum()
    }
}) }
#[no_mangle] pub extern "C" fn sim_command(op: u32, a: u32, b: u32) -> u32 { SIM.with(|s| s.borrow_mut().command(op, a, b) as u32) }
#[no_mangle] pub extern "C" fn sim_roster_count() -> u32 { KINDS.len() as u32 }
#[no_mangle] pub extern "C" fn sim_roster_ptr() -> *const f32 { ROSTER.as_ptr() }
// Placement readbacks never pack, step, select or spend. Tokens are stable actor
// slots + 1 (zero = none), unlike the compact snapshot indices used by the HUD.
#[no_mangle] pub extern "C" fn sim_selected_token() -> u32 { SIM.with(|s| {
    let s = s.borrow(); if s.selected < CAP && s.entities[s.selected].active { s.selected as u32 + 1 } else { 0 }
}) }
#[no_mangle] pub extern "C" fn sim_can_place(kind: u32, tile: u32) -> u32 { SIM.with(|s| {
    let s = s.borrow(); (s.mode == 1 && s.can_place(s.game.player, kind, tile, s.selected)) as u32
}) }
#[no_mangle] pub extern "C" fn sim_build_extent(kind: u32, axis: u32) -> f32 {
    roster(kind).filter(|k| k.klass == 0).map_or(0., |k| if axis == 0 { k.width } else { k.depth })
}
#[no_mangle] pub extern "C" fn sim_build_builder(tile: u32) -> u32 { SIM.with(|s| {
    let s = s.borrow(); let side = s.side();
    if s.mode != 1 || tile >= side * side || !s.ready_builder(s.game.player, s.selected) { return 0; }
    s.nearest_builder(s.game.player, (tile % side) as f32 + 0.5, (tile / side) as f32 + 0.5)
        .map_or(0, |id| id as u32 + 1)
}) }
#[no_mangle] pub extern "C" fn sim_builder_ready(token: u32) -> u32 { SIM.with(|s| {
    let s = s.borrow(); (s.mode == 1 && token > 0 && s.ready_builder(s.game.player, token.wrapping_sub(1) as usize)) as u32
}) }
#[no_mangle] pub extern "C" fn sim_can_train(kind: u32) -> u32 { SIM.with(|s| {
    let s = s.borrow(); (s.mode == 1 && s.can_train(s.game.player, kind, s.selected)) as u32
}) }
#[no_mangle] pub extern "C" fn sim_can_build(kind: u32) -> u32 {
    SIM.with(|s| {
        let s = s.borrow(); (s.mode == 1 && s.can_build(s.game.player, kind, s.selected)) as u32
    })
}
#[no_mangle] pub extern "C" fn sim_raid_active() -> u32 {
    SIM.with(|s| {
        let s = s.borrow();
        if s.mode != 1 { return 0; }
        let foe = 1 - s.game.player;
        let mut count = 0;
        for id in 0..MATCH_ACTORS {
            if s.complete(id, foe) && matches!(s.game.orders[id], Order::Raid(_)) {
                count += 1;
            }
        }
        count
    })
}
#[no_mangle] pub extern "C" fn sim_raid_lane() -> u32 {
    SIM.with(|s| {
        let s = s.borrow();
        if s.mode != 1 { return 0; }
        let foe = 1 - s.game.player;
        for id in 0..MATCH_ACTORS {
            if s.complete(id, foe) && matches!(s.game.orders[id], Order::Raid(_)) {
                return s.game.lanes[id] as u32;
            }
        }
        0
    })
}
#[no_mangle] pub extern "C" fn sim_raid_breach() -> u32 {
    SIM.with(|s| {
        let s = s.borrow();
        if s.mode != 1 { return 0; }
        let foe = 1 - s.game.player;
        let (bx, by) = s.game.base[s.game.player];
        for id in 0..MATCH_ACTORS {
            if s.complete(id, foe) && matches!(s.game.orders[id], Order::Raid(_)) {
                if s.game.waypoints[id] >= 5 { return 1; }
                let px = s.entities[id].data[0];
                let py = s.entities[id].data[1];
                if ((bx - px).powi(2) + (by - py).powi(2)).sqrt() <= 60. {
                    return 1;
                }
            }
        }
        0
    })
}
#[no_mangle] pub extern "C" fn sim_raid_eta() -> u32 {
    SIM.with(|s| {
        let s = s.borrow();
        if s.mode != 1 { return 0; }
        if s.game.next_raid > s.tick {
            (s.game.next_raid - s.tick) / 60
        } else {
            0
        }
    })
}
#[no_mangle] pub extern "C" fn sim_corridor_wp(lane: u32, wp: u32, coord: u32) -> f32 {
    SIM.with(|s| {
        let s = s.borrow();
        let foe = if s.mode == 1 { 1 - s.game.player } else { 1 };
        let path = corridor_path(foe, (lane % 2) as usize, (lane % 2) as usize);
        let idx = (wp as usize).min(path.len() - 1);
        if coord == 0 { path[idx].0 } else { path[idx].1 }
    })
}
