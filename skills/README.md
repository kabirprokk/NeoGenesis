# Skills index — procedures the AI follows to answer classes of user requests.
All skills run on engine tools (`engine/src/tools.ts`, 35 tools). Invoke by name.

| skill | when the user asks… | core tools |
|---|---|---|
| `drop-test` | survives a fall / crash / landing? | verdict, scenario |
| `material-showdown` | X vs Y, best material for a job? | material-get/list, scenario |
| `planet-survey` | same experiment on Mars/Moon/…? | planet-get, scenario × planets |
| `float-or-sink` | floats? boats? lava oceans? | fluid-get, buoyancy, scenario |
| `scratch-ladder` | can X cut Y? mining tiers? | mohs-ladder, material-get |
| `blast-analysis` | explosions? heard from how far? | explosives, sound-delay |
| `friction-audit` | slips? climbs? stands on slopes? | friction-pairs, slide-check, repose-check |
| `thermal-sweep` | melts? burns? lava? fire real? | material-get (meltC/ignitionC) |

Headless entry: `cd engine && npm run experience -- --tools` lists every tool.
Batch entry: `batch` tool runs many prompts, one verdict per line.
