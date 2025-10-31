import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';

interface CellData {
  id: string;
  row: number;
  col: number;
  value: string;
}

const Index = () => {
  const [cells, setCells] = useState<CellData[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [selectedCell, setSelectedCell] = useState<{row: number, col: number} | null>(null);
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
    toast({
      title: "Сохранено",
      description: `Ячейка ${String.fromCharCode(65 + col)}${row + 1}`,
    });
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

  const getCellValue = (row: number, col: number) => {
    return cells.find(c => c.row === row && c.col === col)?.value || '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto py-8 px-4">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
            Excel Voice & Scan
          </h1>
          <p className="text-slate-600">Профессиональный инструмент для работы с данными</p>
        </header>

        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          <aside className="space-y-4">
            <Card className="p-6 shadow-lg border-slate-200">
              <Tabs defaultValue="voice" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="voice">
                    <Icon name="Mic" size={16} className="mr-2" />
                    Голос
                  </TabsTrigger>
                  <TabsTrigger value="scan">
                    <Icon name="Scan" size={16} className="mr-2" />
                    Сканер
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="voice" className="space-y-4">
                  <div className="text-center">
                    <Button
                      onClick={isListening ? stopListening : startListening}
                      className={`w-full h-16 text-lg font-semibold transition-all ${
                        isListening ? 'bg-red-500 hover:bg-red-600 animate-pulse' : ''
                      }`}
                      disabled={!('webkitSpeechRecognition' in window)}
                    >
                      <Icon name={isListening ? "StopCircle" : "Mic"} size={24} className="mr-2" />
                      {isListening ? 'Остановить' : 'Начать запись'}
                    </Button>
                  </div>
                  {transcript && (
                    <div className="p-4 bg-slate-100 rounded-lg border border-slate-200">
                      <p className="text-sm text-slate-600 mb-1">Распознано:</p>
                      <p className="text-slate-900 font-medium">{transcript}</p>
                    </div>
                  )}
                  {selectedCell && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-900">
                        Выбрана: <span className="font-bold">
                          {String.fromCharCode(65 + selectedCell.col)}{selectedCell.row + 1}
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
                    className="w-full h-16 text-lg font-semibold"
                    variant="outline"
                  >
                    <Icon name="Upload" size={24} className="mr-2" />
                    Загрузить фото
                  </Button>
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-sm text-amber-900">
                      <Icon name="Info" size={16} className="inline mr-1" />
                      Загрузите фото документа для распознавания текста
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </Card>

            <Card className="p-6 shadow-lg border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center">
                <Icon name="Settings" size={18} className="mr-2" />
                Управление
              </h3>
              <div className="space-y-2">
                <Button onClick={exportToCSV} variant="outline" className="w-full justify-start">
                  <Icon name="Download" size={18} className="mr-2" />
                  Экспорт CSV
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Icon name="Trash2" size={18} className="mr-2" />
                  Очистить всё
                </Button>
              </div>
            </Card>
          </aside>

          <main>
            <Card className="p-4 shadow-lg border-slate-200 overflow-x-auto">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Таблица данных</h2>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Icon name="Save" size={16} />
                  <span>Автосохранение</span>
                </div>
              </div>
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full border-collapse bg-white">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 w-16">#</th>
                      {Array.from({ length: COLS }).map((_, i) => (
                        <th key={i} className="border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 min-w-[120px]">
                          {String.fromCharCode(65 + i)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: ROWS }).map((_, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-slate-50 transition-colors">
                        <td className="border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-50">
                          {rowIndex + 1}
                        </td>
                        {Array.from({ length: COLS }).map((_, colIndex) => (
                          <td
                            key={colIndex}
                            className={`border border-slate-300 p-0 ${
                              selectedCell?.row === rowIndex && selectedCell?.col === colIndex
                                ? 'ring-2 ring-blue-500 ring-inset'
                                : ''
                            }`}
                            onClick={() => setSelectedCell({ row: rowIndex, col: colIndex })}
                          >
                            <Input
                              value={getCellValue(rowIndex, colIndex)}
                              onChange={(e) => updateCell(rowIndex, colIndex, e.target.value)}
                              className="border-0 rounded-none focus-visible:ring-0 h-10 px-3"
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
