import {
  Component,
  Input,
  Output,
  EventEmitter,
  TemplateRef
} from '@angular/core';
import { CalendarEvent, WeekDay } from 'calendar-utils';
import { MonthOnYear } from './year-utils';

@Component({
  selector: 'mwl-calendar-year-view-header',
  template: `
    <ng-template
      #defaultTemplate
      let-days="months"
      let-locale="locale"
      let-dayHeaderClicked="dayHeaderClicked"
      let-eventDropped="eventDropped">
      <div class="cal-day-headers">
        <div
          class="cal-header"
          *ngFor="let month of months"
          [class.cal-past]="month.isPast"
          [class.cal-today]="month.isToday"
          [class.cal-future]="month.isFuture"
          [class.cal-yearend]="month.isYearend"
          [class.cal-drag-over]="month.dragOver"
          [ngClass]="month.cssClass"
          (mwlClick)="dayHeaderClicked.emit({day: month})"
          mwlDroppable
          (dragEnter)="month.dragOver = true"
          (dragLeave)="month.dragOver = false"
          (drop)="month.dragOver = false; eventDropped.emit({event: $event.dropData.event, newStart: month.date})">
          <b>{{ month.date | calendarDate:'yearViewColumnHeader':locale  }}</b><br>
          <!--<span>{{ month.date | calendarDate:'weekViewColumnHeader':locale }}</span>-->
        </div>
      </div>
    </ng-template>
    <ng-template
      [ngTemplateOutlet]="customTemplate || defaultTemplate"
      [ngTemplateOutletContext]="{days: months, locale: locale, dayHeaderClicked: dayHeaderClicked, eventDropped: eventDropped}">
    </ng-template>
  `
})
export class CalendarYearViewHeaderComponent {
  // @Input() days: WeekDay[];
  @Input() months: MonthOnYear[];

  @Input() locale: string;

  @Input() customTemplate: TemplateRef<any>;

  @Output()
  dayHeaderClicked: EventEmitter<{ day: WeekDay }> = new EventEmitter<{
    day: WeekDay;
  }>();

  @Output()
  eventDropped: EventEmitter<{
    event: CalendarEvent;
    newStart: Date;
  }> = new EventEmitter<{ event: CalendarEvent; newStart: Date }>();

  constructor() {}
}
