import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'dropdown',
  imports: [CommonModule],
  templateUrl: './dropdown.html',
  styleUrl: './dropdown.scss',
})
export class Dropdown {
  @Input() items: any[] = [];
  @Input() placeholder = 'Выберите элемент';

  @Output() change = new EventEmitter<any>();

  isOpen = false;
  selectedItem: any = null;

  toggle(): void {
    this.isOpen = !this.isOpen;
  }

  select(item: any): void {
    this.selectedItem = item;
    this.change.emit(item);
    this.isOpen = false;
  }
}
