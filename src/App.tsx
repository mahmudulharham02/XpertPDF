import React, { useState, useEffect } from 'react';
import { 
  Images, 
  Merge, 
  PenTool, 
  Scan,
  LayoutDashboard,
  Menu,
  X,
  BookOpen,
  Settings,
  ArrowLeft,
  FileImage
} from 'lucide-react';
import { MergeTool } from './components/tools/MergeTool';
import { SignTool } from './components/tools/SignTool';
import { ScanTool } from './components/tools/ScanTool';
import { ExtractImagesTool } from './components/tools/ExtractImagesTool';
import { ViewerTool } from './components/tools/ViewerTool';
import { SettingsTool } from './components/tools/SettingsTool';
import { PdfToImageTool } from './components/tools/PdfToImageTool';
import { t } from './lib/i18n';

export type ToolType = 'dashboard' | 'viewer' | 'extract-images' | 'merge' | 'sign' | 'scan' | 'settings' | 'pdf-to-image';

export default function App() {
  const [activeTool, setActiveTool] = useState<ToolType>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState('pitch-dark'); // light, pitch-dark, ocean, rose
  const [font, setFont] = useState('sans'); // sans, arial, georgia, courier
  const [language, setLanguage] = useState('en'); // default to english

  // Load from local storage
  useEffect(() => {
    const savedTheme = localStorage.getItem('app-theme');
    const savedFont = localStorage.getItem('app-font');
    const savedLang = localStorage.getItem('app-lang');
    if (savedTheme) setTheme(savedTheme);
    if (savedFont) setFont(savedFont);
    if (savedLang) setLanguage(savedLang);

    const handlePopState = () => {
      setActiveTool('dashboard');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const changeTool = (tool: ToolType) => {
    setActiveTool(tool);
    setIsSidebarOpen(false);
    if (tool !== 'dashboard') {
      window.history.pushState(null, '', `#${tool}`);
    } else {
      window.history.pushState(null, '', '/');
    }
  };

  const handleSetTheme = (t: string) => {
    setTheme(t);
    localStorage.setItem('app-theme', t);
  };

  const handleSetFont = (f: string) => {
    setFont(f);
    localStorage.setItem('app-font', f);
  };

  const handleSetLanguage = (l: string) => {
    setLanguage(l);
    localStorage.setItem('app-lang', l);
  };

  const navItems = [
    { id: 'dashboard', label: t(language, 'dashboard'), icon: LayoutDashboard },
    { id: 'viewer', label: t(language, 'viewer'), icon: BookOpen },
    { id: 'extract-images', label: t(language, 'extractImages'), icon: Images },
    { id: 'pdf-to-image', label: t(language, 'pdfToImage'), icon: FileImage },
    { id: 'merge', label: t(language, 'merge'), icon: Merge },
    { id: 'sign', label: t(language, 'sign'), icon: PenTool },
    { id: 'scan', label: t(language, 'scan'), icon: Scan },
    { id: 'settings', label: t(language, 'settings'), icon: Settings },
  ] as const;

  const fontClass = font === 'sans' ? 'font-sans' : `font-${font}`;
  const themeClass = theme === 'light' ? '' : `theme-${theme}`;

  return (
    <div className={`flex h-screen w-full text-slate-900 overflow-hidden select-none app-bg-default ${fontClass} ${themeClass}`}>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 z-40 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Liquid Panel style */}
      <aside className={`fixed md:static inset-y-0 left-0 w-64 liquid-panel flex flex-col z-50 transform transition-transform duration-300 ease-in-out md:m-4 md:rounded-[24px] ${isSidebarOpen ? 'translate-x-0 m-4 rounded-[24px]' : '-translate-x-full md:translate-x-0'}`}>
        <div className="h-20 flex items-center justify-between px-6 border-b border-black/5 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3 text-indigo-500 dark:text-indigo-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-7 h-7">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">Xpert<span className="text-indigo-500 dark:text-indigo-400">PDF</span></span>
          </div>
          <button 
            className="md:hidden p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTool === item.id;
            return (
              <button
                key={item.id}
                onClick={() => changeTool(item.id as ToolType)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[16px] text-[15px] font-medium transition-all duration-300 ${
                  isActive 
                    ? 'liquid-nav-active' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
        
        <div className="p-5 border-t border-black/5 dark:border-white/10 text-xs font-medium text-slate-400 dark:text-slate-500">
          <p>&copy; 2026 XpertPDF</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden md:py-4 md:pr-4">
        {/* Main Content Wrapper (Liquid Panel) */}
        <div className="flex-1 flex flex-col liquid-panel overflow-hidden md:rounded-[24px]">
          {/* Header */}
          <header className="h-20 shrink-0 bg-white/30 dark:bg-black/20 border-b border-black/5 dark:border-white/10 flex items-center px-4 md:px-8 z-10 gap-4">
            <button 
              className="md:hidden liquid-btn-secondary p-2 rounded-xl"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            </button>
            {activeTool !== 'dashboard' && (
              <button 
                className="liquid-btn-secondary p-2 rounded-xl"
                onClick={() => changeTool('dashboard')}
              >
                <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              </button>
            )}
            <h1 className="text-xl font-semibold text-slate-800 dark:text-white">
              {navItems.find(i => i.id === activeTool)?.label}
            </h1>
          </header>

          {/* Dynamic Content */}
          <div className="flex-1 overflow-auto relative p-4 md:p-8 custom-scrollbar">
            <div className="max-w-5xl mx-auto min-h-full flex flex-col">
              {activeTool === 'dashboard' && <Dashboard setActiveTool={changeTool} language={language} />}
              {activeTool === 'viewer' && <ViewerTool />}
              {activeTool === 'extract-images' && <ExtractImagesTool />}
              {activeTool === 'pdf-to-image' && <PdfToImageTool />}
              {activeTool === 'merge' && <MergeTool />}
              {activeTool === 'sign' && <SignTool />}
              {activeTool === 'scan' && <ScanTool />}
              {activeTool === 'settings' && <SettingsTool currentTheme={theme} setTheme={handleSetTheme} currentFont={font} setFont={handleSetFont} language={language} setLanguage={handleSetLanguage} />}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Dashboard({ setActiveTool, language }: { setActiveTool: (t: ToolType) => void, language: string }) {
  const tools = [
    { id: 'viewer', title: t(language, 'viewer'), icon: BookOpen, color: 'text-sky-600', bg: 'bg-sky-100' },
    { id: 'extract-images', title: t(language, 'extractImages'), icon: Images, color: 'text-purple-600', bg: 'bg-purple-100' },
    { id: 'pdf-to-image', title: t(language, 'pdfToImage'), icon: FileImage, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { id: 'merge', title: t(language, 'merge'), icon: Merge, color: 'text-amber-600', bg: 'bg-amber-100' },
    { id: 'sign', title: t(language, 'sign'), icon: PenTool, color: 'text-rose-600', bg: 'bg-rose-100' },
    { id: 'scan', title: t(language, 'scan'), icon: Scan, color: 'text-indigo-600', bg: 'bg-indigo-100' },
  ] as const;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <div 
              key={tool.id}
              onClick={() => setActiveTool(tool.id as ToolType)}
              className="group flex flex-col items-center cursor-pointer transition-all duration-300"
            >
              <div className="w-20 h-20 bg-white/40 dark:bg-black/20 border border-black/5 dark:border-white/10 flex items-center justify-center rounded-[24px] mb-3 group-hover:-translate-y-1 group-hover:scale-105 group-hover:shadow-lg group-hover:bg-white/60 dark:group-hover:bg-white/5 transition-all duration-300 relative overflow-hidden">
                 <div className={`absolute inset-0 opacity-10 dark:opacity-20 ${tool.bg}`}></div>
                 <Icon className={`w-8 h-8 ${tool.color} relative z-10`} />
              </div>
              <h3 className="text-[13px] sm:text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors text-center">{tool.title}</h3>
            </div>
          );
        })}
      </div>
    </div>
  );
}

