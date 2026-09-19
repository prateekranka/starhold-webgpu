//! Disposable encounter fixtures. Mutating lab exports exist ONLY with `workshop`.
use super::*;
#[derive(Clone,Copy)]
pub(super) struct LabState {pub active:bool,pub scenario:u32,pub seed:u32,pub preparation_ticks:u32}
impl LabState {pub const EMPTY:Self=Self{active:false,scenario:0,seed:0,preparation_ticks:0};}
#[cfg(feature="workshop")]
impl Sim {
    pub(super) fn lab_init(&mut self,seed:u32,scenario:u32,faction:u32,kind:u32,enemy:u32,count:u32)->bool {
        if scenario>2||faction>1||count<1||count>8{return false;}
        if !roster(kind).is_some_and(|k|k.klass==1&&k.faction==faction as usize)||!roster(enemy).is_some_and(|k|k.klass==1&&k.faction!=faction as usize){return false;}
        self.entities.fill(Entity::EMPTY);self.snapshot.fill(0.);self.ids.fill(0);self.tick=0;self.accumulator=0.;self.rng=seed.max(1);self.selected=CAP;self.mode=1;
        self.game=Match::EMPTY;self.game.player=faction as usize;self.research=research::ResearchState::EMPTY;self.actors.reset();self.lab=LabState{active:true,scenario,seed,preparation_ticks:0};
        self.world=vec![0.5;64*64];self.terrain.fill(0.5);
        for f in 0..2 {self.game.sides[f]=Side{alloy:500,charge:300,age:2,advancing:0};self.game.base[f]=if f==faction as usize{(15.5,45.5)}else{(48.5,18.5)};}
        for i in 0..64{self.world[i]=-1.;self.world[63*64+i]=-1.;self.world[i*64]=-1.;self.world[i*64+63]=-1.;}
        if scenario==2{for y in 3..61{if !(30..34).contains(&y){self.world[y*64+32]=3.;}}}
        let f=faction as usize;let foe=1-f;
        for (j,k) in (if f==0{[10,11,12,13,14]}else{[60,61,62,63,64]}).iter().enumerate(){self.match_add(j,*k,12.+j as f32*5.,49.,f);}
        self.match_add(5,headquarters(foe),51.,12.,foe);
        for j in 0..count as usize{
            let y=29.5+j as f32*2.;let x=if scenario==0{29.5}else{25.5};
            self.match_add(10+j,kind,x,y,f);self.game.orders[10+j]=Order::Defend;
            self.match_add(30+j,enemy,if scenario==0{33.5}else{38.5},y,foe);
            self.game.orders[30+j]=Order::Defend;
        }
        if scenario!=0{
            for j in 0..count as usize{self.actors.commands[10+j]=Some(nav::Command::AttackMove(38+30*64));}
        }
        self.pack();true
    }
}
#[cfg(feature="workshop")]
#[no_mangle]pub extern "C" fn sim_lab_init(seed:u32,scenario:u32,faction:u32,kind:u32,enemy:u32,count:u32)->u32{SIM.with(|s|s.borrow_mut().lab_init(seed,scenario,faction,kind,enemy,count) as u32)}
#[cfg(feature="workshop")]
#[no_mangle]pub extern "C" fn sim_lab_tick()->u32{SIM.with(|s|s.borrow().tick)}
#[cfg(feature="workshop")]
#[no_mangle]pub extern "C" fn sim_lab_event_count()->u32{SIM.with(|s|s.borrow().actors.event_count as u32)}
#[cfg(feature="workshop")]
#[no_mangle]pub extern "C" fn sim_lab_event_ptr()->*const f32{SIM.with(|s|s.borrow().actors.events.as_ptr())}
#[cfg(feature="workshop")]
#[no_mangle]pub extern "C" fn sim_lab_event_stride()->u32{actors::EVENT_STRIDE as u32}
#[cfg(feature="workshop")]
#[no_mangle]pub extern "C" fn sim_lab_events_clear(){SIM.with(|s|s.borrow_mut().actors.event_count=0);}
#[cfg(feature="workshop")]
#[no_mangle]pub extern "C" fn sim_lab_events_dropped()->u32{SIM.with(|s|s.borrow().actors.dropped)}

/// Setup uses the real paid research transaction and completion loop. Combat is
/// not advanced. The actual preparation duration is reported separately.
#[cfg(feature="workshop")]
#[no_mangle]pub extern "C" fn sim_lab_prepare(id:u32)->u32{SIM.with(|cell|{
    let mut s=cell.borrow_mut();if !s.lab.active||s.tick!=0{return 0;}
    let f=s.game.player;if !s.research_start(f,id){return 0;}
    let ticks=s.research.jobs[f].map_or(0,|j|research::RESEARCH[j.node].ticks);
    for _ in 0..ticks{s.research_tick();}
    s.lab.preparation_ticks+=ticks;s.pack();s.research.owns(f,id) as u32
})}
#[cfg(feature="workshop")]
#[no_mangle]pub extern "C" fn sim_lab_preparation_ticks()->u32{SIM.with(|s|s.borrow().lab.preparation_ticks)}
