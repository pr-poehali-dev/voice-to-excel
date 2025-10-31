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

interface AISuggestion {
  value: string;
  confidence: number;
  reason: string;
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

const analyzePatterns = (cells: CellData[], row: number, col: number, currentValue: string): AISuggestion[] => {
  const suggestions: AISuggestion[] = [];
  const columnValues = cells.filter(c => c.col === col && c.value.trim() !== '').map(c => c.value);
  
  if (currentValue.length < 2) return suggestions;

  const matches = columnValues.filter(v => 
    v.toLowerCase().startsWith(currentValue.toLowerCase()) && v !== currentValue
  );
  
  const uniqueMatches = Array.from(new Set(matches));
  uniqueMatches.forEach(match => {
    const frequency = columnValues.filter(v => v === match).length;
    suggestions.push({
      value: match,
      confidence: Math.min(frequency * 20, 95),
      reason: frequency > 1 ? `Встречается ${frequency} раз` : 'Похожее значение'
    });
  });

  if (row > 0) {
    const prevRowValue = cells.find(c => c.row === row - 1 && c.col === col)?.value;
    if (prevRowValue && prevRowValue.trim() !== '' && !suggestions.find(s => s.value === prevRowValue)) {
      suggestions.push({
        value: prevRowValue,
        confidence: 75,
        reason: 'Значение из строки выше'
      });
    }
  }

  const valueFrequency = new Map<string, number>();
  columnValues.forEach(v => {
    valueFrequency.set(v, (valueFrequency.get(v) || 0) + 1);
  });
  
  const mostCommon = Array.from(valueFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .filter(([value, count]) => 
      count > 1 && 
      !suggestions.find(s => s.value === value) &&
      value.toLowerCase().includes(currentValue.toLowerCase())
    );
  
  mostCommon.forEach(([value, count]) => {
    suggestions.push({
      value,
      confidence: Math.min(count * 15 + 30, 90),
      reason: `Часто используется (${count}x)`
    });
  });

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
};

const Index = () => {
  const [cells, setCells] = useState<CellData[]>([]);
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [selectedCell, setSelectedCell] = useState<{row: number, col: number} | null>(null);
  const [editingColumn, setEditingColumn] = useState<number | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
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
          setCells(prev => 
            prev.map(cell => 
              cell.row === selectedCell.row && cell.col === selectedCell.col 
                ? { ...cell, value: text } 
                : cell
            )
          );
        }
        toast({
          title: "Текст распознан",
          description: `"${text}"`,
        });
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        toast({
          title: "Ошибка распознавания",
          description: event.error === 'no-speech' ? 'Речь не обнаружена' : 'Попробуйте ещё раз',
          variant: "destructive",
        });
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [selectedCell, toast, cells]);

  const startListening = () => {
    if (!selectedCell) {
      toast({
        title: "Выберите ячейку",
        description: "Сначала кликните на ячейку таблицы",
      });
      return;
    }
    if (recognitionRef.current) {
      try {
        setTranscript('');
        setIsListening(true);
        recognitionRef.current.start();
        toast({
          title: "Слушаю...",
          description: "Говорите сейчас",
        });
      } catch (error) {
        console.error('Error starting recognition:', error);
        setIsListening(false);
        toast({
          title: "Ошибка",
          description: "Не удалось запустить распознавание",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Не поддерживается",
        description: "Ваш браузер не поддерживает распознавание речи",
        variant: "destructive",
      });
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const updateCell = (row: number, col: number, value: string, skipSuggestions = false) => {
    setCells(prev => 
      prev.map(cell => 
        cell.row === row && cell.col === col 
          ? { ...cell, value } 
          : cell
      )
    );

    if (!skipSuggestions && aiEnabled && value.length >= 2) {
      const newSuggestions = analyzePatterns(cells, row, col, value);
      setAiSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
      setSelectedSuggestionIndex(0);
    } else {
      setShowSuggestions(false);
      setAiSuggestions([]);
    }
  };

  const applySuggestion = (suggestion: AISuggestion) => {
    if (selectedCell) {
      updateCell(selectedCell.row, selectedCell.col, suggestion.value, true);
      setShowSuggestions(false);
      toast({
        title: "Применено",
        description: `${suggestion.reason} (${suggestion.confidence}% уверенности)`,
      });
    }
  };

  const autoFillColumn = (col: number) => {
    const columnCells = cells.filter(c => c.col === col);
    const filledCells = columnCells.filter(c => c.value.trim() !== '');
    const emptyCells = columnCells.filter(c => c.value.trim() === '');

    if (filledCells.length === 0 || emptyCells.length === 0) {
      toast({
        title: "Нет данных",
        description: "Недостаточно данных для автозаполнения",
        variant: "destructive"
      });
      return;
    }

    const valueFrequency = new Map<string, number>();
    filledCells.forEach(c => {
      valueFrequency.set(c.value, (valueFrequency.get(c.value) || 0) + 1);
    });

    const mostCommonValue = Array.from(valueFrequency.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0];

    if (mostCommonValue) {
      setCells(prev => 
        prev.map(cell => 
          cell.col === col && cell.value.trim() === ''
            ? { ...cell, value: mostCommonValue }
            : cell
        )
      );
      toast({
        title: "Автозаполнение выполнено",
        description: `Заполнено ${emptyCells.length} ячеек значением "${mostCommonValue}"`,
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedCell) {
      toast({
        title: "Выберите ячейку",
        description: "Сначала выберите ячейку для вставки текста",
        variant: "destructive"
      });
      return;
    }

    setIsProcessingOCR(true);
    toast({
      title: "Обработка изображения...",
      description: "ИИ распознаёт текст, подождите",
    });

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Image = event.target?.result as string;
        
        try {
          const response = await fetch('https://functions.poehali.dev/32b98d17-d76f-43cf-85ea-e1d226b5f7f2', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image: base64Image
            })
          });

          const result = await response.json();

          if (response.ok && result.text) {
            updateCell(selectedCell.row, selectedCell.col, result.text, true);
            toast({
              title: "Текст распознан!",
              description: `Распознано: "${result.text.substring(0, 50)}${result.text.length > 50 ? '...' : ''}"`,
            });
          } else {
            toast({
              title: "Ошибка распознавания",
              description: result.error || "Не удалось распознать текст",
              variant: "destructive"
            });
          }
        } catch (error) {
          console.error('OCR error:', error);
          toast({
            title: "Ошибка сети",
            description: "Не удалось обработать изображение",
            variant: "destructive"
          });
        } finally {
          setIsProcessingOCR(false);
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('File reading error:', error);
      setIsProcessingOCR(false);
      toast({
        title: "Ошибка чтения файла",
        description: "Не удалось загрузить изображение",
        variant: "destructive"
      });
    }

    e.target.value = '';
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
            <p className="text-slate-400">Голосовое и визуальное заполнение таблиц с ИИ</p>
          </div>
          <div className="flex gap-2 items-center">
            <Button
              onClick={() => setAiEnabled(!aiEnabled)}
              variant={aiEnabled ? "default" : "outline"}
              className={aiEnabled ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600" : ""}
            >
              <Icon name={aiEnabled ? "Sparkles" : "SparklesIcon"} size={18} className="mr-2" />
              ИИ {aiEnabled ? "ON" : "OFF"}
            </Button>
            <Button
              onClick={autoDetectColumnTypes}
              className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600"
            >
              <Icon name="Wand2" size={18} className="mr-2" />
              Авто-типы
            </Button>
          </div>
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
                    className={`w-full h-16 text-lg font-semibold transition-all ${
                      isProcessingOCR
                        ? 'bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 animate-pulse shadow-lg shadow-orange-500/50'
                        : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg shadow-cyan-500/50'
                    }`}
                    disabled={isProcessingOCR}
                  >
                    <Icon name={isProcessingOCR ? "Loader2" : "Upload"} size={24} className={`mr-2 ${isProcessingOCR ? 'animate-spin' : ''}`} />
                    {isProcessingOCR ? 'Обработка...' : 'Загрузить фото'}
                  </Button>
                  <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/50">
                    <p className="text-sm text-cyan-400">
                      <Icon name="Sparkles" size={16} className="inline mr-1" />
                      ИИ распознает рукописный и печатный текст
                    </p>
                  </div>
                  {selectedCell && (
                    <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/50 shadow-lg">
                      <p className="text-sm text-cyan-400">
                        Текст будет в ячейке: <span className="font-bold text-cyan-300">
                          {columns[selectedCell.col]?.name}{selectedCell.row + 1}
                        </span>
                      </p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </Card>

            <Card className="p-6 shadow-2xl border-slate-700 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur">
              <h3 className="font-semibold text-slate-100 mb-4 flex items-center">
                <Icon name="Sparkles" size={18} className="mr-2 text-pink-400" />
                ИИ Помощник
              </h3>
              {aiEnabled && aiSuggestions.length > 0 && showSuggestions && (
                <div className="mb-4 space-y-2">
                  <p className="text-xs text-slate-400 mb-2">Предложения для выбранной ячейки:</p>
                  {aiSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => applySuggestion(suggestion)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        index === selectedSuggestionIndex
                          ? 'bg-purple-500/20 border-purple-500'
                          : 'bg-slate-800/50 border-slate-700 hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-100 font-medium truncate">{suggestion.value}</p>
                          <p className="text-xs text-slate-400 mt-1">{suggestion.reason}</p>
                        </div>
                        <span className="text-xs font-bold text-cyan-400 whitespace-nowrap">
                          {suggestion.confidence}%
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {aiEnabled && !showSuggestions && (
                <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <p className="text-xs text-slate-400 text-center">
                    <Icon name="Lightbulb" size={14} className="inline mr-1 text-yellow-400" />
                    Начните вводить данные для получения подсказок
                  </p>
                </div>
              )}
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
                                <div className="pt-2 border-t border-slate-700">
                                  <Button
                                    onClick={() => {
                                      autoFillColumn(col.index);
                                      setEditingColumn(null);
                                    }}
                                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                                  >
                                    <Icon name="Wand2" size={16} className="mr-2" />
                                    Автозаполнить столбец
                                  </Button>
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