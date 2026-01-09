import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, EventEmitter, Input, Output, signal, viewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OverlayModule } from '@angular/cdk/overlay';

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
  @Input({ required: true }) items: DropdownItem[] = [];
  @Input() placeholder = 'Выберите элемент';

  /** Single-select: отдаём выбранный item или null при снятии выбора. */
  @Output() readonly change = new EventEmitter<DropdownItem | null>();

  /** Ссылки на элементы списка — нужны только для scrollIntoView при открытии. */
  readonly optionEls = viewChildren<ElementRef<HTMLElement>>('optionEl');

  readonly isOpen = signal(false);
  readonly selectedValue = signal<string | null>(null);

  /** Флаг: скроллим до выбранного элемента один раз при открытии. */
  private readonly shouldScrollToSelected = signal(false);

  readonly selectedItem = computed<DropdownItem | null>(() => {
    const value = this.selectedValue();
    return value ? this.items.find((i) => i.value === value) ?? null : null;
  });

  readonly displayValue = computed(() => this.selectedItem()?.label ?? this.placeholder);

  constructor() {
    // Реализуем скролл до выбранного элемента если он есть
    afterRenderEffect(() => {
      if (!this.isOpen() || !this.shouldScrollToSelected()) return;
      if (!this.selectedValue()) {
        this.shouldScrollToSelected.set(false);
        return;
      }

      const selectedElRef = this.optionEls().find(
        (ref) => ref.nativeElement.getAttribute('aria-selected') === 'true'
      );

      selectedElRef?.nativeElement.scrollIntoView({ block: 'nearest' });
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

  // При повторном выборе элемента снимаем выбор
  select(item: DropdownItem): void {
    if (item.disabled) return;

    const isSame = this.selectedValue() === item.value;

    this.selectedValue.set(isSame ? null : item.value);
    this.change.emit(isSame ? null : item);

    this.close();
  }

  // Реализуем поддержку клавиатуры
  onTriggerKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.toggle();
        break;

      case 'Escape':
        event.preventDefault();
        this.close();
        break;

      default:
        break;
    }
  }
}
