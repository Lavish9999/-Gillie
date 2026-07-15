# Reef Economy QA

## Water clarity pacing

- Day 0 starts at 25% clarity.
- Day 30 is 56%, Day 90 is 75%, Day 180 is 88%, and Day 365 reaches 100%.
- Confirm the Home tank murk matches the slower curve after a fresh launch.
- Confirm a slip restarts current-streak clarity while lifetime clean days remain banked for collection gifts.

## Guaranteed clean-time gifts

- 1 day: Sprout Hat
- 3 days: Kelp Sprout
- 7 days: Leaf Hat
- 14 days: Glow Coral
- 30 days: Pearl Clam
- 60 days: Sea Glass Stack
- 90 days: Crystal Cave
- 180 days: Lunar Arch
- 365 days: Year One Beacon

Each gift must be added to `ownedItems` exactly once and remain available after relaunch. Existing users who already passed a threshold receive missing gifts retroactively without duplicates.

## Level rewards

- Level 2 through Level 8 pearl rewards continue using the existing one-time reward markers.
- Reopening the Reef, foregrounding the app, and rerendering must never duplicate level pearls.

## Expanded collection

Confirm these new items render in the shop and in the tank after purchase/equip: Mossy Driftwood, Bubble Anemone, Moon Shell, Coral Arch, Sea Glass Stack, Crystal Cave, Lunar Arch, and Year One Beacon.
