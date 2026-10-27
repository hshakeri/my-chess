// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { MoveTree } from '../../../src/components/MoveTree';
import { evansGambitDestruction } from '../../../src/curriculum/openings';

const ITALIAN = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'];

const node = (path: string): HTMLElement => {
  const el = document.querySelector(`[data-path="${path}"]`);
  if (!el) throw new Error(`node ${path} not rendered`);
  return el as HTMLElement;
};

describe('MoveTree interactions (jsdom)', () => {
  afterEach(() => cleanup());

  it('expands and collapses a branch with its toggle', () => {
    render(<MoveTree lesson={evansGambitDestruction} currentPath={[...ITALIAN, 'Nf6']} />);
    const dxc3 = 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Bc5 d4 exd4 O-O dxc3';
    expect(node(dxc3).getAttribute('data-expanded')).toBe('false');
    expect(document.querySelector('[data-node="Qb3"]')).toBeNull();

    fireEvent.click(node(dxc3).querySelector('[data-action="toggle-branch"]')!);
    expect(node(dxc3).getAttribute('data-expanded')).toBe('true');
    expect(document.querySelector('[data-node="Qb3"]')).toBeTruthy();

    fireEvent.click(node(dxc3).querySelector('[data-action="toggle-branch"]')!);
    expect(node(dxc3).getAttribute('data-expanded')).toBe('false');
    expect(document.querySelector('[data-node="Qb3"]')).toBeNull();

    // A branch on the current path can be collapsed too
    const nf6 = 'e4 e5 Nf3 Nc6 Bc4 Nf6';
    expect(document.querySelector('[data-node="d3"]')).toBeTruthy();
    fireEvent.click(node(nf6).querySelector('[data-action="toggle-branch"]')!);
    expect(document.querySelector('[data-node="d3"]')).toBeNull();
  });

  it('reports the SAN path of a clicked node, on the main line and inside a branch', () => {
    const onSelectPath = vi.fn();
    render(<MoveTree lesson={evansGambitDestruction} currentPath={[...ITALIAN, 'Nf6']} onSelectPath={onSelectPath} />);

    fireEvent.click(node('e4 e5 Nf3').querySelector('[data-action="select-node"]')!);
    expect(onSelectPath).toHaveBeenLastCalledWith(['e4', 'e5', 'Nf3']);

    fireEvent.click(node('e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Bc5').querySelector('[data-action="select-node"]')!);
    expect(onSelectPath).toHaveBeenLastCalledWith([...ITALIAN, 'Nf6', 'd3', 'Bc5']);

    fireEvent.click(node('e4 e5 Nf3 Nc6 Bc4 Nd4').querySelector('[data-action="select-node"]')!);
    expect(onSelectPath).toHaveBeenLastCalledWith([...ITALIAN, 'Nd4']);
  });
});
