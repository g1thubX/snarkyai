import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Upload, Sparkles, Image as ImageIcon, Download, RefreshCw, AlertTriangle, Type as TypeIcon, Palette, Minus, Plus } from 'lucide-react';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const TEMPLATES = [
  { id: '1', url: 'https://images.unsplash.com/photo-1531259683007-016a7b628fc3?auto=format&fit=crop&w=800&q=80', name: 'Hacker Cat' },
  { id: '2', url: 'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?auto=format&fit=crop&w=800&q=80', name: 'Judging Pug' },
  { id: '3', url: 'https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?auto=format&fit=crop&w=800&q=80', name: 'Shocked Kitten' },
  { id: '4', url: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=800&q=80', name: 'Chaos Dog' },
];

const FONT_OPTIONS = [
  { id: 'classic', name: 'Classic', family: 'Impact, "Arial Black", sans-serif' },
  { id: 'modern', name: 'Modern', family: '"Space Grotesk", sans-serif' },
  { id: 'ironic', name: 'Ironic', family: '"Comic Sans MS", "Chalkboard SE", sans-serif' },
  { id: 'hacker', name: 'Hacker', family: '"JetBrains Mono", monospace' },
  { id: 'marker', name: 'Marker', family: '"Permanent Marker", cursive' },
  { id: 'cursed', name: 'Cursed', family: '"Creepster", system-ui' },
];

const STYLE_OPTIONS = [
  { id: 'white-black', name: 'Classic', fill: '#FFFFFF', stroke: '#000000', shadow: false },
  { id: 'neon-green', name: 'Toxic', fill: '#32ff00', stroke: '#000000', shadow: true },
  { id: 'neon-pink', name: 'Cyber', fill: '#ff6b9b', stroke: '#000000', shadow: true },
  { id: 'yellow-black', name: 'Warning', fill: '#FFE800', stroke: '#000000', shadow: false },
  { id: 'black-white', name: 'Inverted', fill: '#000000', stroke: '#FFFFFF', shadow: false },
  { id: 'red-black', name: 'Danger', fill: '#FF0000', stroke: '#000000', shadow: true },
];

export default function App() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [base64Data, setBase64Data] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  
  const [captions, setCaptions] = useState<string[]>([]);
  const [activeCaption, setActiveCaption] = useState<string>('');
  const [selectedFont, setSelectedFont] = useState<string>(FONT_OPTIONS[0].family);
  const [selectedStyle, setSelectedStyle] = useState(STYLE_OPTIONS[0]);
  const [fontScale, setFontScale] = useState<number>(100);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setImageSrc(result);
      setMimeType(file.type);
      // Extract just the base64 data part
      const base64 = result.split(',')[1];
      setBase64Data(base64);
      
      // Reset state
      setCaptions([]);
      setActiveCaption('');
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleTemplateSelect = async (url: string) => {
    try {
      setCaptions([]);
      setActiveCaption('');
      setError(null);
      setBase64Data(null); // Clear previous base64
      
      // Fetch and convert template to base64 for Gemini and Canvas
      const response = await fetch(url);
      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onloadend = () => {
        const result = reader.result as string;
        setMimeType(blob.type);
        setBase64Data(result.split(',')[1]);
        setImageSrc(result); // Use data URL to avoid Canvas CORS issues
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      setError("Failed to load template. Try uploading an image instead.");
    }
  };

  const generateCaptions = async () => {
    if (!base64Data || !mimeType) {
      setError("Please upload an image or select a template first.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            }
          },
          "You are a snarky, internet-fluent meme lord. Analyze this image and generate exactly 5 funny, punchy, highly relatable meme captions for it. They should be short enough to fit on an image. Return ONLY a JSON array of strings."
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });

      if (response.text) {
        const parsedCaptions = JSON.parse(response.text);
        setCaptions(parsedCaptions);
        if (parsedCaptions.length > 0) {
          setActiveCaption(parsedCaptions[0]);
        }
      } else {
        throw new Error("No response from AI");
      }
    } catch (err) {
      console.error(err);
      setError("The AI refused to roast this image. Try another one.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Canvas Drawing Logic
  useEffect(() => {
    const drawMeme = async () => {
      if (!canvasRef.current || !imageSrc) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      await document.fonts.ready;

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);

        if (!activeCaption) return;

        let fontSize = Math.floor(canvas.height / 8) * (fontScale / 100);
        const minFontSize = Math.max(Math.floor(canvas.height / 25), 12) * Math.min(1, fontScale / 100);
        const padding = canvas.width * 0.05;
        const maxWidth = canvas.width - (padding * 2);
        const maxHeight = canvas.height * 0.4 * (fontScale / 100);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.lineJoin = 'round';

        let lines: string[] = [];
        let lineHeight = 0;

        while (fontSize >= minFontSize) {
          ctx.font = `bold ${fontSize}px ${selectedFont}`;
          lines = [];
          
          // Split by manual newlines first
          const paragraphs = activeCaption.toUpperCase().split('\n');
          
          for (const p of paragraphs) {
            const words = p.split(' ');
            let currentLine = '';
            
            for (let i = 0; i < words.length; i++) {
              const word = words[i];
              const space = i === words.length - 1 ? '' : ' ';
              const testLine = currentLine + word + space;
              
              if (ctx.measureText(testLine).width > maxWidth) {
                if (currentLine === '') {
                  // The word itself is too long (e.g., Chinese text without spaces). Break char by char.
                  let tempLine = '';
                  for (let j = 0; j < word.length; j++) {
                    const char = word[j];
                    if (ctx.measureText(tempLine + char).width > maxWidth && tempLine !== '') {
                      lines.push(tempLine);
                      tempLine = char;
                    } else {
                      tempLine += char;
                    }
                  }
                  currentLine = tempLine + space;
                } else {
                  // Push the current line and start a new one
                  lines.push(currentLine.trimEnd());
                  
                  // Check if the new word itself is too long
                  if (ctx.measureText(word + space).width > maxWidth) {
                    let tempLine = '';
                    for (let j = 0; j < word.length; j++) {
                      const char = word[j];
                      if (ctx.measureText(tempLine + char).width > maxWidth && tempLine !== '') {
                        lines.push(tempLine);
                        tempLine = char;
                      } else {
                        tempLine += char;
                      }
                    }
                    currentLine = tempLine + space;
                  } else {
                    currentLine = word + space;
                  }
                }
              } else {
                currentLine = testLine;
              }
            }
            if (currentLine) {
              lines.push(currentLine.trimEnd());
            }
          }

          lineHeight = fontSize * 1.2;
          const totalHeight = lines.length * lineHeight;

          let tooWide = lines.some(line => ctx.measureText(line).width > maxWidth);
          if (!tooWide && totalHeight <= maxHeight) {
            break;
          }
          fontSize -= 2;
        }

        const startY = canvas.height - padding;
        lines.reverse().forEach((line, index) => {
          const y = startY - (index * lineHeight);
          
          if (selectedStyle.shadow) {
            ctx.shadowColor = selectedStyle.fill;
            ctx.shadowBlur = Math.max(fontSize * 0.2, 10);
          } else {
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
          }

          ctx.lineWidth = Math.max(fontSize * 0.15, 2);
          ctx.strokeStyle = selectedStyle.stroke;
          ctx.strokeText(line, canvas.width / 2, y);
          
          // Reset shadow for the fill so it doesn't double-blur
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          
          ctx.fillStyle = selectedStyle.fill;
          ctx.fillText(line, canvas.width / 2, y);
        });
      };
      img.src = imageSrc;
    };

    drawMeme();
  }, [imageSrc, activeCaption, selectedFont, selectedStyle, fontScale]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `snarky-meme-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation / Header */}
      <nav className="bg-surface-low border-b border-white/5 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="text-2xl font-headline font-black tracking-tighter text-primary uppercase">
            SnarkyAI <span className="text-white/30">//</span> Meme Forge
          </div>
          <div className="text-sm font-bold text-secondary tracking-widest uppercase bg-secondary/10 px-3 py-1 rounded-full">
            Beta v0.9
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Canvas Area */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-surface-low rounded-2xl p-6 border border-white/5 sticker-shadow-primary flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-headline font-bold text-xl uppercase tracking-tight">The Canvas</h2>
              {imageSrc && (
                <div className="flex items-center gap-4">
                  <button 
                    onClick={handleDownload}
                    className="flex items-center gap-2 text-secondary hover:text-white transition-colors text-sm font-bold uppercase"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                  <button 
                    onClick={() => { setImageSrc(null); setCaptions([]); setActiveCaption(''); }}
                    className="text-white/50 hover:text-tertiary transition-colors text-sm font-bold uppercase"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 bg-surface-highest rounded-xl overflow-hidden relative flex items-center justify-center min-h-[400px] border-2 border-dashed border-white/10">
              {!imageSrc ? (
                <div className="text-center p-8 flex flex-col items-center">
                  <ImageIcon className="w-16 h-16 text-white/20 mb-4" />
                  <p className="text-white/50 font-medium mb-6">Drop an image here or select a template</p>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-chaos-secondary px-6 py-3 rounded-lg flex items-center gap-2"
                  >
                    <Upload className="w-5 h-5" />
                    Upload Image
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>
              ) : (
                <div className="relative w-full h-full flex items-center justify-center bg-black/50">
                  <canvas 
                    ref={canvasRef}
                    className="max-w-full max-h-[600px] object-contain"
                  />
                </div>
              )}
            </div>
            
            {/* Manual Text Input & Font Selection */}
            {imageSrc && (
              <div className="mt-4 flex flex-col gap-3">
                <textarea
                  value={activeCaption}
                  onChange={(e) => setActiveCaption(e.target.value)}
                  placeholder="Or type your own garbage here... (Press Enter for new line)"
                  rows={3}
                  className="w-full bg-surface-highest border-b-2 border-white/20 focus:border-secondary text-white px-4 py-3 rounded-t-lg outline-none transition-colors font-headline font-bold text-lg resize-y"
                />
                
                {/* Font Family Selection */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  <TypeIcon className="w-5 h-5 text-white/50 shrink-0" />
                  {FONT_OPTIONS.map(font => (
                    <button
                      key={font.id}
                      onClick={() => setSelectedFont(font.family)}
                      style={{ fontFamily: font.family }}
                      className={`px-3 py-1.5 rounded-md whitespace-nowrap text-sm transition-all ${
                        selectedFont === font.family 
                          ? 'bg-secondary text-black font-bold shadow-[2px_2px_0px_0px_var(--color-primary)]' 
                          : 'bg-surface border border-white/10 text-white hover:border-white/30'
                      }`}
                    >
                      {font.name}
                    </button>
                  ))}
                </div>

                {/* Font Color/Style Selection */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  <Palette className="w-5 h-5 text-white/50 shrink-0" />
                  {STYLE_OPTIONS.map(style => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedStyle(style)}
                      className={`px-3 py-1.5 rounded-md whitespace-nowrap text-sm font-bold transition-all flex items-center gap-2 ${
                        selectedStyle.id === style.id 
                          ? 'bg-surface-highest border-2 border-primary' 
                          : 'bg-surface border border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div 
                        className="w-4 h-4 rounded-full border border-white/20"
                        style={{ 
                          backgroundColor: style.fill,
                          boxShadow: style.shadow ? `0 0 8px ${style.fill}` : 'none'
                        }}
                      />
                      <span className="text-white">{style.name}</span>
                    </button>
                  ))}
                </div>

                {/* Font Scale Selection */}
                <div className="flex items-center gap-3 bg-surface border border-white/10 rounded-lg px-3 py-2 w-fit">
                  <span className="text-white/50 text-sm font-bold uppercase tracking-wider text-xs">Size</span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setFontScale(s => Math.max(20, s - 10))}
                      className="p-1 hover:bg-white/10 rounded text-white transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-white text-sm font-mono w-12 text-center">{fontScale}%</span>
                    <button 
                      onClick={() => setFontScale(s => Math.min(300, s + 10))}
                      className="p-1 hover:bg-white/10 rounded text-white transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Controls & AI */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Templates Section */}
          <div className="bg-surface-low rounded-2xl p-6 border border-white/5">
            <h3 className="font-headline font-bold text-sm text-white/50 uppercase tracking-widest mb-4">Trending Templates</h3>
            <div className="grid grid-cols-4 gap-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleTemplateSelect(t.url)}
                  className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-all focus:outline-none focus:border-primary"
                >
                  <img src={t.url} alt={t.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </button>
              ))}
            </div>
          </div>

          {/* AI Magic Section */}
          <div className="bg-surface-low rounded-2xl p-6 border border-white/5 flex-1 flex flex-col relative overflow-hidden">
            {/* Decorative background glow */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/10 blur-[80px] rounded-full pointer-events-none"></div>
            
            <h3 className="font-headline font-bold text-2xl uppercase tracking-tight mb-2">AI Brain Juice</h3>
            <p className="text-white/60 text-sm mb-6">Let the machine judge your image and generate top-tier internet garbage.</p>

            <button
              onClick={generateCaptions}
              disabled={!imageSrc || isAnalyzing}
              className="btn-chaos-primary w-full py-4 rounded-xl flex items-center justify-center gap-3 text-lg mb-8"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-6 h-6 animate-spin" />
                  Analyzing Chaos...
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" />
                  Magic Caption
                </>
              )}
            </button>

            {error && (
              <div className="bg-tertiary/20 text-tertiary p-4 rounded-lg flex items-start gap-3 mb-6 border border-tertiary/30">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Results */}
            <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-2">
              {captions.length === 0 && !isAnalyzing && !error && (
                <div className="flex-1 flex items-center justify-center text-white/30 font-headline italic text-center p-4 border-2 border-dashed border-white/10 rounded-xl">
                  Waiting for visual input...
                </div>
              )}
              
              {captions.map((caption, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveCaption(caption)}
                  className={`text-left p-4 rounded-xl font-headline font-bold text-lg transition-all border-l-4 ${
                    activeCaption === caption 
                      ? 'bg-surface-highest border-secondary text-secondary shadow-[4px_4px_0px_0px_rgba(50,255,0,0.1)]' 
                      : 'bg-surface border-white/10 text-white hover:bg-surface-highest hover:border-primary hover:text-primary'
                  }`}
                >
                  "{caption}"
                </button>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
