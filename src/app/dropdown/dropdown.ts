import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, EventEmitter, Input, Output, signal, viewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OverlayModule } from '@angular/cdk/overlay';

export type DropdownMode = 'single' | 'multi';

export type DropdownItem = {
  label: string;
  value: string;
  disabled?: boolean;
}

@Component({
  selector: 'dropdown',
  imports: [CommonModule, OverlayModule],
  templateUrl: './dropdown.html',
  styleUrl: './dropdown.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dropdown {
  @Input() items: DropdownItem[] = [];
  @Input() placeholder = 'Выберите элемент';
  @Input() mode: DropdownMode = 'single';

  /** 
   * Single-select: эмитим [value] или []
   * Multi-select: эмитим [value1, value2...]
   * */
  @Output() readonly change = new EventEmitter<string[]>();

  /** Ссылки на элементы списка — нужны только для scrollIntoView при открытии. */
  readonly optionEls = viewChildren<ElementRef<HTMLElement>>('optionEl');

  readonly isOpen = signal(false);
  readonly selectedValue = signal<string | null>(null);
  readonly selectedSet = signal<Set<string>>(new Set<string>());

  readonly isMulti = computed(() => this.mode === 'multi');

  readonly selectedValues = computed<string[]>(() => {
    if (this.isMulti()) {
      const set = this.selectedSet();
      return this.items.filter(i => set.has(i.value)).map(i => i.value);
    }

    const v = this.selectedValue();
    return v ? [v] : [];
  });

  readonly selectedValuesSet = computed(() => new Set(this.selectedValues()));

  readonly selectedItems = computed<DropdownItem[]>(() => {
    const values = new Set(this.selectedValues());
    return this.items.filter(i => values.has(i.value));
  });

  readonly displayValue = computed(() => {
    const selected = this.selectedItems();
    if (!selected.length) return this.placeholder;

    if (!this.isMulti()) {
      return selected[0]?.label ?? this.placeholder;
    }

    if (selected.length <= 2) {
      return selected.map(i => i.label).join(', ');
    }
    return `${selected[0].label}, ${selected[1].label} и еще ${selected.length - 2}`;
  });

  /** Флаг: скроллим до выбранного элемента один раз при открытии. */
  private readonly shouldScrollToSelected = signal(false);

  constructor() {
    // Реализуем скролл до выбранного элемента если он есть
    afterRenderEffect(() => {
      if (!this.isOpen() || !this.shouldScrollToSelected()) return;

      // для single — скроллим к выбранному
      // для multi — можно скроллить к первому выбранному (минимальный вариант)
      const values = this.selectedValues();
      const first = values[0];

      if (!first) {
        this.shouldScrollToSelected.set(false);
        return;
      }

      const options = this.optionEls();
      if (!options.length) {
        return;
      }

      const el = options.find(ref => ref.nativeElement.getAttribute('data-value') === first);
      el?.nativeElement.scrollIntoView({ block: 'nearest' });

      this.shouldScrollToSelected.set(false);
    });
  }

  toggle(): void {
    const willOpen = !this.isOpen();
    this.isOpen.set(willOpen);

    if (willOpen) {
      this.shouldScrollToSelected.set(true);
    }
  }

  close(): void {
    this.isOpen.set(false);
    this.shouldScrollToSelected.set(false);
  }

  select(item: DropdownItem): void {
    if (item.disabled) return;

    if (this.isMulti()) {
      const next = new Set(this.selectedSet());

      if (next.has(item.value)) {
        next.delete(item.value);
      } else {
        next.add(item.value);
      }

      this.selectedSet.set(next);

      this.change.emit(this.selectedValues());

      return;
    }

    // Single-select: повторный клик по выбранному снимает выбор
    const isAlreadySelected = this.selectedValue() === item.value;
    this.selectedValue.set(isAlreadySelected ? null : item.value);

    this.change.emit(this.selectedValues());
    this.close();
  }

  // Реализуем поддержку клавиатуры
  onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggle();
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }
}
