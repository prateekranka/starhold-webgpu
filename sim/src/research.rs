//! Simulation-owned research. No client-side costs, prerequisites, or mutations.
use super::*;

pub(super) const RESEARCH_STRIDE: usize = 12;
#[derive(Clone, Copy)]
pub(super) struct Research {
    pub id: u32, pub faction: usize, pub age: u32, pub producer: u32,
    pub alloy: u32, pub charge: u32, pub ticks: u32, pub requires: u32,
    pub exclusive: u32, pub effect: u32, pub target: u32, pub value: f32,
}
// Effects: 0 speed %, 1 damage %, 2 max HP %, 3 range tiles,
// 4 Running Draw (movement recovery ticks), 5 Anchored Draw (windup ticks).
// Stable IDs are public. Bit positions are internal to this versioned catalog.
pub(super) const RESEARCH: [Research; 12] = [
    Research{id:100,faction:0,age:0,producer:10,alloy:16,charge:8,ticks:720,requires:0,exclusive:0,effect:0,target:20,value:10.},
    Research{id:101,faction:0,age:1,producer:11,alloy:22,charge:12,ticks:960,requires:1,exclusive:0,effect:0,target:21,value:15.},
    Research{id:102,faction:0,age:1,producer:13,alloy:24,charge:12,ticks:1200,requires:0,exclusive:0,effect:2,target:22,value:15.},
    Research{id:103,faction:0,age:1,producer:13,alloy:24,charge:16,ticks:1200,requires:1<<2,exclusive:0,effect:1,target:23,value:15.},
    Research{id:104,faction:0,age:2,producer:14,alloy:32,charge:24,ticks:1680,requires:1<<3,exclusive:0,effect:3,target:23,value:1.},
    Research{id:105,faction:0,age:2,producer:14,alloy:30,charge:18,ticks:1200,requires:1<<1,exclusive:0,effect:2,target:16,value:20.},
    Research{id:200,faction:1,age:0,producer:60,alloy:16,charge:8,ticks:720,requires:0,exclusive:0,effect:0,target:32,value:10.},
    Research{id:201,faction:1,age:1,producer:61,alloy:22,charge:12,ticks:960,requires:1<<6,exclusive:0,effect:0,target:33,value:15.},
    Research{id:202,faction:1,age:1,producer:63,alloy:24,charge:12,ticks:1200,requires:0,exclusive:0,effect:1,target:30,value:25.},
    Research{id:203,faction:1,age:1,producer:63,alloy:28,charge:18,ticks:1440,requires:1<<8,exclusive:1,effect:4,target:30,value:12.},
    Research{id:204,faction:1,age:1,producer:63,alloy:28,charge:18,ticks:1440,requires:1<<8,exclusive:1,effect:5,target:30,value:36.},
    Research{id:205,faction:1,age:1,producer:63,alloy:30,charge:18,ticks:1200,requires:1<<7,exclusive:0,effect:2,target:63,value:20.},
];
#[derive(Clone, Copy)]
pub(super) struct ResearchJob { pub node: usize, pub producer: usize, pub generation: u32, pub remaining: u32 }
#[derive(Clone, Copy)]
pub(super) struct ResearchState { pub unlocked: [u32; 2], pub jobs: [Option<ResearchJob>; 2] }
impl ResearchState {
    pub const EMPTY: Self = Self { unlocked:[0;2], jobs:[None;2] };
    pub fn owns(&self, f:usize, id:u32)->bool {
        RESEARCH.iter().position(|n|n.id==id).is_some_and(|i| self.unlocked[f] & (1<<i) != 0)
    }
    pub fn busy(&self, producer:usize)->bool { self.jobs.iter().flatten().any(|j|j.producer==producer) }
}
fn index(id:u32)->Option<usize> { RESEARCH.iter().position(|n|n.id==id) }
impl Sim {
    pub(super) fn effective_kind(&self, kind:u32)->Option<Kind> {
        let mut k=*roster(kind)?;
        if self.mode!=1 {return Some(k);}
        for (i,n) in RESEARCH.iter().enumerate() {
            if n.faction!=k.faction || n.target!=kind || self.research.unlocked[k.faction]&(1<<i)==0 {continue;}
            match n.effect {0=>k.speed*=1.+n.value/100.,1=>k.damage*=1.+n.value/100.,2=>k.hp*=1.+n.value/100.,3=>k.range+=n.value,_=>{}}
        }
        Some(k)
    }
    /// 0 unknown, 1 age, 2 prerequisites, 3 producer, 4 resources,
    /// 5 queue busy, 6 mutually exclusive, 7 complete, 8 running, 9 available.
    pub(super) fn research_status(&self, f:usize, id:u32)->u32 {
        let Some(i)=index(id) else{return 0;}; let n=RESEARCH[i];
        if self.mode!=1 || f>1 || n.faction!=f || self.game.outcome!=0 {return 0;}
        let owned=self.research.unlocked[f];
        if owned&(1<<i)!=0 {return 7;}
        if self.research.jobs[f].is_some_and(|j|j.node==i) {return 8;}
        if n.exclusive!=0 && RESEARCH.iter().enumerate().any(|(j,o)|o.faction==f&&o.exclusive==n.exclusive&&owned&(1<<j)!=0) {return 6;}
        if self.game.sides[f].age<n.age {return 1;}
        if owned&n.requires!=n.requires {return 2;}
        if !self.has(f,n.producer) {return 3;}
        if self.research.jobs[f].is_some() || !(0..MATCH_ACTORS).any(|p|self.complete(p,f)&&self.entities[p].data[4]==n.producer as f32&&self.game.jobs[p].kind==0) {return 5;}
        if self.game.sides[f].alloy<n.alloy||self.game.sides[f].charge<n.charge {return 4;}
        9
    }
    pub(super) fn research_start(&mut self, f:usize, id:u32)->bool {
        if self.research_status(f,id)!=9 {return false;}
        let i=index(id).unwrap();let n=RESEARCH[i];
        let Some(producer)=(0..MATCH_ACTORS).find(|&p|self.complete(p,f)&&self.entities[p].data[4]==n.producer as f32&&self.game.jobs[p].kind==0) else{return false;};
        self.game.sides[f].alloy-=n.alloy;self.game.sides[f].charge-=n.charge;
        self.research.jobs[f]=Some(ResearchJob{node:i,producer,generation:self.game.generations[producer],remaining:n.ticks});
        true
    }
    pub(super) fn research_cancel(&mut self, f:usize)->bool {
        if self.mode!=1||f>1||self.game.outcome!=0 {return false;}
        let Some(job)=self.research.jobs[f].take() else{return false;};let n=RESEARCH[job.node];
        self.game.sides[f].alloy+=n.alloy;self.game.sides[f].charge+=n.charge;
        true
    }
    pub(super) fn research_tick(&mut self) {
        for f in 0..2 {
            let Some(mut j)=self.research.jobs[f] else{continue;};
            if !self.complete(j.producer,f)||self.game.generations[j.producer]!=j.generation {
                self.research.jobs[f]=None;continue; // Destroyed infrastructure loses the paid research.
            }
            j.remaining=j.remaining.saturating_sub(1);
            if j.remaining>0 {self.research.jobs[f]=Some(j);continue;}
            let n=RESEARCH[j.node];
            let before=self.effective_kind(n.target).map_or(1.,|k|k.hp);
            self.research.unlocked[f]|=1<<j.node;self.research.jobs[f]=None;
            let after=self.effective_kind(n.target).map_or(before,|k|k.hp);
            if after!=before {
                // Raising max HP does not heal existing actors; new actors spawn full.
                for e in &mut self.entities[..MATCH_ACTORS] {
                    if e.active&&e.data[9]==f as f32&&e.data[4]==n.target as f32 {e.data[7]=(e.data[7]*before/after).min(1.);}
                }
            }
        }
    }
}
const fn research_table()->[f32;12*RESEARCH_STRIDE] {
    let mut out=[0.;12*RESEARCH_STRIDE];let mut i=0;
    while i<RESEARCH.len(){let n=RESEARCH[i];let row=[n.id as f32,n.faction as f32,n.age as f32,n.producer as f32,n.alloy as f32,n.charge as f32,n.ticks as f32,n.requires as f32,n.exclusive as f32,n.effect as f32,n.target as f32,n.value];let mut j=0;while j<RESEARCH_STRIDE{out[i*RESEARCH_STRIDE+j]=row[j];j+=1;}i+=1;}out
}
static RESEARCH_TABLE:[f32;12*RESEARCH_STRIDE]=research_table();
#[no_mangle] pub extern "C" fn sim_content_version()->u32 {1}
#[no_mangle] pub extern "C" fn sim_research_count()->u32 {RESEARCH.len() as u32}
#[no_mangle] pub extern "C" fn sim_research_stride()->u32 {RESEARCH_STRIDE as u32}
#[no_mangle] pub extern "C" fn sim_research_ptr()->*const f32 {RESEARCH_TABLE.as_ptr()}
#[no_mangle] pub extern "C" fn sim_research_status(id:u32)->u32 {SIM.with(|s|{let s=s.borrow();s.research_status(s.game.player,id)})}
#[no_mangle] pub extern "C" fn sim_research_remaining()->u32 {SIM.with(|s|{let s=s.borrow();if s.mode!=1{return 0;}s.research.jobs[s.game.player].map_or(0,|j|j.remaining)})}
#[no_mangle] pub extern "C" fn sim_research_active()->u32 {SIM.with(|s|{let s=s.borrow();if s.mode!=1{return 0;}s.research.jobs[s.game.player].map_or(0,|j|RESEARCH[j.node].id)})}
#[no_mangle] pub extern "C" fn sim_research_owned(f:u32,id:u32)->u32 {SIM.with(|s|{let s=s.borrow();(s.mode==1&&f<2&&s.research.owns(f as usize,id)) as u32})}
/// Full read-only catalog, including durations and combat numbers. Legacy stride 8 is untouched.
#[no_mangle] pub extern "C" fn sim_kind_stat(kind:u32, field:u32)->f32 {SIM.with(|s|{
    let s=s.borrow();let Some(k)=s.effective_kind(kind) else{return -1.;};
    match field {0=>k.kind as f32,1=>k.faction as f32,2=>k.tier as f32,3=>k.klass as f32,4=>k.producer as f32,5=>k.alloy as f32,6=>k.charge as f32,7=>k.pop as f32,8=>k.ticks as f32,9=>k.hp,10=>k.speed,11=>k.range,12=>k.damage,13=>k.cadence as f32,14=>k.width,15=>k.depth,_=>-1.}
})}
