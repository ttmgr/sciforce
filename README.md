# sciforce

## Science Bros

Broforce-style run-and-gun platformer: 7 scientist bros, 2 levels (Placebo Island, Detox Desert), 9 enemy types and 3 bosses. Single self-contained HTML file, no build step.

- Game: `science-bros/index.html`. Open it in a browser.
- Controls: arrows or A/D move; Up, W or Space jump (hold against a wall to climb); Z or J fire; X or K special (3 per bro); C or L punch; P pause; M mute.

### Levels, enemies and bosses

- **Level 1, Placebo Island:** beach, bunker, acid bridge, cliff with a watchtower, cliff fort. Boss: the **Homeopathitron**, a walking pill mech. It fires spreads, jumps for shockwaves and summons quacks. Below 40% health it enters overdose mode: faster, with homing missiles.
- **Level 2, Detox Desert:** dunes, a two-floor Wellness Spa, an oil field and an acid canyon. Mid-boss: the **Detoxkopter**, which strafes, drops bombs and hovers low to fire missiles; climb the brick towers to hit it. Final boss: the **Crystal Crawler**, a worm that tunnels through the sand, bursts out in arcs or rears up spitting acid. Only its head takes bullets.
- Lives and freed bros carry over from level 1 to level 2. Game over restarts the current level.
- **Quacks:** grunt, riot shield (blocks shots from the front; punch the shield away), heavy (20 hp, spins up a minigun), scout (runs off whistling and wakes every quack nearby), grenadier (punch grenades back), rocketeer (kneels and aims; shoot the rocket down), guru (calls in paratroopers), paratrooper, suicide bomber, attack dog (leaps at you), plus turrets.
- **Bros:** Einstein, Curie, Tesla, Newton and Franklin on level 1. Level 2 adds Ada Lovebro (three-card spread; special: a drone that guards you for 8 s) and Charles Darbro (homing finches; special: natural selection, weak quacks on screen drop dead).
- Supply crates refill one special. Steel piles under the acid bridges stay up even if the crates burn away.

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
```

The first runs a scripted player through the level until it wins or runs out of bros. The second checks the cliff climb, the boss kill and the chopper extraction. The third checks the physics: nothing floats at the start, the watchtower, bunker roof and acid tower collapse when cut loose, ragdolls come to rest on the floor, explosions make gibs, punches launch bodies and propane tanks fly. The fourth checks each enemy type's behaviour, both new bros, the three bosses (activation, attacks, death, gates), the level 2 ending and that bros carry over between levels. The third and fourth exit with code 1 on any failure.
