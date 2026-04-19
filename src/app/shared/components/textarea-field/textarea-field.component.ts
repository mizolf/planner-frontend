import { Component, input } from '@angular/core';
import { ReactiveFormsModule, ControlContainer, FormGroupDirective, FormControl } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-textarea-field',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule],
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  templateUrl: './textarea-field.component.html',
})
export class TextareaFieldComponent {
  label = input.required<string>();
  icon = input.required<string>();
  placeholder = input<string>('');
  controlName = input.required<string>();
  errors = input<Record<string, string>>({});
  rows = input<number>(3);

  get control(): FormControl | null {
    if (!this.controlContainer.control) return null;
    return this.controlContainer.control.get(this.controlName()) as FormControl;
  }

  get firstErrorMessage(): string {
    const ctrl = this.control;
    if (!ctrl?.errors) return '';
    const errorMap = this.errors();
    for (const key of Object.keys(errorMap)) {
      if (ctrl.errors[key]) return errorMap[key];
    }
    return '';
  }

  constructor(private controlContainer: FormGroupDirective) {}
}
