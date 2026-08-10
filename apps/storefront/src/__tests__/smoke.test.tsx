import { render, screen } from '@testing-library/react';

function Hello() {
  return <span>storefront tests online</span>;
}

describe('storefront test harness', () => {
  it('renders', () => {
    render(<Hello />);
    expect(screen.getByText('storefront tests online')).toBeInTheDocument();
  });
});
