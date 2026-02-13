# Golden Butterfly Particles

Metallic golden butterfly particles that swarm freely, respond to mouse movement in all directions, and can form any uploaded image.

## Usage

Open `index.html` in a browser.

- **Upload Image** — particles rearrange to form the image shape
- **Reset Swarm** — particles return to free-flight mode
- **Mouse** — move cursor to push and swirl nearby butterflies
- **R key** — quick reset

## How It Works

1. Image is loaded onto an offscreen canvas and downsampled
2. Pixel positions are extracted (alpha-filtered for PNGs, step-sampled for JPEGs)
3. Pixel coordinates are mapped to 3D world space with centering and Y-flip
4. Spring physics pull each butterfly to its assigned target position
5. Butterfly scale adapts during formation so the image detail is visible
