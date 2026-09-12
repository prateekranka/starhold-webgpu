//! ABI kinds: 10 Keep, 11 Court, 12 Well, 13 Hall, 14 Forge, 15 Hearth,
//! 16 Bastion, 17 Wharf; 20 Riveter, 21 Beetle, 22 Sentinel, 23 Sunlance,
//! 24 Skiff, 30 Jackal, 31 Strider; 40 Ore, 41 Drone, 42 Freighter,
//! 43 Relief, 50 Projectile, 51 Impact, 52 Wreck.
//! States: 0 idle, 1 move, 2 attack, 3 work, 4 death, 5 construct,
//! 6 retreat, 7 dock, 8 repair, 9 inactive.
//! Snapshot: x,y,z,yaw,kind,state,anim_phase,health,selected,faction,param0,param1.
use std::cell::RefCell;
const CAP: usize = 160;
const STRIDE: usize = 12;
// Two staggered ranks on the eastern terrace. At yaw 0 adjacent centers
// project at least 13 pixels apart; every foot stays on the z=.5 mesa.
const RAID_POSTS: [(f32,f32);8] = [(26.6,16.),(26.6,18.6),(26.6,21.2),(28.3,15.1),(28.3,17.7),(28.3,20.3),(27.,23.6),(28.3,22.9)];
// Planted infantry screen in front of the buildings, with rifle support behind.
const GUARD_POSTS: [(f32,f32);6] = [(23.1,15.8),(23.2,18.4),(23.1,21.),(19.5,24.),(19.,18.8),(19.3,22.)];
#[derive(Clone, Copy)]
struct Entity { data: [f32; STRIDE], x: i32, y: i32, target: usize, timer: u32, route: usize, origin: [f32;3], destination: [f32;3], active: bool }
impl Entity {
    const EMPTY: Self = Self { data: [0.; STRIDE], x: 0, y: 0, target: 0, timer: 0, route: 0, origin: [0.;3], destination: [0.;3], active: false };
}
struct Sim { entities: [Entity; CAP], snapshot: [f32; CAP*STRIDE], ids: [usize; CAP], terrain: [f32;1024], count: usize, tick: u32, accumulator: f64, rng: u32, selected: usize, alloy: u32, charge: u32 }
thread_local! { static SIM: RefCell<Sim> = RefCell::new(Sim { entities:[Entity::EMPTY;CAP], snapshot:[0.;CAP*STRIDE], ids:[0;CAP], terrain:[0.;1024], count:0,tick:0,accumulator:0.,rng:1,selected:CAP,alloy:160,charge:120 }); }
fn height(x:f32,y:f32)->f32 {
    if (7. ..25.).contains(&x) && (9. ..26.).contains(&y) || (23. ..29.).contains(&x) && (7. ..26.).contains(&y) || (3. ..10.).contains(&x) && (15. ..26.).contains(&y) || x>=24. && y<=14. {0.5}
    else if (7. ..14.).contains(&x) && (3. ..9.).contains(&y) {1.} else if x<2. || y<2. || x>30. || y>30. {-1.} else {0.}
}
impl Sim {
 fn random(&mut self)->u32 { let mut x=self.rng; x^=x<<13;x^=x>>17;x^=x<<5;self.rng=x;x }
 fn add(&mut self,id:usize,kind:u32,x:f32,y:f32,faction:f32) { let mut e=Entity::EMPTY;e.active=true;e.x=(x*1024.) as i32;e.y=(y*1024.) as i32;e.data=[x,y,height(x,y),0.,kind as f32,0.,0.,1.,0.,faction,1.,0.];self.entities[id]=e; }
 fn pack(&mut self) { self.count=0;for i in 0..CAP {if self.entities[i].active {self.entities[i].data[8]=if self.selected==i {1.} else {0.};self.ids[self.count]=i;self.snapshot[self.count*STRIDE..(self.count+1)*STRIDE].copy_from_slice(&self.entities[i].data);self.count+=1;}} }
 fn walk(&mut self,id:usize,x:f32,y:f32,speed:f32)->bool {let e=&mut self.entities[id];let dx=(x*1024.) as i32-e.x;let dy=(y*1024.) as i32-e.y;let dist=((dx as f64).powi(2)+(dy as f64).powi(2)).sqrt();let step=(speed*1024./60.) as i32;if dist<=step as f64 {e.x=(x*1024.) as i32;e.y=(y*1024.) as i32;} else {e.x+=(dx as f64/dist*step as f64).round() as i32;e.y+=(dy as f64/dist*step as f64).round() as i32;}
 e.data[0]=e.x as f32/1024.;e.data[1]=e.y as f32/1024.;e.data[2]=height(e.data[0],e.data[1]);e.data[3]=(dy as f32).atan2(dx as f32);e.data[5]=1.;dist<=step as f64 }
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
#[no_mangle] pub extern "C" fn sim_init(seed:u32) {SIM.with(|s| {let mut s=s.borrow_mut();s.entities.fill(Entity::EMPTY);s.tick=0;s.accumulator=0.;s.rng=seed.max(1);s.selected=7;s.alloy=160;s.charge=120;
for y in 0..32 {for x in 0..32 {s.terrain[y*32+x]=height(x as f32+0.5,y as f32+0.5);}}
for (id,(kind,x,y)) in [(10,16.,16.),(11,7.,23.),(12,10.,12.),(16,24.,8.),(13,16.,11.),(14,5.,18.),(15,17.,21.),(16,26.,12.)].iter().enumerate() {s.add(id,*kind,*x,*y,0.);if id>=4 {s.entities[id].data[10]=0.;s.entities[id].data[5]=5.;}}
for id in 8..27 {let kind=if id<18 {20}else if id<20 {21}else if id<24 {22}else if id<26 {23}else{24};s.add(id,kind,9.+(id%5) as f32,24.+(id%2) as f32,0.);if kind==20 {s.entities[id].data[10]=0.;}else if kind==22||kind==23 {s.add(id,kind,22.5+(id%3) as f32*0.8,11.+(id%2) as f32*2.,0.);}else if kind==24 {s.add(id,kind,21.5,22.,0.);s.entities[id].data[2]=3.5;}}
for id in 14..18 {let site=if id<16 {4}else{5};let x=s.entities[site].data[0]+if id%2==0 {1.6}else{-1.6};let y=s.entities[site].data[1]+1.8;s.add(id,20,x,y,0.);s.entities[id].data[10]=0.;}
for id in 27..39 {let j=id-27;let jitter=(s.random()%200) as f32/1000.;s.add(id,40,3.+(j%3) as f32*1.5+jitter,19.+(j/3) as f32*2.3,2.);s.entities[id].data[10]=80.;}
for id in 52..54 {s.add(id,41,16.,18.,2.);s.entities[id].data[2]=3.2;}
s.pack();});}
#[no_mangle] pub extern "C" fn sim_step(dt_ms:f32) {if !dt_ms.is_finite()||dt_ms<=0. {return;}SIM.with(|s| {let mut s=s.borrow_mut();let dt=if (dt_ms as f64-1000./60.).abs()<0.001 {1000./60.}else{dt_ms as f64};s.accumulator+=dt;while s.accumulator+0.00001>=1000./60. {s.accumulator-=1000./60.;s.tick();}});}
#[no_mangle] pub extern "C" fn sim_entity_count()->u32 {SIM.with(|s|s.borrow().count as u32)}
#[no_mangle] pub extern "C" fn sim_entity_stride()->u32 {STRIDE as u32}
#[no_mangle] pub extern "C" fn sim_entity_ptr()->*const f32 {SIM.with(|s|s.borrow().snapshot.as_ptr())}
#[no_mangle] pub extern "C" fn sim_select(index:i32) {SIM.with(|s| {let mut s=s.borrow_mut();s.selected=if index>=0&&(index as usize)<s.count {let id=s.ids[index as usize];let k=s.entities[id].data[4];if (10. ..32.).contains(&k) {id}else{CAP}}else{CAP};s.pack();});}
// Additive read-only terrain/resource exports; required entity ABI stays unchanged.
#[no_mangle] pub extern "C" fn sim_terrain_ptr()->*const f32 {SIM.with(|s|s.borrow().terrain.as_ptr())}
#[no_mangle] pub extern "C" fn sim_alloy()->u32 {SIM.with(|s|s.borrow().alloy)}
#[no_mangle] pub extern "C" fn sim_charge()->u32 {SIM.with(|s|s.borrow().charge)}
