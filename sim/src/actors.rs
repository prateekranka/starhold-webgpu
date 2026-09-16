//! Match combat clock, generation-safe commands and bounded event observations.
use super::*;
pub(super) const EVENT_STRIDE:usize=9;
const EVENT_CAP:usize=256;
/// World-space Ash Jackal projectile socket: the authored bow grip (2, 0.6, 2.3)
/// after the renderer's JACKAL_SCALE of 0.6. The rig, this constant and
/// src/assets/ash-jackal.ts must agree exactly.
pub(super) const JACKAL_SOCKET:[f32;3]=[1.2,0.36,1.38];
#[derive(Clone, Copy)]
pub(super) struct BowAction {
    pub target:usize,pub generation:u32,pub elapsed:u32,pub windup:u32,
    pub cycle:u32,pub movement_unlock:u32,pub damage:f32,pub released:bool,
}
impl BowAction { pub const EMPTY:Self=Self{target:CAP,generation:0,elapsed:0,windup:24,cycle:48,movement_unlock:48,damage:0.,released:false}; }
pub(super) struct ActorState {
    pub bows:[BowAction;CAP],pub events:[f32;EVENT_STRIDE*EVENT_CAP],pub event_count:usize,pub dropped:u32,
    pub paths:Vec<Option<nav::Path>>,pub commands:Vec<Option<nav::Command>>,
}
impl ActorState {
    pub const EMPTY:Self=Self{bows:[BowAction::EMPTY;CAP],events:[0.;EVENT_STRIDE*EVENT_CAP],event_count:0,dropped:0,paths:Vec::new(),commands:Vec::new()};
    pub fn reset(&mut self){*self=Self::EMPTY;self.paths.resize_with(CAP,||None);self.commands.resize(CAP,None);}
}
impl Sim {
    pub(super) fn actor_event(&mut self,event:u32,actor:usize,target:usize,value:f32) {
        // Event recording is opt-in in the disposable lab, not a per-frame game allocation.
        if !self.lab.active{return;}
        if self.actors.event_count==EVENT_CAP{self.actors.dropped+=1;return;}
        let e=self.entities[actor];let handle=self.actor_handle(actor);
        let target_handle=if target<CAP{self.actor_handle(target)}else{0};
        let row=[self.tick as f32,event as f32,handle as f32,target_handle as f32,value,e.data[0],e.data[1],e.data[2],e.data[6]];
        let o=self.actors.event_count*EVENT_STRIDE;self.actors.events[o..o+EVENT_STRIDE].copy_from_slice(&row);self.actors.event_count+=1;
    }
    pub(super) fn actor_handle(&self,id:usize)->u32 {
        if id>=MATCH_ACTORS||!self.entities[id].active{return 0;}
        (self.game.generations[id]&0xffff)<<8 | (id as u32+1)
    }
    pub(super) fn actor_id(&self,handle:u32)->Option<usize> {
        let slot=(handle&255).wrapping_sub(1) as usize;
        (slot<MATCH_ACTORS&&self.entities[slot].active&&self.actor_handle(slot)==handle).then_some(slot)
    }
    pub(super) fn bow_locked(&self,id:usize)->bool {
        let a=self.actors.bows[id];a.target<CAP&&a.elapsed<a.movement_unlock
    }
    pub(super) fn jackal_combat(&mut self,id:usize,k:&Kind) {
        let e=self.entities[id];let mut a=self.actors.bows[id];
        self.game.cooldowns[id]=self.game.cooldowns[id].saturating_sub(1);
        if a.target<CAP {
            // Interrupted draws spend no shot, but do not erase their cooldown.
            let alive=self.entities[a.target].active&&self.game.generations[a.target]==a.generation;
            if !a.released && (!alive||self.game.orders[id]==Order::Return) {
                self.actor_event(5,id,a.target,0.);self.actors.bows[id]=BowAction::EMPTY;return;
            }
            a.elapsed+=1;
            if a.elapsed<a.movement_unlock {self.entities[id].data[5]=2.;}
            self.entities[id].data[6]=if a.elapsed<=a.windup {0.5*a.elapsed as f32/a.windup as f32}else{0.5+0.5*(a.elapsed-a.windup) as f32/(a.cycle-a.windup) as f32};
            if !a.released&&a.elapsed>=a.windup {
                if !self.in_range(id,a.target,k.range)||!self.line_of_fire(id,a.target){
                    self.actor_event(5,id,a.target,0.);self.actors.bows[id]=BowAction::EMPTY;return;
                }
                let target=self.entities[a.target];
                self.entities[id].data[3]=(target.data[1]-e.data[1]).atan2(target.data[0]-e.data[0]);
                a.released=true;self.fire_jackal(id,a.target,a.damage);
            }
            self.entities[id].data[11]=self.game.cooldowns[id] as f32/a.cycle as f32;
            if a.elapsed<a.cycle{self.actors.bows[id]=a;return;}
            self.actors.bows[id]=BowAction::EMPTY;
        }
        if self.game.cooldowns[id]>0||e.data[5]==6.||self.game.orders[id]==Order::Return{return;}
        if self.actors.commands.get(id).and_then(|c|*c).is_some_and(|c|matches!(c,nav::Command::Move(_))){return;}
        let explicit=self.actors.commands.get(id).and_then(|c|*c).and_then(|c|if let nav::Command::Attack(h)=c{self.actor_id(h)}else{None});
        let target=explicit.filter(|&j|self.in_range(id,j,k.range)&&self.line_of_fire(id,j)).or_else(||if explicit.is_none(){self.visible_enemy(id,k.range)}else{None});
        let Some(target)=target else{return;};
        let anchored=self.research.owns(k.faction,204);let running=self.research.owns(k.faction,203);
        let windup=if anchored{36}else{24};let cycle=if anchored{60}else{48};
        self.actors.bows[id]=BowAction{target,generation:self.game.generations[target],elapsed:0,windup,cycle,movement_unlock:if running{36}else{cycle},damage:k.damage*if anchored{1.5}else{1.},released:false};
        self.game.cooldowns[id]=cycle;self.entities[id].data[5]=2.;self.entities[id].data[6]=0.;
        self.entities[id].data[3]=(self.entities[target].data[1]-e.data[1]).atan2(self.entities[target].data[0]-e.data[0]);
        self.actor_event(1,id,target,0.);
    }
    pub(super) fn in_range(&self,id:usize,target:usize,range:f32)->bool {
        let a=self.entities[id];let b=self.entities[target];
        (a.data[0]-b.data[0]).powi(2)+(a.data[1]-b.data[1]).powi(2)<=range*range
    }
    /// Bounded line-of-fire probe for new archer/explicit-order combat. The
    /// frozen showcase and legacy automatic combat do not call this helper.
    pub(super) fn line_of_fire(&self,id:usize,target:usize)->bool {
        let a=self.entities[id];let b=self.entities[target];
        let distance=((b.data[0]-a.data[0]).powi(2)+(b.data[1]-a.data[1]).powi(2)).sqrt();
        let samples=(distance*4.).ceil().clamp(1.,128.) as usize;
        for i in 1..samples {
            let t=i as f32/samples as f32;
            let x=a.data[0]+(b.data[0]-a.data[0])*t;let y=a.data[1]+(b.data[1]-a.data[1])*t;
            let z=a.data[2]+JACKAL_SOCKET[2]+(b.data[2]+0.5-a.data[2]-JACKAL_SOCKET[2])*t;
            if self.ground(x,y)>z{return false;}
            for (j,e) in self.entities[..MATCH_ACTORS].iter().enumerate(){
                if j==id||j==target||!e.active{continue;}
                if let Some(k)=roster(e.data[4] as u32){if k.klass==0&&(x-e.data[0]).abs()<k.width/2.&&(y-e.data[1]).abs()<k.depth/2.{return false;}}
            }
        }
        true
    }
    pub(super) fn visible_enemy(&self,id:usize,range:f32)->Option<usize>{
        let mut best=range*range;let mut result=None;let a=self.entities[id];
        for j in 0..MATCH_ACTORS{let b=self.entities[j];if !b.active||b.data[9]==a.data[9]||roster(b.data[4] as u32).is_none(){continue;}
            let d=(b.data[0]-a.data[0]).powi(2)+(b.data[1]-a.data[1]).powi(2);
            if d<=best&&(d<best||result.is_none())&&self.line_of_fire(id,j){best=d;result=Some(j);}
        }result
    }
    fn fire_jackal(&mut self,id:usize,target:usize,damage:f32) {
        let e=self.entities[id];let victim=self.entities[target];let yaw=e.data[3];
        let (c,s)=(yaw.cos(),yaw.sin());
        let socket=[e.data[0]+JACKAL_SOCKET[0]*c-JACKAL_SOCKET[1]*s,e.data[1]+JACKAL_SOCKET[0]*s+JACKAL_SOCKET[1]*c,e.data[2]+JACKAL_SOCKET[2]];
        let previous_count=self.actors.event_count;
        self.actor_event(2,id,target,damage);
        if self.actors.event_count>previous_count {
            let offset=previous_count*EVENT_STRIDE+5;
            self.actors.events[offset..offset+3].copy_from_slice(&socket);
        }
        if let Some(shot)=(MATCH_ACTORS..148).find(|&j|!self.entities[j].active){
            self.match_add(shot,50,socket[0],socket[1],e.data[9] as usize);
            let p=&mut self.entities[shot];p.target=target;p.route=self.game.generations[target] as usize;
            p.data[2]=socket[2];p.data[3]=yaw;p.data[10]=30.;p.origin=socket;p.damage=damage;
            p.destination=[victim.data[0],victim.data[1],victim.data[2]+0.5];
        }else{self.match_damage(target,damage);}
    }
}
#[no_mangle]pub extern "C" fn sim_actor_handle(index:u32)->u32{SIM.with(|s|{let s=s.borrow();if s.mode!=1||index as usize>=s.count{0}else{s.actor_handle(s.ids[index as usize])}})}
#[no_mangle]pub extern "C" fn sim_jackal_socket(axis:u32)->f32{JACKAL_SOCKET.get(axis as usize).copied().unwrap_or(0.)}
#[no_mangle]pub extern "C" fn sim_actor_order(handle:u32,op:u32,arg:u32)->u32{SIM.with(|s|s.borrow_mut().actor_order(handle,op,arg) as u32)}
