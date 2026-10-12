# Demo 1 — Whirling Porcelain

Whirling Porcelain is a Three.js teacup carnival ride made for the WebXR
carnival-ride demonstration. It runs as a desktop web page and demonstrates
nested transforms, textured geometry, several kinds of real-time lights,
shadows, switchable cameras, and performance-conscious rendering.

## Run it

From this folder, start a local web server:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. Opening `index.html` directly as a
`file://` page is not supported because the project loads Three.js as a module.

- Public URL: **Add the final public HTTPS URL here.**
- Video: [Demo 1 Video](https://youtu.be/3X2DJrxcaCo)

## Controls

- **Stop ride / Start ride:** pauses or resumes all ride motion.
- **Ride a cup / Ground view:** switches between the outside view and a camera
  attached to a cup.
- **Night mode / Day mode:** changes the lighting setup.
- **Ride speed:** changes the animation speed.
- **Learning tools:** exposes controls for pausing each hierarchy level and for
  showing coordinates, axes, triangles, textures, and performance statistics.

## What it demonstrates

### Transform hierarchy

The ride uses three nested moving levels:

1. The main `ride` group turns the complete platform.
2. Each colored `cupGroup` turns relative to the ride.
3. Each teacup turns relative to its cup group.

The cup camera is a child of one teacup. Its final world transform therefore
combines the ride, group, cup, and camera transforms. It inherits the motion
without manually recalculating its world position every frame.

### Models, textures, and UVs

The teacups and centerpiece were assembled from substantially modified Three.js
geometry. The cup body uses a lathed side profile, with separate interior, rim,
handle, seats, and steering components.

The cup paint is a procedurally generated color texture. The pavement uses a
color map and a matching bump map. UV coordinates specify which location in
each flat image corresponds to each location on the model. The color map
provides the brick colors; the bump map changes the lighting response so the
mortar appears recessed without adding physical geometry.

### Lighting and shadows

- A hemisphere light supplies broad sky-and-ground fill.
- A directional light represents distant daylight.
- Point lights illuminate outward from the visible carnival bulbs.
- Spotlights aim from the floodlight fixtures toward the ride.

The bright bulb meshes use emissive materials only to make the bulbs themselves
look illuminated. Invisible point lights perform the actual lighting of nearby
surfaces.

The moving cups, teapot, and stand cast real-time shadows onto the platform.
Shadow maps add depth and prevent the models from appearing to float, but each
shadow-casting light requires an additional rendering pass from the light's
viewpoint. The project limits shadow-map resolution and the number of lights
that cast shadows to control that cost.

### Views and performance

The ground and rider views are switchable. The rider camera is part of the
transform hierarchy rather than being moved separately.

Repeated fence posts, lamp poles, and lamp bulbs use instanced meshes, reducing
draw calls. The renderer caps pixel density to avoid shading an unnecessarily
large number of pixels on high-density displays. The learning panel reports
frame rate, frame time, draw calls, and triangle count.

## Debugging example

An early centerpiece change caused ordinary decorative children of the ride to
be treated as cup groups. The animation loop assumed that every child had the
cup group's custom rotation data, which produced invalid rotation values. The
fix was to mark actual cup groups with `userData.isCupGroup` and select by that
meaning rather than by position in the parent's child list.

A separate visual problem made the cup rims appear to float. The rim radius and
height were adjusted so the rim overlaps the top of the cup wall and reads as
one connected object.

## Third-party source

- [Three.js](https://threejs.org/) version 0.180.0, loaded as an ES module from
  jsDelivr.

All scene models and procedural textures in this demo were created in code for
this course project.

## Known issues

- The ride is designed primarily for a desktop browser; entering WebXR is
  optional and is not implemented.
- Lighting and materials are stylized rather than photorealistic.
- The final public HTTPS URL must be added before submission.
