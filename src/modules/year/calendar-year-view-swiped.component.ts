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
  import{ addDays } from 'date-fns';
  import { CalendarDragHelper } from '../common/calendar-drag-helper.provider';
  import { CalendarResizeHelper } from '../common/calendar-resize-helper.provider';
  import { CalendarEventTimesChangedEvent } from '../common/calendar-event-times-changed-event.interface';
  import { CalendarUtils } from '../common/calendar-utils.provider';
  import { validateEvents } from '../common/util';
  import { MonthOnYear } from './year-utils';
  import { NgxCarousel } from 'ngx-carousel';
  
  export interface YearViewEventResize {
    originalOffset: number;
    originalSpan: number;
    edge: string;
  }
  /**
   * Shows all events on a given Year. Example usage:
   *
   * ```typescript
   * <mwl-calendar-year-view-swiped
   *  [viewDate]="viewDate"
   *  [events]="events">
   * </mwl-calendar-year-view-swiped>
   * ```
   */
  @Component({
    selector: 'mwl-calendar-year-view-swiped',
    template: `
    <ngx-carousel
      [inputs]="carouselOne">
        <ngx-item NgxCarouselItem *ngFor="let part of getRange(totalPart)">
          <mwl-calendar-year-view
            [viewDate]="viewDate"
            [events]="events"
            [months]="getMonthByPart(part)"
            [refresh]="refresh"
            (dayClicked)="dayClicked($event.day)"
            (eventClicked)="handleEvent('Clicked', $event.event)"
            (eventTimesChanged)="eventTimesChanged($event)">
          </mwl-calendar-year-view>
        </ngx-item>
        <button NgxCarouselPrev class='leftRs'>&lt;</button>
        <button NgxCarouselNext class='rightRs'>&gt;</button>
      </ngx-carousel>
    `
  })
  export class CalendarYearViewSwipedComponent implements OnChanges, OnInit, OnDestroy {
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
    months: MonthOnYear[];

    listParts: any[] = null;
  
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
  
    public carouselOne: NgxCarousel;
    @Input() public nbMonthMaxToShow: number;
    public totalPart: number;
  
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
      this.totalPart = Math.ceil(12 / (this.nbMonthMaxToShow));
      this.prepartMonth();
      this.carouselOne = {
        grid: {xs: 1, sm: 1, md: 1, lg: 1, all: 0},
        slide: 1,
        speed: 400,
        // interval: 4000,
        point: {
          visible: true
        },
        load: 2,
        touch: false,
        loop: false,
        custom: 'banner'
      }
    }
  
    /**
     * @hidden
     */
    ngOnChanges(changes: any): void {
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
  
    public prepartMonth() {
      this.listParts = new Array<any>();
      let listMonthOnYear: MonthOnYear[] = new Array<MonthOnYear>();
      for(let i=0; i<12; i++){
        listMonthOnYear.push( new MonthOnYear(new Date(2017, i)) );
        // console.log(i, this.listParts, listMonthOnYear, this.nbMonthMaxToShow);
        if(i > 0 && (i % ((this.nbMonthMaxToShow*(this.listParts.length+1))-1)) === 0){
          this.listParts.push([...listMonthOnYear]);
          listMonthOnYear = new Array<MonthOnYear>();
        }
      }
    }
    public getMonthByPart(part: number){
      if ( typeof(this.listParts) === "undefined" || this.listParts === null ) {
        this.prepartMonth();
      }
      const result = this.listParts[part];
      return ( typeof(result) !== "undefined" && result !== null )?result:[
        new MonthOnYear(new Date(2017, 0)),
        new MonthOnYear(new Date(2017, 1)),
        new MonthOnYear(new Date(2017, 2)),
        new MonthOnYear(new Date(2017, 3)),
      ];
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
  
    getRange(number){
      let items: number[];
      items = [];
      for(let i = 0; i < number; i++){
         items.push(i);
      }
      return items;
    }
  }
  