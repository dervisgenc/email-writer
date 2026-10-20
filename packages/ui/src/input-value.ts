/** Reads the value from an input event without a type cast. */
export function inputValue(event: Event): string {
  const target = event.target;
  return target !== null && 'value' in target && typeof target.value === 'string' ? target.value : '';
}

export function inputChecked(event: Event): boolean {
  const target = event.target;
  return target !== null && 'checked' in target && target.checked === true;
}
