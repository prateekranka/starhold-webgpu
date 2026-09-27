//! Deterministic, bounded navigation for explicit player/encounter orders.
//! Legacy scripted world raids retain their existing orders in this vertical slice.
use super::*;
use std::cmp::Reverse;
use std::collections::BinaryHeap;
#[derive(Clone,Copy,Debug)]
pub(super) enum Command {Move(u32),Attack(u32),Hold,AttackMove(u32)}
pub(super) struct Path {pub goal:u32,pub points:Vec<u32>,pub cursor:usize,pub retry:u32}
impl Sim {
    fn blocked_cell(&self,x:i32,y:i32,ignore:usize)->bool {
        let n=self.side() as i32;
        if x<1||y<1||x>=n-1||y>=n-1||self.ground(x as f32+0.5,y as f32+0.5)<0. {return true;}
        for (id,e) in self.entities[..MATCH_ACTORS].iter().enumerate() {
            if id==ignore||!e.active{continue;}
            let Some(k)=roster(e.data[4] as u32) else{continue;};
            if k.klass==0&&(x as f32+0.5-e.data[0]).abs()<k.width/2.+0.25&&(y as f32+0.5-e.data[1]).abs()<k.depth/2.+0.25{return true;}
        }
        false
    }
    fn nav_edge(&self,from:u32,to:u32,id:usize)->bool {
        let n=self.side();let (x,y)=((to%n) as i32,(to/n) as i32);let (a,b)=((from%n) as i32,(from/n) as i32);
        if self.blocked_cell(x,y,id)||(self.ground(x as f32+0.5,y as f32+0.5)-self.ground(a as f32+0.5,b as f32+0.5)).abs()>0.51{return false;}
        if x!=a&&y!=b&&(self.blocked_cell(a,y,id)||self.blocked_cell(x,b,id)
            ||(self.ground(a as f32+0.5,y as f32+0.5)-self.ground(a as f32+0.5,b as f32+0.5)).abs()>0.51
            ||(self.ground(x as f32+0.5,b as f32+0.5)-self.ground(a as f32+0.5,b as f32+0.5)).abs()>0.51){return false;}
        true
    }
    pub(super) fn plan_path(&self,id:usize,goal:u32)->Option<Vec<u32>> {
        let n=self.side();if goal>=n*n||self.blocked_cell((goal%n) as i32,(goal/n) as i32,id){return None;}
        let e=self.entities[id];let start=e.data[0].floor() as u32+e.data[1].floor() as u32*n;
        if start==goal{return Some(vec![goal]);}
        let mut cost=vec![u32::MAX;(n*n) as usize];let mut prev=vec![u32::MAX;(n*n) as usize];let mut queue=BinaryHeap::new();
        let heuristic=|p:u32|{let dx=(p%n).abs_diff(goal%n);let dy=(p/n).abs_diff(goal/n);14*dx.min(dy)+10*dx.abs_diff(dy)};
        cost[start as usize]=0;queue.push(Reverse((heuristic(start),0u32,start)));
        let mut visits=0;
        while let Some(Reverse((_,g,p)))=queue.pop(){
            if g!=cost[p as usize]{continue;}
            if p==goal{let mut path=Vec::new();let mut q=p;while q!=start{path.push(q);q=prev[q as usize];}path.reverse();return Some(path);}
            visits+=1;if visits>12_000{return None;}
            let (x,y)=((p%n) as i32,(p/n) as i32);
            for (dx,dy) in [(0,-1),(-1,0),(1,0),(0,1),(-1,-1),(1,-1),(-1,1),(1,1)]{
                let (tx,ty)=(x+dx,y+dy);if tx<0||ty<0||tx>=n as i32||ty>=n as i32{continue;}
                let q=tx as u32+ty as u32*n;if !self.nav_edge(p,q,id){continue;}
                let next=g+if dx!=0&&dy!=0{14}else{10};
                if next<cost[q as usize]{cost[q as usize]=next;prev[q as usize]=p;queue.push(Reverse((next+heuristic(q),next,q)));}
            }
        }
        None
    }
    pub(super) fn navigate(&mut self,id:usize,goal:u32,speed:f32)->bool {
        if self.actors.paths.len()!=CAP{self.actors.reset();}
        let rebuild=self.actors.paths[id].as_ref().is_none_or(|p|p.goal!=goal||(p.points.is_empty()&&self.tick>=p.retry));
        if rebuild{
            let points=self.plan_path(id,goal).unwrap_or_default();
            if points.is_empty(){self.actor_event(6,id,CAP,goal as f32);}
            self.actors.paths[id]=Some(Path{goal,points,cursor:0,retry:self.tick+60});
        }
        let Some(path)=self.actors.paths[id].as_ref() else{return false;};
        if path.points.is_empty(){self.entities[id].data[5]=0.;return false;}
        let waypoint=path.points[path.cursor.min(path.points.len()-1)];let n=self.side();
        let e=self.entities[id];let current=e.data[0].floor() as u32+e.data[1].floor() as u32*n;
        if current!=waypoint&&!self.nav_edge(current,waypoint,id){self.actors.paths[id]=None;self.entities[id].data[5]=0.;return false;}
        let arrived=self.walk(id,(waypoint%n) as f32+0.5,(waypoint/n) as f32+0.5,speed);
        if arrived{let p=self.actors.paths[id].as_mut().unwrap();p.cursor+=1;return p.cursor>=p.points.len();}false
    }
    pub(super) fn actor_order(&mut self,handle:u32,op:u32,arg:u32)->bool {
        if self.mode!=1||self.game.outcome!=0{return false;}
        let Some(id)=self.actor_id(handle) else{return false;};let e=self.entities[id];
        let Some(k)=roster(e.data[4] as u32) else{return false;};
        if k.klass!=1||e.data[9]!=self.game.player as f32||e.data[5]==5.{return false;}
        let command=match op{
            0|3=>{let n=self.side();if arg>=n*n||self.blocked_cell((arg%n) as i32,(arg/n) as i32,id){return false;}if op==0{Command::Move(arg)}else{Command::AttackMove(arg)}},
            1=>{let Some(target)=self.actor_id(arg) else{return false;};if self.entities[target].data[9]==e.data[9]||k.damage<=0.{return false;}Command::Attack(arg)},
            2 if arg==0=>Command::Hold,
            _=>return false,
        };
        if self.actors.commands.len()!=CAP{self.actors.reset();}
        if op==2&&self.actors.bows[id].target<CAP&&!self.actors.bows[id].released{
            let target=self.actors.bows[id].target;self.actor_event(5,id,target,0.);self.actors.bows[id]=actors::BowAction::EMPTY;
        }
        self.actors.commands[id]=Some(command);self.actors.paths[id]=None;self.game.orders[id]=Order::Idle;
        self.actor_event(7,id,CAP,op as f32);true
    }
    pub(super) fn actor_order_tick(&mut self,id:usize,k:&Kind)->bool {
        let Some(command)=self.actors.commands.get(id).and_then(|c|*c) else{return false;};
        let goal=match command{
            Command::Hold=>return true,
            Command::Move(tile)=>tile,
            Command::AttackMove(tile)=>{
                if self.visible_enemy(id,k.range).is_some(){return true;}tile
            },
            Command::Attack(handle)=>{
                let Some(target)=self.actor_id(handle) else{self.actors.commands[id]=Some(Command::Hold);return true;};
                if self.in_range(id,target,k.range)&&self.line_of_fire(id,target){return true;}
                let (x,y)=if roster(self.entities[target].data[4] as u32).is_some_and(|k|k.klass==0){self.edge(target,id)}else{(self.entities[target].data[0],self.entities[target].data[1])};
                x.floor() as u32+y.floor() as u32*self.side()
            },
        };
        if self.navigate(id,goal,k.speed)&&!matches!(command,Command::Attack(_)){self.actors.commands[id]=Some(Command::Hold);self.entities[id].data[5]=0.;}
        true
    }
}
