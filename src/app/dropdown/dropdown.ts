import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { OverlayModule } from '@angular/cdk/overlay';

export type DropdownMode = 'single' | 'multi';

export type DropdownGroup = {
  key: string;
  label: string;
  disabled?: boolean;
};

export type DropdownItem = {
  label: string;
  value: string;
  disabled?: boolean;
};

type GroupableItem = DropdownItem & { district: string };

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
  readonly items = input<DropdownItem[]>([]);
  readonly placeholder = input<string>('Выберите элемент');
  readonly mode = input<DropdownMode>('single');

  readonly groups = input<DropdownGroup[]>([]);
  readonly groupBy = input<((item: GroupableItem) => string | null) | undefined>(undefined);

  readonly searchable = input(false);
  readonly value = input<string[]>([]);

  readonly change = output<string[]>();

  /** Ссылки на элементы списка — нужны только для scrollIntoView при открытии */
  readonly optionEls = viewChildren<ElementRef<HTMLElement>>('optionEl');

  /** Инпут поиска — фокусируем при открытии */
  readonly searchInputEl = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  /** Генерируем уникальный id для aria-controls (a11y) */
  readonly panelId = `dropdown-panel-${crypto.randomUUID?.() ?? Math.random().toString(16).slice(2)}`;

  readonly isOpen = signal(false);

  readonly selectedValue = signal<string | null>(null);
  readonly selectedSet = signal<Set<string>>(new Set<string>());

  readonly searchQuery = signal('');

  /** Флаг: скроллим до выбранного элемента один раз при открытии */
  private readonly shouldScrollToSelected = signal(false);

  readonly isMulti = computed(() => this.mode() === 'multi');

  readonly selectedValues = computed<string[]>(() => {
    const items = this.items();

    if (this.isMulti()) {
      const set = this.selectedSet();
      return items.filter((i) => set.has(i.value)).map((i) => i.value);
    }

    const v = this.selectedValue();
    return v ? [v] : [];
  });

  readonly selectedValuesSet = computed(() => new Set(this.selectedValues()));

  readonly selectedItems = computed(() => {
    const selected = this.selectedValuesSet();
    return this.items().filter((i) => selected.has(i.value));
  });

  readonly displayValue = computed(() => {
    const selected = this.selectedItems();
    const placeholder = this.placeholder();

    if (!selected.length) return placeholder;

    if (!this.isMulti()) {
      return selected[0]?.label ?? placeholder;
    }

    if (selected.length <= 2) {
      return selected.map((i) => i.label).join(', ');
    }
    return `${selected[0].label}, ${selected[1].label} и еще ${selected.length - 2}`;
  });

  /**
   * Поиск
   **/

  readonly normalizedQuery = computed(() => this.searchQuery().trim().toLowerCase());

  readonly filteredItems = computed<DropdownItem[]>(() => {
    const q = this.normalizedQuery();
    const items = this.items();

    if (!this.searchable() || !q) return items;

    return items.filter((i) => i.label.toLowerCase().includes(q));
  });

  /**
   * Группы
   **/

  readonly groupsMap = computed(() => {
    const map = new Map<string, DropdownGroup>();
    for (const g of this.groups()) map.set(g.key, g);
    return map;
  });

  /** Преобразует items в плоский список строк для рендера:
   * учитывает поиск и группировку
   * сохраняет контролируемый порядок групп
   * применяет disabled-состояние группы к её элементам
   **/
  readonly renderRows = computed<RenderRow[]>(() => {
    const groupBy = this.groupBy();
    const visibleItems = this.filteredItems();

    if (!groupBy) {
      return visibleItems.map((item) => ({
        kind: 'option',
        item,
        disabled: !!item.disabled,
        groupKey: null,
      }));
    }

    // В режиме группировки items содержат поле district, которое нужно для groupBy
    const sourceItems = visibleItems as GroupableItem[];

    const grouped = new Map<string, GroupableItem[]>();

    for (const item of sourceItems) {
      const key = groupBy(item);
      if (!key) continue;

      const arr = grouped.get(key);
      if (arr) arr.push(item);
      else grouped.set(key, [item]);
    }

    const groupsMap = this.groupsMap();
    const groups = this.groups();

    const rows: RenderRow[] = [];

    const orderedKeys = groups.map((g) => g.key).filter((key) => grouped.has(key));

    const extraKeys: string[] = [];
    for (const key of grouped.keys()) {
      if (!groupsMap.has(key)) extraKeys.push(key);
    }

    const allKeys = [...orderedKeys, ...extraKeys];

    for (const key of allKeys) {
      const itemsInGroup = grouped.get(key);
      if (!itemsInGroup?.length) continue;

      const group = groupsMap.get(key);
      const groupDisabled = !!group?.disabled;

      rows.push({
        kind: 'group',
        key,
        label: group?.label ?? key,
        disabled: groupDisabled,
      });

      for (const item of itemsInGroup) {
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

  constructor() {
    effect(() => {
      const v = this.value() ?? [];

      if (this.isMulti()) {
        this.selectedSet.set(new Set(v));
        this.selectedValue.set(null);
      } else {
        this.selectedValue.set(v[0] ?? null);
        this.selectedSet.set(new Set());
      }
    });

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

      const el = options.find((ref) => ref.nativeElement.getAttribute('data-value') === first);
      el?.nativeElement.scrollIntoView({ block: 'nearest' });

      this.shouldScrollToSelected.set(false);
    });

    afterRenderEffect(() => {
      if (!this.isOpen() || !this.searchable()) return;

      const input = this.searchInputEl();
      input?.nativeElement.focus();
    });
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
  }

  trackRow(row: RenderRow): string {
    return row.kind === 'group' ? `g:${row.key}` : `o:${row.item.value}`;
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

    const isAlreadySelected = this.selectedValue() === item.value;
    this.selectedValue.set(isAlreadySelected ? null : item.value);

    this.change.emit(this.selectedValues());
    this.close();
  }
}
