# Generic Remote Control Protocol SW-P-08

The SW-P-08 protocol is implemented by many broadcast routers and control systems. You may need to enable this protocol on your router control system. Currently only the 'standard' set of SW-P-08 commands are supported which means a maximum of 16 levels, 1024 sources and 1024 destinations can be controlled. 

[Please log suggestions and issues on github.](https://github.com/bitfocus/companion-module-generic-swp08/issues)

## Configuration
These settings must be entered before the module can be used.

- **IP Address** of the router or controller 
- **Port** of the router of controller 
- **Matrix** this will probably be 1 in most systems
- **Levels** this number controls the levels offered in the level selection menus. It is not verified against the hardware and only affects the user interface. All levels are enabled by default, use the Levels actions to modify the selection.

## Commands
There are multiple ways of making crosspoint buttons to cater for different applications. For basic operation where one button makes one pre-defined route only **Set Crosspoint** is required.

- **Select Levels:** Add the level(s) in the action to the level selection for the next take
- **DeSelect Levels:** Remove the level(s) in the action from the level selection for the next take
- **Toggle Levels:** For each level in the action set the state to the opposite of the current state
- **Select Destination:** Preset the destination for the next route take
- **Select Source:** Preset the source for the next route take
- **Route Source to selected Levels and Destination:** Use the preset levels and destination with the source from this action and make the route
- **Take:** Make the crosspoint from preset levels, source and destination
- **Clear:** Forget any preset levels, destination or source. Enables all levels.
- **Set Crosspoint:** Specify levels, source and destination in the action and make the route

### Names
There are additional commands which get and use the names stored in the router controller. *These commands are experimental and have been created without access to the interface specification so could break!*

## Feedbacks
Button background colours can be changed to show current status.

- **Selected Levels**
- **Selected Destination**
- **Selected Source**

## Variables
Some dynamic information is stored in variables which you can access through the companion user interface.

- **Number of Source names** reported by router
- **Number of Destination names** reported by router
- **Selected Destination** set by actions
- **Selected Source** set by actions
- **Source_?** a label for each source as defined in the the router
- **Destination_?** a label for each destination as defined in the router

## Version 1.0.0

First Release

## Version 1.0.1

Reworked levels to be more flexible
Added Route Source name action
Added Toggle Level action