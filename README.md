# companion-module-generic-swp08

See [HELP.md](./companion/HELP.md) and [LICENSE](./LICENSE)

## Version History

### Version 1.0.0

- First Release

### Version 1.0.1

- Reworked levels to be more flexible
- Added route source by name action
- Added toggle level action
- Added variables for source and destination labels
- Added option to re-enable levels on clear
- Added feedback for selected level and destination
- Fixed packaging of bytes sent to router

### Version 1.0.2

- Reworked incoming data processing
- Reworked name decoding to support larger routers
- Added module config option for name length
- Added module config option to request names on connection
- Added variables for selected destination source

### Version 1.0.3

- Added module config option to disable the supported commands check

### Version 1.0.4

- Added support for more than 16 levels
- Added support for more then 1024 sources/destinations
- Tidy up config page layout
- Add more supported device types to the module properties

### Version 1.0.5

- Added presets for some actions
- Added feedback Source routed to selected Destination

### Version 2.0.0

- Update for Companion Version 3
- Add connection keep alive
- Accept variables for Select Source Name, Select Destination Name, Set Crosspoint by Name
- Add Crosspoint Connected, Crosspoint Connected By Name feedback
- Action Recorder support
- Select Source and Destination Presets now generated according to router size (up to 256)
- Select Source and Destination Presets now with names
- Select Source presets have 2nd Source Routed to Destination feedback

### Version 2.0.1

- Add TX message queue
- Update dependencies
- Update package manager

### Version 2.0.2

- Fix typo in variable-parsing function

### Version 2.0.3

- Use Node 22
- Update dependencies

### Version 2.0.4

- Throttle Action, Feedback, Variable definition updates

### Version 2.0.5

- Parse variables with context object (for local variables)

### Version 2.0.6

- Reworked data processing
- Fixed issue with not getting labels if "Request supported commands" config option was disabled
- Fixed issue where labels were duplicated and in wrong order if router had labels on multiple levels
- Fixed initial label request (non-extended mode) to use the correct format according to specification
- Fixed issue where not all source labels were received, fixes issue #31

### Version 2.0.7

- Removed untested config option for tally dumping

### Version 2.0.8

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

### Version 2.0.9

- Fix: some issues with label pulling

### Version 2.0.10

- Fix: tally dump response handling for byte type responses

### Version 2.0.11

- Fix: Select destination by name action

### Version 3.0.0

- Convert to Typescript
- Send `crosspoint interrogate` as keepalive
- Improve logging
- Fix: Listen for `end` event from TCPHelper not `close` which does not exist

### Version 4.0.0

- Upgrade to API `v2.0`
- Support expressions for all action and feedback options
- Add **Source name routed to selected Destination** value feedback
- Add **Can Take** boolean feedback
- Reformat config options
- Move version history to `README.md`
