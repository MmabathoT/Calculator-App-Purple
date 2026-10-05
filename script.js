(function () {
  const displayEl = document.getElementById('display');
  const expressionEl = document.getElementById('expression');
  const historyEl = document.getElementById('history');

  const state = {
    expression: '',
    angleMode: 'DEG',
    result: '',
    error: false,
  };

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
    const pattern = /\s*((?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:e[+-]?\d+)?|pi|π|e|sin|cos|tan|sqrt|ln|log|abs|[()+\-−×÷*/^!%])/igy;
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

  function evaluate(source) {
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
      displayEl.textContent = '';
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

  window.addEventListener('keydown', (event) => {
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

  render();
})();
