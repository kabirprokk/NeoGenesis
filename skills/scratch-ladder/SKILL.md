# Skill: scratch-ladder

Use for mining tiers, "can X cut Y", tool progression, "what pickaxe for quartz".

## Procedure
1. `mohs-ladder` for the 1–10 reference.
2. `material-get` for tool and target (`mohs` field).
3. Rule: harder scratches softer, equal mutually abrades, softer NEVER scratches
   harder — no exceptions, no "with enough force".
4. For tool-tier questions (e.g. quartz at Mohs 7): answer with the cheapest
   material strictly harder (quartz → topaz/corundum tier, NOT steel at 5.5).

## Output
One-line verdict + the two Mohs numbers + the minimal sufficient tool tier.
