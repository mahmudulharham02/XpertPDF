import React from 'react';
import { Palette, Type, Moon, Sun, Droplet } from 'lucide-react';

export function SettingsTool({ 
  currentTheme, 
  setTheme, 
  currentFont, 
  setFont 
}: { 
  currentTheme: string, 
  setTheme: (t: string) => void,
  currentFont: string,
  setFont: (f: string) => void
}) {

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

  return (
    <div className="flex-1 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col p-6 lg:p-10">
        
        <div className="mb-8">
           <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-2">
             <Palette className="w-6 h-6 text-indigo-600" />
             Appearance Settings
           </h2>
           <p className="text-slate-500">Customize the look and feel of your workspace.</p>
        </div>

        <div className="space-y-10">
          
          {/* Theme Selection */}
          <section>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              Theme Mode
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
               {themes.map(theme => {
                 const Icon = theme.icon;
                 const isActive = currentTheme === theme.id;
                 return (
                   <button
                     key={theme.id}
                     onClick={() => setTheme(theme.id)}
                     className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all ${
                       isActive ? 'border-indigo-600 ring-2 ring-indigo-600/20' : 'border-slate-200 hover:border-slate-300'
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
                     <div className="flex items-center gap-2">
                       <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-500'}`} />
                       <span className={`font-medium ${isActive ? 'text-indigo-700' : 'text-slate-700'}`}>
                         {theme.name}
                       </span>
                     </div>
                   </button>
                 );
               })}
            </div>
          </section>

          {/* Font Selection */}
          <section>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Type className="w-5 h-5" />
              Typography
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {fonts.map(font => {
                 const isActive = currentFont === font.id;
                 return (
                   <button
                     key={font.id}
                     onClick={() => setFont(font.id)}
                     className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                       isActive ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
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
          </section>

        </div>

      </div>
    </div>
  );
}
