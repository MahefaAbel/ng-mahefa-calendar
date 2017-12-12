
const listMonthsName = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mais', 'Juin', 
  'Juillet', 'Aôut', 'Septembre', 'Octobre', 'Novembre', 'Decembre'
];

export class MonthOnYear {
  date: Date;
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
  dragOver: boolean;
  cssClass?: string;

  constructor(date: Date){
    this.date = date;
  }

  getMonthName(){
    return listMonthsName[this.date.getMonth()];
  }
}