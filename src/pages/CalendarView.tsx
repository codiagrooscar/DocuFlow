import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CalendarView() {
  const { processes } = useData();
  const [currentDate, setCurrentDate] = useState(new Date());

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const dateFormat = "d";
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  // Filter processes that have an estimated delivery date
  const scheduledProcesses = processes.filter(p => p.estimatedDeliveryDate);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <CalendarIcon className="h-6 w-6 text-codiagro-green" />
          Calendario de Entregas
        </h2>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-medium w-40 text-center capitalize">
            {format(currentDate, 'MMMM yyyy', { locale: es })}
          </span>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b border-slate-200">
            {weekDays.map(day => (
              <div key={day} className="py-3 text-center text-sm font-semibold text-slate-500 bg-slate-50">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-fr">
            {days.map((day, i) => {
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isToday = isSameDay(day, new Date());
              
              // Find processes scheduled for this day
              const dayProcesses = scheduledProcesses.filter(p => 
                p.estimatedDeliveryDate && isSameDay(new Date(p.estimatedDeliveryDate), day)
              );

              return (
                <div 
                  key={day.toString()} 
                  className={`min-h-[120px] p-2 border-b border-r border-slate-100 ${
                    !isCurrentMonth ? 'bg-slate-50/50 text-slate-400' : 'bg-white'
                  } ${isToday ? 'bg-codiagro-green/5' : ''}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                      isToday ? 'bg-codiagro-green text-white' : ''
                    }`}>
                      {format(day, dateFormat)}
                    </span>
                    {dayProcesses.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] bg-codiagro-orange/10 text-codiagro-orange-dark border-none">
                        {dayProcesses.length}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    {dayProcesses.map(process => (
                      <Link key={process.id} to={`/process/${process.id}`}>
                        <div className="text-xs p-1.5 rounded bg-slate-100 hover:bg-codiagro-green/10 hover:text-codiagro-green-dark transition-colors border border-slate-200 cursor-pointer truncate" title={`${process.title} - ${process.clientName}`}>
                          <div className="font-medium truncate">{process.title}</div>
                          <div className="text-[10px] text-slate-500 truncate">{process.clientName}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
