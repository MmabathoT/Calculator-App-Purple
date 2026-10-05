# Tally — a calculator

A modern calculator with a dark, glassy purple-and-black interface. Built to
work equally well on a laptop or a phone: it sits as a floating card on
larger screens, and expands to fill the viewport like a native app on small
ones.

## Features
- Standard operations: add, subtract, multiply, divide
- Percent, sign toggle, decimal point, clear
- Compact history of your last couple of calculations
- Full keyboard support (digits, `+ - * /`, `Enter`/`=`, `Backspace`, `Esc`, `%`)
- Responsive layout, visible focus states, respects reduced-motion

## Running it
No build step — it's plain HTML, CSS, and JavaScript.

```bash
# from this folder
python3 -m http.server 8000
# then open http://localhost:8000
```

Or just open `index.html` directly in a browser.

## Files
- `index.html` — markup
- `style.css` — the glass panel, gradient equals key, and responsive layout
- `script.js` — calculator logic and keyboard bindings
