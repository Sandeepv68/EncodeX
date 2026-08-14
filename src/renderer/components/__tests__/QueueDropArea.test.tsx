import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import QueueDropArea from '../QueueDropArea';
import { INDICATOR_HEIGHT } from '../../styles/QueueDropArea.styles';

const { dndState } = vi.hoisted(() => ({
  dndState: { active: null, over: null },
}));

vi.mock('@dnd-kit/core', () => ({
  useDndContext: () => dndState,
}));

const GAP = 16;

function makeRect(top: number, height: number) {
  return { top, height, bottom: top + height };
}

function renderArea(children: ReactNode = <div data-testid="child">content</div>) {
  const view = render(<QueueDropArea>{children}</QueueDropArea>);
  const root = view.container.firstElementChild as HTMLElement;
  return { ...view, root };
}

describe('QueueDropArea', () => {
  beforeEach(() => {
    dndState.active = null;
    dndState.over = null;
  });

  it('renders the children with no overlay layers when no drag is active', () => {
    const { root } = renderArea();
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(root.children).toHaveLength(1);
  });

  it('shows the drag frame while a drag is active but no item is hovered', () => {
    dndState.active = { id: '1', rect: { current: { translated: makeRect(40, 60) } } };
    dndState.over = null;

    const { root, rerender } = renderArea();
    rerender(
      <QueueDropArea>
        <div data-testid="child">content</div>
      </QueueDropArea>,
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(root.children).toHaveLength(2);
  });

  it('positions the indicator in the gap before the hovered card', () => {
    dndState.active = { id: '1', rect: { current: { translated: makeRect(40, 60) } } };
    dndState.over = { id: '2', rect: makeRect(100, 50) };

    const { root, rerender } = renderArea();
    rerender(
      <QueueDropArea>
        <div data-testid="child">content</div>
      </QueueDropArea>,
    );

    expect(root.children).toHaveLength(3);
    expect(getComputedStyle(root.lastElementChild as HTMLElement).top).toBe(
      `${100 - GAP / 2 - INDICATOR_HEIGHT / 2}px`,
    );
  });

  it('positions the indicator in the gap after the hovered card', () => {
    dndState.active = { id: '1', rect: { current: { translated: makeRect(200, 60) } } };
    dndState.over = { id: '2', rect: makeRect(100, 50) };

    const { root, rerender } = renderArea();
    rerender(
      <QueueDropArea>
        <div data-testid="child">content</div>
      </QueueDropArea>,
    );

    expect(root.children).toHaveLength(3);
    expect(getComputedStyle(root.lastElementChild as HTMLElement).top).toBe(
      `${150 + GAP / 2 - INDICATOR_HEIGHT / 2}px`,
    );
  });

  it('skips the indicator when the active item has no translated rect', () => {
    dndState.active = { id: '1', rect: { current: { translated: null } } };
    dndState.over = { id: '2', rect: makeRect(100, 50) };

    const { root, rerender } = renderArea();
    rerender(
      <QueueDropArea>
        <div data-testid="child">content</div>
      </QueueDropArea>,
    );

    expect(root.children).toHaveLength(2);
  });

  it('computes the indicator top from the container offset', () => {
    const containerTop = 40;
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: containerTop,
    } as DOMRect);

    dndState.active = { id: '1', rect: { current: { translated: makeRect(40, 60) } } };
    dndState.over = { id: '2', rect: makeRect(100, 50) };

    const { root, rerender } = renderArea();
    rerender(
      <QueueDropArea>
        <div data-testid="child">content</div>
      </QueueDropArea>,
    );

    expect(getComputedStyle(root.lastElementChild as HTMLElement).top).toBe(
      `${100 - containerTop - GAP / 2 - INDICATOR_HEIGHT / 2}px`,
    );

    spy.mockRestore();
  });
});
