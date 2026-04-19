import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function endDateAfterStartDate(
  startKey: string,
  endKey: string,
): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const start = group.get(startKey)?.value;
    const end = group.get(endKey)?.value;
    if (!start || !end) return null;
    return end < start ? { endBeforeStart: true } : null;
  };
}

export function budgetMaxDigits(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (num > 999999.99) return { budgetTooLarge: true };
    const parts = String(value).split('.');
    if (parts[1] && parts[1].length > 2) return { budgetTooManyDecimals: true };
    return null;
  };
}
