import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import type { AppQuestion } from './ui/labels.ts';
import { RichText } from './ui/QuestionParts.tsx';

const bank: AppQuestion[] = [
  {
    id: 'q1',
    topic: 'sql',
    difficulty: 'avanzado',
    type: 'concept',
    prompt: '¿Pregunta?',
    options: [
      { id: 'a', text: 'Uno' },
      { id: 'b', text: 'Dos' },
    ],
    correct: 'a',
    explanation: 'Porque sí.',
  },
];

describe('App', () => {
  const html = renderToString(<App bank={bank} storage={null} />);

  it('muestra el inicio con los tres modos', () => {
    expect(html).toContain('DevQuiz');
    expect(html).toContain('Empezar reto rápido');
    expect(html).toContain('Empezar reto a medida');
    expect(html).toContain('Repasar fallos');
  });

  it('avisa cuando el filtro tiene pocas preguntas', () => {
    expect(html).toContain('Solo hay');
    expect(html).toContain('el reto será más corto');
  });

  it('avisa si no se puede guardar el progreso', () => {
    expect(html).toContain('no permite guardar datos');
  });

  it('explica por qué el repaso no está disponible', () => {
    expect(html).toContain('Aún no tienes preguntas falladas');
  });

  it('no permite empezar un reto a medida si no hay preguntas', () => {
    const empty = renderToString(<App bank={[]} storage={null} />);
    expect(empty).toContain('No hay preguntas con este filtro');
    expect(empty).toMatch(/<button[^>]*type="submit"[^>]*disabled/);
  });
});

describe('RichText', () => {
  it('muestra como código lo que va entre comillas invertidas', () => {
    expect(renderToString(<RichText text="Usa `map` aquí" />)).toBe('Usa <code>map</code> aquí');
  });

  it('deja intacto el texto sin comillas invertidas', () => {
    expect(renderToString(<RichText text="a < b" />)).toBe('a &lt; b');
  });
});
