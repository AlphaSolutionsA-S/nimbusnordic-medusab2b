import { render, screen } from '@testing-library/react';
import { ClaimsUnavailable } from '@/modules/account/components/claims-unavailable';

describe('ClaimsUnavailable', () => {
  it('TC-3: Renders unavailable state with customer-safe message', () => {
    render(<ClaimsUnavailable />);

    // Component renders with correct testid
    expect(screen.getByTestId('claims-unavailable')).toBeInTheDocument();

    // Message is friendly and safe (no internals, no credentials)
    const message = screen.getByText(/claims information is temporarily unavailable/i);
    expect(message).toBeInTheDocument();

    // Verify no stack traces, Payload internals, or credentials exposed
    expect(screen.queryByText(/payload/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/401|403|500/)).not.toBeInTheDocument();
  });
});
