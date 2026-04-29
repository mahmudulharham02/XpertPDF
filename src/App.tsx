import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Images, 
  Merge, 
  Minimize2, 
  PenTool, 
  Scan,
  LayoutDashboard,
  Menu,
  X,
  BookOpen,
  Settings
} from 'lucide-react';
import { ExtractTool } from './components/tools/ExtractTool';
import { MergeTool } from './components/tools/MergeTool';
import { CompressTool } from './components/tools/CompressTool';
import { SignTool } from './components/tools/SignTool';
import { ScanTool } from './components/tools/ScanTool';
import { ExtractImagesTool } from './components/tools/ExtractImagesTool';
import { ViewerTool } from './components/tools/ViewerTool';
import { SettingsTool } from './components/tools/SettingsTool';

export type ToolType = 'dashboard' | 'viewer' | 'extract-text' | 'extract-images' | 'merge' | 'compress' | 'sign' | 'scan' | 'settings';

export default function App() {
  const [activeTool, setActiveTool] = useState<ToolType>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState('pitch-dark'); // light, pitch-dark, ocean, rose
  const [font, setFont] = useState('sans'); // sans, arial, georgia, courier

  // Load from local storage
  useEffect(() => {
    const savedTheme = localStorage.getItem('app-theme');
    const savedFont = localStorage.getItem('app-font');
    if (savedTheme) setTheme(savedTheme);
    if (savedFont) setFont(savedFont);
  }, []);

  const handleSetTheme = (t: string) => {
    setTheme(t);
    localStorage.setItem('app-theme', t);
  };

  const handleSetFont = (f: string) => {
    setFont(f);
    localStorage.setItem('app-font', f);
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'viewer', label: 'PDF Viewer', icon: BookOpen },
    { id: 'extract-text', label: 'Extract Text (OCR)', icon: FileText },
    { id: 'extract-images', label: 'Extract Images', icon: Images },
    { id: 'merge', label: 'Merge PDFs', icon: Merge },
    { id: 'compress', label: 'Compress PDF', icon: Minimize2 },
    { id: 'sign', label: 'Sign Document', icon: PenTool },
    { id: 'scan', label: 'Scan to Text', icon: Scan },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  const fontClass = font === 'sans' ? 'font-sans' : `font-${font}`;
  const themeClass = theme === 'light' ? '' : `theme-${theme}`;

  return (
    <div className={`flex h-screen w-full bg-slate-50 text-slate-900 overflow-hidden ${fontClass} ${themeClass}`}>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-20 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:static inset-y-0 left-0 w-64 bg-slate-900 text-white flex flex-col shadow-xl z-30 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2 text-indigo-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span className="text-xl font-bold tracking-tight text-white">Xpert<span className="text-indigo-400">PDF</span></span>
          </div>
          <button 
            className="md:hidden p-1 text-slate-400 hover:text-white transition-colors"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTool === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTool(item.id);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-200' : 'text-slate-400'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-white/10 text-xs font-normal text-slate-500">
          <p>&copy; 2026 XpertPDF</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 md:px-8 shrink-0 z-10 shadow-sm gap-4">
          <button 
            className="md:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold text-slate-800">
            {navItems.find(i => i.id === activeTool)?.label}
          </h1>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-auto bg-slate-50 relative p-4 md:p-8 custom-scrollbar">
          <div className="max-w-5xl mx-auto min-h-full flex flex-col">
            {activeTool === 'dashboard' && <Dashboard setActiveTool={setActiveTool} />}
            {activeTool === 'viewer' && <ViewerTool />}
            {activeTool === 'extract-text' && <ExtractTool />}
            {activeTool === 'extract-images' && <ExtractImagesTool />}
            {activeTool === 'merge' && <MergeTool />}
            {activeTool === 'compress' && <CompressTool />}
            {activeTool === 'sign' && <SignTool />}
            {activeTool === 'scan' && <ScanTool />}
            {activeTool === 'settings' && <SettingsTool currentTheme={theme} setTheme={handleSetTheme} currentFont={font} setFont={handleSetFont} />}
          </div>
        </div>
      </main>
    </div>
  );
}

function Dashboard({ setActiveTool }: { setActiveTool: (t: ToolType) => void }) {
  const tools = [
    { id: 'viewer', title: 'PDF Viewer', desc: 'Open and read PDF documents securely in your browser.', icon: BookOpen, color: 'text-sky-600', bg: 'bg-sky-100' },
    { id: 'extract-text', title: 'OCR Text Extraction', desc: 'Extract editable text from native or scanned PDFs using AI.', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-100' },
    { id: 'extract-images', title: 'Export Images', desc: 'Pull all graphical assets from documents as JPG or PNG.', icon: Images, color: 'text-purple-600', bg: 'bg-purple-100' },
    { id: 'merge', title: 'Merge Documents', desc: 'Combine multiple PDF files into a single document easily.', icon: Merge, color: 'text-amber-600', bg: 'bg-amber-100' },
    { id: 'compress', title: 'Compress PDF', desc: 'Reduce file size while maintaining visual quality.', icon: Minimize2, color: 'text-green-600', bg: 'bg-green-100' },
    { id: 'sign', title: 'Digital Signatures', desc: 'Draw and place verified signatures on your contracts.', icon: PenTool, color: 'text-rose-600', bg: 'bg-rose-100' },
    { id: 'scan', title: 'Scan and Digitize', desc: 'Use your camera to scan physical papers into digital text.', icon: Scan, color: 'text-indigo-600', bg: 'bg-indigo-100' },
  ] as const;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-10">
        <h2 className="text-3xl font-bold tracking-tight mb-2 bg-[#000000] text-[#3829fe]">Welcome to XpertPDF</h2>
        <p className="text-slate-500 text-lg">Your complete toolkit for intelligent document processing and management.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <div 
              key={tool.id}
              onClick={() => setActiveTool(tool.id as ToolType)}
              className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group"
            >
              <div className={`w-12 h-12 rounded-lg ${tool.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className={`w-6 h-6 ${tool.color}`} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{tool.title}</h3>
              <p className="text-sm text-slate-500">{tool.desc}</p>
            </div>
          );
        })}
      </div>
      
      <div className="mt-12 bg-indigo-50 rounded-2xl p-8 border border-indigo-100 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-indigo-900 mb-2">Powered by Advanced AI OCR</h3>
          <p className="text-indigo-700 max-w-xl">XpertPDF uses next-generation vision models to ensure flawless extraction even from handwritten or heavily degraded scans across 50+ languages.</p>
        </div>
        <div className="hidden lg:block w-32 h-32 relative">
          <div className="absolute inset-0 bg-indigo-200 rounded-full animate-pulse opacity-50"></div>
          <div className="absolute inset-4 bg-indigo-300 rounded-full flex items-center justify-center shadow-lg">
             <Scan className="w-12 h-12 text-indigo-700" />
          </div>
        </div>
      </div>
    </div>
  );
}
