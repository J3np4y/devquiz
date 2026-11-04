import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('muestra el nombre de la aplicación', () => {
    expect(renderToString(<App />)).toContain('DevQuiz');
  });
});
