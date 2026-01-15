import { Component, computed, effect, signal } from '@angular/core';
import { Dropdown } from './dropdown/dropdown';
import { JsonPipe } from '@angular/common';
import { areas, districts } from './data';

type District = {
  label: string;
  value: string;
};

type Area = {
  label: string;
  value: string;
  district: string;
};

@Component({
  selector: 'app-root',
  imports: [Dropdown, JsonPipe],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly districtItems: District[] = districts;
  readonly areaItems: Area[] = areas;

  // По умолчанию выбраны все округа
  readonly selectedDistricts = signal<string[]>(districts.map((d) => d.value));
  readonly selectedAreas = signal<string[]>([]);

  // Map для получения районов только из выбранных округов
  readonly areaDistrictByValue = computed(() => {
    const map = new Map<string, string>();
    for (const a of this.areaItems) map.set(a.value, a.district);
    return map;
  });

  // Формируем группы районов и дизейблим их, если округ не выбран
  readonly groupsForAreas = computed(() => {
    const selected = new Set(this.selectedDistricts());

    return districts.map((d) => ({
      key: d.value,
      label: d.label,
      disabled: !selected.has(d.value),
    }));
  });

  // "Обертка" для вывода объектов в json pipe целиком, а не только value
  readonly selectedAreaObjects = computed(() => {
    const selected = new Set(this.selectedAreas());
    return this.areaItems.filter((a) => selected.has(a.value));
  });

  // Группируем районы по округам (для dropdown компонента)
  readonly groupByDistrict = (item: Area) => item.district;

  constructor() {
    // При снятии выбора у округа автоматически очищаем выбранные районы из этой группы
    effect(() => {
      const allowed = new Set(this.selectedDistricts());
      const districtByValue = this.areaDistrictByValue();

      const prev = this.selectedAreas();
      const next = prev.filter((v) => allowed.has(districtByValue.get(v) ?? ''));

      if (next.length !== prev.length) {
        this.selectedAreas.set(next);
      }
    });
  }
}
