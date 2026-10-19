# sciforce

## Science Bros

Broforce-style run-and-gun platformer with five scientist bros and one full level (Placebo Island). Single self-contained HTML file, no build step.

- Game: `science-bros/index.html`. Open it in a browser.
- Controls: arrows or A/D move; Up, W or Space jump (hold against a wall to climb); Z or J fire; X or K special (3 per bro); C or L punch; P pause; M mute.

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
```

The first runs a scripted player through the level until it wins or runs out of bros. The second checks the cliff climb, the boss kill and the chopper extraction. The third checks the physics: nothing floats at the start, the watchtower, bunker roof and acid tower collapse when cut loose, ragdolls come to rest on the floor, explosions make gibs, punches launch bodies and propane tanks fly. It exits with code 1 on any failure.
