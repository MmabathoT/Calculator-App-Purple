(function () {
  const displayEl = document.getElementById('display');
  const expressionEl = document.getElementById('expression');
  const historyEl = document.getElementById('history');
  const errorToastEl = document.getElementById('error-toast');

  errorToastEl.addEventListener('animationend', () => {
    errorToastEl.hidden = true;
    errorToastEl.classList.remove('error-toast-show');
  });

  const state = {
    expression: '',
    angleMode: 'DEG',
    result: '',
    error: false,
  };

  const converterData = {
    'Weight and mass': { units: { mg: 0.000001, g: 0.001, kg: 1, tonne: 1000, oz: 0.028349523125, lb: 0.45359237 } },
    Temperature: { units: ['°C', '°F', 'K'] },
    Energy: { units: { J: 1, kJ: 1000, cal: 4.184, kcal: 4184, Wh: 3600, kWh: 3600000 } },
    Area: { units: { 'mm²': 0.000001, 'cm²': 0.0001, 'm²': 1, 'km²': 1000000, hectare: 10000, acre: 4046.8564224, 'ft²': 0.09290304 } },
    Speed: { units: { 'm/s': 1, 'km/h': 1 / 3.6, mph: 0.44704, knot: 0.5144444444 } },
    Time: { units: { ms: 0.001, s: 1, min: 60, h: 3600, day: 86400, week: 604800 } },
    Power: { units: { W: 1, kW: 1000, MW: 1000000, hp: 745.699872 } },
    Data: { units: { bit: 1, byte: 8, KB: 8000, MB: 8000000, GB: 8000000000, TB: 8000000000000, KiB: 8192, MiB: 8388608, GiB: 8589934592 } },
    Pressure: { units: { Pa: 1, kPa: 1000, bar: 100000, atm: 101325, psi: 6894.757293, mmHg: 133.322387 } },
    Angle: { units: { degree: 1, radian: 180 / Math.PI, gradian: 0.9, revolution: 360 } },
    Volume: { units: { mL: 0.001, L: 1, 'm³': 1000, tsp: 0.004928921594, tbsp: 0.01478676478, 'fl oz': 0.02957352956, cup: 0.2365882365, pint: 0.473176473, quart: 0.946352946, gallon: 3.785411784 } },
    Length: { units: { mm: 0.001, cm: 0.01, m: 1, km: 1000, inch: 0.0254, foot: 0.3048, yard: 0.9144, mile: 1609.344 } },
  };
  const currencyCodes = ['USD', 'EUR', 'GBP', 'ZAR', 'AUD', 'CAD', 'JPY', 'CNY', 'INR', 'CHF', 'NZD'];
  let currentMode = 'standard';
  let currentCategory = 'Currency';

  function getSavedTheme() {
    try {
      const savedTheme = localStorage.getItem('tally-theme');
      return ['system', 'light', 'dark'].includes(savedTheme) ? savedTheme : 'system';
    } catch (error) {
      document.getElementById('theme-status').textContent = `Unable to load the saved theme: ${error.message}`;
      return 'system';
    }
  }

  function applyTheme(theme) {
    const dark = theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const select = document.getElementById('theme-select');
    if (select.value !== theme) select.value = theme;
    try {
      localStorage.setItem('tally-theme', theme);
      document.getElementById('theme-status').textContent = theme === 'system'
        ? 'Following your device appearance setting.'
        : `${theme === 'dark' ? 'Dark' : 'Light'} theme selected.`;
    } catch (error) {
      document.getElementById('theme-status').textContent = `Theme applied, but could not be saved: ${error.message}`;
    }
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return 'Error';
    if (Object.is(value, -0)) value = 0;
    return Number(value.toPrecision(12)).toLocaleString('en-US', {
      maximumSignificantDigits: 12,
      useGrouping: true,
    });
  }

  function tokenize(source) {
    const tokens = [];
    const pattern = /\s*((?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:e[+-]?\d+)?|pi|π|sin|cos|tan|sqrt|ln|log|abs|x|e|[()+\-−×÷*/^!%])/igy;
    let position = 0;

    while (position < source.length) {
      pattern.lastIndex = position;
      const match = pattern.exec(source);
      if (!match) throw new Error('Invalid expression');
      tokens.push(match[1].toLowerCase());
      position = pattern.lastIndex;
    }
    return tokens;
  }

  function evaluate(source, graphX = 0) {
    const tokens = tokenize(source);
    let index = 0;
    const peek = () => tokens[index];
    const take = () => tokens[index++];

    function parseExpression() {
      let value = parseTerm();
      while (peek() === '+' || peek() === '-' || peek() === '−') {
        const operator = take();
        const right = parseTerm();
        value = operator === '+' ? value + right : value - right;
      }
      return value;
    }

    function parseTerm() {
      let value = parseUnary();
      while (peek() === '*' || peek() === '×' || peek() === '/' || peek() === '÷') {
        const operator = take();
        const right = parseUnary();
        if (operator === '/' || operator === '÷') {
          if (right === 0) throw new Error('Cannot divide by zero');
          value /= right;
        } else {
          value *= right;
        }
      }
      return value;
    }

    function parseUnary() {
      if (peek() === '+' || peek() === '-' || peek() === '−') {
        const operator = take();
        const value = parseUnary();
        return operator === '+' ? value : -value;
      }
      return parsePower();
    }

    function parsePower() {
      let value = parsePostfix();
      if (peek() === '^') {
        take();
        value = Math.pow(value, parseUnary());
      }
      return value;
    }

    function parsePostfix() {
      let value = parsePrimary();
      while (peek() === '!' || peek() === '%') {
        const operator = take();
        if (operator === '%') {
          value /= 100;
        } else {
          if (value < 0 || !Number.isInteger(value) || value > 170) {
            throw new Error('Factorial requires a whole number from 0 to 170');
          }
          let product = 1;
          for (let number = 2; number <= value; number++) product *= number;
          value = product;
        }
      }
      return value;
    }

    function parsePrimary() {
      const token = take();
      if (token === undefined) throw new Error('Incomplete expression');
      if (token === '(') {
        const value = parseExpression();
        if (take() !== ')') throw new Error('Missing closing parenthesis');
        return value;
      }

      if (token === 'pi' || token === 'π') return Math.PI;
      if (token === 'e') return Math.E;
      if (token === 'x') return graphX;
      if (/^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:e[+-]?\d+)?$/.test(token)) return Number(token);

      if (['sin', 'cos', 'tan', 'sqrt', 'ln', 'log', 'abs'].includes(token)) {
        if (take() !== '(') throw new Error('Function needs parentheses');
        const argument = parseExpression();
        if (take() !== ')') throw new Error('Missing closing parenthesis');
        const angle = state.angleMode === 'DEG' ? argument * Math.PI / 180 : argument;
        switch (token) {
          case 'sin': return Math.sin(angle);
          case 'cos': return Math.cos(angle);
          case 'tan': return Math.tan(angle);
          case 'sqrt': return Math.sqrt(argument);
          case 'ln': return Math.log(argument);
          case 'log': return Math.log10(argument);
          case 'abs': return Math.abs(argument);
        }
      }
      throw new Error('Invalid expression');
    }

    if (tokens.length === 0) throw new Error('Enter an expression');
    const result = parseExpression();
    if (index !== tokens.length || !Number.isFinite(result)) throw new Error('Invalid result');
    return result;
  }

  function render() {
    if (!state.expression) {
      displayEl.textContent = '0';
      expressionEl.textContent = '';
      return;
    }

    expressionEl.textContent = state.expression;
    if (state.error) {
      displayEl.textContent = 'Error';
      return;
    }
    try {
      displayEl.textContent = formatNumber(evaluate(state.expression));
    } catch {
      displayEl.textContent = state.expression;
    }
  }

  function isValueEnding(source) {
    return /(?:[0-9)]|π|e|!|%)$/.test(source);
  }

  function append(value) {
    if (state.error) clear();
    const startsFactor = /^(?:π|e|\(|sin\(|cos\(|tan\(|sqrt\(|ln\(|log\(|abs\()/.test(value);
    const endsConstantOrGroup = /(?:\)|π|e|!|%)$/.test(state.expression);
    if (state.expression && isValueEnding(state.expression) &&
        (startsFactor || (endsConstantOrGroup && /^(?:[0-9]|\.)/.test(value)))) {
      state.expression += '×';
    }
    state.expression += value;
    state.result = '';
    render();
  }

  function inputDigit(digit) {
    if (state.error) clear();
    if (state.result !== '') clear();
    const currentNumber = state.expression.match(/(?:^|[+\-−×÷*/^(])(-?(?:\d+\.?\d*|\.\d*))$/);
    if (currentNumber && currentNumber[1].replace('.', '').length >= 12) return;
    if (currentNumber) {
      state.expression += digit;
      render();
    } else {
      append(digit);
    }
  }

  function inputDecimal() {
    if (state.error) clear();
    if (state.result !== '') clear();
    const currentNumber = state.expression.match(/(?:^|[+\-−×÷*/^(])(-?(?:\d+\.?\d*|\.\d*))$/);
    if (currentNumber && currentNumber[1].includes('.')) return;
    if (currentNumber) {
      state.expression += '.';
      render();
    } else {
      append('0.');
    }
  }

  function setMode(mode, category) {
    currentMode = mode;
    if (category) currentCategory = category;
    const isCalculator = mode === 'standard' || mode === 'scientific';
    document.getElementById('calculator-view').hidden = !isCalculator;
    document.getElementById('mode-panel').hidden = isCalculator;
    document.querySelectorAll('.tool-view').forEach((view) => { view.hidden = true; });
    document.querySelectorAll('.key-scientific').forEach((key) => {
      key.hidden = mode === 'standard';
    });
    document.getElementById('mode-title').textContent = mode === 'converter' ? currentCategory : ({
      standard: 'Standard',
      scientific: 'Scientific',
      graphing: 'Graphing',
      programmer: 'Programmer',
      date: 'Date calculation',
      settings: 'Settings',
    })[mode];

    if (!isCalculator) {
      const viewId = mode === 'converter' ? 'converter-view' : `${mode}-view`;
      document.getElementById(viewId).hidden = false;
    }
    if (mode === 'converter') setupConverter(currentCategory);
    if (mode === 'graphing') drawGraph();
    if (mode === 'programmer') updateProgrammer();
    if (mode === 'date') updateDateCalculation();

    document.querySelectorAll('.mode-option').forEach((option) => {
      option.classList.toggle('selected',
        option.dataset.mode === mode &&
        (mode !== 'converter' || option.dataset.category === currentCategory));
    });
    closeModeMenu();
  }

  function closeModeMenu() {
    document.getElementById('mode-menu').hidden = true;
    document.getElementById('menu-backdrop').hidden = true;
    document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false');
  }

  function setupConverter(category) {
    const title = document.getElementById('converter-title');
    const from = document.getElementById('converter-from');
    const to = document.getElementById('converter-to');
    const status = document.getElementById('converter-status');
    title.textContent = category;
    status.textContent = category === 'Currency' ? 'Rates provided by Frankfurter; internet connection required.' : '';
    let units;
    if (category === 'Currency') {
      units = currencyCodes;
    } else {
      const definition = converterData[category];
      units = Array.isArray(definition.units) ? definition.units : Object.keys(definition.units);
    }
    const previousFrom = from.value;
    const previousTo = to.value;
    from.replaceChildren(...units.map((unit) => new Option(unit, unit)));
    to.replaceChildren(...units.map((unit) => new Option(unit, unit)));
    from.value = units.includes(previousFrom) ? previousFrom : units[0];
    to.value = units.includes(previousTo) ? previousTo : units[Math.min(1, units.length - 1)];
    document.getElementById('converter-result').textContent = '';
  }

  function convertTemperature(value, from, to) {
    const celsius = from === '°C' ? value : from === '°F' ? (value - 32) * 5 / 9 : value - 273.15;
    return to === '°C' ? celsius : to === '°F' ? celsius * 9 / 5 + 32 : celsius + 273.15;
  }

  async function convert() {
    const amount = Number(document.getElementById('converter-amount').value);
    const from = document.getElementById('converter-from').value;
    const to = document.getElementById('converter-to').value;
    const result = document.getElementById('converter-result');
    const status = document.getElementById('converter-status');
    if (!Number.isFinite(amount)) {
      result.textContent = 'Enter a valid amount.';
      return;
    }

    if (currentCategory === 'Currency') {
      if (from === to) {
        result.textContent = `${formatNumber(amount)} ${to}`;
        status.textContent = 'Same currency selected; no exchange rate needed.';
        return;
      }
      result.textContent = 'Loading exchange rate…';
      status.textContent = '';
      try {
        const response = await fetch(`https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`);
        if (!response.ok) throw new Error(`Rate service returned HTTP ${response.status}.`);
        const data = await response.json();
        const rate = data.rates && data.rates[to];
        if (!Number.isFinite(rate)) throw new Error('The rate service did not return the selected currency.');
        result.textContent = `${formatNumber(amount * rate)} ${to}`;
        status.textContent = `Rate: 1 ${from} = ${formatNumber(rate)} ${to} · Source: Frankfurter`;
      } catch (error) {
        result.textContent = 'Currency conversion is unavailable.';
        status.textContent = `Could not retrieve exchange rate: ${error.message}`;
      }
      return;
    }

    let converted;
    if (currentCategory === 'Temperature') {
      converted = convertTemperature(amount, from, to);
    } else {
      const units = converterData[currentCategory].units;
      converted = amount * units[from] / units[to];
    }
    result.textContent = `${formatNumber(converted)} ${to}`;
    status.textContent = '';
  }

  function drawGraph() {
    const canvas = document.getElementById('graph-canvas');
    const status = document.getElementById('graph-status');
    const minimum = Number(document.getElementById('graph-min').value);
    const maximum = Number(document.getElementById('graph-max').value);
    const expression = document.getElementById('graph-expression').value.trim();
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const context = canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const width = rect.width;
    const height = rect.height;
    context.clearRect(0, 0, width, height);

    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum >= maximum) {
      status.textContent = 'Enter a valid range where x min is less than x max.';
      return;
    }
    try {
      const samples = [];
      for (let index = 0; index <= Math.ceil(width * 1.5); index++) {
        const x = minimum + (maximum - minimum) * index / Math.ceil(width * 1.5);
        const y = evaluate(expression, x);
        if (Number.isFinite(y)) samples.push({ x, y });
      }
      if (samples.length < 2) throw new Error('This function has no plottable values in the selected range.');
      let minY = Math.min(...samples.map((point) => point.y));
      let maxY = Math.max(...samples.map((point) => point.y));
      if (minY === maxY) { minY -= 1; maxY += 1; }
      const padding = (maxY - minY) * 0.08;
      minY -= padding;
      maxY += padding;
      const toX = (x) => (x - minimum) / (maximum - minimum) * width;
      const toY = (y) => height - (y - minY) / (maxY - minY) * height;

      context.strokeStyle = '#e7e1ef';
      context.lineWidth = 1;
      context.beginPath();
      for (let index = 0; index <= 10; index++) {
        const x = index * width / 10;
        const y = index * height / 10;
        context.moveTo(x, 0); context.lineTo(x, height);
        context.moveTo(0, y); context.lineTo(width, y);
      }
      context.stroke();
      context.strokeStyle = '#8b8494';
      context.beginPath();
      if (minimum <= 0 && maximum >= 0) { context.moveTo(toX(0), 0); context.lineTo(toX(0), height); }
      if (minY <= 0 && maxY >= 0) { context.moveTo(0, toY(0)); context.lineTo(width, toY(0)); }
      context.stroke();

      context.strokeStyle = '#7c3aed';
      context.lineWidth = 2.5;
      context.beginPath();
      let drawing = false;
      let previousY;
      for (const point of samples) {
        const py = toY(point.y);
        if (!Number.isFinite(py) || (drawing && Math.abs(py - previousY) > height * 0.8)) {
          drawing = false;
          continue;
        }
        if (drawing) context.lineTo(toX(point.x), py);
        else context.moveTo(toX(point.x), py);
        previousY = py;
        drawing = true;
      }
      context.stroke();
      status.textContent = `y range: ${formatNumber(minY)} to ${formatNumber(maxY)}`;
    } catch (error) {
      status.textContent = `Unable to plot function: ${error.message}`;
    }
  }

  function parseProgrammerNumber(value, base) {
    const input = value.trim().replaceAll('_', '');
    if (!input || input.length > 130) throw new Error('Enter a number with no more than 128 digits.');
    const sign = input.startsWith('-') ? -1n : 1n;
    const digits = input.replace(/^[+-]/, '').replace(/^0[xob]/i, '');
    const patterns = { 2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^\d+$/, 16: /^[\da-f]+$/i };
    if (!patterns[base].test(digits)) throw new Error(`Enter a valid base-${base} number.`);
    const prefix = { 2: '0b', 8: '0o', 10: '', 16: '0x' }[base];
    return sign * BigInt(`${prefix}${digits}`);
  }

  function updateProgrammer() {
    const base = Number(document.getElementById('programmer-base').value);
    const operation = document.getElementById('programmer-operation').value;
    const secondLabel = document.getElementById('programmer-b-label');
    const result = document.getElementById('programmer-result');
    secondLabel.hidden = operation === 'not';
    try {
      const a = parseProgrammerNumber(document.getElementById('programmer-a').value, base);
      const b = operation === 'not' ? 0n : parseProgrammerNumber(document.getElementById('programmer-b').value, base);
      let value;
      switch (operation) {
        case 'add': value = a + b; break;
        case 'subtract': value = a - b; break;
        case 'multiply': value = a * b; break;
        case 'divide':
          if (b === 0n) throw new Error('Cannot divide by zero.');
          value = a / b;
          break;
        case 'and': value = a & b; break;
        case 'or': value = a | b; break;
        case 'xor': value = a ^ b; break;
        case 'not': value = ~a; break;
        case 'left':
        case 'right':
          if (b < 0n || b > 4096n) throw new Error('Shift amount must be from 0 to 4096.');
          value = operation === 'left' ? a << b : a >> b;
          break;
        default: throw new Error('Select a supported operation.');
      }
      result.innerHTML = '';
      for (const [label, radix] of [['DEC', 10], ['HEX', 16], ['OCT', 8], ['BIN', 2]]) {
        const row = document.createElement('div');
        row.className = 'base-result';
        const name = document.createElement('strong');
        name.textContent = label;
        const output = document.createElement('span');
        output.textContent = value.toString(radix).toUpperCase();
        row.append(name, output);
        result.append(row);
      }
    } catch (error) {
      result.textContent = error.message;
    }
  }

  function parseDateInput(value) {
    const parts = value.split('-').map(Number);
    if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) throw new Error('Select a valid date.');
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    if (date.getUTCFullYear() !== parts[0] || date.getUTCMonth() !== parts[1] - 1 || date.getUTCDate() !== parts[2]) {
      throw new Error('Select a valid date.');
    }
    return date;
  }

  function updateDateCalculation() {
    const operation = document.getElementById('date-operation').value;
    const endLabel = document.getElementById('date-end-label');
    const daysLabel = document.getElementById('date-days-label');
    const output = document.getElementById('date-result');
    endLabel.hidden = operation !== 'difference';
    daysLabel.hidden = operation === 'difference';
    try {
      const start = parseDateInput(document.getElementById('date-start').value);
      if (operation === 'difference') {
        const end = parseDateInput(document.getElementById('date-end').value);
        const difference = Math.round((end - start) / 86400000);
        output.textContent = `${Math.abs(difference)} day${Math.abs(difference) === 1 ? '' : 's'}${difference < 0 ? ' earlier' : ''}`;
      } else {
        const days = Number(document.getElementById('date-days').value);
        if (!Number.isInteger(days) || Math.abs(days) > 1000000) throw new Error('Enter a whole number of days from -1,000,000 to 1,000,000.');
        start.setUTCDate(start.getUTCDate() + (operation === 'add' ? days : -days));
        output.textContent = start.toISOString().slice(0, 10);
      }
    } catch (error) {
      output.textContent = error.message;
    }
  }

  function backspace() {
    if (state.error) {
      clear();
      return;
    }
    if (!state.expression) return;
    const functionToken = state.expression.match(/(?:sin|cos|tan|sqrt|abs|log|ln)\($/);
    state.expression = state.expression.slice(0, state.expression.length - (functionToken ? functionToken[0].length : 1));
    render();
  }

  function clear() {
    state.expression = '';
    state.result = '';
    state.error = false;
    errorToastEl.hidden = true;
    render();
  }

  function calculate() {
    if (!state.expression) return;
    try {
      const result = evaluate(state.expression);
      const formatted = formatNumber(result);
      addHistoryEntry(state.expression, formatted);
      state.result = String(result);
      state.expression = state.result;
      state.error = false;
    } catch {
      state.error = true;
      errorToastEl.hidden = false;
      errorToastEl.classList.remove('error-toast-show');
      void errorToastEl.offsetWidth;
      errorToastEl.classList.add('error-toast-show');
    }
    render();
  }

  function addHistoryEntry(expression, result) {
    const entry = document.createElement('p');
    entry.className = 'history-entry';
    entry.textContent = `${expression} = ${result}`;
    historyEl.appendChild(entry);
    while (historyEl.querySelectorAll('.history-entry').length > 2) {
      historyEl.removeChild(historyEl.querySelector('.history-entry'));
    }
  }

  document.querySelector('.keys').addEventListener('click', (event) => {
    const button = event.target.closest('.key');
    if (!button) return;

    switch (button.dataset.action) {
      case 'digit':
        inputDigit(button.dataset.digit);
        break;
      case 'decimal':
        inputDecimal();
        break;
      case 'append':
        append(button.dataset.value);
        break;
      case 'clear':
        clear();
        historyEl.replaceChildren();
        break;
      case 'backspace':
        backspace();
        break;
      case 'toggle-angle':
        state.angleMode = state.angleMode === 'DEG' ? 'RAD' : 'DEG';
        button.textContent = state.angleMode;
        render();
        break;
      case 'equals':
        calculate();
        break;
    }
  });

  document.getElementById('menu-toggle').addEventListener('click', () => {
    const menu = document.getElementById('mode-menu');
    const open = menu.hidden;
    menu.hidden = !open;
    document.getElementById('menu-backdrop').hidden = !open;
    document.getElementById('menu-toggle').setAttribute('aria-expanded', String(open));
  });
  document.getElementById('menu-backdrop').addEventListener('click', closeModeMenu);
  document.getElementById('mode-menu').addEventListener('click', (event) => {
    const option = event.target.closest('.mode-option');
    if (option) setMode(option.dataset.mode, option.dataset.category);
  });
  document.getElementById('minimize-button').addEventListener('click', (event) => {
    closeModeMenu();
    const minimized = document.querySelector('.calculator').classList.toggle('is-minimized');
    event.currentTarget.setAttribute('aria-pressed', String(minimized));
    event.currentTarget.setAttribute('aria-label', minimized ? 'Restore app' : 'Minimize app');
    event.currentTarget.title = minimized ? 'Restore' : 'Minimize';
    document.getElementById('window-control-status').textContent = minimized
      ? 'Calculator minimized. Use Restore to show it again.'
      : 'Calculator restored.';
  });
  document.getElementById('expand-button').addEventListener('click', async () => {
    const calculator = document.querySelector('.calculator');
    const status = document.getElementById('window-control-status');
    try {
      if (document.fullscreenElement === calculator) {
        await document.exitFullscreen();
      } else if (document.fullscreenEnabled && calculator.requestFullscreen) {
        await calculator.requestFullscreen();
      } else {
        status.textContent = 'Fullscreen is not available in this browser.';
      }
    } catch (error) {
      status.textContent = `Could not change fullscreen mode: ${error.message}`;
    }
  });
  document.addEventListener('fullscreenchange', () => {
    const expanded = document.fullscreenElement === document.querySelector('.calculator');
    const button = document.getElementById('expand-button');
    button.textContent = expanded ? '⧉' : '□';
    button.setAttribute('aria-label', expanded ? 'Exit fullscreen' : 'Enter fullscreen');
    button.title = expanded ? 'Exit fullscreen' : 'Expand';
    document.getElementById('window-control-status').textContent = expanded
      ? 'Calculator is fullscreen.'
      : 'Exited fullscreen.';
  });
  document.getElementById('close-button').addEventListener('click', async () => {
    closeModeMenu();
    document.querySelector('.calculator').classList.remove('is-minimized');
    document.querySelector('.calculator').classList.add('is-closed');
    document.getElementById('closed-screen').hidden = false;
    document.getElementById('minimize-button').setAttribute('aria-pressed', 'false');
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (error) {
        document.getElementById('window-control-status').textContent = `Could not exit fullscreen: ${error.message}`;
      }
    }
  });
  document.getElementById('reopen-button').addEventListener('click', () => {
    document.getElementById('closed-screen').hidden = true;
    document.querySelector('.calculator').classList.remove('is-closed');
  });

  document.getElementById('graph-expression').addEventListener('input', drawGraph);
  document.getElementById('graph-min').addEventListener('input', drawGraph);
  document.getElementById('graph-max').addEventListener('input', drawGraph);
  window.addEventListener('resize', () => { if (currentMode === 'graphing') drawGraph(); });

  ['programmer-base', 'programmer-a', 'programmer-b', 'programmer-operation'].forEach((id) => {
    document.getElementById(id).addEventListener('input', updateProgrammer);
    document.getElementById(id).addEventListener('change', updateProgrammer);
  });
  document.getElementById('date-operation').addEventListener('change', updateDateCalculation);
  ['date-start', 'date-end', 'date-days'].forEach((id) => {
    document.getElementById(id).addEventListener('input', updateDateCalculation);
    document.getElementById(id).addEventListener('change', updateDateCalculation);
  });
  document.getElementById('convert-button').addEventListener('click', convert);
  document.getElementById('swap-units').addEventListener('click', () => {
    const from = document.getElementById('converter-from');
    const to = document.getElementById('converter-to');
    const previous = from.value;
    from.value = to.value;
    to.value = previous;
    if (currentCategory !== 'Currency') convert();
  });
  document.getElementById('converter-from').addEventListener('change', () => {
    if (currentCategory !== 'Currency') convert();
  });
  document.getElementById('converter-to').addEventListener('change', () => {
    if (currentCategory !== 'Currency') convert();
  });

  document.getElementById('theme-select').addEventListener('change', (event) => {
    applyTheme(event.target.value);
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (document.getElementById('theme-select').value === 'system') applyTheme('system');
  });

  window.addEventListener('keydown', (event) => {
    if (currentMode !== 'standard' && currentMode !== 'scientific') return;
    if (event.target.matches('input, select, textarea, [contenteditable="true"]')) return;
    if (event.key >= '0' && event.key <= '9') inputDigit(event.key);
    else if (event.key === '.') inputDecimal();
    else if ('+-*/^()'.includes(event.key)) append(event.key);
    else if (event.key === 'Enter' || event.key === '=') {
      event.preventDefault();
      calculate();
    } else if (event.key === 'Backspace') backspace();
    else if (event.key === 'Escape') clear();
    else if (event.key === '%') append('%');
  });

  const today = new Date();
  const dateEnd = new Date(today);
  dateEnd.setDate(dateEnd.getDate() + 7);
  document.getElementById('date-start').value = today.toISOString().slice(0, 10);
  document.getElementById('date-end').value = dateEnd.toISOString().slice(0, 10);
  document.getElementById('copyright-year').textContent = String(new Date().getFullYear());
  applyTheme(getSavedTheme());
  setMode('standard');
  render();
})();
