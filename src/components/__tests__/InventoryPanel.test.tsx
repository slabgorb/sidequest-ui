import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { InventoryPanel } from '../InventoryPanel';

const BASE_INVENTORY = {
  items: [
    { name: 'Elven Longbow', type: 'weapon', equipped: true, description: 'A finely crafted bow.' },
    { name: 'Healing Potion', type: 'consumable', quantity: 3, description: 'Restores health.' },
    { name: 'Iron Shield', type: 'armor', equipped: false, description: 'A sturdy shield.' },
  ],
  gold: 42,
};

describe('InventoryPanel', () => {
  it('renders all item names', () => {
    render(<InventoryPanel data={BASE_INVENTORY} />);
    expect(screen.getByText('Elven Longbow')).toBeInTheDocument();
    expect(screen.getByText('Healing Potion')).toBeInTheDocument();
    expect(screen.getByText('Iron Shield')).toBeInTheDocument();
  });

  it('shows equipped state for weapons/armor', () => {
    render(<InventoryPanel data={BASE_INVENTORY} />);
    // Equipped items should have a visual indicator
    const bow = screen.getByText('Elven Longbow').closest('[data-testid]');
    expect(bow).toHaveAttribute('data-equipped', 'true');

    const shield = screen.getByText('Iron Shield').closest('[data-testid]');
    expect(shield).toHaveAttribute('data-equipped', 'false');
  });

  it('shows quantity for consumables', () => {
    render(<InventoryPanel data={BASE_INVENTORY} />);
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });

  it('displays gold amount', () => {
    render(<InventoryPanel data={BASE_INVENTORY} />);
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it('renders with empty items list', () => {
    render(<InventoryPanel data={{ items: [], gold: 0 }} />);
    expect(screen.getByTestId('inventory-panel')).toBeInTheDocument();
  });

  it('renders item descriptions', () => {
    render(<InventoryPanel data={BASE_INVENTORY} />);
    expect(screen.getByText(/A finely crafted bow/)).toBeInTheDocument();
  });

  it('groups items by type', () => {
    render(<InventoryPanel data={BASE_INVENTORY} />);
    // Weapons, consumables, and armor should be distinguishable
    expect(screen.getByText(/weapon/i)).toBeInTheDocument();
    expect(screen.getByText(/consumable/i)).toBeInTheDocument();
  });

  it('has a root element with data-testid', () => {
    render(<InventoryPanel data={BASE_INVENTORY} />);
    expect(screen.getByTestId('inventory-panel')).toBeInTheDocument();
  });

  it('handles items without quantity field', () => {
    const data = {
      items: [{ name: 'Sword', type: 'weapon', equipped: true, description: 'Sharp.' }],
      gold: 10,
    };
    render(<InventoryPanel data={data} />);
    expect(screen.getByText('Sword')).toBeInTheDocument();
  });
});
