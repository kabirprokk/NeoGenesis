# WORLD — the plane lab (no placeholders, no decoration)

The game is one flat solid plane (`frontend/src/lab/planeWorld.ts`) on the
reality engine: real gravity, real material bodies, real fluids, real
sky/sun/moon as time-of-day. Neo stages experiments here — tanks, heat
chambers, spark gaps, laser benches, acid vats — and the engine lives them
at 120 Hz while you watch.

Frames: feet in plane metres around the spawn; the ground mesh follows the
player in 10 m snaps. Staged bodies and tank walls are solid (circle-collider
push-out), water slows you down, the camera can't clip underground, and the
shadow frustum follows you. Meshes are pooled per body id and removed on
cleanup (no heap bleed).

Honest limits: bodies collide pairwise (sphere/sphere, box/box, sphere/box —
impulse with pair-averaged restitution, fracture on hard hits) with CCD-lite
substeps (no tunneling up to ~3 km/s against metre-scale walls; beyond that,
or past 32 substeps, all bets off); spin exists as Magnus lift on moving
bodies (backspin sails, topspin dives — approx curveball fit) but bodies don't
tumble, so there is still no true rotational dynamics; the engine has no
freeze or corrosion kinetics (cold is staged, corrosion is a table verdict);
heat is lumped-capacitance with a Biot-number flag (Bi > 0.1 warns the core
lags the skin — no internal conduction); and fluids are box volumes, not
free-surface waves. Slosh inside carried vessels is an approx spring-damper
tether (half-full sloshes loosest), not CFD.
