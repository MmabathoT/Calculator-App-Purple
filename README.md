# Tally — a calculator

A responsive calculator with a purple interface, mode menu, and tools for
calculations, graphing, programmer arithmetic, date calculations, and unit
conversion.

## Features
- Standard and scientific calculator modes with live results and recent history
- Graphing for expressions using `x`, arithmetic, powers, constants, and supported functions
- Programmer arithmetic in decimal, hexadecimal, octal, and binary, including bitwise operations
- Date differences and adding or subtracting days
- Converters for currency, volume, length, weight and mass, temperature, energy, area, speed, time, power, data, pressure, and angle
- Settings for light, dark, or device-matched appearance, plus an About section with project links
- In-app minimize, fullscreen, and close/reopen controls (the close control keeps the browser tab open)
- Keyboard support for calculator input (`+ - * /`, `Enter`/`=`, `Backspace`, `Esc`, `%`)
- Layout adapts to phones, laptops, and desktop screens

Currency conversion retrieves current rates from the Frankfurter API and
requires an internet connection. The selected currency codes are sent to the
service; the amount is converted in the browser.

The selected appearance is saved in the browser. App name, version, copyright,
and project links are editable in the About section in `index.html`.

## Running it

No build step — it's plain HTML, CSS, and JavaScript.

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`, or open `index.html` directly in a browser.

## Files
- `index.html` — calculator and mode menu markup
- `style.css` — responsive interface and mode layouts
- `script.js` — calculation, graphing, date, programmer, and converter logic
