use super::*;
use research::RESEARCH;
#[test]
fn research_catalog_has_unique_ids_and_acyclic_same_faction_prerequisites(){
    for (i,n) in RESEARCH.iter().enumerate(){
        assert_eq!(RESEARCH.iter().filter(|m|m.id==n.id).count(),1);
        assert_eq!(roster(n.producer).unwrap().faction,n.faction);
        assert_eq!(roster(n.target).unwrap().faction,n.faction);
        assert!(n.ticks>0&&n.value.is_finite());
        assert_eq!(n.requires&!((1<<i)-1),0,"prerequisites must precede their node");
        for (j,m) in RESEARCH.iter().enumerate(){if n.requires&(1<<j)!=0{assert_eq!(n.faction,m.faction);}}
    }
}
#[test]
fn catalog_probes_reject_unknown_fields_and_do_not_mutate_showcase(){
    sim_init(73129);let before=SIM.with(|s|s.borrow().snapshot);
    assert_eq!(research::sim_kind_stat(30,9),80.);
    assert_eq!(research::sim_kind_stat(999,9),-1.);
    assert_eq!(research::sim_kind_stat(30,900),-1.);
    assert_eq!(sim_command(10,202,0),0);
    assert_eq!(SIM.with(|s|s.borrow().snapshot),before);
}
#[cfg(feature="workshop")]
fn fixture(s:&mut Sim){assert!(s.lab_init(7319,0,1,30,22,1));}
#[cfg(feature="workshop")]
fn advance(s:&mut Sim,ticks:u32){for _ in 0..ticks{s.match_tick();}}
#[cfg(feature="workshop")]
#[test]
fn research_spends_once_completes_on_exact_tick_and_resets(){SIM.with(|cell|{
    let mut s=cell.borrow_mut();fixture(&mut s);
    assert_eq!(s.research_status(1,202),9);let before=s.game.sides[1];
    assert!(s.research_start(1,202));assert!(!s.research_start(1,202));
    assert_eq!(s.game.sides[1].alloy,before.alloy-24);assert_eq!(s.game.sides[1].charge,before.charge-12);
    for _ in 0..1199{s.research_tick();}
    assert!(!s.research.owns(1,202));assert_eq!(s.effective_kind(30).unwrap().damage,4.);
    s.research_tick();assert!(s.research.owns(1,202));assert_eq!(s.effective_kind(30).unwrap().damage,5.);
    assert_eq!(s.effective_kind(22).unwrap().damage,12.);fixture(&mut s);assert!(!s.research.owns(1,202));
});}
#[cfg(feature="workshop")]
#[test]
fn all_available_research_resolves_its_own_target_effect(){SIM.with(|cell|{
    let mut s=cell.borrow_mut();
    for (i,n) in RESEARCH.iter().enumerate(){
        assert!(s.lab_init(7319,0,n.faction as u32,if n.faction==0{22}else{30},if n.faction==0{30}else{22},1));
        s.research.unlocked[n.faction]=n.requires;
        let before=s.effective_kind(n.target).unwrap();assert!(s.research_start(n.faction,n.id),"node {}",n.id);
        for _ in 0..n.ticks{s.research_tick();}
        let after=s.effective_kind(n.target).unwrap();assert_ne!(s.research.unlocked[n.faction]&(1<<i),0);
        match n.effect{0=>assert!(after.speed>before.speed),1=>assert!(after.damage>before.damage),2=>assert!(after.hp>before.hp),3=>assert!(after.range>before.range),4|5=>assert!(s.research.owns(n.faction,n.id)),_=>panic!("unknown effect")}
    }
});}
#[cfg(feature="workshop")]
#[test]
fn research_rejects_wrong_civ_missing_all_prerequisites_age_funds_and_busy_producer(){SIM.with(|cell|{
    let mut s=cell.borrow_mut();fixture(&mut s);assert_eq!(s.research_status(0,202),0);assert_eq!(s.research_status(1,203),2);
    s.game.sides[1].age=0;assert_eq!(s.research_status(1,202),1);s.game.sides[1].age=2;
    s.game.sides[1].alloy=0;assert_eq!(s.research_status(1,202),4);s.game.sides[1].alloy=500;
    s.entities[3].active=false;assert_eq!(s.research_status(1,202),3);s.entities[3].active=true;
    s.game.jobs[3]=Production{kind:30,slot:80,remaining:20};assert_eq!(s.research_status(1,202),5);s.game.jobs[3]=Production::EMPTY;
    assert!(s.research_start(1,202));assert!(!s.can_train(1,30,3));
});}
#[cfg(feature="workshop")]
#[test]
fn doctrine_choices_are_exclusive_and_cancel_refunds_exactly(){SIM.with(|cell|{
    let mut s=cell.borrow_mut();fixture(&mut s);s.research.unlocked[1]=1<<8;
    let before=s.game.sides[1];assert!(s.research_start(1,203));s.research_tick();assert!(s.research_cancel(1));assert!(!s.research_cancel(1));
    assert_eq!(s.game.sides[1].alloy,before.alloy);assert_eq!(s.game.sides[1].charge,before.charge);
    assert!(s.research_start(1,203));for _ in 0..1440{s.research_tick();}assert_eq!(s.research_status(1,204),6);assert!(!s.research_start(1,204));
});}
#[cfg(feature="workshop")]
#[test]
fn producer_loss_cancels_without_refund_and_hp_research_does_not_heal(){SIM.with(|cell|{
    let mut s=cell.borrow_mut();fixture(&mut s);assert!(s.research_start(1,202));let a=s.game.sides[1].alloy;s.remove_actor(3);s.research_tick();assert!(s.research.jobs[1].is_none());assert_eq!(s.game.sides[1].alloy,a);
    fixture(&mut s);s.research.unlocked[1]=(1<<6)|(1<<7);s.entities[3].data[7]=0.5;let before=s.entities[3].data[7]*s.effective_kind(63).unwrap().hp;
    assert!(s.research_start(1,205));for _ in 0..1200{s.research_tick();}let after=s.entities[3].data[7]*s.effective_kind(63).unwrap().hp;assert!((before-after).abs()<0.001);
});}
#[cfg(feature="workshop")]
#[test]
fn jackal_release_matches_phase_socket_and_48_tick_cadence(){SIM.with(|cell|{
    let mut s=cell.borrow_mut();fixture(&mut s);advance(&mut s,24);assert!(!s.entities[120..148].iter().any(|e|e.active&&e.data[4]==50.));s.match_tick();
    let shot=*s.entities[120..148].iter().find(|e|e.active&&e.data[4]==50.).unwrap();let actor=s.entities[10];
    assert_eq!(actor.data[6],0.5);assert_eq!(shot.origin,[actor.data[0]+0.6,actor.data[1]+0.18,actor.data[2]+0.72]);
    advance(&mut s,60);let releases:Vec<_>=s.actors.events[..s.actors.event_count*actors::EVENT_STRIDE].chunks(actors::EVENT_STRIDE).filter(|r|r[1]==2.).map(|r|r[0] as u32).collect();
    assert!(releases.len()>=2);assert_eq!(releases[1]-releases[0],48);
});}
#[cfg(feature="workshop")]
#[test]
fn anchored_draw_is_slower_stronger_and_research_cannot_change_inflight_damage(){SIM.with(|cell|{
    let mut s=cell.borrow_mut();fixture(&mut s);s.research.unlocked[1]=(1<<8)|(1<<10);advance(&mut s,36);assert!(!s.entities[120..148].iter().any(|e|e.active));s.match_tick();
    let shot=s.entities[120..148].iter().find(|e|e.active&&e.data[4]==50.).unwrap();assert_eq!(shot.damage,7.5);assert_eq!(s.entities[10].data[6],0.5);
    fixture(&mut s);advance(&mut s,25);let shot=s.entities[120..148].iter().find(|e|e.active&&e.data[4]==50.).unwrap();assert_eq!(shot.damage,4.);s.research.unlocked[1]=1<<8;advance(&mut s,12);assert!((s.entities[30].data[7]*180.-176.).abs()<0.001);
});}
#[cfg(feature="workshop")]
#[test]
fn running_draw_releases_movement_without_extra_shots_and_stop_does_not_reset_cooldown(){SIM.with(|cell|{
    let mut s=cell.borrow_mut();fixture(&mut s);s.research.unlocked[1]=(1<<8)|(1<<9);advance(&mut s,25);let h=s.actor_handle(10);assert!(s.actor_order(h,0,24+28*64));advance(&mut s,10);assert_eq!(s.entities[10].data[0],29.5);advance(&mut s,4);assert!(s.entities[10].data[0]<29.5);assert!(s.game.cooldowns[10]>0);
    fixture(&mut s);advance(&mut s,4);let before=s.game.cooldowns[10];let h=s.actor_handle(10);assert!(s.actor_order(h,2,0));assert_eq!(s.game.cooldowns[10],before);assert_eq!(s.actors.bows[10].target,CAP);
});}
#[cfg(feature="workshop")]
#[test]
fn handles_reject_enemy_orders_and_slot_reuse(){SIM.with(|cell|{
    let mut s=cell.borrow_mut();fixture(&mut s);let h=s.actor_handle(10);let enemy=s.actor_handle(30);assert!(!s.actor_order(enemy,2,0));s.remove_actor(10);s.match_add(10,30,20.,20.,1);assert_ne!(s.actor_handle(10),h);assert!(!s.actor_order(h,2,0));let current=s.actor_handle(10);assert!(!s.actor_order(current,0,u32::MAX));
});}
#[cfg(feature="workshop")]
#[test]
fn obstacle_navigation_is_repeatable_and_never_crosses_the_wall(){SIM.with(|cell|{
    let mut s=cell.borrow_mut();assert!(s.lab_init(7319,2,1,30,22,1));let goal=38+26*64;
    let a=s.plan_path(10,goal).unwrap();let b=s.plan_path(10,goal).unwrap();assert_eq!(a,b);assert!(a.iter().any(|p|p%64==32&&(30..34).contains(&(p/64))));
    assert!(a.iter().all(|p|s.world[*p as usize]==0.5));let h=s.actor_handle(10);assert!(s.actor_order(h,0,goal));advance(&mut s,600);
    assert!(s.entities[10].data[2]>=0.5);assert_ne!(s.entities[10].data[2],3.);
});}
#[cfg(feature="workshop")]
#[test]
fn invalid_fixture_is_atomic_and_events_are_bounded(){SIM.with(|cell|{
    let mut s=cell.borrow_mut();fixture(&mut s);let before=s.snapshot;assert!(!s.lab_init(1,99,1,30,22,1));assert_eq!(s.snapshot,before);
    for _ in 0..300{s.actor_event(7,10,CAP,0.);}assert_eq!(s.actors.event_count,256);assert_eq!(s.actors.dropped,44);
});}

#[cfg(feature="workshop")]
#[test]
fn preparation_pays_real_cost_without_advancing_battle(){
    assert_eq!(lab::sim_lab_init(1,0,1,30,22,1),1);
    assert_eq!(lab::sim_lab_prepare(202),1);assert_eq!(lab::sim_lab_prepare(203),1);
    assert_eq!(lab::sim_lab_prepare(204),0);assert_eq!(lab::sim_lab_preparation_ticks(),2640);
    assert_eq!(sim_alloy(),448);assert_eq!(sim_charge(),270);assert_eq!(lab::sim_lab_tick(),0);
    sim_step(1000./60.);assert_eq!(lab::sim_lab_prepare(200),0);
}
#[cfg(feature="workshop")]
#[test]
fn jackal_cannot_fire_through_a_wall(){SIM.with(|cell|{
    let mut s=cell.borrow_mut();fixture(&mut s);s.world[29*64+31]=3.;
    assert!(!s.line_of_fire(10,30));advance(&mut s,120);
    assert!(!s.actors.events[..s.actors.event_count*actors::EVENT_STRIDE].chunks(actors::EVENT_STRIDE).any(|r|r[1]==2.));
});}
