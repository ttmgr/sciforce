# sciforce

## Science Bros

Broforce-style run-and-gun platformer: 7 scientist bros, 3 levels (Placebo Island, Detox Desert, Cryo Summit), 9 enemy types, 4 bosses and a drivable mech. Single self-contained HTML file, no build step.

- Game: `science-bros/index.html`. Open it in a browser.
- Controls: arrows or A/D move; Up, W or Space jump (hold against a wall to climb, jump off it to wall-jump); Z or J fire; X or K special (3 per bro); C or L punch; Down + punch in the air for a ground pound; Shift or V dash-roll (also jumps out of the mech); P pause menu; M mute.
- Gamepad (standard mapping): stick or d-pad move, A jump, X or RT fire, B punch, Y special, LB/RB dash, Start pause. Explosions rumble pads that support it.

### Levels, enemies and bosses

- **Level 1, Placebo Island:** beach, bunker, acid bridge, cliff with a watchtower, cliff fort. Boss: the **Homeopathitron**, a walking pill mech. It fires spreads, jumps for shockwaves and summons quacks. Below 40% health it enters overdose mode: faster, with homing missiles.
- **Level 2, Detox Desert:** dunes, a two-floor Wellness Spa, an oil field and an acid canyon. Mid-boss: the **Detoxkopter**, which strafes, drops bombs and hovers low to fire missiles; climb the brick towers to hit it. Final boss: the **Crystal Crawler**, a worm that tunnels through the sand, bursts out in arcs or rears up spitting acid. Only its head takes bullets.
- **Level 3, Cryo Summit:** snowy slopes with a frozen pond, the Cryo Spa (a mech is parked outside), a chasm of freezing water under a brittle ice bridge, a tunnel with icicles that drop on whatever walks beneath them, a snow fort. Final boss: the **Snake Oil Tank**, driven by Dr. Placebo. It keeps its distance lobbing shells from a turret that tracks you, rolls in with a flamethrower of burning snake oil, and below half health it mortars and rams.
- Ice blocks are slippery and shatter easily.
- Lives and freed bros carry over between levels. Game over restarts the current level.
- **Quacks:** grunt, riot shield (blocks shots from the front; punch the shield away), heavy (20 hp, spins up a minigun), scout (runs off whistling and wakes every quack nearby), grenadier (punch grenades back), rocketeer (kneels and aims; shoot the rocket down), guru (calls in paratroopers), paratrooper, suicide bomber, attack dog (leaps at you), plus turrets.
- **Bros:** Einstein, Curie, Tesla, Newton and Franklin on level 1. Level 2 adds Ada Lovebro (three-card spread; special: a drone that guards you for 8 s) and Charles Darbro (homing finches; special: natural selection, weak quacks on screen drop dead).
- Supply crates refill one special. Steel piles under the acid bridges stay up even if the crates burn away.

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
```

The first runs a scripted player through the level until it wins or runs out of bros. The second checks the cliff climb, the boss kill and the chopper extraction. The third checks the physics: nothing floats at the start, the watchtower, bunker roof and acid tower collapse when cut loose, ragdolls come to rest on the floor, explosions make gibs, punches launch bodies and propane tanks fly. The fourth checks each enemy type's behaviour, both new bros, the three bosses (activation, attacks, death, gates), the level 2 ending and that bros carry over between levels. The fifth checks the dash (and that it dodges a bullet), the wall jump, the ground pound drilling through layers, blast debris, blasted back walls, fire spreading along the crate bridge, the airstrike, the combo score, the mech (boarding, armour, bulldozing, jumping out, being thrown clear) and the pause menu. The fourth also covers Level 3: icicles, slippery ice, the tank fight and the game ending. The last three exit with code 1 on any failure.
