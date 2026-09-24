# SCT_WD_2
# Stopwatch Web Application

A colourful, interactive stopwatch built with plain HTML, CSS and JavaScript. It has no frameworks or libraries and needs no installation. Built as **Task 02** of the SkillCraft Technology internship.

## Features

- **Start, Pause, Resume and Reset** controls
- **Lap tracking** with split time and total time for every lap
- **Fastest and slowest lap** highlighting
- **Animated dial** where the ring sweeps once per minute and the ticks light up as it passes
- **5 colour themes** (Neon, Sunset, Ocean, Forest, Candy), saved between visits
- **Live effects** including an animated background, flowing gradient digits, button ripples and a confetti burst on each lap
- **Keyboard shortcuts** for quick control
- **Saved state**: the time and laps survive a page refresh, and the stopwatch keeps counting accurately
- **Responsive design** that works on phones, tablets and desktops
- **Accessible**: visible keyboard focus and reduced-motion support

## Project Structure

```
stopwatch/
├── index.html   # Page structure
├── style.css    # Themes, layout and animations
├── script.js    # Stopwatch logic and interactions
└── README.md
```

## How to Run

1. Download or clone this folder.
2. Open `index.html` in any modern browser.

No build step or server is needed. An internet connection is only used to load the Google Fonts (Barlow and Barlow Condensed). Without one, the app falls back to system fonts.

## How to Use

| Action | Button | Keyboard |
| --- | --- | --- |
| Start, pause or resume | Start / Pause / Resume | `Space` |
| Record a lap | Lap | `L` |
| Reset everything | Reset | `R` |
| Change theme | Coloured dots | none |

The Lap button works only while the stopwatch is running.

## How It Works

- Time is calculated from `Date.now()` rather than by counting intervals, so it stays accurate even if the browser slows down or the tab is in the background.
- `requestAnimationFrame` updates the display smoothly, down to centiseconds.
- The dial is drawn with SVG. The ring progress, tick marks and moving marker are all driven by the elapsed time.
- `localStorage` stores the stopwatch state and the chosen theme.

## Technologies

- HTML5
- CSS3 (custom properties, grid, animations, `color-mix`)
- JavaScript (ES6+)

## Browser Support

Works in the latest versions of Chrome, Edge, Firefox, Safari and mobile browsers.

#Demo link 
https://gaurikhamankar123-star.github.io/SCT_WD_2/

