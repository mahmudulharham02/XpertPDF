import React, { useState } from 'react';
import { Palette, Type, Moon, Sun, Droplet, Globe, Folder, FolderOpen, ChevronDown } from 'lucide-react';
import { t } from '../../lib/i18n';

export function SettingsTool({ 
  currentTheme, 
  setTheme, 
  currentFont, 
  setFont,
  language,
  setLanguage
}: { 
  currentTheme: string, 
  setTheme: (t: string) => void,
  currentFont: string,
  setFont: (f: string) => void,
  language: string,
  setLanguage: (l: string) => void
}) {

  const [activeFolder, setActiveFolder] = useState<string>('');

  const toggleFolder = (folder: string) => {
    setActiveFolder(prev => prev === folder ? '' : folder);
  };

  const themes = [
    { id: 'light', name: 'Default Light', icon: Sun, color: 'bg-white border-slate-200 text-slate-900', p: 'bg-indigo-600' },
    { id: 'pitch-dark', name: 'Pitch Dark', icon: Moon, color: 'bg-black border-zinc-800 text-white', p: 'bg-indigo-500' },
    { id: 'ocean', name: 'Ocean Blue', icon: Droplet, color: 'bg-sky-50 border-sky-200 text-slate-900', p: 'bg-sky-600' },
    { id: 'rose', name: 'Rose Red', icon: Droplet, color: 'bg-rose-50 border-rose-200 text-slate-900', p: 'bg-rose-600' }
  ];

  const fonts = [
    { id: 'sans', name: 'System Sans' },
    { id: 'arial', name: 'Arial' },
    { id: 'georgia', name: 'Georgia' },
    { id: 'courier', name: 'Courier New' }
  ];

  const languages = [
    { id: 'binary', name: '01010010 01100101 01100001 (Binary)' },
    { id: 'en', name: 'English' },
    { id: 'fr', name: 'French' },
    { id: 'pt', name: 'Portuguese' },
    { id: 'bn', name: 'Bangla' },
    { id: 'hi', name: 'Hindi' },
    { id: 'ar', name: 'Arabic' },
    { id: 'es', name: 'Spanish' },
    { id: 'zh', name: 'Chinese' },
    { id: 'zh-TW', name: 'Chinese Traditional' },
    { id: 'ja', name: 'Japanese' },
    { id: 'ko', name: 'Korean' },
    { id: 'vi', name: 'Vietnamese' },
    { id: 'ru', name: 'Russian' }
  ];

  return (
    <div className="flex-1 flex flex-col pt-4 animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-4xl mx-auto w-full">
      <div className="liquid-panel rounded-[24px] flex flex-col p-6 lg:p-10 shadow-lg shadow-black/5">
        
        <div className="mb-8 border-b border-black/5 dark:border-white/10 pb-6">
           <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-[12px] flex items-center justify-center shadow-inner">
                <Palette className="w-5 h-5 text-indigo-500" />
             </div>
             {t(language, 'settings')}
           </h2>
           <p className="text-slate-500 dark:text-slate-400 font-medium">Customize the look and feel of your workspace.</p>
        </div>

        <div className="space-y-4">
          
          {/* Theme Folder */}
          <div className="bg-white/60 dark:bg-black/40 border border-black/5 dark:border-white/10 rounded-[20px] overflow-hidden transition-all duration-300">
            <button 
              onClick={() => toggleFolder('themes')}
              className="w-full hover:bg-white/60 dark:hover:bg-white/5 p-5 flex items-center justify-between text-left transition-colors"
            >
              <div className="flex items-center gap-3">
                {activeFolder === 'themes' ? <FolderOpen className="w-6 h-6 text-indigo-500" /> : <Folder className="w-6 h-6 text-slate-400 dark:text-slate-500" />}
                <span className="text-lg font-bold text-slate-700 dark:text-slate-200">{t(language, 'themes')}</span>
              </div>
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${activeFolder === 'themes' ? 'rotate-180' : ''}`} />
            </button>
            <div className={`grid transition-all duration-300 ${activeFolder === 'themes' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden">
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-transparent border-t border-black/5 dark:border-white/10">
                   {themes.map(theme => {
                     const Icon = theme.icon;
                     const isActive = currentTheme === theme.id;
                     return (
                       <button
                         key={theme.id}
                         onClick={() => setTheme(theme.id)}
                         className={`flex flex-col items-start p-4 rounded-[16px] transition-all duration-300 ${
                           isActive ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-indigo-500 border border-transparent shadow-md' : 'liquid-btn-secondary'
                         }`}
                       >
                         <div className={`w-full h-20 rounded-lg mb-3 border flex flex-col ${theme.color} overflow-hidden`}>
                            <div className="h-6 w-full border-b border-inherit px-2 flex items-center gap-1 opacity-70">
                               <div className="w-2 h-2 rounded-full bg-current opacity-50"></div>
                               <div className="w-2 h-2 rounded-full bg-current opacity-50"></div>
                               <div className="w-2 h-2 rounded-full bg-current opacity-50"></div>
                            </div>
                            <div className="flex-1 p-2 flex items-center justify-center">
                               <div className={`w-12 h-6 ${theme.p} rounded-md`}></div>
                            </div>
                         </div>
                         <div className="flex items-center gap-2 mt-4">
                           <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`} />
                           <span className={`font-bold text-sm ${isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                             {theme.name}
                           </span>
                         </div>
                       </button>
                     );
                   })}
                </div>
              </div>
            </div>
          </div>

          {/* Typography Folder */}
          <div className="bg-white/60 dark:bg-black/40 border border-black/5 dark:border-white/10 rounded-[20px] overflow-hidden transition-all duration-300">
            <button 
              onClick={() => toggleFolder('typography')}
              className="w-full hover:bg-white/60 dark:hover:bg-white/5 p-5 flex items-center justify-between text-left transition-colors"
            >
              <div className="flex items-center gap-3">
                {activeFolder === 'typography' ? <FolderOpen className="w-6 h-6 text-indigo-500" /> : <Folder className="w-6 h-6 text-slate-400 dark:text-slate-500" />}
                <span className="text-lg font-bold text-slate-700 dark:text-slate-200">Typography</span>
              </div>
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${activeFolder === 'typography' ? 'rotate-180' : ''}`} />
            </button>
            <div className={`grid transition-all duration-300 ${activeFolder === 'typography' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden">
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-transparent border-t border-black/5 dark:border-white/10">
                   {fonts.map(font => {
                     const isActive = currentFont === font.id;
                     return (
                       <button
                         key={font.id}
                         onClick={() => setFont(font.id)}
                         className={`flex items-center justify-between p-4 rounded-[16px] transition-all duration-300 ${
                           isActive ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-indigo-500 border border-transparent shadow-md text-indigo-900 dark:text-indigo-100' : 'liquid-btn-secondary text-slate-700 dark:text-slate-300'
                         }`}
                       >
                         <span className="text-lg" style={{ fontFamily: font.id === 'sans' ? 'sans-serif' : font.name }}>
                           {font.name}
                         </span>
                         {isActive && (
                           <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
                         )}
                       </button>
                     );
                   })}
                </div>
              </div>
            </div>
          </div>

          {/* Language Folder */}
          <div className="bg-white/60 dark:bg-black/40 border border-black/5 dark:border-white/10 rounded-[20px] overflow-hidden transition-all duration-300">
            <button 
              onClick={() => toggleFolder('language')}
              className="w-full hover:bg-white/60 dark:hover:bg-white/5 p-5 flex items-center justify-between text-left transition-colors"
            >
              <div className="flex items-center gap-3">
                {activeFolder === 'language' ? <FolderOpen className="w-6 h-6 text-indigo-500" /> : <Folder className="w-6 h-6 text-slate-400 dark:text-slate-500" />}
                <span className="text-lg font-bold text-slate-700 dark:text-slate-200">{t(language, 'languageOptions')}</span>
              </div>
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${activeFolder === 'language' ? 'rotate-180' : ''}`} />
            </button>
            <div className={`grid transition-all duration-300 ${activeFolder === 'language' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden">
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-transparent border-t border-black/5 dark:border-white/10">
                   {languages.map(lang => (
                     <button
                       key={lang.id}
                       onClick={() => setLanguage(lang.id)}
                       className={`flex items-center justify-between p-4 rounded-[16px] transition-all duration-300 ${
                           language === lang.id ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-indigo-500 border border-transparent shadow-md text-indigo-900 dark:text-indigo-100' : 'liquid-btn-secondary text-slate-700 dark:text-slate-300'
                        }`}
                     >
                       <span className="text-sm font-medium">{lang.name}</span>
                     </button>
                   ))}
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}


