import {
  Component,
  Input,
  forwardRef,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { NgPersianDatepickerModule } from 'ng-persian-datepicker';
import type { IActiveDate, IDatepickerTheme } from 'ng-persian-datepicker';
import { gregorianIsoToShamsi } from '../utils/jalali-date.util';

@Component({
  selector: 'app-persian-date-input',
  standalone: true,
  imports: [ReactiveFormsModule, NgPersianDatepickerModule],
  templateUrl: './persian-date-input.html',
  styleUrl: './persian-date-input.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PersianDateInputComponent),
      multi: true,
    },
  ],
})
export class PersianDateInputComponent implements ControlValueAccessor {
  @Input() placeholder = 'انتخاب تاریخ';
  @Input() inputId = '';

  readonly displayControl = new FormControl('', { nonNullable: true });

  readonly pickerTheme: Partial<IDatepickerTheme> = {
    selectedBackground: '#4f46e5',
    selectedText: '#ffffff',
    hoverBackground: '#eef2ff',
    hoverText: '#312e81',
    todayBackground: '#e0e7ff',
    todayText: '#4338ca',
  };

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.displayControl.setValue(gregorianIsoToShamsi(value), { emitEvent: false });
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) this.displayControl.disable({ emitEvent: false });
    else this.displayControl.enable({ emitEvent: false });
  }

  onDateInit(event: IActiveDate): void {
    this.displayControl.setValue(event.shamsi, { emitEvent: false });
  }

  onDateSelect(event: IActiveDate): void {
    const iso = event.gregorian.slice(0, 10);
    this.displayControl.setValue(event.shamsi, { emitEvent: false });
    this.onChange(iso);
    this.onTouched();
  }
}
