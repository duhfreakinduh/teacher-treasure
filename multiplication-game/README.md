---
title: Fact Quest
e moji: ✖️
colorFrom: purple
colorTo: indigo
sdk: static
app_file: index.html
pinned: false
short_description: A fun multiplication-facts learning game for kids.
---

# Fact Quest — Multiplication Adventure

A mobile-first multiplication game for facts ×1 through ×12.

## Game modes

- **Adventure:** 10-question rounds with three hearts.
- **Speed Run:** solve as many facts as possible in 60 seconds.
- **Boss Battle:** correct answers damage the dragon.
- **Practice:** endless, no-pressure practice with hints.
- **Daily Quest:** a 12-question challenge with bonus XP.

## Learning features

- Choose one or more fact families from ×1 through ×12.
- Weak or recently missed fact families are automatically weighted more often.
- Tracks attempts, accuracy, mastery stars, streaks, XP, levels and badges.
- Progress is stored only in the browser using `localStorage`.
- No account, analytics, ads, tracking or external API calls.

## Phone app / PWA features

- Responsive phone-first design.
- Install manifest for Add to Home Screen where supported.
- Service worker caches the game for offline play after the first successful load.
- Sound effects use the browser Web Audio API; supported phones also vibrate on answers.

## Hugging Face Space

This folder is ready to be used as the root of a **Static HTML Hugging Face Space**. The Space README front matter uses `sdk: static` and `app_file: index.html`.

Copy these files to the root of the Space:

`README.md`, `index.html`, `style.css`, `app.js`, `manifest.webmanifest`, `sw.js`, `icon.svg`

## Local testing

Run any static web server from this folder. Example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

> Service workers require HTTP(S), so opening `index.html` directly as a `file://` URL is not a complete PWA test.
