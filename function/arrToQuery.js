export default function arrToQuery(text) {
  if (text === '') return [''];

  return text.split(',').map(item => item.trim()).filter((item, index, arr) => item !== '' || arr.length === 1);
}
