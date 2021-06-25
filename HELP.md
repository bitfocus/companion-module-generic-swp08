# Generic Remote Control Protocol SW-P-08

The SW-P-08 protocol is implemented by many broadcast routers and control systems. You may need to enable this protocol on your router control system.

In some routers it is necessary to send multiple commands to route the video and audio levels.

## Commands
There are multiple ways of making crosspoint buttons to cater for different applications.

- *Select Level:* Preset the level for the next route
- *Select Destination:* Preset the destination for the next route 
- *Select Level and Destination:* Preset both in a single action
- *Select Source:* Preset the source for the next take
- *Route source to selected Level and Destination:* Use the preset Level and Destination with the Source from this action and make the route
- *Take:* Make the crosspoint from preset Source, Destination and Level
- *Clear:* Forget any preset level, destination or source
- *Set Crosspoint:* Specify Level, Source and Destination in the action and make the route

## Feedbacks
Button background colours can be changed to show current status.

- *Selected Level*
- *Selected Destination*
- *Selected Source*

## Variables
Some dynamic information is stored in variables which you can access through the companion user interface.

- *Number of Sources* reported by router
- *Number of Destinations* reported by router
- *Selected Level* set by actions
- *Selected Destination* set by actions
- *Selected Source* set by actions

## Version 1.0.0

First Release