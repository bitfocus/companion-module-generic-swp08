# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Entries for 4.1.1 and earlier are kept as originally written.

## [Unreleased]

### Added

- **Multiple matrices** — one connection can control several SW-P-08 matrices, e.g. Lawo VSM video and audio matrices on the same port. New **Matrices** config field (`1:Video, 2:Audio`, `1,2,3` or a count such as `3`); blank keeps the previous single-matrix behaviour.
- **Matrix option** — **Set Crosspoint**, **Set Crosspoint by name** and the crosspoint feedbacks can target a matrix, defaulting to the primary matrix.
- **Select Matrix** — new action and **Selected Matrix** feedback; **Take** and the **Route Source** actions honour the selected matrix.
- **Per-matrix data** — names, tally and routemap per matrix, with scoped variables (`*_Matrix_<m>_*`) alongside the unchanged primary-matrix variables.
- **Crosspoints presets** — an opt-in button for every source/destination pair, per matrix and level, built from the router names. Enable with **Generate crosspoint presets**; **Port names to leave out of crosspoint presets** sets which ports to skip (`N/C` by default).
- **Crosspoint preset variables** — `show_dest_name` hides the destination name and `bg_color` sets the background colour. Both are empty by default; a button value wins over a page variable with the same name, and with neither set the destination name shows on a black background.
- **Background colour feedback** — sets the button background from a colour value or expression.

### Changed

- **Preset text size** — presets use auto size (shrink to fit) so long router names fit on the button.
- **Crosspoint confirmation** — the module interrogates each crosspoint shortly after connecting it, so feedback updates at once on routers that do not send a Crosspoint Connected tally, such as Lawo VSM.
- **Crosspoint feedbacks** — each destination is interrogated once per connection, so feedbacks work when the router does not answer the tally dump.

### Fixed

- **Request supported commands** — no longer stalls the connection when the router never answers; names and tally are read after 3 seconds anyway.

## [4.1.1] - 2026-09-06

- Send the next queued message as soon as the router ACKs/NAKs the previous one (or the ACK timeout elapses) instead of also holding a fixed 10 ms interval between sends, per SW-P-88 §7.2.2
- Name the ACK timeout (1 s, the spec's notional value) and the attempts per message (2) as constants
- Add send-queue tests against a fake SW-P-08 router (immediate / delayed / NAK / silent)

## [4.1.0] - 2026-08-04

- Add an initial load sync gate, to avoid noise until settled

## [4.0.7] - 2026-07-30

- Silently drop or dont perform getCrosspoint commands to destination 0 (selected_dst on init)
- Add some self tests

## [4.0.6] - 2026-07-13

- Keep alive get crosspoint only performed on Level 1

## [4.0.5] - 2026-07-12

- Use Node 26
- Update Dependencies
- Linting

## [4.0.4] - 2026-06-09

- Fix: 1-based key for `this.source_names` and `this.dest_names`
- Improvement: Default to a max source/dest value of 0xffff if getHighestKey returns a 0 or undefined.
- Chore: Update p-queue
- Chore: Update lint-staged
- Chore: Update typescript-eslint
- Chore: Update yarn

## [4.0.3] - 2026-05-12

- Fix: `destination source name` feedback source offset by 1
- Improve: Handling of levels and matrix values in extended mode (> 16).
- Fix: `destinations` variable `name` field
- Fix: Don't return `SetCrosspoint` early after logging message to say proceeding with extended command despite extended commands not being enabled
- Improvement: Prefer extended command set whenever it is supported
- Improvement: Don't overwrite config in `configUpdated()`
- Improvement: Wait for `ACK` during `sendMessage`, queue processing and consecutive actions will progress after `ACK`
- Improvement: Refactor `updateAllCrosspoints()` for better efficieny
- Improvement: check for changed size of `coreVariables` during `updateVariableDefinitions()`
- Improvement: clear `this.ackCallbacks` on socket `end` event
- Improvement: Other minor refactors / typing improvements

## [4.0.2] - 2026-04-29

- Correct description of `Crosspoint Connected on specific level` feedback
- P-Queue updated to `9.2.0`
- Typescript-eslint updated to `8.59.1`

## [4.0.1] - 2026-04-26

- Refactor feedback checks
- Check `Can Take` feedback in more places

## [4.0.0] - 2026-04-25

- Upgrade to API `v2.0`
- Support expressions for all action and feedback options
- Add **Source name routed to selected Destination** value feedback
- Add **Can Take** boolean feedback
- Reformat config options
- Move version history to `README.md`

## [3.0.0] - 2026-04-20

- Convert to Typescript
- Send `crosspoint interrogate` as keepalive
- Improve logging
- Fix: Listen for `end` event from TCPHelper not `close` which does not exist

## [2.0.11] - 2026-04-18

- Fix: Select destination by name action

## [2.0.10] - 2026-03-20

- Fix: tally dump response handling for byte type responses

## [2.0.9] - 2026-02-23

- Fix: some issues with label pulling

## [2.0.8] - 2025-06-16

- Added support for tally dumps, which allows the module to have a full overview of the currently routed crosspoints.
- Add support for tally variables per layer
- Fix issues with name responses, remove "self" usage.
- Added extra caching of variables so we don't update more variables than needed.
- Don't push variable definitions unless they have changed.
- Handle "supported commands" data from device better.
- Use interval for keepalive timer, and fix the invalid dummy packet we were sending.
- Make sure names are cached, fix bug in definition caching, and move source/dest count to same throttling
- Make sure the number of levels in dropdowns in actions/feedbacks represent the current config settings
- Update manifest with keywords

## [2.0.7] - 2025-04-26

- Removed untested config option for tally dumping

## [2.0.6] - 2025-04-26

- Reworked data processing
- Fixed issue with not getting labels if "Request supported commands" config option was disabled
- Fixed issue where labels were duplicated and in wrong order if router had labels on multiple levels
- Fixed initial label request (non-extended mode) to use the correct format according to specification
- Fixed issue where not all source labels were received, fixes issue #31

## [2.0.5] - 2025-04-16

- Parse variables with context object (for local variables)

## [2.0.4] - 2025-04-14

- Throttle Action, Feedback, Variable definition updates

## [2.0.3] - 2024-11-30

- Use Node 22
- Update dependencies

## [2.0.2] - 2024-09-24

- Fix typo in variable-parsing function

## [2.0.1] - 2024-09-23

- Add TX message queue
- Update dependencies
- Update package manager

## [2.0.0] - 2024-07-22

- Update for Companion Version 3
- Add connection keep alive
- Accept variables for Select Source Name, Select Destination Name, Set Crosspoint by Name
- Add Crosspoint Connected, Crosspoint Connected By Name feedback
- Action Recorder support
- Select Source and Destination Presets now generated according to router size (up to 256)
- Select Source and Destination Presets now with names
- Select Source presets have 2nd Source Routed to Destination feedback

## [1.0.5] - 2022-03-14

- Added presets for some actions
- Added feedback Source routed to selected Destination

## [1.0.4] - 2022-02-04

- Added support for more than 16 levels
- Added support for more then 1024 sources/destinations
- Tidy up config page layout
- Add more supported device types to the module properties

## [1.0.3] - 2021-07-30

- Added module config option to disable the supported commands check

## [1.0.2] - 2021-07-15

- Reworked incoming data processing
- Reworked name decoding to support larger routers
- Added module config option for name length
- Added module config option to request names on connection
- Added variables for selected destination source

## [1.0.1] - 2021-07-06

- Reworked levels to be more flexible
- Added route source by name action
- Added toggle level action
- Added variables for source and destination labels
- Added option to re-enable levels on clear
- Added feedback for selected level and destination
- Fixed packaging of bytes sent to router

## [1.0.0] - 2021-06-29

- First Release
