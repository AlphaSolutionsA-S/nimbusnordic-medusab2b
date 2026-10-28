import { getBusinessCentralEnvironmentForCountry } from '../business-central-environment';

describe('Business Central environment of a company country', () => {
  it.each(['NO', 'no', ' No ', '\tNO\n'])('routes %j to the Norwegian environment', (country) => {
    expect(getBusinessCentralEnvironmentForCountry(country)).toBe('NO');
  });

  it.each(['DK', 'SE', '', '   ', 'NOR', 'N', 'N O'])(
    'routes %j to the Danish environment',
    (country) => {
      expect(getBusinessCentralEnvironmentForCountry(country)).toBe('DK');
    },
  );

  it.each([null, undefined])('routes a missing country (%s) to the Danish environment', (country) => {
    expect(getBusinessCentralEnvironmentForCountry(country)).toBe('DK');
  });
});
