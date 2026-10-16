# Ahmet Ege Baykoz · Portfolio

Source of [e26180.github.io](https://e26180.github.io/), the portfolio of a Year 2 BSc (Hons) Computer Science with Cyber Security student at the University of York, seeking a 12-month industrial placement for 2027–28.

## What's inside

- **Hero:** a typed `ahmet@york:~$ whoami` line (skippable, off under reduced motion) and a draggable access pass on a lanyard, written as a small Verlet rope in plain JavaScript
- **Network & Firewall Lab case study:** an inline-SVG diagram of the home lab and the four labs as question → what I did → key result → security lesson
- **Latest from my lab notebook:** the newest write-ups from [security-notes](https://github.com/E26180/security-notes), fetched from the GitHub API with a session cache and a static fallback
- **Skills as evidence:** every skill links to where I used it
- **Mini terminal:** press <kbd>`</kbd> or the `>_` button and type `help`
- Light/dark theme, a 404 page ("Packet dropped.") and a social preview image

## Security hygiene

- Plain HTML, CSS and vanilla JavaScript: no build step, no frameworks, no third-party scripts, trackers or cookies
- A Content-Security-Policy meta tag on every page: same-origin scripts plus one hashed inline theme snippet, no `unsafe-inline`, and network access limited to the GitHub API and raw files
- `rel="noopener noreferrer"` on external links and a strict referrer policy
- Remote text is inserted with `textContent`, never as HTML
- [`/.well-known/security.txt`](https://e26180.github.io/.well-known/security.txt) (RFC 9116); `.nojekyll` lets GitHub Pages publish the dot-directory
- GitHub Pages does not allow custom response headers, so protections that only work as headers (`frame-ancestors`, `Permissions-Policy`) cannot be set here

## Structure

```
index.html            main page
maths.html            CS Maths & Tools (earlier project)
404.html              not-found page
styles.css            all styles, dark and light themes
assets/js/main.js     theme, typed line, nav, lazy-loads the modules below
assets/js/badge.js    lanyard physics
assets/js/notebook.js GitHub API feed
assets/js/terminal.js mini terminal
assets/js/maths.js    binary converter
.well-known/security.txt
```

If the inline theme snippet in the `<head>` changes, its `sha256-` hash in the CSP must be updated too, or the browser will block it.

## Links

[Live site](https://e26180.github.io/) · [GitHub](https://github.com/E26180) · [LinkedIn](https://www.linkedin.com/in/ahmet-ege-baykoz-6897b635b/)
