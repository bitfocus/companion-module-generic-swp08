# Generic Remote Control Protocol SW-P-08

The SW-P-08 protocol is implemented by many broadcast routers and control systems. You may need to enable this protocol on your router control system. Currently only the 'standard' set of SW-P-08 commands are supported which means a maximum of 16 levels, 1024 sources and 1024 destinations can be controlled. 

[Please log suggestions and issues on github.](https://github.com/bitfocus/companion-module-generic-swp08/issues)

## Configuration

- *IP Address* of the router or controller 
- *Port* of the router of controller 
- *Matrix* this will probably be 1 in most systems
- *Levels* this number controls the levels offered in the level selection menus. It is not verified against the hardware and is only affects the user interface.

## Commands
There are multiple ways of making crosspoint buttons to cater for different applications.

- *Select Levels:* Preset the levels for the next route
- *Select Destination:* Preset the destination for the next route
- *Select Levels and Destination:* Preset both in a single action
- *Select Source:* Preset the source for the next take
- *Route source to selected Levels and Destination:* Use the preset Levels and Destination with the Source from this action and make the route
- *Take:* Make the crosspoint from preset Source, Destination and Level
- *Clear:* Forget any preset level, destination or source
- *Set Crosspoint:* Specify Levels, Source and Destination in the action and make the route

### Names
There are additional commands which get and use the names stored in the router controller. *These commands are experimental and have been created without access to the interface specification so could break!*

## Feedbacks
Button background colours can be changed to show current status.

- *Selected Levels*
- *Selected Destination*
- *Selected Source*

## Variables
Some dynamic information is stored in variables which you can access through the companion user interface.

- *Number of Source names* reported by router
- *Number of Destination names* reported by router
- *Selected Levels* set by actions
- *Selected Destination* set by actions
- *Selected Source* set by actions

## Version 1.0.0

First Release