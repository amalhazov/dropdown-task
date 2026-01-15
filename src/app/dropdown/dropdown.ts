import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, EventEmitter, Input, Output, signal, viewChild, viewChildren } from '@angular/core';
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
  @Input() searchable = false;

  /** 
   * Single-select: эмитим [value] или []
   * Multi-select: эмитим [value1, value2...]
   * */
  @Output() readonly change = new EventEmitter<string[]>();

  /** Ссылки на элементы списка — нужны только для scrollIntoView при открытии. */
  readonly optionEls = viewChildren<ElementRef<HTMLElement>>('optionEl');
  readonly searchInputEl = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly isOpen = signal(false);
  readonly selectedValue = signal<string | null>(null);
  readonly selectedSet = signal<Set<string>>(new Set<string>());
  readonly searchQuery = signal('');

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

  readonly normalizedQuery = computed(() => this.searchQuery().trim().toLowerCase());

  readonly filteredItems = computed<DropdownItem[]>(() => {
    const q = this.normalizedQuery();
    const items = this.items ?? [];

    if (!this.searchable || !q) return items;

    return items.filter(i => i.label.toLowerCase().includes(q));
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
    const items = this.filteredItems();
    const groupBy = this.groupBy;

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

    const orderedKeys = (this.groups ?? [])
      .map(g => g.key)
      .filter(key => grouped.has(key));

    const extraKeys: string[] = [];
    for (const key of grouped.keys()) {
      if (!groupsMap.has(key)) extraKeys.push(key);
    }

    const allKeys = [...orderedKeys, ...extraKeys];

    for (const key of allKeys) {
      const groupItems = grouped.get(key);
      if (!groupItems?.length) continue;
      const group = groupsMap.get(key);
      const groupDisabled = !!group?.disabled;

      rows.push({
        kind: 'group',
        key,
        label: group?.label ?? key,
        disabled: groupDisabled,
      });

      for (const item of groupItems) {
        rows.push({
          kind: 'option',
          item,
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
    afterRenderEffect(() => {
      if (!this.isOpen() || !this.shouldScrollToSelected()) return;

      const values = this.selectedValues();
      const first = values[0];

      if (!first) {
        this.shouldScrollToSelected.set(false);
        return;
      }

      const options = this.optionEls();
      if (!options.length) return;

      const el = options.find(ref => ref.nativeElement.getAttribute('data-value') === first);
      el?.nativeElement.scrollIntoView({ block: 'nearest' });

      this.shouldScrollToSelected.set(false);
    });

    afterRenderEffect(() => {
      if (!this.isOpen() || !this.searchable) return;

      const input = this.searchInputEl();
      input?.nativeElement.focus();
    });
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
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
    this.searchQuery.set('');
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
}
