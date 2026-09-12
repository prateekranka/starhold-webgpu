// Mirrored from sim/src/lib.rs: stable ABI values, not render instance indices.
export const Kind = {Keep:10,Court:11,Well:12,Hall:13,Forge:14,Hearth:15,Bastion:16,Wharf:17,Riveter:20,Beetle:21,Sentinel:22,Sunlance:23,Skiff:24,Jackal:30,Strider:31,Ore:40,Drone:41,Freighter:42,Relief:43,Projectile:50,Impact:51,Wreck:52} as const;
export const State = {Idle:0,Move:1,Attack:2,Work:3,Death:4,Construct:5,Retreat:6,Dock:7,Repair:8,Inactive:9} as const;
export const names: Record<number,string> = {10:'CHARTER KEEP',11:'FREIGHT COURT',12:'HELIOWELL',13:'MUSTER HALL',14:'STARFORGE',15:'HEARTH PODS',16:'PRISM BASTION',17:'SKY WHARF',20:'RIVETER',21:'PACK BEETLE',22:'WARD SENTINEL',23:'SUNLANCE',24:'HARBOR SKIFF',30:'ASH JACKAL',31:'CINDER STRIDER'};
export const jobs = ['IDLE','MOVING','ATTACKING','WORKING','SALVAGE','BUILDING','RETREAT','DOCKING','REPAIR','WAITING'];
export const palette = ['10121C','1B1E30','2B2D46','41435E','565B73','747C91','98A4AE','B7C8C6','D8E3D5','F3F0D7','163D48','1D6068','298B8B','4FB7AA','8BD7BE','214B78','347DA0','58BED4','A4E8E0','6C492C','AA7135','D5A64B','F1CE72','4E2439','813447','BC4A45','E77945','F5B66B','3C3057','624779','8C69A0','BD96C1'];
