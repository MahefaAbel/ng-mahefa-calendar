import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ResizableModule } from 'angular-resizable-element';
import { DragAndDropModule } from 'angular-draggable-droppable';
import { CalendarYearViewComponent } from './calendar-year-view.component';
import { CalendarYearViewHeaderComponent } from './calendar-year-view-header.component';
import { CalendarYearViewEventComponent } from './calendar-year-view-event.component';
import { CalendarYearViewSwipedComponent } from './calendar-year-view-swiped.component';
import { CalendarCommonModule } from '../common/calendar-common.module';
import { NgxCarouselModule } from 'ngx-carousel';

export { CalendarYearViewSwipedComponent } from './calendar-year-view-swiped.component';
export {
  WeekViewEvent as CalendarWeekViewEvent,
  WeekViewEventRow as CalendarWeekViewEventRow,
  GetWeekViewArgs as CalendarGetWeekViewArgs
} from 'calendar-utils';

@NgModule({
  imports: [
    CommonModule,
    ResizableModule,
    DragAndDropModule,
    CalendarCommonModule,
    NgxCarouselModule
  ],
  declarations: [
    CalendarYearViewComponent,
    CalendarYearViewHeaderComponent,
    CalendarYearViewEventComponent,
    CalendarYearViewSwipedComponent
  ],
  exports: [
    CalendarYearViewComponent,
    CalendarYearViewHeaderComponent,
    CalendarYearViewEventComponent,
    CalendarYearViewSwipedComponent
  ],
  providers: [
    // CalendarDatePipe
  ]
})
export class CalendarYearModule {}
