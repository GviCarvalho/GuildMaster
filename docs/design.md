# Guildmaster Tycoon – Design Doc

## Premise
You are the guild master running a guild hall in a living world. NPCs pursue needs, jobs, and agendas off-camera; when they have problems or opportunities, they come to the guild. The player only sees what reaches the guild through clients, adventurers, rumors, and spies.

## Pillars
- Emergent world: autonomous NPCs with needs, jobs, relationships, and a functioning market drive unscripted incidents.
- Guild-first perspective: information is partial, delayed, or noisy; the guild acts with incomplete intel.
- Consequence net: NPC actions block or enable others; conflicts ripple outward and back to the guild.
- Deterministic sim: seedable RNG for reproducible testing and narrative debugging.

## Player Loop
1) Plan the day: set shop prices/stock, inn and bar menus, staff shifts, and budget.
2) Handle clients: review requests, negotiate payouts/risks, accept/decline.
3) Assign missions: pick adventurers, kits, and tactics; dispatch and await outcomes.
4) Operate facilities: bar/inn/store generate income and gather rumors; restock from market.
5) Respond to reports: debrief teams, act on rumors, manage reputation fallout.
6) Advance time: tick-based day/night; pause/fast-forward while world keeps simulating.

## Systems Overview
- Time and ticks: discrete ticks with day/night modifiers; world sim and guild ops advance together.
- NPC simulation (off-camera):
  - Needs: food, shelter, safety, status, wealth.
  - Personalities: aggressiveness, honesty, vengefulness, helpfulness, curiosity.
  - Social graph: friends/enemies/factions, grudges and favors; witnesses create evidence and rumors.
  - Economy: producers/consumers, prices from supply/demand; shortages and surpluses drive incidents.
  - Travel and encounters: routes can be blocked, robbed, assisted, or rerouted.
- Incident engine:
  - Storyteller pressure creates incidents (raids, disputes, escorts, shortages, mysteries, trade offers).
  - IncidentInstance → IncidentWorker simulates outcomes, side-effects, and logs (injuries, deaths, loot, reputation hits, new hooks).
- Missions:
  - Requests come from clients or the guild (patrols, escorts, investigations, deliveries, procurement).
  - Preparation: adventurer selection, loadouts, consumables, backup/insurance options.
  - Execution: simulated off-camera using the same incident machinery; yields full logs plus items/reputation changes.
- Adventurers:
  - Stats: combat, stealth, knowledge, social, endurance; traits: reliability, loyalty, greed, caution.
  - States: morale, fatigue, injuries, long-term trauma; progression via training and gear.
- Facilities:
  - Bar/Inn: income + rumor intake; better quality boosts intel reliability and adventurer morale.
  - Store/Forge: sales, repairs, crafting; ties to market prices and stock limits.
  - Upgrades: lodging quality, kitchen, infirmary, armory, scribe/archives, spy room.
- Knowledge model:
  - Channels: client briefs, adventurer debriefs, bar gossip, merchant chatter, spy/agent reports.
  - Each channel has delay, noise, and reliability; contradictory reports are possible.
  - Full incident logs are retained; player-facing reports are filtered views with timestamps and confidence.
  - Retroactive reveals: later intel can correct earlier reports.
- Reputation and factions:
  - Track per-faction and global reputation; affected by mission outcomes, fairness, prices, gossip.
  - Hidden reputation modifiers for secrecy/deniability; rivals can sabotage or undercut.
- Economy and finance:
  - Cashflow from facilities and missions; wages, upkeep, repairs, training, bribes/insurance.
  - Market orders with lead times; scarcity spikes prices and drives client behavior.
- Progression:
  - Unlock higher-risk missions, better contracts, facility tiers, and covert options as reputation climbs.
  - Failure states: insolvency, mass injury/death, faction lockout, legal shutdown.

## Data and Content
- Data-driven templates: incidents, missions, NPC archetypes, factions, items, facilities, storyteller profiles.
- Use JSON/TSV/Resource scripts for authoring; deterministic seeds for regression scenarios.

## MVP Slice (target)
- World tick with basic storyteller generating a handful of incident types (escort, delivery, dispute, shortage).
- NPC archetypes with simple needs and personalities influencing incident triggers.
- Guild loop: accept/decline requests, assign adventurers, pick simple loadouts, dispatch.
- Off-camera mission sim that produces:
  - Full log (for debugging) and a filtered guild report with delay/noise.
  - Outcome impacts: cash, items, injuries, reputation delta.
- Facilities v1: bar/inn/store with income and rumor hooks; basic restock from market with fluctuating prices.
- UI stubs: mission board, roster, facility panels, reports view with timestamps/confidence.

## Stretch Ideas
- Rival guilds and town guard behavior that reacts to your reputation.
- Undercover/scout missions to improve intel quality.
- Insurance/waivers and legal risks; court or bribery events.
- Dynamic travel graph with blockades, weather, and road quality affecting incident odds.

## Testing and Telemetry
- Seeded runs for deterministic regression.
- Snapshot logs of incidents and reports to detect schema or balance drift.
- Debug tools: inspect current world indices, queued incidents, and active rumors/reports.
