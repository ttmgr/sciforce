# sciforce

## Science Bros

Broforce-style run-and-gun platformer: an 11-mission campaign against the Anti-Science League, three bonus modes (Lab Siege, Boss Rush, Moon Base), 19 trophies, 22 scientist bros, 4 pickup guns, 17 quack types, 13 bosses, a drivable mech, objectives, intel, a world map and in-level maps. Single self-contained HTML file, no build step.

- Game: `science-bros/index.html`. Open it in a browser.
- Controls: arrows or A/D move; Up, W or Space jump (hold against a wall to climb, jump off it to wall-jump); Z or J fire; X or K special (3 per bro); C or L punch; Down + punch in the air for a ground pound; tap left or right twice quickly to run (or push a gamepad stick all the way); Shift or V dodge-roll (also jumps out of the mech); Up/Down on a ladder climbs; hold Tab for the map; P pause menu; M mute.
- Gamepad (standard mapping; a PS5 DualSense works over USB-C or Bluetooth): stick or d-pad move (stick all the way runs), Cross/A jump, Square/X or R2 fire, Circle/B punch, Triangle/Y special, L1/R1/L2 roll, Options/Start pause, hold the touchpad or Create/Select for the map. Press a button once after the page loads so the browser sees the pad. Explosions rumble pads that support it (Chrome; Firefox has no rumble).

### Safe start and choices

- **Safe start:** every mission begins with 10 quiet seconds (a countdown shows). Quacks do not notice you or shoot; if you shoot one first, that one fights back. No enemy spawns in the first 20 tiles of any map, so the start area stays clear after the 10 seconds too.
- **Briefing choices:** pick which freed bro to deploy (left/right) and one piece of starting gear (down, then left/right): shield, jetpack, overclock, or a shotgun, minigun, rocket launcher or railgun.
- **Mission select:** on the world map, left/right picks any mission you have reached before in this browser.

### Campaign

Title menu (Campaign, Lab Siege, Boss Rush, Moon Base, Trophies), then a world map of the 11 stops, then a briefing from HQ (Prof. Peer Review) with the mission's objectives. Each level has required objectives (they must be done before the extraction chopper comes) and bonus ones (free every scientist, find the three intel files; each bonus is worth 2000 points). Intel files tell the story; the debrief after each level moves it on and the ending wraps it up. Lives and freed bros carry over between missions. Checkpoint flags refill your specials, and the next bro parachutes in over the last flag you raised.

- **Mission 1, Placebo Island:** smash 3 placebo vats, destroy the Homeopathitron.
- **Mission 2, Detox Desert:** topple the radio mast, shoot down the Detoxkopter, kill the Crystal Crawler.
- **Mission 3, Cryo Summit:** wipe 2 server racks, stop the Snake Oil Tank (Dr. Placebo escapes in a pod).
- **Story:** the Anti-Science League wants to take over the world. Dr. Placebo is its general for the first four missions; its leader is King Citrus, the Big Bad Orange, a fictional giant angry orange who preaches vitamin C megadoses.
- **Mission 4, Dilution Plant:** smash 2 dilution vats, shut down the **Succussion Engine**: two hammers drop where you stand (a red column warns you), it sprays diluted solution and spits out quacks; its core is shielded until you break its three stabiliser vats, then it shakes rubble down from the roof.

- **Mission 5, Flat Earth Station:** jam 3 propaganda antennas, climb (or blast through) the ice wall they call the edge of the world, and bring down the **Flat Earth Zeppelin**: shoot its four gondolas off from the tower tops, then the gas bag. It bombs you and drops paratroopers.
- **Mission 6, Chemtrail Airfield:** topple 3 spray towers and shoot down the **Chemtrail Copter** (a tougher Detoxkopter) over the tower arena.
- **Mission 7, Quartz Caverns:** a dark cave lit by glowing crystals. Smash 3 crystal-charging vats and kill the **Quartz Queen** (a tougher Crystal Crawler) in the sand pit.
- **Mission 8, Miasma Marsh:** rain, bog pits and bridges. Wipe 2 research servers and stop the **Miasma Machine** (a tougher Snake Oil Tank).
- **Mission 9, Zodiac Observatory:** snow on a night summit. Knock down 3 horoscope dishes and scrap the **Zodiac Mech** (a tougher Homeopathitron).
- **Mission 10, Perpetual Motion Works:** a rusty factory with chimneys (climb them, or shoot out their crate base and drop them). Smash 3 demo engines and stop **the Pitchman**, a crane camera whose stage lights shield it.
- Missions 6 to 10 are built from a set of level pieces (camp, yard, hall, bridge over a pit, cliff with a tunnel, fort, chimneys) and four boss arenas.
- **Mission 11, Citrus Citadel:** pour out 3 megadose vats in the juice works, fight through the rally and the citadel walls, then juice **King Citrus**. He hops with shockwaves, rolls across the throne room (and is dizzy, taking double damage, after hitting a wall), spits seeds, squirts juice puddles, calls in quacks, and when furious rains vitamin pills.

### Modes and trophies

- **Lab Siege:** hold a walled yard against endless waves. A boss every fifth wave, supplies between waves, an extra bro every third wave. Every bro is unlocked. Your best wave is saved.
- **Boss Rush:** all 12 campaign bosses back to back on 5 lives, against the clock. Your best time is saved.
- **Moon Base:** a bonus mission in low gravity (jumps go much higher). Jam 3 radio masts on a fake film set, cross the crater field and take down **the Director**, a crane camera with a spotlight that locks on and fires, sandbag drops and paratrooper extras.
- **Trophies:** 19 of them, for things like a x10 combo, 500 blocks broken, a flawless mission, a mission under 3 minutes, Lab Siege waves 5 and 15, the Boss Rush, the Moon, and 10 camera drones downed. Career counters and trophies are saved in this browser. A toast pops up when you earn one.

### Maps

A minimap in the bottom-right corner shows the level around you. Hold Tab for the whole level with markers for you, quacks, cages, targets, intel and the boss, plus the objective list.

### Levels, enemies and bosses

- **Level 1, Placebo Island:** beach, bunker, acid bridge, cliff with a watchtower, cliff fort. Boss: the **Homeopathitron**, a walking pill mech. It fires spreads, jumps for shockwaves and summons quacks. Below 40% health it enters overdose mode: faster, with homing missiles.
- **Level 2, Detox Desert:** dunes, a two-floor Wellness Spa, an oil field and an acid canyon. Mid-boss: the **Detoxkopter**, which strafes, drops bombs and hovers low to fire missiles; climb the brick towers to hit it. Final boss: the **Crystal Crawler**, a worm that tunnels through the sand, bursts out in arcs or rears up spitting acid. Only its head takes bullets.
- **Level 3, Cryo Summit:** snowy slopes with a frozen pond, the Cryo Spa (a mech is parked outside), a chasm of freezing water under a brittle ice bridge, a tunnel with icicles that drop on whatever walks beneath them, a snow fort. Final boss: the **Snake Oil Tank**, driven by Dr. Placebo. It keeps its distance lobbing shells from a turret that tracks you, rolls in with a flamethrower of burning snake oil, and below half health it mortars and rams.
- Ice blocks are slippery and shatter easily.
- Lives and freed bros carry over between levels. Game over restarts the current level.
- **Quacks:** grunt, riot shield (blocks shots from the front; punch the shield away), heavy (20 hp, spins up a minigun), scout (runs off whistling and wakes every quack nearby), grenadier (punch grenades back), rocketeer (kneels and aims; shoot the rocket down), guru (calls in paratroopers), paratrooper, suicide bomber, attack dog (leaps at you), plus turrets.
- **Bros (12):** Einstein, Curie, Tesla, Newton and Franklin on mission 1. Mission 2 adds Ada Lovebro (three-card spread; drone) and Charles Darbro (homing finches; natural selection). Mission 3 adds Galileo Galilbro (a sun lens that sets things alight; a sun that orbits you) and Alan Turbro (ricochet rounds; hacks the quacks on screen into fighting each other). Mission 4 adds Katherine Johnbro (shells that land on the nearest quack; orbital strikes), Lise Meitbro (fission shots that split twice; a chain reaction that marches ahead) and Archimedes Bro (a screw drill that bores through rock; a lever that throws everything on screen into the air).
- **Newest quacks:** the **preacher** holds up a book and preaches; every quack near him reloads faster and takes 40% less damage for 6 s (they get a halo), so shoot him first. The **mortar crew** marks the ground where you stand with a blinking red cross, then lobs a shell onto it; keep moving, or get close and he backs off. The **camera drone** patrols in the air; when it has you in frame it shows REC, then dives at you and blows up. Shoot it down over quacks to hit them with its blast.
- **More quacks:** jetpack troopers hover and shoot down; snipers track you with a laser sight that locks before one fast shot; flamethrower troopers burn what is in front of them and their tanks blow when they die; brutes charge through walls and other quacks and are dazed when they hit one; medics revive fresh quack corpses (three times at most), so shoot them first.
- **Objects and items:** ladders, bounce pads, proximity mines, alarm boxes (once a quack nearby spots you, it calls paratroopers; shoot it first), fuel tanks (huge blasts), blue item crates (shield that stops one killing blow, overclock for double fire rate, jetpack, extra bro), intel files, and objective targets.
- Supply crates refill one special. Animations: running leans forward and kicks up dust, turning at speed skids, the gun swings with the stride when you're not shooting, hit quacks flinch, freed bros flip out of the cage. Steel piles under the acid bridges stay up even if the crates burn away.

### Weapons

- **Pickup guns** come from orange crates (and sometimes from blue item crates). Each replaces your bro's weapon until its ammo runs out: shotgun (7 pellets, big kick), rocket launcher, minigun, and railgun (one line through every quack and every block that is not steel). Ammo shows on the HUD.
- **Upgrades:** Einstein's photons pass through the first quack, and he fires faster during time dilation; Curie's vials leave a radiation puddle; Tesla's arc chains to four quacks and stuns them; Newton's apples bounce once before going off; Franklin's X-ray cuts through one block; Ada fires five cards and her drone lasts 12 s; Darwin sends three finches.
- **Bros 19 to 22:** Carl Sagbro (slow glowing orbs that pass through everything; star rain), Alfred Wegbro (a ripple along the ground that throws quacks up; the ground splits under every quack on screen), Edwin Hubbro (shots that hit harder the further they fly; everything on screen flung away), Dmitri Mendelbro (each shot a random element: sodium blast, floating helium, piercing iron, fast neon, uranium puddle; eight element blasts).
- **New bros (18 in all):** Gregor Mendbro (pea shooter; three pea turrets), Louis Pastbro (darts that poison; a heat wave that cooks nearby quacks), Michael Farabro (an arc welder that cuts quacks and stone; a cage that bounces every shot back for 6 s), Hypatia Bro (a disc that flies out and comes back through quacks; six discs that spiral out), Richard Feynbro (wavy shots that pass through two quacks; shots in every direction), Alexander Flembro (spores that make quacks sick, and sickness spreads; every quack on screen falls sick).
- Each cage holds a random bro you have not freed yet. There are 21 cages across the six missions, one for each bro you can free.
- **Hit boxes:** bullets are tested along the path they travelled each frame, so fast shots cannot skip through anything; enemy shots must touch a box a pixel inside your sprite. The pause menu can show all hitboxes.

### Moves

- **Dash-roll:** a quick burst along the ground (a roll) or through the air; bullets and dog bites pass through you. 0.6 s cooldown, shown under your portrait.
- **Wall jump:** jump while touching a wall without holding into it and you kick off the other way. Holding into the wall still climbs.
- **Ground pound:** Down + punch in mid-air slams straight down. It breaks the floor, keeps drilling through up to 4 layers of earth, crates or bricks, and throws nearby quacks.

### Bro-Mech

Walk into a parked mech (Level 1 cliff fort, Level 2 canyon, Level 3 outside the spa) to climb in. It bulldozes soft walls just by walking into them, fires a heavy gun (fire) and rockets (special), smashes through blocks with its fist (punch), shakes the ground when it lands, and takes 24 hits for you. Dash jumps out backwards; if it is destroyed it blows up and throws you clear.

### Destruction

- Blasts throw big lumps of the blocks they break; a fast lump knocks out the quack it hits.
- Blasts punch holes in back walls, so the sky shows through the bunker and the spa.
- Fire on a crate burns it until it gives and creeps along neighbouring crates, so bridges burn down piece by piece.
- Red airstrike crates drop a pickup that calls in a jet. It carpet-bombs the ground ahead of you.

### Graphics

- Dynamic lighting: the night is dark, and lamps, muzzle flashes, explosions, fire, acid, rockets, crystals and pickups light it up with coloured glow. A vignette darkens the edges.
- 1px outlines on all characters; tiles shade their exposed edges and get darker the deeper they sit.
- Explosions are lumpy fireballs that cool from white to red and rise. Rain and lightning on the island, blowing sand in the desert.
- Snow, aurora and a pine skyline on the Cryo Summit.
- Title screen plays over the level with explosions going off in the background.
- Pause menu (P): screen shake, scanlines, music and lighting on/off (saved in this browser), restart level, quit to title.
- New HUD: portrait, specials as flasks, the bro reserve as heads, dash cooldown, score. Kills inside 1.6 s chain into a combo that multiplies the points; score, run total and best combo show on the end screens, and the best run is saved in this browser and shown on the title.

### Animation and sound

- Characters are drawn in layers: a 6-frame run cycle (far leg darker), an upper body that bobs with the stride and breathes when idle, and a front arm with its own poses (aim, punch, climb, throw, both arms waving when on fire). Jump, fall, kneel and wall-climb poses.
- Each quack type has its own head, body, weapon and tells: the heavy's barrels spin, the rocketeer's sight line blinks, the guru's orb glows while chanting, the scout's whistle sends out rings.
- The mech walks on two jointed legs with footfalls that shake the screen. The kopter tilts into its motion. The crawler's body follows its head like a chain.
- A small step sequencer plays bass, drums and a lead line, with a faster track during boss fights. M mutes everything.

### Physics and details

- Structures stand only while a chain of blocks links them to bedrock or a steel girder. Cut one loose and it shakes, then falls block by block, crushing whatever is under it. The bunker roof, the watchtower and the acid bridge can all be dropped.
- Shot quacks fly back as ragdolls that bounce, settle and can be shot again. Explosions and falling blocks tear them into gibs. Blood and scorch marks stick to the blocks they hit.
- Broken blocks throw chunks that bounce and settle. The photon rifle ejects shell casings. Every gun has a muzzle flash.
- Blasts push the player, bodies, barrels and lamps, and leave small fires that set quacks running in a panic and burn through wooden crates. Propane tanks fly like rockets when shot or punched.
- Punch launches quacks, corpses, barrels and tanks. A punched bomber flies off and goes off where it lands.
- Jump buffering, landing dust and squash, footstep dust, a short freeze on big hits, quacks that alert each other.
- Back walls behind broken earth and inside the bunker, swinging lamps, a cloth flag, palms, signs, sandbags, searchlights, and a rope ladder on the chopper.

### Tests

Headless logic tests in Node (canvas and DOM stubbed, no dependencies):

```
node science-bros/tests/smoke_playthrough.js science-bros/index.html
node science-bros/tests/climb_boss_extraction.js science-bros/index.html
node science-bros/tests/physics.js science-bros/index.html
node science-bros/tests/enemies_bosses.js science-bros/index.html
node science-bros/tests/controls_destruction.js science-bros/index.html
node science-bros/tests/bros.js science-bros/index.html
node science-bros/tests/objects_quest.js science-bros/index.html
node science-bros/tests/safe_start.js science-bros/index.html
node science-bros/tests/gamepad.js science-bros/index.html
node science-bros/tests/levels.js science-bros/index.html
node science-bros/tests/modes_content.js science-bros/index.html
```

The first runs a scripted player through the level until it wins or runs out of bros. The second checks the cliff climb, the boss kill and the chopper extraction. The third checks the physics: nothing floats at the start, the watchtower, bunker roof and acid tower collapse when cut loose, ragdolls come to rest on the floor, explosions make gibs, punches launch bodies and propane tanks fly. The fourth checks each enemy type's behaviour, both new bros, the three bosses (activation, attacks, death, gates), the level 2 ending and that bros carry over between levels. The fifth checks the dash (and that it dodges a bullet), the wall jump, the ground pound drilling through layers, blast debris, blasted back walls, fire spreading along the crate bridge, the airstrike, the combo score, the mech (boarding, armour, bulldozing, jumping out, being thrown clear) and the pause menu. The fourth also covers Level 3: icicles, slippery ice, the tank fight and the game ending. The sixth checks that each of the 12 bros' weapons kills a quack and that the new specials work. The seventh checks the objects, items, objectives, objective-gated extraction and the campaign screens. The fourth also covers the new quacks and Level 4. The eighth checks the safe start on all 11 missions (no enemy within 20 tiles; no quack fires in the first 10 s, standing still or pushing forward), that quacks wake up after it, that shooting first provokes only that quack, the briefing choices and mission select. The ninth drives the game with a fake PS5-style controller: menus, moving, running, every button, the map and the pause menu. The tenth checks every campaign mission: theme, briefing, map spot, one final boss, enough targets for each objective, cages, 3 intel files, nothing spawned inside a wall; and for missions 6 to 10 that a simple bot gets past the middle, the boss wakes up, goes down, its gate opens and the chopper comes. The eleventh checks the preacher, the mortar crew and the camera drone, the title menu, Lab Siege (waves, boss wave, game over), Boss Rush (all 12 bosses, the finish), Moon Base (low gravity, the Director, the finish) and the trophies. Tests three to eleven exit with code 1 on any failure.
