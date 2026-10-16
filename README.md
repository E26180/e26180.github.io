# Ahmet Ege Baykoz · Portfolio

Source of [e26180.github.io](https://e26180.github.io/), the portfolio of a Year 2 BSc (Hons) Computer Science with Cyber Security student at the University of York, seeking a 12-month industrial placement for 2027–28.

Plain HTML, CSS and vanilla JavaScript: no build step, no framework.

## What's inside

- **Home** (one scrolling page): a hero that types out `ahmet@york:~$ whoami` and a draggable access pass on a lanyard (a small Verlet rope), then *Inside the Mac*, the lab, the latest write-ups, other work, skills with evidence and a timeline
- **Inside the Mac**: a scroll-driven CSS 3D scene on the home page. As you scroll, a Mac opens, a terminal and then Wireshark and UFW windows from Labs 1 and 2 open and close, the machine comes apart into labelled layers, the camera separates down to the lens and sensor, and it ends on the network chip sending the ARP request from Lab 4. Buttons under the caption jump to each scene. It is a stylised illustration, says so on screen, and has a text version for screen readers
- **[/lab/](https://e26180.github.io/lab/)**: the Network & Firewall Lab case study as a scrollytelling page. A sticky diagram lights up the parts each lab was about (HTTP and TCP, UFW, DHCP and DNS, ARP) while you scroll through the four labs
- **Latest from my lab notebook**: the newest write-ups from [security-notes](https://github.com/E26180/security-notes), fetched from the GitHub API with a session cache and a static fallback
- **Mini terminal**: press <kbd>`</kbd> or the `>_` button and type `help`
- Light/dark theme, a 404 page ("Packet dropped.") and a social preview image

## Motion

Everything below is off under `prefers-reduced-motion`, and the page reads fine without any of it.

- *Inside the Mac* is driven by the scroll position (a few custom properties set once per frame); with reduced motion it becomes one labelled still
- the name rises word by word, the section content fades in as it scrolls into view, a progress line grows along the top and the timeline rail draws itself (CSS scroll-driven animations where supported, `IntersectionObserver` elsewhere)
- [Lenis](https://github.com/darkroomengineering/lenis) smooths wheel scrolling, only for a mouse or trackpad
- moving between pages uses cross-document view transitions (Chrome, Safari): the header stays still and the page fades

## Design

Instrument Serif for headlines, Geist for text and Geist Mono for labels and code, all self-hosted. Each has a metric-matched fallback font (`size-adjust` and the ascent/descent overrides), so the layout does not move when the web fonts arrive. Colour carries meaning: cyan for me and links, green for allowed, red for blocked.

## Security hygiene

- No trackers, no cookies, nothing loaded from other sites. The only third-party code is Lenis (MIT, vendored in `assets/vendor`) and the fonts are self-hosted (OFL, see `assets/fonts/LICENSES.txt`)
- A Content-Security-Policy meta tag on every page: same-origin scripts plus one hashed inline theme snippet, no `unsafe-inline`, and network access limited to the site itself, the GitHub API and raw files
- `rel="noopener noreferrer"` on external links and a strict referrer policy
- Remote text is inserted with `textContent`, never as HTML
- [`/.well-known/security.txt`](https://e26180.github.io/.well-known/security.txt) (RFC 9116); `.nojekyll` lets GitHub Pages publish the dot-directory
- GitHub Pages does not allow custom response headers, so protections that only work as headers (`frame-ancestors`, `Permissions-Policy`) cannot be set here

## Structure

```
index.html              home
lab/index.html          Network & Firewall Lab case study
maths.html              CS Maths & Tools (earlier project)
404.html                not-found page
styles.css              all styles, dark and light themes
assets/js/main.js       theme, typed line, reveal, nav, smooth scroll; lazy-loads the modules below
assets/js/inside.js     Inside the Mac: scroll progress to scene, labels, scene buttons
assets/css/inside.css   Inside the Mac: the 3D machine, windows and captions
assets/js/badge.js      lanyard physics
assets/js/lab.js        scrollytelling for the lab diagram
assets/js/notebook.js   GitHub API feed
assets/js/terminal.js   mini terminal
assets/js/maths.js      binary converter
assets/fonts/           Geist, Geist Mono, Instrument Serif (woff2, latin subset)
assets/vendor/          Lenis
.well-known/security.txt
```

If the inline theme snippet in a page's `<head>` changes, its `sha256-` hash in that page's CSP must be updated too, or the browser will block it.

## Links

[Live site](https://e26180.github.io/) · [GitHub](https://github.com/E26180) · [LinkedIn](https://www.linkedin.com/in/ahmet-ege-baykoz-6897b635b/)
