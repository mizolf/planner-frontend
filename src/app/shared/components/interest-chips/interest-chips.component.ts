import { Component, input } from '@angular/core';
import { ReactiveFormsModule, ControlContainer, FormGroupDirective, FormControl } from '@angular/forms';
import { NgClass } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Interest } from '../../../core/models/trip.model';

const ALL_INTERESTS: Interest[] = [
  'CULTURE', 'FOOD', 'ADVENTURE', 'NATURE',
  'NIGHTLIFE', 'SHOPPING', 'RELAXATION', 'HISTORY',
];

@Component({
  selector: 'app-interest-chips',
  standalone: true,
  imports: [ReactiveFormsModule, NgClass, TranslateModule],
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  templateUrl: './interest-chips.component.html',
})
export class InterestChipsComponent {
  label = input.required<string>();
  controlName = input.required<string>();

  readonly allInterests = ALL_INTERESTS;

  get control(): FormControl | null {
    if (!this.controlContainer.control) return null;
    return this.controlContainer.control.get(this.controlName()) as FormControl;
  }

  isSelected(interest: Interest): boolean {
    const current: Interest[] = this.control?.value ?? [];
    return current.includes(interest);
  }

  toggleInterest(interest: Interest): void {
    const current: Interest[] = this.control?.value ?? [];
    const updated = this.isSelected(interest)
      ? current.filter(i => i !== interest)
      : [...current, interest];
    this.control?.setValue(updated);
    this.control?.markAsTouched();
  }

  constructor(private controlContainer: FormGroupDirective) {}
}
