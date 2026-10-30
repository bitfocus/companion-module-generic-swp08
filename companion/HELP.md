# Generic Remote Control Protocol SW-P-08

The SW-P-08 protocol is implemented by many broadcast routers and control systems. You may need to enable this protocol on your router control system. This module supports up to 256 levels, 65535 sources and 65535 destinations. If your router controller does not support the extended command set then you are limited to 16 levels, 1024 sources and 1024 destinations.

[Please log suggestions and issues on github.](https://github.com/bitfocus/companion-module-generic-swp08/issues)

## Configuration

These settings must be entered before the module can be used.

- **IP Address** of the router or controller
- **Port** of the router of controller
- **Matrices** _(optional)_ Leave blank to control a single matrix (the **Matrix Number** below). To control several matrices over one connection - for example a Lawo VSM that exposes video and audio as separate Probel matrices on the same port - list them comma separated:
  - `1:Video, 2:Audio` - matrix ids with labels (labels appear in the action/feedback dropdowns)
  - `1,2,3` - matrix ids only (auto labelled `Matrix 1` ...)
  - `3` - a bare count, expands to matrices `1..3`
    The **first** matrix in the list is the _primary_ matrix: it keeps the historic un-prefixed variables (`Source_1`, `Sel_Dest_Source_Level_1`, `Route_1_5`, ...). Other matrices get scoped variants (`Source_Matrix_2_1`, `Sel_Dest_Source_Matrix_2_Level_1`, `Route_Matrix_2_1_5`, ...).
- **Matrix Number (primary / fallback)** Used when **Matrices** is blank, and as the default matrix for actions/feedbacks. This will probably be 1 in most systems.
- **Levels** This number controls the levels offered in the level selection menus. It is not verified against the hardware and only affects the user interface. All levels are enabled by default, use the Levels actions to modify the selection.
- **Router has more than 1024 sources or destinations** If you have a large router enable this option to ensure all source and destination names are retrieved. If you don't need the names from the router or your router doesn't support names then this option can be ignored.
- **Request Supported Commands** By default Companion will ask the router which SW-P-08 commands and responses it supports. If the router does not answer within 3 seconds (Lawo VSM does not), names and tally are read anyway; disabling this option avoids the wait.
- **Request Names** When connection is made to the router ask for the names. Not supported by all routers.
- **Name Length** Ask the router to return names of this length. Not supported by all routers.

## Action Commands

There are multiple ways of making crosspoint buttons to cater for different applications. For basic operation where one button makes one pre-defined route only **Set Crosspoint** is required.

- **Select Levels** Add the level(s) in the action to the level selection for the next take
- **DeSelect Levels** Remove the level(s) in the action from the level selection for the next take
- **Toggle Levels** For each level in the action set the state to the opposite of the current state
- **Select Matrix** Preset the matrix used by **Take** and the **Route Source ...** actions (only relevant when **Matrices** lists more than one). Defaults to the primary matrix.
- **Select Destination** and **Select Destination name** Preset the destination for the next route take
- **Select Source** and **Select Source name** Preset the source for the next route take
- **Route Source to selected Levels and Destination** and **Route Source name to selected Levels and Destination** Use the preset matrix, levels and destination with the source from this action and make the route
- **Take** Make the crosspoint from preset matrix, levels, source and destination
- **Clear** Forget any preset levels, destination or source, and reset the matrix to primary. Optionally re-enable all levels.
- **Set Crosspoint** and **Set Crosspoint by name** specify matrix, levels, source and destination in the action and make the route. The **Matrix** field defaults to the primary matrix, so existing single-matrix buttons keep working unchanged.
- **Refresh Source and Destination names** Ask the router for the current set of names and update (per matrix when several are configured)

## Feedbacks - Boolean

Button background colours can be changed to show current selection status.

- **Can Take**
- **Crosspoint Connected** (has a **Matrix** option; defaults to primary)
- **Crosspoint Connected on specific level** (has a **Matrix** option)
- **Crosspoint Connected By Name** (has a **Matrix** option)
- **Selected Levels**
- **Selected Levels and Destination**
- **Selected Matrix**
- **Selected Destination**
- **Selected Source**
- **Source routed to selected Destination** (has a **Matrix** option)

## Feedbacks - Value

- **Source name routed to selected Destination** (has a **Matrix** option)

## Presets

## Variables

Some dynamic information is stored in variables which you can access through the Companion user interface.

- **Number of Source names** reported by router (`Sources`; `Sources_Matrix_<m>` for non-primary matrices)
- **Number of Destination names** reported by router (`Destinations`; `Destinations_Matrix_<m>`)
- **Selected Destination** set by actions
- **Selected Source** set by actions
- **Selected Matrix** and **Selected Matrix Label** set by the Select Matrix action (only published when more than one matrix is configured)
- **Selected Destination Source** and **Selected Destination Source Name** When a destination is selected the variable updates by interrogating the router. There is a variable per level (`Sel_Dest_Source_Level_<l>`), and per matrix/level (`Sel_Dest_Source_Matrix_<m>_Level_<l>`) when several matrices are configured. The un-prefixed names follow the selected matrix.
- **Source\_?** The name of each source as defined in the router (`Source_<n>`; `Source_Matrix_<m>_<n>` for non-primary matrices)
- **Destination\_?** The name of each destination as defined in the router (`Destination_<n>`; `Destination_Matrix_<m>_<n>`)
- **Route\_?\_?** With _Advanced tally/routing variables_ enabled, the source routed to each destination on each level: `Route_<level>_<dest>` for the primary matrix, `Route_Matrix_<m>_<level>_<dest>` for the rest

## Action Recorder

Tally and connected messages recieved from the router will create new set crosspoint actions, allowing for easy creation of salvos.
