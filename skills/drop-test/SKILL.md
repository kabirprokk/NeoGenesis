# Skill: drop-test

Use when the user asks whether something survives a fall, crash, or landing —
"would this break", "drop X from Y", "is this landing real".

## Procedure
1. Identify material + drop height. Default size 1 m box if unspecified.
2. `verdict` tool with prompt `drop a <material> <shape> from <H>m`, OR full control:
   `scenario` with bodies `[{shape, material, sizeM, heightM: H}]` and
   checks `[{kind: "survives-fall", heightM: H}]`.
3. Read `measurements.broken`, `events`, and the trace's impact velocity.
4. Sweep heights (3 m, 10 m, 50 m, 100 m) to find the breaking threshold when asked
   "how far can it fall".

## Output
Verdict + breaking height + impact velocity + the stress-vs-ultimate numbers.
Never say "it would probably break" — quote `pressureMpa` vs ultimate.
