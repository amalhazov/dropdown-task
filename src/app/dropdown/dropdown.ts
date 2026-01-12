import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, EventEmitter, Input, Output, signal, viewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OverlayModule } from '@angular/cdk/overlay';

export type DropdownMode = 'single' | 'multi';

export type DropdownGroup = {
  key: string;
  label: string;
  disabled?: boolean;
}

export type DropdownItem = {
  label: string;
  value: string;
  disabled?: boolean;
}

type RenderRow = 
  | { kind: 'group'; key: string; label: string; disabled: boolean }
  | { kind: 'option'; item: DropdownItem; disabled: boolean; groupKey: string | null };

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
  @Input() groups: DropdownGroup[] = [];
  @Input() groupBy?: (item: DropdownItem) => string | null;

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

  readonly groupsMap = computed(() => {
    const map = new Map<string, DropdownGroup>();
    for (const g of this.groups) map.set(g.key, g);
    return map;
  });

  readonly renderRows = computed<RenderRow[]>(() => {
    const items = this.items ?? [];
    const groupBy = this.groupBy;

    // Без группировки — ведем себя как раньше, просто список опций
    if (!groupBy) {
      return items.map(item => ({
        kind: 'option',
        item,
        disabled: !!item.disabled,
        groupKey: null,
      }));
    }

    const grouped = new Map<string, DropdownItem[]>();

    for (const item of items) {
      const key = groupBy(item);
      if (!key) continue;

      const arr = grouped.get(key);
      if (arr) {
        arr.push(item);
      } else {
        grouped.set(key, [item]);
      }
    }

    const groupsMap = this.groupsMap();
    const rows: RenderRow[] = [];

    // 1) Сначала ключи из groups — чтобы порядок был контролируемый
    const orderedKeys = (this.groups ?? [])
      .map(g => g.key)
      .filter(key => grouped.has(key));

    // 2) Потом “лишние” ключи, которых нет в groups (на всякий случай)
    const extraKeys: string[] = [];
    for (const key of grouped.keys()) {
      if (!groupsMap.has(key)) extraKeys.push(key);
    }

    const allKeys = [...orderedKeys, ...extraKeys];

    for (const key of allKeys) {
      const groupItems = grouped.get(key);
      if (!groupItems?.length) continue; // группа показывается только если есть элементы

      const group = groupsMap.get(key);

      // ✅ ВОТ ТУТ мы “дизейблим всю группу”
      const groupDisabled = !!group?.disabled;

      // header группы (не выбираемый)
      rows.push({
        kind: 'group',
        key,
        label: group?.label ?? key,
        disabled: groupDisabled,
      });

      // элементы группы (все disabled, если disabled группа)
      for (const item of groupItems) {
        rows.push({
          kind: 'option',
          item,

          // ✅ ВОТ ЭТА СТРОКА — главное исправление по ТЗ:
          // если disabled группа — все её элементы disabled
          disabled: groupDisabled || !!item.disabled,

          groupKey: key,
        });
      }
    }

    return rows;
  });

  trackRow(row: RenderRow): string {
    return row.kind === 'group' ? `g:${row.key}` : `o:${row.item.value}`;
  }

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

  select(row: { kind: 'option'; item: DropdownItem; disabled: boolean }): void {
    if (row.disabled) return;

    const item = row.item;

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
