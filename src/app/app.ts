import { Component, computed, signal } from '@angular/core';
import { Dropdown } from './dropdown/dropdown';
import { JsonPipe } from '@angular/common';
import { areas, districts } from './data';

@Component({
  selector: 'app-root',
  imports: [Dropdown, JsonPipe],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  // readonly items = districts;
  readonly items = areas;

  readonly selectedValues = signal<string[]>([]);

  readonly selectedDistricts = computed(() =>
    this.items.filter(d => this.selectedValues().includes(d.value))
  );

  readonly groups = districts.map(d => ({
    key: d.value,
    label: d.label,
    // Пример дизэйбла САО
    disabled: d.value === 'SAO', 
  }));

  readonly groupBy = (item: any) => item.district as string;
}
