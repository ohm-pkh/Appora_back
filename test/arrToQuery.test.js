import arrToQuery from "../function/arrToQuery";

describe('arrToQuery', () => {
  test('converts a single value', () => {
    expect(arrToQuery('Bistro')).toStrictEqual(['Bistro']);
  });

  test('converts multiple comma-separated values', () => {
    expect(arrToQuery('Bistro,Thai,Italian')).toStrictEqual(['Bistro','Thai','Italian']);
  });

  test('trims spaces around values', () => {
    expect(arrToQuery('  Bistro ,  Thai , Italian ')).toStrictEqual(['Bistro','Thai','Italian']);
  });

  test('handles empty string', () => {
    expect(arrToQuery('')).toStrictEqual(['']);
  });

  test('handles trailing commas', () => {
    expect(arrToQuery('Bistro,Thai,')).toStrictEqual(['Bistro','Thai']);
  });
});
