import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CellData {
  id: string;
  row: number;
  col: number;
  value: string;
}

interface ColumnConfig {
  index: number;
  name: string;
  type: 'date' | 'title' | 'info' | 'text';
}

const detectColumnType = (values: string[]): 'date' | 'title' | 'info' | 'text' => {
  const nonEmpty = values.filter(v => v.trim() !== '');
  if (nonEmpty.length === 0) return 'text';

  const datePattern = /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/;
  const dateCount = nonEmpty.filter(v => datePattern.test(v)).length;
  if (dateCount / nonEmpty.length > 0.6) return 'date';

  const avgLength = nonEmpty.reduce((sum, v) => sum + v.length, 0) / nonEmpty.length;
  if (avgLength < 30) return 'title';
  if (avgLength > 50) return 'info';
  
  return 'text';
};

const Index = () => {
  const [cells, setCells] = useState<CellData[]>([]);
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [selectedCell, setSelectedCell] = useState<{row: number, col: number} | null>(null);
  const [editingColumn, setEditingColumn] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

  const ROWS = 20;
  const COLS = 10;

  useEffect(() => {
    const initialCells: CellData[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        initialCells.push({
          id: `${r}-${c}`,
          row: r,
          col: c,
          value: ''
        });
      }
    }
    setCells(initialCells);

    const initialColumns: ColumnConfig[] = [];
    for (let i = 0; i < COLS; i++) {
      initialColumns.push({
        index: i,
        name: String.fromCharCode(65 + i),
        type: 'text'
      });
    }
    setColumns(initialColumns);
  }, []);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'ru-RU';

      recognitionRef.current.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        if (selectedCell) {
          updateCell(selectedCell.row, selectedCell.col, text);
        }
        toast({
          title: "Текст распознан",
          description: `"${text}"`,
        });
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
        toast({
          title: "Ошибка распознавания",
          variant: "destructive",
        });
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [selectedCell, toast]);

  const startListening = () => {
    if (!selectedCell) {
      toast({
        title: "Выберите ячейку",
        description: "Сначала кликните на ячейку таблицы",
      });
      return;
    }
    if (recognitionRef.current) {
      setTranscript('');
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const updateCell = (row: number, col: number, value: string) => {
    setCells(prev => 
      prev.map(cell => 
        cell.row === row && cell.col === col 
          ? { ...cell, value } 
          : cell
      )
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    toast({
      title: "Загружено",
      description: "Функция OCR в разработке",
    });
  };

  const exportToCSV = () => {
    const rows: string[][] = Array(ROWS).fill(null).map(() => Array(COLS).fill(''));
    cells.forEach(cell => {
      rows[cell.row][cell.col] = cell.value;
    });
    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'table.csv';
    a.click();
    toast({
      title: "Экспорт завершён",
      description: "Файл table.csv загружен",
    });
  };

  const clearAll = () => {
    setCells(prev => prev.map(cell => ({ ...cell, value: '' })));
    toast({
      title: "Очищено",
      description: "Все данные удалены",
    });
  };

  const autoDetectColumnTypes = () => {
    const newColumns = columns.map(col => {
      const columnValues = cells
        .filter(cell => cell.col === col.index)
        .map(cell => cell.value);
      const detectedType = detectColumnType(columnValues);
      return { ...col, type: detectedType };
    });
    setColumns(newColumns);
    toast({
      title: "Типы определены",
      description: "Столбцы автоматически настроены",
    });
  };

  const updateColumnConfig = (index: number, field: 'name' | 'type', value: string) => {
    setColumns(prev => 
      prev.map(col => 
        col.index === index 
          ? { ...col, [field]: value } 
          : col
      )
    );
  };

  const getCellValue = (row: number, col: number) => {
    return cells.find(c => c.row === row && c.col === col)?.value || '';
  };

  const getColumnIcon = (type: string) => {
    switch (type) {
      case 'date': return 'Calendar';
      case 'title': return 'Heading';
      case 'info': return 'FileText';
      default: return 'Type';
    }
  };

  const getColumnColor = (type: string) => {
    switch (type) {
      case 'date': return 'text-cyan-400';
      case 'title': return 'text-purple-400';
      case 'info': return 'text-yellow-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto py-8 px-4">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent mb-2">
              Excel Voice Pro
            </h1>
            <p className="text-slate-400">Голосовое и визуальное заполнение таблиц</p>
          </div>
          <Button
            onClick={autoDetectColumnTypes}
            className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600"
          >
            <Icon name="Sparkles" size={18} className="mr-2" />
            Авто-определение типов
          </Button>
        </header>

        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          <aside className="space-y-4">
            <Card className="p-6 shadow-2xl border-slate-700 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur">
              <Tabs defaultValue="voice" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4 bg-slate-900/50">
                  <TabsTrigger value="voice" className="data-[state=active]:bg-purple-500">
                    <Icon name="Mic" size={16} className="mr-2 text-purple-400" />
                    Голос
                  </TabsTrigger>
                  <TabsTrigger value="scan" className="data-[state=active]:bg-cyan-500">
                    <Icon name="Scan" size={16} className="mr-2 text-cyan-400" />
                    Сканер
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="voice" className="space-y-4">
                  <div className="text-center">
                    <Button
                      onClick={isListening ? stopListening : startListening}
                      className={`w-full h-16 text-lg font-semibold transition-all ${
                        isListening 
                          ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 animate-pulse shadow-lg shadow-red-500/50' 
                          : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/50'
                      }`}
                      disabled={!('webkitSpeechRecognition' in window)}
                    >
                      <Icon name={isListening ? "StopCircle" : "Mic"} size={24} className="mr-2" />
                      {isListening ? 'Остановить' : 'Начать запись'}
                    </Button>
                  </div>
                  {transcript && (
                    <div className="p-4 bg-slate-800/50 rounded-lg border border-purple-500/30 shadow-lg">
                      <p className="text-sm text-purple-400 mb-1">Распознано:</p>
                      <p className="text-slate-100 font-medium">{transcript}</p>
                    </div>
                  )}
                  {selectedCell && (
                    <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/50 shadow-lg">
                      <p className="text-sm text-cyan-400">
                        Выбрана: <span className="font-bold text-cyan-300">
                          {columns[selectedCell.col]?.name}{selectedCell.row + 1}
                        </span>
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="scan" className="space-y-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-16 text-lg font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg shadow-cyan-500/50"
                  >
                    <Icon name="Upload" size={24} className="mr-2" />
                    Загрузить фото
                  </Button>
                  <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/50">
                    <p className="text-sm text-yellow-400">
                      <Icon name="Info" size={16} className="inline mr-1" />
                      Загрузите фото для распознавания
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </Card>

            <Card className="p-6 shadow-2xl border-slate-700 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur">
              <h3 className="font-semibold text-slate-100 mb-4 flex items-center">
                <Icon name="Settings" size={18} className="mr-2 text-pink-400" />
                Управление
              </h3>
              <div className="space-y-2">
                <Button onClick={exportToCSV} variant="outline" className="w-full justify-start border-slate-600 hover:bg-slate-700/50">
                  <Icon name="Download" size={18} className="mr-2 text-green-400" />
                  Экспорт CSV
                </Button>
                <Button onClick={clearAll} variant="outline" className="w-full justify-start border-slate-600 hover:bg-slate-700/50">
                  <Icon name="Trash2" size={18} className="mr-2 text-red-400" />
                  Очистить всё
                </Button>
              </div>
            </Card>
          </aside>

          <main>
            <Card className="p-4 shadow-2xl border-slate-700 overflow-x-auto bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-100">Таблица данных</h2>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Icon name="Save" size={16} className="text-green-400" />
                  <span>Автосохранение</span>
                </div>
              </div>
              <div className="border border-slate-700 rounded-lg overflow-hidden shadow-xl">
                <table className="w-full border-collapse bg-slate-950/50">
                  <thead>
                    <tr className="bg-slate-900/80">
                      <th className="border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 w-16">#</th>
                      {columns.map((col) => (
                        <th key={col.index} className="border border-slate-700 px-2 py-2 min-w-[140px]">
                          <Dialog open={editingColumn === col.index} onOpenChange={(open) => setEditingColumn(open ? col.index : null)}>
                            <DialogTrigger asChild>
                              <button className="w-full flex items-center justify-center gap-2 hover:bg-slate-800/50 rounded p-2 transition-colors">
                                <Icon name={getColumnIcon(col.type)} size={16} className={getColumnColor(col.type)} />
                                <span className={`text-sm font-semibold ${getColumnColor(col.type)}`}>
                                  {col.name}
                                </span>
                                <Icon name="Settings2" size={14} className="text-slate-500" />
                              </button>
                            </DialogTrigger>
                            <DialogContent className="bg-slate-900 border-slate-700">
                              <DialogHeader>
                                <DialogTitle className="text-slate-100">Настройка столбца {col.name}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 mt-4">
                                <div>
                                  <label className="text-sm text-slate-400 mb-2 block">Название</label>
                                  <Input
                                    value={col.name}
                                    onChange={(e) => updateColumnConfig(col.index, 'name', e.target.value)}
                                    className="bg-slate-800 border-slate-700"
                                  />
                                </div>
                                <div>
                                  <label className="text-sm text-slate-400 mb-2 block">Тип данных</label>
                                  <Select 
                                    value={col.type} 
                                    onValueChange={(value) => updateColumnConfig(col.index, 'type', value)}
                                  >
                                    <SelectTrigger className="bg-slate-800 border-slate-700">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-700">
                                      <SelectItem value="date">
                                        <span className="flex items-center gap-2">
                                          <Icon name="Calendar" size={16} className="text-cyan-400" />
                                          Дата
                                        </span>
                                      </SelectItem>
                                      <SelectItem value="title">
                                        <span className="flex items-center gap-2">
                                          <Icon name="Heading" size={16} className="text-purple-400" />
                                          Название
                                        </span>
                                      </SelectItem>
                                      <SelectItem value="info">
                                        <span className="flex items-center gap-2">
                                          <Icon name="FileText" size={16} className="text-yellow-400" />
                                          Информация
                                        </span>
                                      </SelectItem>
                                      <SelectItem value="text">
                                        <span className="flex items-center gap-2">
                                          <Icon name="Type" size={16} className="text-slate-400" />
                                          Текст
                                        </span>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: ROWS }).map((_, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-slate-800/30 transition-colors">
                        <td className="border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-500 bg-slate-900/50">
                          {rowIndex + 1}
                        </td>
                        {Array.from({ length: COLS }).map((_, colIndex) => (
                          <td
                            key={colIndex}
                            className={`border border-slate-700 p-0 ${
                              selectedCell?.row === rowIndex && selectedCell?.col === colIndex
                                ? 'ring-2 ring-purple-500 ring-inset'
                                : ''
                            }`}
                            onClick={() => setSelectedCell({ row: rowIndex, col: colIndex })}
                          >
                            <Input
                              value={getCellValue(rowIndex, colIndex)}
                              onChange={(e) => updateCell(rowIndex, colIndex, e.target.value)}
                              className="border-0 rounded-none focus-visible:ring-0 h-10 px-3 bg-transparent text-slate-100"
                              placeholder="..."
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Index;
