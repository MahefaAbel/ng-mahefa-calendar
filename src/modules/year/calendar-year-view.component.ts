import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectorRef,
  OnChanges,
  OnInit,
  OnDestroy,
  LOCALE_ID,
  Inject,
  TemplateRef
} from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import {
  WeekDay,
  CalendarEvent,
  WeekViewEvent,
  WeekViewEventRow
} from 'calendar-utils';
import { ResizeEvent } from 'angular-resizable-element';
import addDays from 'date-fns/add_days';
import { CalendarDragHelper } from '../common/calendar-drag-helper.provider';
import { CalendarResizeHelper } from '../common/calendar-resize-helper.provider';
import { CalendarEventTimesChangedEvent } from '../common/calendar-event-times-changed-event.interface';
import { CalendarUtils } from '../common/calendar-utils.provider';
import { validateEvents } from '../common/util';
import { MonthOnYear } from './year-utils';

export interface YearViewEventResize {
  originalOffset: number;
  originalSpan: number;
  edge: string;
}
/**
 * Shows all events on a given Year. Example usage:
 *
 * ```typescript
 * <mwl-calendar-year-view
 *  [viewDate]="viewDate"
 *  [events]="events">
 * </mwl-calendar-year-view>
 * ```
 */
@Component({
  selector: 'mwl-calendar-year-view',
  template: `
    <div class="cal-year-view" #yearViewContainer>
      <mwl-calendar-year-view-header
        [months]="months"
        [locale]="locale"
        [customTemplate]="headerTemplate"
        (dayHeaderClicked)="dayHeaderClicked.emit($event)"
        (eventDropped)="eventTimesChanged.emit($event)">
      </mwl-calendar-year-view-header>
      <div *ngFor="let eventRow of eventRows" #eventRowContainer class="cal-events-row">
        <div
          *ngFor="let yearEvent of eventRow.row"
          #event
          class="cal-event-container"
          [class.cal-draggable]="yearEvent.event.draggable"
          [class.cal-starts-within-year]="!yearEvent.startsBeforeYear"
          [class.cal-ends-within-year]="!yearEvent.endsAfterYear"
          [ngClass]="yearEvent.event?.cssClass"
          [style.width]="((100 / this.months.length) * yearEvent.span) + '%'"
          [style.marginLeft]="((100 / months.length) * yearEvent.offset) + '%'"
          mwlResizable
          [resizeEdges]="{left: yearEvent.event?.resizable?.beforeStart, right: yearEvent.event?.resizable?.afterEnd}"
          [resizeSnapGrid]="{left: dayColumnWidth, right: dayColumnWidth}"
          [validateResize]="validateResize"
          (resizeStart)="resizeStarted(yearViewContainer, yearEvent, $event)"
          (resizing)="resizing(yearEvent, $event, dayColumnWidth)"
          (resizeEnd)="resizeEnded(yearEvent)"
          mwlDraggable
          [dragAxis]="{x: yearEvent.event.draggable && currentResizes.size === 0, y: false}"
          [dragSnapGrid]="{x: dayColumnWidth}"
          [validateDrag]="validateDrag"
          (dragStart)="dragStart(yearViewContainer, event)"
          (dragEnd)="eventDragged(yearEvent, $event.x, dayColumnWidth)">
          <mwl-calendar-year-view-event
            [weekEvent]="yearEvent"
            [tooltipPlacement]="tooltipPlacement"
            [tooltipTemplate]="tooltipTemplate"
            [tooltipAppendToBody]="tooltipAppendToBody"
            [customTemplate]="eventTemplate"
            [eventTitleTemplate]="eventTitleTemplate"
            (eventClicked)="eventClicked.emit({event: yearEvent.event})">
          </mwl-calendar-year-view-event>
        </div>
      </div>
    </div>
  `
})
export class CalendarYearViewComponent implements OnChanges, OnInit, OnDestroy {
  /**
   * The current view date
   */
  @Input() viewDate: Date;

  /**
   * An array of events to display on view
   * The schema is available here: https://github.com/mattlewis92/calendar-utils/blob/c51689985f59a271940e30bc4e2c4e1fee3fcb5c/src/calendarUtils.ts#L49-L63
   */
  @Input() events: CalendarEvent[] = [];

  /**
   * An array of day indexes (0 = sunday, 1 = monday etc) that will be hidden on the view
   */
  @Input() excludeDays: number[] = [];

  /**
   * An observable that when emitted on will re-render the current view
   */
  @Input() refresh: Subject<any>;

  /**
   * The locale used to format dates
   */
  @Input() locale: string;

  /**
   * The placement of the event tooltip
   */
  @Input() tooltipPlacement: string = 'bottom';

  /**
   * A custom template to use for the event tooltips
   */
  @Input() tooltipTemplate: TemplateRef<any>;

  /**
   * Whether to append tooltips to the body or next to the trigger element
   */
  @Input() tooltipAppendToBody: boolean = true;

  /**
   * The start number of the year
   */
  @Input() yearStartsOn: number;

  /**
   * A custom template to use to replace the header
   */
  @Input() headerTemplate: TemplateRef<any>;

  /**
   * A custom template to use for year view events
   */
  @Input() eventTemplate: TemplateRef<any>;

  /**
   * A custom template to use for event titles
   */
  @Input() eventTitleTemplate: TemplateRef<any>;

  /**
   * The precision to display events.
   * `days` will round event start and end dates to the nearest day and `minutes` will not do this rounding
   */
  @Input() precision: 'days' | 'minutes' = 'days';

  /**
   * An array of day indexes (0 = sunday, 1 = monday etc) that indicate which days are yearends
   */
  @Input() yearendDays: number[];

  /**
   * Called when a header year day is clicked. Adding a `cssClass` property on `$event.day` will add that class to the header element
   */
  @Output()
  dayHeaderClicked: EventEmitter<{ day: WeekDay }> = new EventEmitter<{
    day: WeekDay;
  }>();

  /**
   * Called when the event title is clicked
   */
  @Output()
  eventClicked: EventEmitter<{ event: CalendarEvent }> = new EventEmitter<{
    event: CalendarEvent;
  }>();

  /**
   * Called when an event is resized or dragged and dropped
   */
  @Output()
  eventTimesChanged: EventEmitter<
    CalendarEventTimesChangedEvent
  > = new EventEmitter<CalendarEventTimesChangedEvent>();

  /**
   * An output that will be called before the view is rendered for the current year.
   * If you add the `cssClass` property to a day in the header it will add that class to the cell element in the template
   */
  @Output()
  beforeViewRender: EventEmitter<{
    header: MonthOnYear[];
  }> = new EventEmitter();

  /**
   * @hidden
   */
  @Input() months: MonthOnYear[];

  /**
   * @hidden
   */
  eventRows: WeekViewEventRow[] = [];

  /**
   * @hidden
   */
  refreshSubscription: Subscription;

  /**
   * @hidden
   */
  currentResizes: Map<WeekViewEvent, YearViewEventResize> = new Map();

  /**
   * @hidden
   */
  validateDrag: (args: any) => boolean;

  /**
   * @hidden
   */
  validateResize: (args: any) => boolean;

  /**
   * @hidden
   */
  dayColumnWidth: number;

  /**
   * @hidden
   */
  constructor(
    private cdr: ChangeDetectorRef,
    private utils: CalendarUtils,
    @Inject(LOCALE_ID) locale: string
  ) {
    this.locale = locale;
  }

  /**
   * @hidden
   */
  ngOnInit(): void {
    if (this.refresh) {
      this.refreshSubscription = this.refresh.subscribe(() => {
        this.refreshAll();
        this.cdr.markForCheck();
      });
    }
    console.log("this.months: ", this.months);

  }

  /**
   * @hidden
   */
  ngOnChanges(changes: any): void {
    if (changes.viewDate || changes.excludeDays || changes.yearendDays) {
      this.refreshHeader();
    }

    if (changes.events) {
      validateEvents(this.events);
    }

    if (changes.events || changes.viewDate || changes.excludeDays) {
      this.refreshBody();
    }
  }

  /**
   * @hidden
   */
  ngOnDestroy(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  /**
   * @hidden
   */
  resizeStarted(
    yearViewContainer: HTMLElement,
    yearEvent: WeekViewEvent,
    resizeEvent: ResizeEvent,
    partMonth: number
  ): void {
    this.currentResizes.set(yearEvent, {
      originalOffset: yearEvent.offset,
      originalSpan: yearEvent.span,
      edge: typeof resizeEvent.edges.left !== 'undefined' ? 'left' : 'right'
    });
    this.dayColumnWidth = this.getDayColumnWidth(yearViewContainer);
    const resizeHelper: CalendarResizeHelper = new CalendarResizeHelper(
      yearViewContainer,
      this.dayColumnWidth
    );
    this.validateResize = ({ rectangle }) =>
      resizeHelper.validateResize({ rectangle });
    this.cdr.markForCheck();
  }

  /**
   * @hidden
   */
  resizing(
    yearEvent: WeekViewEvent,
    resizeEvent: ResizeEvent,
    dayWidth: number
  ): void {
    const currentResize: YearViewEventResize = this.currentResizes.get(
      yearEvent
    );

    if (resizeEvent.edges.left) {
      const diff: number = Math.round(+resizeEvent.edges.left / dayWidth);
      yearEvent.offset = currentResize.originalOffset + diff;
      yearEvent.span = currentResize.originalSpan - diff;
    } else if (resizeEvent.edges.right) {
      const diff: number = Math.round(+resizeEvent.edges.right / dayWidth);
      yearEvent.span = currentResize.originalSpan + diff;
    }
  }

  /**
   * @hidden
   */
  resizeEnded(yearEvent: WeekViewEvent): void {
    const currentResize: YearViewEventResize = this.currentResizes.get(
      yearEvent
    );

    let daysDiff: number;
    if (currentResize.edge === 'left') {
      daysDiff = yearEvent.offset - currentResize.originalOffset;
    } else {
      daysDiff = yearEvent.span - currentResize.originalSpan;
    }

    yearEvent.offset = currentResize.originalOffset;
    yearEvent.span = currentResize.originalSpan;

    let newStart: Date = yearEvent.event.start;
    let newEnd: Date = yearEvent.event.end;
    if (currentResize.edge === 'left') {
      newStart = addDays(newStart, daysDiff);
    } else if (newEnd) {
      newEnd = addDays(newEnd, daysDiff);
    }

    this.eventTimesChanged.emit({ newStart, newEnd, event: yearEvent.event });
    this.currentResizes.delete(yearEvent);
  }

  /**
   * @hidden
   */
  eventDragged(
    yearEvent: WeekViewEvent,
    draggedByPx: number,
    dayWidth: number
  ): void {
    const daysDragged: number = draggedByPx / dayWidth;
    const newStart: Date = addDays(yearEvent.event.start, daysDragged);
    let newEnd: Date;
    if (yearEvent.event.end) {
      newEnd = addDays(yearEvent.event.end, daysDragged);
    }

    this.eventTimesChanged.emit({ newStart, newEnd, event: yearEvent.event });
  }

  /**
   * @hidden
   */
  getDayColumnWidth(eventRowContainer: HTMLElement): number {
    return Math.floor(eventRowContainer.offsetWidth / this.months.length);
  }

  /**
   * @hidden
   */
  dragStart(yearViewContainer: HTMLElement, event: HTMLElement): void {
    this.dayColumnWidth = this.getDayColumnWidth(yearViewContainer);
    const dragHelper: CalendarDragHelper = new CalendarDragHelper(
      yearViewContainer,
      event
    );
    this.validateDrag = ({ x, y }) =>
      this.currentResizes.size === 0 && dragHelper.validateDrag({ x, y });
    this.cdr.markForCheck();
  }

  private refreshHeader(): void {
    /*this.utils.getYearViewHeader({
      viewDate: this.viewDate,
      weekStartsOn: this.yearStartsOn,
      excluded: this.excludeDays,
      weekendDays: this.yearendDays
    })*/
    this.beforeViewRender.emit({
      header: this.months
    });
  }

  private refreshBody(): void {
    this.eventRows = this.utils.getWeekView({
      events: this.events,
      viewDate: this.viewDate,
      weekStartsOn: this.yearStartsOn,
      excluded: this.excludeDays,
      precision: this.precision,
      absolutePositionedEvents: true
    });
  }

  private refreshAll(): void {
    this.refreshHeader();
    this.refreshBody();
  }

}
