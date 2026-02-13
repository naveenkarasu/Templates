# 3D Keyboard Skills

Interactive 3D keyboard where each keycap represents a tech skill. Hover or press keys to see skill names and descriptions. Built with Spline 3D, GSAP, and Next.js.

> Source: [Naresh Khatri](https://github.com/Naresh-Khatri/3d-portfolio)

## Usage

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the keyboard.

## Customizing Skills

Edit `src/data/constants.ts` to change the skills displayed on the keyboard. Each skill maps to a keycap in the Spline scene:

```ts
[SkillNames.REACT]: {
  id: 5,
  name: "react",        // must match the keycap name in Spline
  label: "React",       // displayed on hover
  shortDescription: "...",
  color: "#61dafb",
  icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg",
},
```

## Customizing the 3D Scene

The Spline scene file is at `public/assets/skills-keyboard.spline`. To edit it:

1. Open [Spline](https://spline.design/) and import the `.spline` file
2. Each keycap object name must match a key in the `SKILLS` record
3. Export and replace the file in `public/assets/`

The `SkillNames` enum, `SKILLS` record, and the Spline keycap names must all stay in sync for the keyboard interactions to work.

## Project Structure

```
src/
  app/
    page.tsx                    # Main page - renders keyboard
    layout.tsx                  # Root layout with providers
    globals.css                 # Tailwind + CSS variables
  components/
    animated-background.tsx     # Core: Spline 3D scene + keyboard interaction
    animated-background-config.ts # Keyboard position/scale/rotation
    sections/skills.tsx         # Skills section wrapper
    sections/section-header.tsx # Section title component
    preloader/                  # Loading animation
    providers.tsx               # Theme + preloader providers
    reveal-animations.tsx       # Scroll reveal animations
    smooth-scroll.tsx           # Lenis smooth scroll
    theme-provider.tsx          # Dark/light theme
    ui/section-wrapper.tsx      # Scroll-based opacity wrapper
  data/
    constants.ts                # Skill definitions (edit this!)
  hooks/
    use-media-query.tsx         # Responsive breakpoints
    use-sounds.ts               # Keyboard press/release sounds
  lib/
    utils.ts                    # cn() helper
    lenis/index.ts              # Smooth scroll re-export
public/
  assets/
    skills-keyboard.spline      # 3D keyboard scene
    keycap-sounds/              # Press and release sound effects
```

## Tech Stack

Next.js, React, TypeScript, Tailwind CSS, Spline 3D, GSAP, Framer Motion, Lenis
