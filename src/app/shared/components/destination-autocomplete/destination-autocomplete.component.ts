import {
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  ReactiveFormsModule,
  ControlContainer,
  FormGroupDirective,
  FormControl,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import {
  DestinationSuggestion,
  GeoBias,
  GeocodingService,
} from '../../../core/services/geocoding.service';

@Component({
  selector: 'app-destination-autocomplete',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule],
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  templateUrl: './destination-autocomplete.component.html',
})
export class DestinationAutocompleteComponent {
  label = input.required<string>();
  icon = input<string>('location_on');
  placeholder = input<string>('');
  controlName = input.required<string>();
  errors = input<Record<string, string>>({});
  bias = input<GeoBias | null>(null);

  selected = output<DestinationSuggestion>();
  cleared = output<void>();

  readonly suggestions = signal<DestinationSuggestion[]>([]);
  readonly dropdownOpen = signal(false);
  readonly searching = signal(false);
  readonly noResults = signal(false);
  readonly activeIndex = signal(-1);

  private readonly geocoding = inject(GeocodingService);
  private readonly controlContainer = inject(FormGroupDirective);
  private readonly host = inject(ElementRef);

  // Driven by the DOM (input) event, NOT control.valueChanges: form.reset() in
  // the edit dialog's open() fires valueChanges, which would trigger a phantom
  // search and wipe the prefilled coordinates. (input) only fires on real
  // keystrokes. Do not refactor this to valueChanges.
  private readonly query$ = new Subject<string>();

  constructor() {
    this.query$
      .pipe(
        map((q) => q.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          if (q.length < 2) return of(null);
          this.searching.set(true);
          this.noResults.set(false);
          return this.geocoding.search(q, this.bias() ?? undefined);
        }),
        takeUntilDestroyed(),
      )
      .subscribe((results) => {
        this.searching.set(false);
        if (results === null) return;
        this.suggestions.set(results);
        this.noResults.set(results.length === 0);
        this.activeIndex.set(-1);
        this.dropdownOpen.set(true);
      });
  }

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

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    // Any manual keystroke makes previously picked coordinates stale
    this.cleared.emit();
    if (value.trim().length < 2) {
      this.suggestions.set([]);
      this.closeDropdown();
    } else {
      this.dropdownOpen.set(true);
    }
    this.query$.next(value);
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.dropdownOpen()) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveHighlight(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveHighlight(-1);
        break;
      case 'Enter': {
        const suggestion = this.suggestions()[this.activeIndex()];
        if (suggestion) {
          // Prevent the dialog form from submitting on pick
          event.preventDefault();
          this.select(suggestion);
        } else {
          this.closeDropdown();
        }
        break;
      }
      case 'Escape':
        // Close only the dropdown — keep the event from reaching the dialog's
        // document:keydown.escape listener, which would close the dialog
        event.stopPropagation();
        this.closeDropdown();
        break;
    }
  }

  onOptionMousedown(event: MouseEvent, suggestion: DestinationSuggestion): void {
    // mousedown + preventDefault so the input doesn't blur before selection
    event.preventDefault();
    this.select(suggestion);
  }

  onBlur(): void {
    this.closeDropdown();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.dropdownOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.closeDropdown();
    }
  }

  private select(suggestion: DestinationSuggestion): void {
    // setValue doesn't fire the (input) event, so this neither re-searches
    // nor emits cleared
    this.control?.setValue(suggestion.label);
    this.closeDropdown();
    this.selected.emit(suggestion);
  }

  private moveHighlight(delta: number): void {
    const count = this.suggestions().length;
    if (count === 0) return;
    const next = (this.activeIndex() + delta + count) % count;
    this.activeIndex.set(next);
  }

  private closeDropdown(): void {
    this.dropdownOpen.set(false);
    this.activeIndex.set(-1);
  }
}
