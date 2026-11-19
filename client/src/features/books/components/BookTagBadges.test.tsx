import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BookTagBadges } from './BookTagBadges';

describe('BookTagBadges', () => {
    it.each([0, 1, 2])('shows %i tags without overflow', count => {
        const { container } = render(<BookTagBadges tags={Array.from({ length: count }, (_, id) => ({ id, name: String(id) }))} />);
        expect(container.querySelectorAll('span')).toHaveLength(count);
        expect(screen.queryByRole('button')).toBeNull();
    });
    it('sorts tags and reveals overflow', async () => {
        render(<BookTagBadges tags={['Z', 'B', 'A'].map((name, id) => ({ id, name }))} />);
        expect(screen.queryByText('Z')).toBeNull();
        expect(screen.getByText('A').compareDocumentPosition(screen.getByText('B')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Show 1 more tags' }));
        expect(await screen.findByText('Z')).toBeTruthy();
        fireEvent.keyDown(screen.getByText('Z'), { key: 'Escape' });
    });
});
