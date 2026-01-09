import { Component, signal } from '@angular/core';
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
  selectedItem: any = null;

  readonly items = districts;
}
