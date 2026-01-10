import { Component, computed, signal } from '@angular/core';
import { Dropdown } from './dropdown/dropdown';
import { JsonPipe } from '@angular/common';
import { districts } from './data';

@Component({
  selector: 'app-root',
  imports: [Dropdown, JsonPipe],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly items = districts;

  readonly selectedValues = signal<string[]>([]);

  readonly selectedDistricts = computed(() =>
    this.items.filter(d => this.selectedValues().includes(d.value))
  );
}
